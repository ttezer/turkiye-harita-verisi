import regions from '../../dist/json/regions.json' with { type: 'json' };
import provinces from '../../dist/json/provinces.json' with { type: 'json' };
import districts from '../../dist/json/districts.json' with { type: 'json' };
import yerlesimler from '../../dist/json/yerlesimler.json' with { type: 'json' };
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = path.dirname(fileURLToPath(import.meta.url));

function readGeojson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(packageDir, relativePath), 'utf8'));
}

export function getProvinces() {
  return provinces;
}

export function getRegions() {
  return regions;
}

export function getDistricts() {
  return districts;
}

export function getYerlesimler() {
  return yerlesimler;
}

export function findRegionById(id) {
  return regions.find((item) => item.id === id) || null;
}

export function findProvinceById(id) {
  return provinces.find((item) => item.id === id) || null;
}

export function findProvincesByRegionId(regionId) {
  return provinces.filter((item) => item.region_id === regionId);
}

export function findDistrictsByProvinceId(provinceId) {
  return districts.filter((item) => item.parent_id === provinceId);
}

export function findDistrictsByRegionId(regionId) {
  return districts.filter((item) => item.region_id === regionId);
}

export function findYerlesimlerByProvinceId(provinceId) {
  return yerlesimler.filter((item) => item.province_id === provinceId);
}

export function findYerlesimlerByDistrictId(districtId) {
  return yerlesimler.filter((item) => item.district_id === districtId);
}

export function findYerlesimById(id) {
  return yerlesimler.find((item) => item.id === id) || null;
}

export function getRegionGeometry() {
  return readGeojson('../../dist/geojson/regions.geojson');
}

export function getProvinceGeometry() {
  return readGeojson('../../dist/geojson/provinces.geojson');
}

export function getDistrictGeometry() {
  return readGeojson('../../dist/geojson/districts.geojson');
}
