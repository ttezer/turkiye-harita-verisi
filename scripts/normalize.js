#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeBbox,
  ensureDir,
  getHdxLayerPaths,
  logStep,
  normalizeDisplayText,
  paths,
  readFeatureCollection,
  readJson,
  runPipelineStep,
  writeJson,
  toNameAscii,
} from './lib/pipeline.js';

const scriptPath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const KAMU_SOURCE = 'kamu-kaynak';
const HDX_SOURCE = 'hdx';

export function preferredName(properties, fallbackKey, turkishKey) {
  return normalizeDisplayText(properties[turkishKey] || properties[fallbackKey]);
}

export function normalizeProvince(feature) {
  const properties = feature.properties;
  const name = preferredName(properties, 'adm1_name', 'adm1_name1');

  return {
    source_hdx_id: properties.adm1_pcode,
    source_parent_hdx_id: null,
    source_valid_on: properties.valid_on,
    source_valid_to: properties.valid_to,
    source_version: properties.version,
    name,
    name_ascii: toNameAscii(name),
    plate_code: properties.adm1_pcode.slice(-3),
    centroid: {
      lat: properties.center_lat,
      lon: properties.center_lon,
    },
    bbox: computeBbox(feature.geometry),
    area_sqkm: properties.area_sqkm,
    geometry_type: feature.geometry.type,
  };
}

export function normalizeDistrict(feature) {
  const properties = feature.properties;
  const name = preferredName(properties, 'adm2_name', 'adm2_name1');
  const parentName = preferredName(properties, 'adm1_name', 'adm1_name1');

  return {
    source_hdx_id: properties.adm2_pcode,
    source_parent_hdx_id: properties.adm1_pcode,
    source_valid_on: properties.valid_on,
    source_valid_to: properties.valid_to,
    source_version: properties.version,
    name,
    name_ascii: toNameAscii(name),
    parent_name: parentName,
    parent_name_ascii: toNameAscii(parentName),
    centroid: {
      lat: properties.center_lat,
      lon: properties.center_lon,
    },
    bbox: computeBbox(feature.geometry),
    area_sqkm: properties.area_sqkm,
    geometry_type: feature.geometry.type,
  };
}

export function stripFeature(feature, level) {
  return {
    type: 'Feature',
    properties: {
      level,
      source_hdx_id: level === 'province' ? feature.properties.adm1_pcode : feature.properties.adm2_pcode,
      source_parent_hdx_id: level === 'province' ? null : feature.properties.adm1_pcode,
    },
    geometry: feature.geometry,
  };
}

function parseArgs(argv) {
  const args = {
    source: KAMU_SOURCE,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--source') {
      args.source = argv[++index];
    } else {
      throw new Error(`Bilinmeyen arguman: ${arg}`);
    }
  }

  if (![KAMU_SOURCE, HDX_SOURCE].includes(args.source)) {
    throw new Error('--source kamu-kaynak veya hdx olmali.');
  }

  return args;
}

function hdxProvinceSourceId(plateCode) {
  return `TUR${String(plateCode).padStart(3, '0')}`;
}

function hdxDistrictSourceId(plateCode, districtLocalCode) {
  return `${hdxProvinceSourceId(plateCode)}${districtLocalCode}`;
}

function geometryCentroidFromBbox(geometry) {
  const [minLon, minLat, maxLon, maxLat] = computeBbox(geometry);
  return {
    lat: Number(((minLat + maxLat) / 2).toFixed(8)),
    lon: Number(((minLon + maxLon) / 2).toFixed(8)),
  };
}

function districtNameKeys(plateCode, name) {
  const normalized = toNameAscii(name);
  return [
    `${plateCode}|${normalized}`,
    `${plateCode}|${normalized.replaceAll(/\s+/g, '')}`,
  ];
}

