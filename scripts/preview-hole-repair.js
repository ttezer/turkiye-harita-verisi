#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import polygonClipping from 'polygon-clipping';
import {
  paths,
  rewindGeometry,
  roundGeometryCoordinates,
  writeJson,
  writeJsonCompact,
} from './lib/pipeline.js';

const repairs = [
  {
    province_id: 'TR-P-48',
    province: 'MuÄŸla',
    district: 'Marmaris',
    outer_name: 'Bozburun',
    inner_name: 'YeÅŸilova',
    outer_id: 'TR-Y-48-007-M-0005',
    inner_id: 'TR-Y-48-007-M-0030',
    note: 'User-provided check pair; YeÅŸilova is inside/overlapping Bozburun in current geometry.',
  },
  {
    province_id: 'TR-P-48',
    province: 'MuÄŸla',
    district: 'Marmaris',
    outer_name: 'Armutalan',
    inner_name: 'Sinan',
    outer_id: 'TR-Y-48-007-M-0002',
    inner_id: 'TR-Y-48-007-M-0022',
    note: 'Overlap-report high pair; used to verify hole/difference repair on current geometry.',
  },
  {
    province_id: 'TR-P-54',
    province: 'Sakarya',
    district: 'Hendek',
    outer_name: 'Ã‡amlÄ±ca',
    inner_name: 'YeÅŸiller',
    outer_id: 'TR-Y-54-007-M-0018',
    inner_id: 'KK-Y-54-007-566299',
  },
];

const inputPath = path.join(paths.distGeojsonDir, 'mahalle-geometrileri.geojson');
const districtsPath = path.join(paths.distJsonDir, 'districts.json');
const outputPath = path.join(paths.rootDir, 'archive', 'kamu-kaynak', 'yerlesim', 'hole-repair-preview.geojson');
const reportPath = path.join(paths.rootDir, 'archive', 'kamu-kaynak', 'yerlesim', 'hole-repair-preview-report.json');
const byDistrictDir = path.join(paths.rootDir, 'archive', 'kamu-kaynak', 'yerlesim', 'hole-repair-preview-by-district');

function toMultiPolygonCoordinates(geometry) {
  if (geometry.type === 'Polygon') {
    return [geometry.coordinates];
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates;
  }
  throw new Error(`Unsupported geometry type: ${geometry.type}`);
}

function fromMultiPolygonCoordinates(coordinates) {
  if (!coordinates || coordinates.length === 0) {
    return null;
  }
  return coordinates.length === 1
    ? { type: 'Polygon', coordinates: coordinates[0] }
    : { type: 'MultiPolygon', coordinates };
}

function ringArea(ring) {
  let sum = 0;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    sum += (ring[previous][0] * ring[index][1]) - (ring[index][0] * ring[previous][1]);
  }
  return Math.abs(sum / 2);
}

function geometryArea(geometry) {
  return toMultiPolygonCoordinates(geometry).reduce((sum, polygon) => {
    const outerArea = ringArea(polygon[0] || []);
    const holeArea = polygon.slice(1).reduce((holeSum, ring) => holeSum + ringArea(ring), 0);
    return sum + outerArea - holeArea;
  }, 0);
}

function polygonCount(geometry) {
  return toMultiPolygonCoordinates(geometry).length;
}

function holeCount(geometry) {
  return toMultiPolygonCoordinates(geometry).reduce((sum, polygon) => sum + Math.max(0, polygon.length - 1), 0);
}

function buildDistrictIndex() {
  const districts = JSON.parse(fs.readFileSync(districtsPath, 'utf8'));
  return new Map(districts.map((district) => [
    `${district.parent_id}|${district.name}`,
    district,
  ]));
}

function findFeature(features, repair, district, key) {
  const idKey = key === 'outer_name' ? 'outer_id' : 'inner_id';
  const feature = repair[idKey]
    ? features.find((item) => item.properties.id === repair[idKey])
    : features.find((item) => (
      item.properties.province_id === district.parent_id
      && item.properties.district_id === district.id
      && item.properties.name === repair[key]
    ));
  if (!feature) {
    throw new Error(`Feature not found: ${repair.province} > ${repair.district} > ${repair[key]}`);
  }
  return feature;
}

const collection = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const districtIndex = buildDistrictIndex();
const features = collection.features.map((feature) => ({
  ...feature,
  properties: { ...feature.properties },
  geometry: JSON.parse(JSON.stringify(feature.geometry)),
}));

const report = {
  generated_at: new Date().toISOString(),
  input: path.relative(paths.rootDir, inputPath).replaceAll('\\', '/'),
  output: path.relative(paths.rootDir, outputPath).replaceAll('\\', '/'),
  method: 'polygon-clipping difference; preview only, source data is not modified.',
  repairs: [],
};

for (const repair of repairs) {
  const district = districtIndex.get(`${repair.province_id}|${repair.district}`);
  if (!district) {
    throw new Error(`District not found: ${repair.province} > ${repair.district}`);
  }

  const outer = findFeature(features, repair, district, 'outer_name');
  const inner = findFeature(features, repair, district, 'inner_name');
  const beforeArea = geometryArea(outer.geometry);
  const beforeHoles = holeCount(outer.geometry);
  const beforePolygonCount = polygonCount(outer.geometry);
  const difference = polygonClipping.difference(
    toMultiPolygonCoordinates(outer.geometry),
    toMultiPolygonCoordinates(inner.geometry),
  );
  const repairedGeometry = fromMultiPolygonCoordinates(difference);
  if (!repairedGeometry) {
    throw new Error(`Repair removed full geometry: ${repair.province} > ${repair.district} > ${repair.outer_name}`);
  }

  outer.geometry = roundGeometryCoordinates(rewindGeometry(repairedGeometry), 6);
  outer.properties.hole_repair_preview = true;
  outer.properties.hole_repair_removed_inner_name = repair.inner_name;
  outer.properties.hole_repair_method = 'difference';

  const afterArea = geometryArea(outer.geometry);
  report.repairs.push({
    ...repair,
    outer_id: outer.properties.id,
    inner_id: inner.properties.id,
    district_id: district.id,
    before_polygon_count: beforePolygonCount,
    after_polygon_count: polygonCount(outer.geometry),
    before_hole_count: beforeHoles,
    after_hole_count: holeCount(outer.geometry),
    before_area_degrees: Number(beforeArea.toFixed(8)),
    after_area_degrees: Number(afterArea.toFixed(8)),
    removed_area_degrees: Number((beforeArea - afterArea).toFixed(8)),
  });
}

writeJsonCompact(outputPath, {
  ...collection,
  name: 'turkiye_map.preview.hole_repair',
  features,
});
for (const districtId of [...new Set(report.repairs.map((repair) => repair.district_id))]) {
  writeJsonCompact(
    path.join(byDistrictDir, `${districtId}.geojson`),
    {
      type: 'FeatureCollection',
      name: `turkiye_map.preview.hole_repair.${districtId}`,
      features: features.filter((feature) => feature.properties.district_id === districtId),
    },
  );
}
writeJson(reportPath, report);

console.log(`Preview yazildi: ${outputPath}`);
console.log(`Ilce preview klasoru: ${byDistrictDir}`);
console.log(`Rapor yazildi: ${reportPath}`);
