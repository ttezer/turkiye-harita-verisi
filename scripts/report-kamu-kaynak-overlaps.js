#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { paths, readJson, writeJson } from './lib/pipeline.js';

const yerlesimDir = path.join(paths.rootDir, 'source', 'kamu-kaynak', 'yerlesim');
const outPath = path.join(yerlesimDir, 'overlap-report.json');
const OVERLAP_WARNING_RATIO = 0.5;
const OVERLAP_HIGH_RATIO = 0.8;
const SAMPLE_TARGET_PER_POLYGON = 8;
const municipalityTypes = readJson(paths.provinceMunicipalityTypes);
const municipalityTypesByPlate = new Map(municipalityTypes.provinces.map((province) => {
  const type = municipalityTypes.types[province.municipality_type];
  return [province.plate_code, {
    municipality_type: province.municipality_type,
    municipality_type_label: type.label,
    is_metropolitan_municipality: Boolean(type.is_metropolitan_municipality),
  }];
}));

function municipalityTypeForPlate(plateCode) {
  const municipalityType = municipalityTypesByPlate.get(plateCode);
  if (!municipalityType) {
    throw new Error(`Missing municipality type for province plate code ${plateCode}`);
  }
  return municipalityType;
}

function getFetchedProvinceDirs() {
  if (!fs.existsSync(yerlesimDir)) {
    return [];
  }

  return fs.readdirSync(yerlesimDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{2}-/.test(entry.name))
    .map((entry) => path.join(yerlesimDir, entry.name))
    .filter((dir) => fs.existsSync(path.join(dir, 'yerlesim-geometrileri.geojson')));
}

function geometryPolygons(geometry) {
  if (!geometry) {
    return [];
  }
  if (geometry.type === 'Polygon') {
    return [geometry.coordinates];
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates;
  }
  return [];
}