function createLegacyDistrictCodeIndex() {
  const { districtPath } = getHdxLayerPaths();
  const districtCollection = readFeatureCollection(districtPath);
  const byName = new Map();
  const usedCodesByPlate = new Map();

  for (const feature of districtCollection.features) {
    const district = normalizeDistrict(feature);
    const plateCode = String(Number(district.source_parent_hdx_id.slice(-3))).padStart(2, '0');
    const districtLocalCode = district.source_hdx_id.slice(-3);
    if (!usedCodesByPlate.has(plateCode)) {
      usedCodesByPlate.set(plateCode, new Set());
    }
    usedCodesByPlate.get(plateCode).add(districtLocalCode);
    for (const key of districtNameKeys(plateCode, district.name)) {
      if (!byName.has(key)) {
        byName.set(key, districtLocalCode);
      }
    }
    if (toNameAscii(district.name) === toNameAscii(district.parent_name)) {
      for (const key of districtNameKeys(plateCode, `${district.parent_name} Merkez`)) {
        if (!byName.has(key)) {
          byName.set(key, districtLocalCode);
        }
      }
    }
  }

  return { byName, usedCodesByPlate, assignedCodesByPlate: new Map() };
}

function nextDistrictLocalCode(plateCode, codeIndex) {
  const used = codeIndex.usedCodesByPlate.get(plateCode) || new Set();
  const assigned = codeIndex.assignedCodesByPlate.get(plateCode) || new Set();
  for (let candidate = 1; candidate <= 999; candidate += 1) {
    const code = String(candidate).padStart(3, '0');
    if (!used.has(code) && !assigned.has(code)) {
      assigned.add(code);
      codeIndex.assignedCodesByPlate.set(plateCode, assigned);
      return code;
    }
  }
  throw new Error(`Yeni ilce kodu uretilemedi: ${plateCode}`);
}

function resolveDistrictLocalCode(plateCode, name, codeIndex) {
  for (const key of districtNameKeys(plateCode, name)) {
    const existing = codeIndex.byName.get(key);
    if (existing) {
      const assigned = codeIndex.assignedCodesByPlate.get(plateCode) || new Set();
      assigned.add(existing);
      codeIndex.assignedCodesByPlate.set(plateCode, assigned);
      return existing;
    }
  }
  return nextDistrictLocalCode(plateCode, codeIndex);
}

function normalizeKamuProvince(feature) {
  const name = normalizeDisplayText(feature.properties.il_adi);
  const plateCode = String(feature.properties.il_id).padStart(2, '0');
  return {
    source_hdx_id: hdxProvinceSourceId(plateCode),
    source_parent_hdx_id: null,
    source_valid_on: null,
    source_valid_to: null,
    source_version: KAMU_SOURCE,
    name,
    name_ascii: toNameAscii(name),
    plate_code: plateCode.padStart(3, '0'),
    centroid: geometryCentroidFromBbox(feature.geometry),
    bbox: computeBbox(feature.geometry),
    area_sqkm: null,
    geometry_type: feature.geometry.type,
  };
}

function normalizeKamuDistrict(feature, codeIndex) {
  const name = normalizeDisplayText(feature.properties.ilce_adi);
  const parentName = normalizeDisplayText(feature.properties.il_adi);
  const plateCode = String(feature.properties.il_id).padStart(2, '0');
  const districtLocalCode = resolveDistrictLocalCode(plateCode, name, codeIndex);

  return {
    source_hdx_id: hdxDistrictSourceId(plateCode, districtLocalCode),
    source_parent_hdx_id: hdxProvinceSourceId(plateCode),
    source_valid_on: null,
    source_valid_to: null,
    source_version: KAMU_SOURCE,
    name,
    name_ascii: toNameAscii(name),
    parent_name: parentName,
    parent_name_ascii: toNameAscii(parentName),
    centroid: geometryCentroidFromBbox(feature.geometry),
    bbox: computeBbox(feature.geometry),
    area_sqkm: null,
    geometry_type: feature.geometry.type,
  };
}

function stripNormalizedFeature(feature, metadata, level) {
  return {
    type: 'Feature',
    properties: {
      level,
      source_hdx_id: metadata.source_hdx_id,
      source_parent_hdx_id: metadata.source_parent_hdx_id,
    },
    geometry: feature.geometry,
  };
}

