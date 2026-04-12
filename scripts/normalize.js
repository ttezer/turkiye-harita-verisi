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
  runPipelineStep,
  writeJson,
  toNameAscii,
} from './lib/pipeline.js';

const scriptPath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;

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

export function main() {
  logStep('Normalizing HDX snapshot');

  const { provincePath, districtPath } = getHdxLayerPaths();
  const provinceCollection = readFeatureCollection(provincePath);
  const districtCollection = readFeatureCollection(districtPath);

  ensureDir(paths.normalizedDir);

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

  writeJson(path.join(paths.normalizedDir, 'provinces.metadata.partial.json'), provinces);
  writeJson(path.join(paths.normalizedDir, 'districts.metadata.partial.json'), districts);
  writeJson(path.join(paths.normalizedDir, 'provinces.geometry.geojson'), provinceGeometry);
  writeJson(path.join(paths.normalizedDir, 'districts.geometry.geojson'), districtGeometry);
  writeJson(path.join(paths.normalizedDir, 'ingest-report.json'), {
    source: 'hdx',
    dataset: 'cod-ab-tur',
    province_count: provinces.length,
    district_count: districts.length,
    files: {
      provinces_metadata: 'data/normalized/provinces.metadata.partial.json',
      districts_metadata: 'data/normalized/districts.metadata.partial.json',
      provinces_geometry: 'data/normalized/provinces.geometry.geojson',
      districts_geometry: 'data/normalized/districts.geometry.geojson',
    },
  });

  logStep(`Normalized ${provinces.length} provinces and ${districts.length} districts`);
}

/* v8 ignore next -- CLI entrypoint guard */
if (invokedPath === scriptPath) {
  runPipelineStep('normalize', main);
}
