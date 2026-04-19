#!/usr/bin/env node

import AdmZip from 'adm-zip';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));

export const paths = {
  rootDir,
  hdxDir: path.join(rootDir, 'source', 'hdx', 'cod-ab-tur'),
  hdxZip: path.join(rootDir, 'source', 'hdx', 'cod-ab-tur', 'tur_admin_boundaries.geojson.zip'),
  hdxExtractedDir: path.join(rootDir, 'source', 'hdx', 'cod-ab-tur', 'extracted'),
  referenceDir: path.join(rootDir, 'source', 'reference'),
  provinceCrosswalk: path.join(rootDir, 'source', 'reference', 'provinces.crosswalk.json'),
  districtCrosswalk: path.join(rootDir, 'source', 'reference', 'districts.crosswalk.json'),
  regionsGeographic7: path.join(rootDir, 'source', 'reference', 'regions.geographic-7.json'),
  displayNameOverrides: path.join(rootDir, 'source', 'reference', 'display-name-overrides.json'),
  settlementsDir: path.join(rootDir, 'source', 'yerlesimler'),
  mahalleGeometryDir: path.join(rootDir, 'source', 'mahalle'),
  settlementSchema: path.join(rootDir, 'schema', 'yerlesim.schema.json'),
  normalizedDir: path.join(rootDir, 'data', 'normalized'),
  processedDir: path.join(rootDir, 'data', 'processed'),
  distJsonDir: path.join(rootDir, 'dist', 'json'),
  distGeojsonDir: path.join(rootDir, 'dist', 'geojson'),
  regionSchema: path.join(rootDir, 'schema', 'region.schema.json'),
  provinceSchema: path.join(rootDir, 'schema', 'province.schema.json'),
  districtSchema: path.join(rootDir, 'schema', 'district.schema.json'),
};

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function readOptionalJson(filePath, fallbackValue) {
  if (!fs.existsSync(filePath)) {
    return fallbackValue;
  }
  return readJson(filePath);
}

export function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export function writeJsonCompact(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
}

export function assertFileExists(filePath, label = filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required file missing: ${label}`);
  }
}

export function foldTurkishToAscii(value) {
  return value
    .replaceAll('\u00c7', 'C')
    .replaceAll('\u00e7', 'c')
    .replaceAll('\u011e', 'G')
    .replaceAll('\u011f', 'g')
    .replaceAll('\u0130', 'i')
    .replaceAll('I', 'i')
    .replaceAll('\u0131', 'i')
    .replaceAll('\u00d6', 'O')
    .replaceAll('\u00f6', 'o')
    .replaceAll('\u015e', 'S')
    .replaceAll('\u015f', 's')
    .replaceAll('\u00dc', 'U')
    .replaceAll('\u00fc', 'u')
    .normalize('NFKD')
    .replaceAll(/\p{Diacritic}/gu, '');
}

export function normalizeWhitespace(value) {
  return value.replaceAll(/\s+/g, ' ').trim();
}

export function normalizeDisplayText(value) {
  return normalizeWhitespace(
    value
      .normalize('NFC')
      .replaceAll('i\u0307', 'i')
      .replaceAll('I\u0307', '\u0130'),
  );
}

export function toNameAscii(value) {
  return normalizeWhitespace(foldTurkishToAscii(value)).toLowerCase();
}

export function toSlug(value) {
  return toNameAscii(value)
    .replaceAll(/[^a-z0-9\s-]/g, '')
    .replaceAll(/\s+/g, '-')
    .replaceAll(/-+/g, '-');
}

export function plateCodeFromHdxPcode(pcode) {
  const numeric = Number.parseInt(pcode.slice(-3), 10);
  return String(numeric).padStart(2, '0');
}

export function districtCodeFromHdxPcode(pcode) {
  return pcode.slice(-3);
}

export function provinceIdFromPlate(plateCode) {
  return `TR-P-${plateCode}`;
}

export function districtIdFromParts(plateCode, districtLocalCode) {
  return `TR-D-${plateCode}-${districtLocalCode}`;
}

export function computeBbox(geometry) {
  const points = [];

  function walk(coords) {
    if (!Array.isArray(coords)) {
      return;
    }
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      points.push(coords);
      return;
    }
    for (const item of coords) {
      walk(item);
    }
  }

  walk(geometry.coordinates);

  if (points.length === 0) {
    throw new Error('Geometry has no coordinates');
  }

  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  for (const [lon, lat] of points) {
    minLon = Math.min(minLon, lon);
    minLat = Math.min(minLat, lat);
    maxLon = Math.max(maxLon, lon);
    maxLat = Math.max(maxLat, lat);
  }

  return [minLon, minLat, maxLon, maxLat];
}

export function sortedCopy(items, compareFn) {
  return [...items].sort(compareFn);
}

function ringOrientationScore(ring) {
  let sum = 0;

  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[index + 1];
    sum += (x2 - x1) * (y2 + y1);
  }

  return sum;
}

function rewindRing(ring, shouldBeCounterClockwise) {
  const isCounterClockwise = ringOrientationScore(ring) < 0;

  if (shouldBeCounterClockwise ? isCounterClockwise : !isCounterClockwise) {
    return ring;
  }

  return [...ring].reverse();
}

function rewindPolygonCoordinates(polygonCoordinates) {
  return polygonCoordinates.map((ring, ringIndex) => rewindRing(ring, ringIndex !== 0));
}

export function rewindGeometry(geometry) {
  if (geometry.type === 'Polygon') {
    return {
      ...geometry,
      coordinates: rewindPolygonCoordinates(geometry.coordinates),
    };
  }

  if (geometry.type === 'MultiPolygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map(rewindPolygonCoordinates),
    };
  }

  return geometry;
}

export function roundGeometryCoordinates(geometry, decimals = 6) {
  function roundCoordinates(coords) {
    if (!Array.isArray(coords)) {
      return coords;
    }

    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      return [
        Number(coords[0].toFixed(decimals)),
        Number(coords[1].toFixed(decimals)),
      ];
    }

    return coords.map(roundCoordinates);
  }

  return {
    ...geometry,
    coordinates: roundCoordinates(geometry.coordinates),
  };
}

export function getHdxLayerPaths() {
  assertFileExists(paths.hdxZip, paths.hdxZip);
  ensureDir(paths.hdxExtractedDir);

  const provincePath = path.join(paths.hdxExtractedDir, 'tur_admin1.geojson');
  const districtPath = path.join(paths.hdxExtractedDir, 'tur_admin2.geojson');

  if (!fs.existsSync(provincePath) || !fs.existsSync(districtPath)) {
    extractHdxZip();
  }

  return {
    provincePath,
    districtPath,
  };
}

function extractHdxZip() {
  fs.rmSync(paths.hdxExtractedDir, { recursive: true, force: true });
  ensureDir(paths.hdxExtractedDir);

  try {
    const archive = new AdmZip(paths.hdxZip);
    archive.extractAllTo(paths.hdxExtractedDir, true);
  } catch (error) {
    throw new Error(`Failed to extract HDX zip: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function readFeatureCollection(filePath) {
  const data = readJson(filePath);
  if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
    throw new Error(`Expected FeatureCollection: ${filePath}`);
  }
  return data;
}

export function logStep(message) {
  console.log(message);
}

export function runPipelineStep(stepName, stepFn) {
  try {
    stepFn();
  } catch (error) {
    const detail = error instanceof Error ? error.stack || error.message : String(error);
    console.error(`[pipeline:${stepName}] failed`);
    console.error(detail);
    process.exit(1);
  }
}