function readKamuDistrictCollection() {
  const root = path.join(paths.rootDir, 'source', 'kamu-kaynak', 'ilce');
  const features = [];
  for (const entry of readJson(path.join(paths.rootDir, 'source', 'kamu-kaynak', 'admin-report.json')).district_reports) {
    const collection = readJson(path.join(root, entry.dir, 'ilce-geometrileri.geojson'));
    features.push(...collection.features);
  }
  return {
    type: 'FeatureCollection',
    name: 'kamu-kaynak-ilce-geometrileri',
    features,
  };
}

function writeNormalizedOutputs({ source, dataset, provinces, districts, provinceGeometry, districtGeometry }) {
  ensureDir(paths.normalizedDir);
  writeJson(path.join(paths.normalizedDir, 'provinces.metadata.partial.json'), provinces);
  writeJson(path.join(paths.normalizedDir, 'districts.metadata.partial.json'), districts);
  writeJson(path.join(paths.normalizedDir, 'provinces.geometry.geojson'), provinceGeometry);
  writeJson(path.join(paths.normalizedDir, 'districts.geometry.geojson'), districtGeometry);
  writeJson(path.join(paths.normalizedDir, 'ingest-report.json'), {
    source,
    dataset,
    province_count: provinces.length,
    district_count: districts.length,
    files: {
      provinces_metadata: 'data/normalized/provinces.metadata.partial.json',
      districts_metadata: 'data/normalized/districts.metadata.partial.json',
      provinces_geometry: 'data/normalized/provinces.geometry.geojson',
      districts_geometry: 'data/normalized/districts.geometry.geojson',
    },
  });
}

export function normalizeHdxSource() {
  logStep('Normalizing HDX snapshot');

  const { provincePath, districtPath } = getHdxLayerPaths();
  const provinceCollection = readFeatureCollection(provincePath);
  const districtCollection = readFeatureCollection(districtPath);

  const provinces = provinceCollection.features.map(normalizeProvince);
  const districts = districtCollection.features.map(normalizeDistrict);

  const provinceGeometry = {
    type: 'FeatureCollection',
    name: 'turkiye_map.normalized.provinces',
    features: provinceCollection.features.map((feature) => stripFeature(feature, 'province')),
  };

  const districtGeometry = {
    type: 'FeatureCollection',
    name: 'turkiye_map.normalized.districts',
    features: districtCollection.features.map((feature) => stripFeature(feature, 'district')),
  };

  writeNormalizedOutputs({
    source: HDX_SOURCE,
    dataset: 'cod-ab-tur',
    provinces,
    districts,
    provinceGeometry,
    districtGeometry,
  });

  logStep(`Normalized ${provinces.length} provinces and ${districts.length} districts`);
}

export function normalizeKamuKaynakSource() {
  logStep('Normalizing kamu kaynak snapshot');

  const provinceCollection = readJson(path.join(paths.rootDir, 'source', 'kamu-kaynak', 'il', 'il-geometrileri.geojson'));
  const districtCollection = readKamuDistrictCollection();
  const codeIndex = createLegacyDistrictCodeIndex();
  const provinces = provinceCollection.features.map(normalizeKamuProvince);
  const districts = districtCollection.features.map((feature) => normalizeKamuDistrict(feature, codeIndex));

  const provinceGeometry = {
    type: 'FeatureCollection',
    name: 'turkiye_map.normalized.provinces',
    features: provinceCollection.features.map((feature, index) => stripNormalizedFeature(feature, provinces[index], 'province')),
  };

  const districtGeometry = {
    type: 'FeatureCollection',
    name: 'turkiye_map.normalized.districts',
    features: districtCollection.features.map((feature, index) => stripNormalizedFeature(feature, districts[index], 'district')),
  };

  writeNormalizedOutputs({
    source: KAMU_SOURCE,
    dataset: 'kamu-kaynak-admin',
    provinces,
    districts,
    provinceGeometry,
    districtGeometry,
  });

  logStep(`Normalized ${provinces.length} provinces and ${districts.length} districts`);
}

export function main(options = null) {
  const args = options || parseArgs(process.argv);
  if (args.source === HDX_SOURCE) {
    normalizeHdxSource();
  } else {
    normalizeKamuKaynakSource();
  }
}

/* v8 ignore next -- CLI entrypoint guard */
if (invokedPath === scriptPath) {
  runPipelineStep('normalize', main);
}
