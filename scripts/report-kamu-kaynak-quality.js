#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { paths, readJson, toNameAscii, writeJson } from './lib/pipeline.js';

const yerlesimDir = path.join(paths.rootDir, 'source', 'kamu-kaynak', 'yerlesim');
const FAR_MULTIPOLYGON_DISTANCE_KM = 10;
const SOURCE_ONLY_OVERLAP_WARNING_RATIO = 0.5;
const SOURCE_ONLY_OVERLAP_HIGH_RATIO = 0.8;
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
  const root = yerlesimDir;
  if (!fs.existsSync(root)) {
    return [];
  }
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{2}-/.test(entry.name))
    .map((entry) => path.join(root, entry.name))
    .filter((dir) => (
      fs.existsSync(path.join(dir, 'yerlesim-geometrileri.geojson'))
      || fs.existsSync(path.join(dir, 'mahalle-geometrileri.geojson'))
    ));
}

function buildMulkiIndex() {
  const settlements = readJson(path.join(paths.distJsonDir, 'yerlesimler.json'));
  const byProvinceDistrict = new Map();

  for (const settlement of settlements) {
    const plateCode = settlement.province_id?.replace('TR-P-', '');
    const districtKey = `${plateCode}|${toNameAscii(settlement.district_name || '')}`;
    const compactDistrictKey = `${plateCode}|${toNameAscii(settlement.district_name || '').replaceAll(/\s+/g, '')}`;
    if (!byProvinceDistrict.has(districtKey) && !byProvinceDistrict.has(compactDistrictKey)) {
      const record = {
        province_name: settlement.province_name,
        district_name: settlement.district_name,
        settlements: [],
      };
      byProvinceDistrict.set(districtKey, record);
      byProvinceDistrict.set(compactDistrictKey, record);
    }
    byProvinceDistrict.get(districtKey).settlements.push(settlement);
  }

  return byProvinceDistrict;
}

function groupFeatures(features) {
  const groups = new Map();
  for (const feature of features) {
    const plateCode = String(feature.properties.il_id).padStart(2, '0');
    const districtKey = `${plateCode}|${toNameAscii(feature.properties.ilce_adi || '')}`;
    if (!groups.has(districtKey)) {
      groups.set(districtKey, {
        plate_code: plateCode,
        province_name: feature.properties.il_adi,
        district_name: feature.properties.ilce_adi,
        features: [],
      });
    }
    groups.get(districtKey).features.push(feature);
  }
  return groups;
}

function namesByKey(items, nameGetter) {
  const map = new Map();
  for (const item of items) {
    const key = toNameAscii(nameGetter(item) || '');
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(item);
  }
  return map;
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

function bboxIntersects(a, b) {
  return Boolean(a && b && a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]);
}

function distanceKm(a, b) {
  const avgLat = ((a[1] + b[1]) / 2) * Math.PI / 180;
  const kmPerLon = Math.max(1, Math.cos(avgLat) * 111.32);
  const dx = (a[0] - b[0]) * kmPerLon;
  const dy = (a[1] - b[1]) * 110.57;
  return Math.sqrt(dx * dx + dy * dy);
}

function polygonPartSummaries(geometry) {
  return geometryPolygons(geometry)
    .map((polygon, index) => {
      const bbox = geometryBbox({ type: 'Polygon', coordinates: polygon });
      return bbox ? {
        part: index + 1,
        bbox: bbox.map((value) => Number(value.toFixed(6))),
        center: bboxCenter(bbox).map((value) => Number(value.toFixed(6))),
      } : null;
    })
    .filter(Boolean);
}

