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
const HDX_SOURCE = 'hdx';

export function preferredName(properties, fallbackKey, turkishKey) {
  return normalizeDisplayText(properties[turkishKey] || properties[fallbackKey]);
}

export function normalizeProvince(feature) {
  const properties = feature.properties;
  const name = preferredName(properties, 'adm1_name', 'adm1_name1');

  return {
    hdx_id: properties.adm1_pcode,
    parent_hdx_id: null,
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
    hdx_id: properties.adm2_pcode,
    parent_hdx_id: properties.adm1_pcode,
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
      hdx_id: level === 'province' ? feature.properties.adm1_pcode : feature.properties.adm2_pcode,
      parent_hdx_id: level === 'province' ? null : feature.properties.adm1_pcode,
    },
    geometry: feature.geometry,
  };
}

function parseArgs(argv) {
  const args = {
    source: HDX_SOURCE,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--source') {
      args.source = argv[++index];
    } else {
      throw new Error(`Bilinmeyen arguman: ${arg}`);
    }
  }

  if (args.source !== HDX_SOURCE) {
    throw new Error('--source yalnizca hdx olabilir.');
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

export function main(options = null) {
  const args = options || parseArgs(process.argv);
  if (args.source !== HDX_SOURCE) {
    throw new Error('--source yalnizca hdx olabilir.');
  }
  normalizeHdxSource();
}

/* v8 ignore next -- CLI entrypoint guard */
if (invokedPath === scriptPath) {
  runPipelineStep('normalize', main);
}
