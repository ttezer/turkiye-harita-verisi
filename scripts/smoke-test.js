#!/usr/bin/env node

import AdmZip from 'adm-zip';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  findProvincesByRegionId,
  findRegionById,
  getRegionGeometry,
  getRegions,
  findDistrictsByProvinceId,
  findProvinceById,
  getDistrictGeometry,
  getDistricts,
  getProvinceGeometry,
  getProvinces,
} from '../packages/js/index.js';

const rootDir = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const host = '127.0.0.1';
const port = 4174;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertFile(filePath) {
  assert(fs.existsSync(filePath), `Missing file: ${filePath}`);
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readTextFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

async function waitForServer(baseUrl, child) {
  const deadline = Date.now() + 15000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Test UI server exited early with code ${child.exitCode}`);
    }

    try {
      const response = await fetch(baseUrl);
      if (response.ok) {
        return;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  throw new Error('Timed out waiting for test UI server');
}

async function fetchJson(url) {
  const response = await fetch(url);
  assert(response.ok, `Request failed: ${url} (${response.status})`);
  return response.json();
}

function requestPath(rawPath) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      host,
      port,
      path: rawPath,
      method: 'GET',
    }, (response) => {
      response.resume();
      response.on('end', () => resolve(response.statusCode || 0));
    });

    request.on('error', reject);
    request.end();
  });
}

async function main() {
  const expectedFiles = [
    'dist/json/regions.json',
    'dist/json/provinces.json',
    'dist/json/districts.json',
    'dist/geojson/regions.geojson',
    'dist/geojson/provinces.geojson',
    'dist/geojson/districts.geojson',
    'dist/topojson/regions.topojson',
    'dist/topojson/provinces.topojson',
    'dist/topojson/districts.topojson',
    'dist/csv/regions.csv',
    'dist/csv/provinces.csv',
    'dist/csv/districts.csv',
    'dist/xlsx/turkiye-map.xlsx',
    'dist/sql/regions.sql',
    'dist/sql/provinces.sql',
    'dist/sql/districts.sql',
    'dist/wkt/regions.wkt',
    'dist/wkt/provinces.wkt',
    'dist/wkt/districts.wkt',
    'dist/kml/regions.kml',
    'dist/kml/provinces.kml',
    'dist/kml/districts.kml',
    'dist/kmz/regions.kmz',
    'dist/kmz/provinces.kmz',
    'dist/kmz/districts.kmz',
    'data/processed/regions.metadata.json',
    'data/processed/provinces.metadata.json',
    'data/processed/districts.metadata.json',
  ];

  for (const file of expectedFiles) {
    assertFile(path.join(rootDir, file));
  }

  const regionsTopojson = readJsonFile(path.join(rootDir, 'dist/topojson/regions.topojson'));
  const provincesCsv = readTextFile(path.join(rootDir, 'dist/csv/provinces.csv'));
  const regionsSql = readTextFile(path.join(rootDir, 'dist/sql/regions.sql'));
  const provincesWkt = readTextFile(path.join(rootDir, 'dist/wkt/provinces.wkt'));
  const regionsKml = readTextFile(path.join(rootDir, 'dist/kml/regions.kml'));
  const regionsKmz = new AdmZip(path.join(rootDir, 'dist/kmz/regions.kmz'));

  assert(regionsTopojson.type === 'Topology', 'Region TopoJSON root type mismatch');
  assert(Boolean(regionsTopojson.objects?.regions), 'Region TopoJSON object missing');
  assert(provincesCsv.split(/\r?\n/).filter(Boolean).length > 81, 'Province CSV row count looks wrong');
  assert(regionsSql.includes('CREATE TABLE'), 'Region SQL is missing CREATE TABLE');
  assert(regionsSql.includes('INSERT INTO'), 'Region SQL is missing INSERT rows');
  assert(provincesWkt.includes('MULTIPOLYGON') || provincesWkt.includes('POLYGON'), 'Province WKT is missing geometry');
  assert(regionsKml.includes('<Placemark>'), 'Region KML has no placemark');
  assert(regionsKml.includes('<styleUrl>#turkiye-map-style</styleUrl>'), 'Region KML style reference missing');
  assert(regionsKmz.getEntries().some((entry) => entry.entryName === 'doc.kml'), 'Region KMZ is missing doc.kml');
  assert(regionsKmz.readAsText('doc.kml').includes('<Placemark>'), 'Region KMZ doc.kml has no placemark');

  const regions = getRegions();
  const provinces = getProvinces();
  const districts = getDistricts();
  const regionGeometry = getRegionGeometry();
  const provinceGeometry = getProvinceGeometry();
  const districtGeometry = getDistrictGeometry();

  assert(regions.length === 7, `Expected 7 regions, received ${regions.length}`);
  assert(provinces.length === 81, `Expected 81 provinces, received ${provinces.length}`);
  assert(districts.length === 973, `Expected 973 districts, received ${districts.length}`);
  assert(regionGeometry.features.length === regions.length, 'Region geometry count mismatch');
  assert(provinceGeometry.features.length === provinces.length, 'Province geometry count mismatch');
  assert(districtGeometry.features.length === districts.length, 'District geometry count mismatch');
  assert(regionGeometry.features.every((feature) => feature.geometry?.type === 'MultiPolygon'), 'Region geometry should be MultiPolygon');
  assert(findRegionById('TR-R-MAR')?.name === 'Marmara', 'Region lookup failed for TR-R-MAR');
  assert(findProvincesByRegionId('TR-R-MAR').length === 11, 'Province lookup failed for TR-R-MAR');
  assert(findProvinceById('TR-P-34')?.name === 'İstanbul', 'Province lookup failed for TR-P-34');
  assert(findDistrictsByProvinceId('TR-P-34').length > 0, 'District lookup failed for TR-P-34');

  const server = spawn(process.execPath, ['scripts/serve-test-ui.js'], {
    cwd: rootDir,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  server.stdout.on('data', () => {});
  server.stderr.on('data', () => {});

  const baseUrl = `http://${host}:${port}`;

  try {
    await waitForServer(baseUrl, server);

    const htmlResponse = await fetch(baseUrl);
    assert(htmlResponse.ok, `Homepage request failed (${htmlResponse.status})`);
    assert(
      (htmlResponse.headers.get('content-type') || '').includes('text/html'),
      'Homepage content type is not HTML',
    );

    const html = await htmlResponse.text();
    assert(html.includes('Türkiye'), 'Homepage is missing product branding');
    assert(html.includes('mapSvg'), 'Homepage is missing map surface');

    const servedRegions = await fetchJson(`${baseUrl}/dist/json/regions.json`);
    const servedProvinces = await fetchJson(`${baseUrl}/dist/json/provinces.json`);
    const servedDistrictGeometry = await fetchJson(`${baseUrl}/dist/geojson/districts.geojson`);
    assert(servedRegions.length === regions.length, 'Served region JSON count mismatch');
    assert(servedProvinces.length === provinces.length, 'Served province JSON count mismatch');
    assert(
      servedDistrictGeometry.features.length === districts.length,
      'Served district GeoJSON count mismatch',
    );

    const traversalStatus = await requestPath('/%2e%2e/package.json');
    assert(
      traversalStatus === 403 || traversalStatus === 404,
      `Traversal probe should be blocked, received ${traversalStatus}`,
    );
  } finally {
    server.kill();
  }

  console.log('Smoke test passed');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
