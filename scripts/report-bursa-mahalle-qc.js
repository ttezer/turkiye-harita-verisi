#!/usr/bin/env node

import polygonClipping from 'polygon-clipping';
import { paths, readJson, toNameAscii, writeJson } from './lib/pipeline.js';

const provinceId = 'TR-P-16';
const geojson = readJson(`${paths.distGeojsonDir}/mahalle-geometrileri.geojson`);
const settlements = readJson(`${paths.distJsonDir}/yerlesimler.json`);
const features = geojson.features.filter((feature) => feature.properties?.province_id === provinceId);
const officialMahalles = settlements.filter((settlement) => (
  settlement.province_id === provinceId && settlement.type === 'mahalle'
));

function idOf(feature) {
  return feature.properties.id || feature.properties.settlement_id;
}

function geometryToMultiPolygon(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}

function ringArea(ring) {
  let sum = 0;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    sum += (ring[previous][0] * ring[index][1]) - (ring[index][0] * ring[previous][1]);
  }
  return Math.abs(sum) / 2;
}

function multiPolygonArea(multiPolygon) {
  let total = 0;
  for (const polygon of multiPolygon || []) {
    if (!polygon?.length) continue;
    total += ringArea(polygon[0]);
    for (const hole of polygon.slice(1)) total -= ringArea(hole);
  }
  return Math.max(0, total);
}

function geometryArea(geometry) {
  return multiPolygonArea(geometryToMultiPolygon(geometry));
}

function intersectionArea(left, right) {
  try {
    return multiPolygonArea(polygonClipping.intersection(
      geometryToMultiPolygon(left),
      geometryToMultiPolygon(right),
    ));
  } catch {
    return 0;
  }
}

function geometryBbox(geometry) {
  const bbox = [Infinity, Infinity, -Infinity, -Infinity];
  const visit = (coordinates) => {
    if (!Array.isArray(coordinates)) return;
    if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
      bbox[0] = Math.min(bbox[0], coordinates[0]);
      bbox[1] = Math.min(bbox[1], coordinates[1]);
      bbox[2] = Math.max(bbox[2], coordinates[0]);
      bbox[3] = Math.max(bbox[3], coordinates[1]);
      return;
    }
    coordinates.forEach(visit);
  };
  visit(geometry?.coordinates);
  return bbox.every(Number.isFinite) ? bbox : null;
}

function bboxIntersects(left, right) {
  return Boolean(
    left && right
    && left[0] <= right[2]
    && left[2] >= right[0]
    && left[1] <= right[3]
    && left[3] >= right[1],
  );
}

function nameKey(value) {
  return toNameAscii(String(value || '')).replace(/[^a-z0-9]/g, '');
}

function summary(feature) {
  const properties = feature.properties;
  return {
    id: idOf(feature),
    district_id: properties.district_id,
    district_name: properties.district_name,
    name: properties.name,
    source_raw_name: properties.source_raw_name || null,
    type: properties.type,
    source_only: Boolean(properties.source_only || String(idOf(feature)).includes('-SRC-')),
  };
}

const prepared = features
  .map((feature) => ({
    feature,
    bbox: geometryBbox(feature.geometry),
    area: geometryArea(feature.geometry),
  }))
  .filter((item) => item.bbox && item.area > 0);

const sameNameGroups = new Map();
for (const feature of features) {
  const key = `${feature.properties.district_id}|${nameKey(feature.properties.name)}`;
  if (!sameNameGroups.has(key)) sameNameGroups.set(key, []);
  sameNameGroups.get(key).push(summary(feature));
}

const duplicateNames = [...sameNameGroups.entries()]
  .filter(([, group]) => group.length > 1)
  .map(([key, group]) => ({
    district_id: group[0].district_id,
    district_name: group[0].district_name,
    normalized_name: key.split('|')[1],
    records: group,
  }));

const geometryGroups = new Map();
for (const feature of features) {
  const key = JSON.stringify(feature.geometry);
  if (!geometryGroups.has(key)) geometryGroups.set(key, []);
  geometryGroups.get(key).push(summary(feature));
}