function maxPartDistanceKm(parts) {
  let maxDistance = 0;
  for (let left = 0; left < parts.length; left += 1) {
    for (let right = left + 1; right < parts.length; right += 1) {
      maxDistance = Math.max(maxDistance, distanceKm(parts[left].center, parts[right].center));
    }
  }
  return maxDistance;
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

function sampleGeometryPoints(geometry, targetCount = 24) {
  const samples = [];
  for (const polygon of geometryPolygons(geometry)) {
    const outerRing = polygon[0] || [];
    if (outerRing.length === 0) {
      continue;
    }
    const step = Math.max(1, Math.floor(outerRing.length / targetCount));
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
  if (!bboxIntersects(geometryBbox(sourceFeature.geometry), geometryBbox(targetFeature.geometry))) {
    return 0;
  }
  const samples = sampleGeometryPoints(sourceFeature.geometry);
  if (samples.length === 0) {
    return 0;
  }
  const insideCount = samples.filter((point) => pointInGeometry(point, targetFeature.geometry)).length;
  return insideCount / samples.length;
}

function buildGeometryWarnings(group, mulkiByName) {
  const warnings = [];

  for (const feature of group.features) {
    const parts = polygonPartSummaries(feature.geometry);
    const maxDistance = maxPartDistanceKm(parts);
    if (parts.length > 1 && maxDistance >= FAR_MULTIPOLYGON_DISTANCE_KM) {
      warnings.push({
        code: 'far_multipolygon',
        severity: maxDistance >= 25 ? 'high' : 'warning',
        name: feature.properties.mahalle_adi,
        mahalle_id: feature.properties.mahalle_id,
        polygon_count: parts.length,
        max_part_distance_km: Number(maxDistance.toFixed(1)),
        parts,
      });
    }
  }

  const sourceOnlyFeatures = group.features.filter((feature) => (
    !mulkiByName.has(toNameAscii(feature.properties.mahalle_adi || ''))
  ));
  const matchedFeatures = group.features.filter((feature) => (
    mulkiByName.has(toNameAscii(feature.properties.mahalle_adi || ''))
  ));

  for (const sourceOnly of sourceOnlyFeatures) {
    const overlaps = matchedFeatures
      .map((matched) => {
        const sourceInsideMatchedRatio = overlapSampleRatio(sourceOnly, matched);
        const matchedInsideSourceRatio = overlapSampleRatio(matched, sourceOnly);
        return {
          name: matched.properties.mahalle_adi,
          mahalle_id: matched.properties.mahalle_id,
          overlap_ratio: Math.max(sourceInsideMatchedRatio, matchedInsideSourceRatio),
          source_inside_matched_ratio: sourceInsideMatchedRatio,
          matched_inside_source_ratio: matchedInsideSourceRatio,
        };
      })
      .filter((overlap) => overlap.overlap_ratio >= SOURCE_ONLY_OVERLAP_WARNING_RATIO)
      .sort((a, b) => b.overlap_ratio - a.overlap_ratio)
      .slice(0, 10)
      .map((overlap) => ({
        ...overlap,
        overlap_ratio: Number(overlap.overlap_ratio.toFixed(2)),
        source_inside_matched_ratio: Number(overlap.source_inside_matched_ratio.toFixed(2)),
        matched_inside_source_ratio: Number(overlap.matched_inside_source_ratio.toFixed(2)),
      }));

    if (overlaps.length > 0) {
      const highestRatio = overlaps[0].overlap_ratio;
      warnings.push({
        code: 'source_only_overlap',
        severity: highestRatio >= SOURCE_ONLY_OVERLAP_HIGH_RATIO ? 'high' : 'warning',
        name: sourceOnly.properties.mahalle_adi,
        mahalle_id: sourceOnly.properties.mahalle_id,
        source_only: true,
        overlapping_matched_features: overlaps,
      });
    }
  }

  return warnings;
}

function compareDistrict(group, mulkiIndex) {
  const districtNameKey = toNameAscii(group.district_name || '');
  const mulki = mulkiIndex.get(`${group.plate_code}|${districtNameKey}`)
    || mulkiIndex.get(`${group.plate_code}|${districtNameKey.replaceAll(/\s+/g, '')}`);
  const sourceByName = namesByKey(group.features, (feature) => feature.properties.mahalle_adi);
  const mulkiByName = namesByKey(mulki?.settlements || [], (settlement) => settlement.name);
  const duplicateSourceNames = [...sourceByName.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([name_key, items]) => ({
      name_key,
      count: items.length,
      names: items.map((feature) => feature.properties.mahalle_adi),
    }));
  const geometryTypes = group.features.reduce((acc, feature) => {
    acc[feature.geometry?.type || 'Unknown'] = (acc[feature.geometry?.type || 'Unknown'] || 0) + 1;
    return acc;
  }, {});

  const missingInBulut = [...mulkiByName.entries()]
    .filter(([key]) => !sourceByName.has(key))
    .map(([, items]) => items.map((item) => item.name))
    .flat()
    .sort((a, b) => a.localeCompare(b, 'tr'));
  const extraInSource = [...sourceByName.entries()]
    .filter(([key]) => !mulkiByName.has(key))
    .map(([, items]) => items.map((feature) => feature.properties.mahalle_adi))
    .flat()
    .sort((a, b) => a.localeCompare(b, 'tr'));
  const geometryWarnings = buildGeometryWarnings(group, mulkiByName);
  const warningCounts = geometryWarnings.reduce((acc, warning) => {
    acc[warning.code] = (acc[warning.code] || 0) + 1;
    return acc;
  }, {});

  return {
    plate_code: group.plate_code,
    province_name: group.province_name,
    ...municipalityTypeForPlate(group.plate_code),
    district_name: group.district_name,
    kamu_kaynak_count: group.features.length,
    mulki_count: mulki?.settlements.length ?? null,
    count_diff: mulki ? group.features.length - mulki.settlements.length : null,
    missing_in_kamu_kaynak_count: missingInBulut.length,
    extra_in_kamu_kaynak_count: extraInSource.length,
    duplicate_kamu_kaynak_name_count: duplicateSourceNames.length,
    quality_warning_count: geometryWarnings.length,
    quality_warning_counts: warningCounts,
    geometry_types: geometryTypes,
    missing_in_kamu_kaynak: missingInBulut,
    extra_in_kamu_kaynak: extraInSource,
    duplicate_kamu_kaynak_names: duplicateSourceNames,
    quality_warnings: geometryWarnings,
  };
}

const mulkiIndex = buildMulkiIndex();
const provinceReports = [];

for (const dir of getFetchedProvinceDirs()) {
  const geojsonPath = fs.existsSync(path.join(dir, 'yerlesim-geometrileri.geojson'))
    ? path.join(dir, 'yerlesim-geometrileri.geojson')
    : path.join(dir, 'mahalle-geometrileri.geojson');
  const geojson = readJson(geojsonPath);
  const groups = [...groupFeatures(geojson.features).values()];
  const districts = groups.map((group) => compareDistrict(group, mulkiIndex))
    .sort((a, b) => a.district_name.localeCompare(b.district_name, 'tr'));
  const provinceName = districts[0]?.province_name || path.basename(dir);
  const provinceReport = {
    dir: path.relative(paths.rootDir, dir).replaceAll('\\', '/'),
    plate_code: districts[0]?.plate_code || path.basename(dir).slice(0, 2),
    province_name: provinceName,
    ...municipalityTypeForPlate(districts[0]?.plate_code || path.basename(dir).slice(0, 2)),
    district_count: districts.length,
    kamu_kaynak_count: districts.reduce((sum, district) => sum + district.kamu_kaynak_count, 0),
    mulki_count: districts.reduce((sum, district) => sum + (district.mulki_count || 0), 0),
    count_diff: districts.reduce((sum, district) => sum + (district.count_diff || 0), 0),
    missing_in_kamu_kaynak_count: districts.reduce((sum, district) => sum + district.missing_in_kamu_kaynak_count, 0),
    extra_in_kamu_kaynak_count: districts.reduce((sum, district) => sum + district.extra_in_kamu_kaynak_count, 0),
    duplicate_kamu_kaynak_name_count: districts.reduce((sum, district) => sum + district.duplicate_kamu_kaynak_name_count, 0),
    quality_warning_count: districts.reduce((sum, district) => sum + district.quality_warning_count, 0),
    districts,
  };
  provinceReports.push(provinceReport);
}

provinceReports.sort((a, b) => a.plate_code.localeCompare(b.plate_code));

const report = {
  generated_at: new Date().toISOString(),
  province_count: provinceReports.length,
  totals: {
    kamu_kaynak_count: provinceReports.reduce((sum, province) => sum + province.kamu_kaynak_count, 0),
    mulki_count: provinceReports.reduce((sum, province) => sum + province.mulki_count, 0),
    count_diff: provinceReports.reduce((sum, province) => sum + province.count_diff, 0),
    missing_in_kamu_kaynak_count: provinceReports.reduce((sum, province) => sum + province.missing_in_kamu_kaynak_count, 0),
    extra_in_kamu_kaynak_count: provinceReports.reduce((sum, province) => sum + province.extra_in_kamu_kaynak_count, 0),
    duplicate_kamu_kaynak_name_count: provinceReports.reduce((sum, province) => sum + province.duplicate_kamu_kaynak_name_count, 0),
    quality_warning_count: provinceReports.reduce((sum, province) => sum + province.quality_warning_count, 0),
    far_multipolygon_count: provinceReports.reduce((sum, province) => sum + province.districts.reduce((districtSum, district) => districtSum + (district.quality_warning_counts.far_multipolygon || 0), 0), 0),
    source_only_overlap_count: provinceReports.reduce((sum, province) => sum + province.districts.reduce((districtSum, district) => districtSum + (district.quality_warning_counts.source_only_overlap || 0), 0), 0),
    buyuksehir_belediyesi_count: provinceReports.filter((province) => province.municipality_type === 'buyuksehir_belediyesi').length,
    il_belediyesi_count: provinceReports.filter((province) => province.municipality_type === 'il_belediyesi').length,
  },
  provinces: provinceReports,
};

const outPath = path.join(yerlesimDir, 'quality-report.json');
writeJson(outPath, report);

for (const province of provinceReports) {
  console.log(`${province.plate_code} ${province.province_name}: kamu kaynak ${province.kamu_kaynak_count}, Mulki ${province.mulki_count}, fark ${province.count_diff}, eksik ${province.missing_in_kamu_kaynak_count}, fazla ${province.extra_in_kamu_kaynak_count}, kalite uyarisi ${province.quality_warning_count}`);
}
console.log(`Rapor yazildi: ${outPath}`);