function geometryBbox(geometry) {
  const bbox = [Infinity, Infinity, -Infinity, -Infinity];
  const visit = (coordinates) => {
    if (!Array.isArray(coordinates)) {
      return;
    }
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

function bboxCenter(bbox) {
  return [
    (bbox[0] + bbox[2]) / 2,
    (bbox[1] + bbox[3]) / 2,
  ];
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

function pointInRing(point, ring) {
  let inside = false;
  const [x, y] = point;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const [xi, yi] = ring[index];
    const [xj, yj] = ring[previous];
    const intersects = ((yi > y) !== (yj > y))
      && (x < ((xj - xi) * (y - yi) / (yj - yi)) + xi);
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInPolygon(point, polygon) {
  return pointInRing(point, polygon[0] || [])
    && polygon.slice(1).every((hole) => !pointInRing(point, hole));
}

function pointInGeometry(point, geometry) {
  return geometryPolygons(geometry).some((polygon) => pointInPolygon(point, polygon));
}

function sampleGeometryPoints(geometry) {
  const samples = [];
  for (const polygon of geometryPolygons(geometry)) {
    const outerRing = polygon[0] || [];
    if (outerRing.length === 0) {
      continue;
    }

    const step = Math.max(1, Math.floor(outerRing.length / SAMPLE_TARGET_PER_POLYGON));
    for (let index = 0; index < outerRing.length; index += step) {
      samples.push(outerRing[index]);
    }

    const bbox = geometryBbox({ type: 'Polygon', coordinates: polygon });
    if (bbox) {
      samples.push(bboxCenter(bbox));
    }
  }
  return samples;
}

function overlapSampleRatio(sourceFeature, targetFeature) {
  if (!bboxIntersects(sourceFeature._bbox, targetFeature._bbox)) {
    return 0;
  }

  if (!sourceFeature._samples) {
    sourceFeature._samples = sampleGeometryPoints(sourceFeature.geometry);
  }
  if (sourceFeature._samples.length === 0) {
    return 0;
  }

  const insideCount = sourceFeature._samples
    .filter((point) => pointInGeometry(point, targetFeature.geometry))
    .length;
  return insideCount / sourceFeature._samples.length;
}

function groupFeatures(features) {
  const groups = new Map();
  for (const feature of features) {
    const properties = feature.properties || {};
    const plateCode = String(properties.il_id).padStart(2, '0');
    const districtKey = `${plateCode}|${properties.ilce_id}|${properties.ilce_adi}`;
    feature._bbox = geometryBbox(feature.geometry);
    if (!feature._bbox) {
      continue;
    }

    if (!groups.has(districtKey)) {
      groups.set(districtKey, {
        plate_code: plateCode,
        province_name: properties.il_adi,
        district_name: properties.ilce_adi,
        features: [],
      });
    }
    groups.get(districtKey).features.push(feature);
  }
  return groups;
}

function findDistrictOverlaps(group) {
  const overlaps = [];
  const features = [...group.features].sort((left, right) => left._bbox[0] - right._bbox[0]);

  for (let leftIndex = 0; leftIndex < features.length; leftIndex += 1) {
    const left = features[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < features.length; rightIndex += 1) {
      const right = features[rightIndex];
      if (right._bbox[0] > left._bbox[2]) {
        break;
      }
      if (!bboxIntersects(left._bbox, right._bbox)) {
        continue;
      }

      const leftInsideRight = overlapSampleRatio(left, right);
      const rightInsideLeft = overlapSampleRatio(right, left);
      const overlapRatio = Math.max(leftInsideRight, rightInsideLeft);
      if (overlapRatio < OVERLAP_WARNING_RATIO) {
        continue;
      }

      overlaps.push({
        severity: overlapRatio >= OVERLAP_HIGH_RATIO ? 'high' : 'warning',
        overlap_ratio: Number(overlapRatio.toFixed(2)),
        left_inside_right_ratio: Number(leftInsideRight.toFixed(2)),
        right_inside_left_ratio: Number(rightInsideLeft.toFixed(2)),
        left: {
          name: left.properties.mahalle_adi,
          mahalle_id: left.properties.mahalle_id,
        },
        right: {
          name: right.properties.mahalle_adi,
          mahalle_id: right.properties.mahalle_id,
        },
      });
    }
  }

  return overlaps.sort((left, right) => right.overlap_ratio - left.overlap_ratio);
}

const provinceReports = [];

for (const dir of getFetchedProvinceDirs()) {
  const geojson = JSON.parse(fs.readFileSync(path.join(dir, 'yerlesim-geometrileri.geojson'), 'utf8'));
  const districts = [...groupFeatures(geojson.features).values()]
    .map((group) => {
      const overlaps = findDistrictOverlaps(group);
      return {
        plate_code: group.plate_code,
        province_name: group.province_name,
        ...municipalityTypeForPlate(group.plate_code),
        district_name: group.district_name,
        feature_count: group.features.length,
        overlap_pair_count: overlaps.length,
        high_overlap_pair_count: overlaps.filter((item) => item.severity === 'high').length,
        overlaps,
      };
    })
    .sort((left, right) => left.district_name.localeCompare(right.district_name, 'tr'));

  provinceReports.push({
    dir: path.relative(paths.rootDir, dir).replaceAll('\\', '/'),
    plate_code: districts[0]?.plate_code || path.basename(dir).slice(0, 2),
    province_name: districts[0]?.province_name || path.basename(dir),
    ...municipalityTypeForPlate(districts[0]?.plate_code || path.basename(dir).slice(0, 2)),
    district_count: districts.length,
    feature_count: districts.reduce((sum, district) => sum + district.feature_count, 0),
    overlap_pair_count: districts.reduce((sum, district) => sum + district.overlap_pair_count, 0),
    high_overlap_pair_count: districts.reduce((sum, district) => sum + district.high_overlap_pair_count, 0),
    districts,
  });
}

provinceReports.sort((left, right) => left.plate_code.localeCompare(right.plate_code));

const report = {
  generated_at: new Date().toISOString(),
  method: 'Sample-based overlap scan; ratios are approximate and intended for data-quality triage.',
  overlap_warning_ratio: OVERLAP_WARNING_RATIO,
  overlap_high_ratio: OVERLAP_HIGH_RATIO,
  sample_target_per_polygon: SAMPLE_TARGET_PER_POLYGON,
  province_count: provinceReports.length,
  totals: {
    feature_count: provinceReports.reduce((sum, province) => sum + province.feature_count, 0),
    district_count: provinceReports.reduce((sum, province) => sum + province.district_count, 0),
    overlap_pair_count: provinceReports.reduce((sum, province) => sum + province.overlap_pair_count, 0),
    high_overlap_pair_count: provinceReports.reduce((sum, province) => sum + province.high_overlap_pair_count, 0),
    buyuksehir_belediyesi_count: provinceReports.filter((province) => province.municipality_type === 'buyuksehir_belediyesi').length,
    il_belediyesi_count: provinceReports.filter((province) => province.municipality_type === 'il_belediyesi').length,
  },
  provinces: provinceReports,
};

writeJson(outPath, report);

for (const province of provinceReports) {
  console.log(`${province.plate_code} ${province.province_name}: ${province.overlap_pair_count} supheli cakisma, ${province.high_overlap_pair_count} yuksek`);
}
console.log(`Rapor yazildi: ${outPath}`);