const exactDuplicateGeometries = [...geometryGroups.values()]
  .filter((group) => group.length > 1);

const positiveOverlaps = [];
for (let leftIndex = 0; leftIndex < prepared.length; leftIndex += 1) {
  const left = prepared[leftIndex];
  for (let rightIndex = leftIndex + 1; rightIndex < prepared.length; rightIndex += 1) {
    const right = prepared[rightIndex];
    if (left.feature.properties.district_id !== right.feature.properties.district_id) continue;
    if (!bboxIntersects(left.bbox, right.bbox)) continue;

    const area = intersectionArea(left.feature.geometry, right.feature.geometry);
    if (area <= 1e-12) continue;
    const leftRatio = area / left.area;
    const rightRatio = area / right.area;
    positiveOverlaps.push({
      district_id: left.feature.properties.district_id,
      district_name: left.feature.properties.district_name,
      overlap_area_degree2: Number(area.toPrecision(8)),
      left_ratio: Number(leftRatio.toPrecision(6)),
      right_ratio: Number(rightRatio.toPrecision(6)),
      same_name: nameKey(left.feature.properties.name) === nameKey(right.feature.properties.name),
      osb_involved: left.feature.properties.type === 'osb' || right.feature.properties.type === 'osb',
      left: summary(left.feature),
      right: summary(right.feature),
    });
  }
}

positiveOverlaps.sort((left, right) => Math.max(right.left_ratio, right.right_ratio) - Math.max(left.left_ratio, left.right_ratio));

const meaningfulOverlaps = positiveOverlaps.filter((pair) => Math.max(pair.left_ratio, pair.right_ratio) >= 0.001);

const featureIds = new Set(features.map(idOf));
const missingOfficial = officialMahalles
  .filter((settlement) => !featureIds.has(settlement.id))
  .map((settlement) => ({
    id: settlement.id,
    district_id: settlement.parent_id,
    district_name: settlement.district_name,
    name: settlement.name,
  }));

const sourceOnly = features
  .filter((feature) => Boolean(feature.properties.source_only || String(idOf(feature)).includes('-SRC-')))
  .map(summary);

const report = {
  generated_at: new Date().toISOString(),
  province_id: provinceId,
  province_name: 'Bursa',
  method: 'Final Bursa features; same-name groups, exact geometry duplicates, and every positive-area intersection are reported separately.',
  counts: {
    final_feature_count: features.length,
    final_mahalle_count: features.filter((feature) => feature.properties.type === 'mahalle').length,
    final_osb_count: features.filter((feature) => feature.properties.type === 'osb').length,
    official_mahalle_count: officialMahalles.length,
    source_only_count: sourceOnly.length,
    source_only_mahalle_count: sourceOnly.filter((feature) => feature.type === 'mahalle').length,
    source_only_osb_count: sourceOnly.filter((feature) => feature.type === 'osb').length,
    missing_official_count: missingOfficial.length,
  },
  checks: {
    duplicate_name_group_count: duplicateNames.length,
    exact_duplicate_geometry_group_count: exactDuplicateGeometries.length,
    positive_overlap_pair_count: positiveOverlaps.length,
    meaningful_overlap_pair_count: meaningfulOverlaps.length,
    blocking_mahalle_overlap_pair_count: positiveOverlaps.filter((pair) => !pair.osb_involved).length,
    meaningful_blocking_mahalle_overlap_pair_count: meaningfulOverlaps.filter((pair) => !pair.osb_involved).length,
    osb_involved_overlap_pair_count: positiveOverlaps.filter((pair) => pair.osb_involved).length,
  },
  duplicate_names: duplicateNames,
  exact_duplicate_geometries: exactDuplicateGeometries,
  meaningful_overlaps: meaningfulOverlaps,
  positive_overlaps: positiveOverlaps,
  source_only: sourceOnly,
  missing_official: missingOfficial,
};

const outPath = `${paths.processedDir}/bursa-mahalle-qc-report.json`;
writeJson(outPath, report);

console.log(`Bursa QC report written: ${outPath}`);
console.log(JSON.stringify({
  counts: report.counts,
  checks: report.checks,
}, null, 2));
