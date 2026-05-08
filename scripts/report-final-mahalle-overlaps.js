#!/usr/bin/env node

import polygonClipping from 'polygon-clipping';
import { paths, readJson, toNameAscii, writeJson } from './lib/pipeline.js';

const WARNING_RATIO = 0.45;
const HIGH_RATIO = 0.8;
const AUTO_FIX_INNER_RATIO = 0.8;
const AUTO_FIX_OUTER_RATIO_MAX = 0.4;

const mahalleGeojson = readJson(`${paths.distGeojsonDir}/mahalle-geometrileri.geojson`);
const districts = readJson(`${paths.distJsonDir}/districts.json`);
const provinces = readJson(`${paths.distJsonDir}/provinces.json`);
const municipalityTypes = readJson(paths.provinceMunicipalityTypes);

const districtById = new Map(districts.map((district) => [district.id, district]));
const provinceById = new Map(provinces.map((province) => [province.id, province]));
const municipalityTypeByPlate = new Map(municipalityTypes.provinces.map((province) => {
  const type = municipalityTypes.types[province.municipality_type];
  return [province.plate_code, {
    municipality_type: province.municipality_type,
    municipality_type_label: type.label,
    is_metropolitan_municipality: Boolean(type.is_metropolitan_municipality),
  }];
}));

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
    for (const hole of polygon.slice(1)) {
      total -= ringArea(hole);
    }
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
    left
    && right
    && left[0] <= right[2]
    && left[2] >= right[0]
    && left[1] <= right[3]
    && left[3] >= right[1],
  );
}

function isOsbFeature(feature) {
  const text = `${feature.properties.name || ''} ${feature.properties.source_raw_name || ''}`;
  return /\bosb\b/i.test(toNameAscii(text));
}

function featureSummary(feature) {
  return {
    id: feature.properties.id,
    name: feature.properties.name,
    type: feature.properties.type,
    source_only: Boolean(feature.properties.source_only),
    source_raw_name: feature.properties.source_raw_name,
    geometry_repair: feature.properties.geometry_repair || null,
  };
}

function classifyPair(left, right, leftInsideRightRatio, rightInsideLeftRatio) {
  const sameName = toNameAscii(left.properties.name || '') === toNameAscii(right.properties.name || '');
  const hasSourceOnly = Boolean(left.properties.source_only || right.properties.source_only);
  const hasOsb = isOsbFeature(left) || isOsbFeature(right);
  const leftInsideRight = leftInsideRightRatio >= AUTO_FIX_INNER_RATIO && rightInsideLeftRatio <= AUTO_FIX_OUTER_RATIO_MAX;
  const rightInsideLeft = rightInsideLeftRatio >= AUTO_FIX_INNER_RATIO && leftInsideRightRatio <= AUTO_FIX_OUTER_RATIO_MAX;

  if (sameName && hasSourceOnly) return 'duplicate_source_only';
  if (hasOsb) return 'manual_review_osb';
  if (leftInsideRight || rightInsideLeft) return 'auto_fixable_outer_minus_inner';
  if (Math.max(leftInsideRightRatio, rightInsideLeftRatio) >= HIGH_RATIO) return 'manual_review_high_overlap';
  return 'manual_review_overlap';
}

function repairCandidate(pair) {
  if (pair.classification !== 'auto_fixable_outer_minus_inner') return null;
  const leftIsInner = pair.left_inside_right_ratio >= AUTO_FIX_INNER_RATIO;
  const outer = leftIsInner ? pair.right : pair.left;
  const inner = leftIsInner ? pair.left : pair.right;
  return {
    province_id: pair.province_id,
    province_name: pair.province_name,
    district_id: pair.district_id,
    district_name: pair.district_name,
    outer_id: outer.id,
    outer_name: outer.name,
    inner_id: inner.id,
    inner_name: inner.name,
    confidence: Number(pair.overlap_ratio.toFixed(2)),
    reason: `${inner.name}, ${outer.name} siniri icinde ayri yerlesim olarak gorunuyor; dis polygon ic yerlesim alanini kapsadigi icin cikarilabilir.`,
  };
}

function groupByDistrict(features) {
  const groups = new Map();
  for (const feature of features) {
    const districtId = feature.properties.district_id || feature.properties.parent_id;
    const district = districtById.get(districtId);
    if (!district) continue;
    feature._bbox = geometryBbox(feature.geometry);
    feature._area = geometryArea(feature.geometry);
    if (!feature._bbox || !feature._area) continue;
    if (!groups.has(districtId)) {
      const province = provinceById.get(district.parent_id) || provinceById.get(feature.properties.province_id);
      const plateCode = province?.plate_code || feature.properties.province_id?.slice(-2);
      groups.set(districtId, {
        district,
        province,
        plate_code: plateCode,
        municipality: municipalityTypeByPlate.get(plateCode),
        features: [],
      });
    }
    groups.get(districtId).features.push(feature);
  }
  return groups;
}

function findDistrictPairs(group) {
  const pairs = [];
  const features = [...group.features].sort((left, right) => left._bbox[0] - right._bbox[0]);
  for (let leftIndex = 0; leftIndex < features.length; leftIndex += 1) {
    const left = features[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < features.length; rightIndex += 1) {
      const right = features[rightIndex];
      if (right._bbox[0] > left._bbox[2]) break;
      if (!bboxIntersects(left._bbox, right._bbox)) continue;

      const area = intersectionArea(left.geometry, right.geometry);
      if (area <= 0) continue;

      const leftInsideRightRatio = area / left._area;
      const rightInsideLeftRatio = area / right._area;
      const overlapRatio = Math.max(leftInsideRightRatio, rightInsideLeftRatio);
      if (overlapRatio < WARNING_RATIO) continue;

      const pair = {
        severity: overlapRatio >= HIGH_RATIO ? 'high' : 'warning',
        classification: null,
        overlap_ratio: Number(overlapRatio.toFixed(3)),
        left_inside_right_ratio: Number(leftInsideRightRatio.toFixed(3)),
        right_inside_left_ratio: Number(rightInsideLeftRatio.toFixed(3)),
        left: featureSummary(left),
        right: featureSummary(right),
      };
      pair.classification = classifyPair(left, right, leftInsideRightRatio, rightInsideLeftRatio);
      pairs.push(pair);
    }
  }
  return pairs.sort((left, right) => right.overlap_ratio - left.overlap_ratio);
}

const districtReports = [...groupByDistrict(mahalleGeojson.features).values()].map((group) => {
  const pairs = findDistrictPairs(group);
  const repairCandidates = pairs
    .map((pair) => repairCandidate({
      ...pair,
      province_id: group.province.id,
      province_name: group.province.name,
      district_id: group.district.id,
      district_name: group.district.name,
    }))
    .filter(Boolean);

  return {
    province_id: group.province.id,
    province_name: group.province.name,
    plate_code: group.plate_code,
    district_id: group.district.id,
    district_name: group.district.name,
    ...group.municipality,
    feature_count: group.features.length,
    overlap_pair_count: pairs.length,
    high_overlap_pair_count: pairs.filter((pair) => pair.severity === 'high').length,
    auto_fixable_count: repairCandidates.length,
    duplicate_source_only_count: pairs.filter((pair) => pair.classification === 'duplicate_source_only').length,
    manual_review_count: pairs.filter((pair) => pair.classification.startsWith('manual_review')).length,
    repair_candidates: repairCandidates,
    overlaps: pairs,
  };
}).filter((district) => district.overlap_pair_count > 0);

districtReports.sort((left, right) => `${left.plate_code}|${left.district_name}`.localeCompare(`${right.plate_code}|${right.district_name}`, 'tr'));

const report = {
  generated_at: new Date().toISOString(),
  method: 'Exact polygon intersection scan over final dist/geojson/mahalle-geometrileri.geojson output.',
  warning_ratio: WARNING_RATIO,
  high_ratio: HIGH_RATIO,
  district_count: new Set(mahalleGeojson.features.map((feature) => feature.properties.district_id)).size,
  feature_count: mahalleGeojson.features.length,
  totals: {
    district_with_overlap_count: districtReports.length,
    overlap_pair_count: districtReports.reduce((sum, district) => sum + district.overlap_pair_count, 0),
    high_overlap_pair_count: districtReports.reduce((sum, district) => sum + district.high_overlap_pair_count, 0),
    auto_fixable_count: districtReports.reduce((sum, district) => sum + district.auto_fixable_count, 0),
    duplicate_source_only_count: districtReports.reduce((sum, district) => sum + district.duplicate_source_only_count, 0),
    manual_review_count: districtReports.reduce((sum, district) => sum + district.manual_review_count, 0),
  },
  districts: districtReports,
};

const repairCandidateSummary = {
  generated_at: report.generated_at,
  source_report: 'data/processed/final-mahalle-overlap-report.json',
  method: 'Flat list of final dist overlap pairs classified as auto_fixable_outer_minus_inner. Manual-review overlaps are intentionally excluded.',
  candidate_count: report.totals.auto_fixable_count,
  districts_with_candidate_count: districtReports.filter((district) => district.auto_fixable_count > 0).length,
  candidates: districtReports.flatMap((district) => district.repair_candidates.map((candidate) => ({
    ...candidate,
    classification: 'auto_fixable_outer_minus_inner',
  }))),
};

const outPath = `${paths.processedDir}/final-mahalle-overlap-report.json`;
writeJson(outPath, report);

const candidateOutPath = `${paths.processedDir}/final-mahalle-overlap-candidates.json`;
writeJson(candidateOutPath, repairCandidateSummary);

console.log(`Final overlap report written: ${outPath}`);
console.log(`Final overlap candidates written: ${candidateOutPath}`);
console.log(`Districts with overlap: ${report.totals.district_with_overlap_count}`);
console.log(`Pairs: ${report.totals.overlap_pair_count}`);
console.log(`High: ${report.totals.high_overlap_pair_count}`);
console.log(`Auto-fixable: ${report.totals.auto_fixable_count}`);
console.log(`Manual review: ${report.totals.manual_review_count}`);
