#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import iconv from 'iconv-lite';
import shp from 'shpjs';
import { kml } from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';
import {
  ensureDir,
  logStep,
  normalizeDisplayText,
  paths,
  readJson,
  readOptionalJson,
  rewindGeometry,
  roundGeometryCoordinates,
  runPipelineStep,
  sortedCopy,
  toNameAscii,
  writeJson,
  writeJsonCompact,
} from './lib/pipeline.js';

const scriptPath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const distGeojsonDir = path.join(paths.rootDir, 'dist', 'geojson');

const SOURCES = [
  {
    province_id: 'TR-P-48',
    province_name: 'Muğla',
    slug: 'mugla',
    source_name: 'Muğla Büyükşehir Belediyesi Kent Rehberi - MAKS Resmi Mahalleler',
    format: 'arcgis',
    service_url: 'https://muglacbs.mugla.bel.tr/cbs/rest/services/MAKS_RESMI/MAKS_RESMI_SORGU/MapServer/4/query',
    where: '1=1',
    name_field: 'Mahalle',
    district_field: 'Ilce',
  },
  {
    province_id: 'TR-P-20',
    province_name: 'Denizli',
    slug: 'denizli',
    source_name: 'Denizli Adres Bilgi Sistemi - MAHALLE',
    format: 'arcgis',
    service_url: 'https://adres.denizli.bel.tr/arcgis/rest/services/yayinlar/sorgu/MapServer/5/query',
    response_format: 'json',
    where: '1=1',
    name_field: 'AD',
    district_field: 'ILCE_AD',
    district_lookup: {
      service_url: 'https://adres.denizli.bel.tr/arcgis/rest/services/yayinlar/sorgu/MapServer/7/query',
      source_field: 'ILCEID',
      lookup_key_field: 'ID',
      lookup_value_field: 'AD',
      output_field: 'ILCE_AD',
    },
  },
  {
    province_id: 'TR-P-41',
    province_name: 'Kocaeli',
    slug: 'kocaeli',
    source_name: 'Kocaeli Büyükşehir Belediyesi Rehber - Mahalle',
    format: 'kocaeli_api',
    district_list_url: 'https://rehber-api.kocaeli.bel.tr/address/ilce/list',
    neighborhood_list_url: 'https://rehber-api.kocaeli.bel.tr/address/mahalle/list?ilceId={district_ref_id}',
    neighborhood_detail_url: 'https://rehber-api.kocaeli.bel.tr/address/mahalle/{neighborhood_ref_id}',
    name_field: 'mahalle',
    district_field: 'ilce',
  },
  {
    province_id: 'TR-P-27',
    province_name: 'Gaziantep',
    slug: 'gaziantep',
    source_name: 'Gaziantep Açık Veri Platformu - Mahalle Sınır Alanları',
    format: 'kml',
    infer_district_from_geometry: true,
  },
  {
    province_id: 'TR-P-54',
    province_name: 'Sakarya',
    slug: 'sakarya',
    source_name: 'Sakarya Büyükşehir Belediyesi Açık Veri Portalı - Mahalle Sınırları',
    format: 'kmz',
  },
];

export function compactKey(value) {
  return toNameAscii(value).replaceAll(/[^a-z0-9]/g, '');
}

function uniqueKeys(keys) {
  return [...new Set(keys.filter(Boolean))];
}

function nameMatchKeys(value) {
  const key = compactKey(value);
  const keys = [key];
  const withoutOsb = key.replace(/osb$/, '').replace(/organizesanayibolgesi$/, '');
  keys.push(withoutOsb);
  keys.push(withoutOsb.replace(/koy$/, ''));
  keys.push(withoutOsb.replace(/mahallesi$/, '').replace(/mahalle$/, ''));
  keys.push(withoutOsb.replace(/^gazi/, 'g'));
  keys.push(withoutOsb.replace(/^g/, 'gazi'));
  keys.push(withoutOsb.replace(/camii$/, 'cami'));
  keys.push(withoutOsb.replace(/cami$/, 'camii'));

  const parenthetical = String(value || '').match(/^(.+?)\s*\((.+?)\)$/);
  if (parenthetical) {
    keys.push(compactKey(`${parenthetical[2]} ${parenthetical[1]}`));
  }

  return uniqueKeys(keys);
}

function stripCoordinateZ(coordinate) {
  return [coordinate[0], coordinate[1]];
}

function stripRingZ(ring) {
  return ring.map(stripCoordinateZ);
}

function stripPolygonZ(polygon) {
  return polygon.map(stripRingZ);
}

function ringArea(ring) {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    sum += (ring[j][0] * ring[i][1]) - (ring[i][0] * ring[j][1]);
  }
  return Math.abs(sum / 2);
}

function isValidPolygon(polygon) {
  const outerRing = polygon[0] || [];
  const uniquePoints = new Set(outerRing.map((point) => `${point[0]},${point[1]}`)).size;
  return outerRing.length >= 4 && uniquePoints >= 4 && ringArea(outerRing) > 1e-10;
}

function normalizePolygonalGeometry(geometry) {
  if (geometry.type === 'Polygon') {
    const coordinates = stripPolygonZ(geometry.coordinates);
    return {
      ...geometry,
      coordinates,
    };
  }

  if (geometry.type === 'MultiPolygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates
        .map(stripPolygonZ)
        .filter(isValidPolygon),
    };
  }

  if (geometry.type === 'GeometryCollection') {
    const polygons = [];
    for (const item of geometry.geometries || []) {
      const normalized = normalizePolygonalGeometry(item);
      if (normalized.type === 'Polygon') {
        if (isValidPolygon(normalized.coordinates)) {
          polygons.push(normalized.coordinates);
        }
      } else if (normalized.type === 'MultiPolygon') {
        polygons.push(...normalized.coordinates.filter(isValidPolygon));
      }
    }

    return {
      type: 'MultiPolygon',
      coordinates: polygons,
    };
  }

  return geometry;
}

function buildGeometryProperties(source, district, rawName, override, settlement = null) {
  if (settlement) {
    return {
      id: settlement.id,
      level: 'yerlesim',
      type: 'mahalle',
      parent_id: settlement.parent_id,
      province_id: settlement.province_id,
      district_id: settlement.district_id,
      name: settlement.name,
      source_raw_name: normalizeDisplayText(rawName),
      source: source.source_name,
    };
  }

  const name = override.name || normalizeDisplayText(rawName);
  return {
    id: override.id,
    level: 'yerlesim',
    type: 'mahalle',
    parent_id: district.id,
    province_id: source.province_id,
    district_id: district.id,
    name,
    source_raw_name: normalizeDisplayText(rawName),
    source: source.source_name,
    source_only: true,
  };
}

function addIndexValue(index, key, settlement) {
  const list = index.get(key) || [];
  if (!list.some((item) => item.id === settlement.id)) {
    list.push(settlement);
  }
  index.set(key, list);
}

function findFileByExtension(dir, extension) {
  const fileName = fs.readdirSync(dir).find((file) => file.toLowerCase().endsWith(extension));
  if (!fileName) {
    throw new Error(`Missing ${extension} file in ${dir}`);
  }
  return path.join(dir, fileName);
}

function readDbfRows(filePath, encoding) {
  const buffer = fs.readFileSync(filePath);
  const rowCount = buffer.readUInt32LE(4);
  const headerLength = buffer.readUInt16LE(8);
  const recordLength = buffer.readUInt16LE(10);
  const fields = [];

  for (let offset = 32; buffer[offset] !== 0x0D; offset += 32) {
    const name = buffer.subarray(offset, offset + 11).toString('ascii').replace(/\0.*$/, '');
    fields.push({
      name,
      length: buffer[offset + 16],
      offset: null,
    });
  }

  let fieldOffset = 1;
  for (const field of fields) {
    field.offset = fieldOffset;
    fieldOffset += field.length;
  }

  const rows = [];
  for (let index = 0; index < rowCount; index += 1) {
    const offset = headerLength + index * recordLength;
    if (buffer[offset] === 0x2A) {
      continue;
    }

    const row = {};
    for (const field of fields) {
      const value = buffer.subarray(offset + field.offset, offset + field.offset + field.length);
      row[field.name] = normalizeDisplayText(iconv.decode(value, encoding).trim());
    }
    rows.push(row);
  }
  return rows;
}

async function readShapefileSource(source) {
  const dir = path.join(paths.mahalleGeometryDir, source.slug);
  const files = fs.readdirSync(dir);
  const shpFile = files.find((file) => file.toLowerCase().endsWith('.shp'));
  const baseName = shpFile.slice(0, -4);
  const object = {};

  for (const extension of ['shp', 'dbf', 'prj', 'cpg']) {
    const file = files.find((candidate) => candidate.toLowerCase() === `${baseName.toLowerCase()}.${extension}`);
    if (file) {
      object[extension] = fs.readFileSync(path.join(dir, file));
    }
  }

  const collection = await shp(object);
  const dbfFile = findFileByExtension(dir, '.dbf');
  if (source.dbf_encoding) {
    const rows = readDbfRows(dbfFile, source.dbf_encoding);
    collection.features = collection.features.map((feature, index) => ({
      ...feature,
      properties: rows[index] || feature.properties,
    }));
  }

  return collection;
}

async function readArcgisSource(source) {
  const params = new URLSearchParams({
    where: source.where || '1=1',
    outFields: '*',
    returnGeometry: 'true',
    outSR: '4326',
    f: source.response_format || 'geojson',
  });
  const response = await fetch(`${source.service_url}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`ArcGIS source request failed: ${source.source_name} (${response.status})`);
  }
  const payload = await response.json();
  if (payload.error) {
    throw new Error(`ArcGIS source query failed: ${source.source_name} ${JSON.stringify(payload.error)}`);
  }
  const collection = (source.response_format || 'geojson') === 'json'
    ? arcgisJsonToGeojson(payload)
    : payload;

  if (source.district_lookup) {
    await applyArcgisLookup(collection, source.district_lookup);
  }

  return collection;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchJsonWithRetry(url, tries = 4) {
  let lastError;
  for (let attempt = 0; attempt < tries; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return await response.json();
      }
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }

    await sleep(350 * (attempt + 1));
  }

  throw new Error(`Request failed after ${tries} attempts: ${url} (${lastError?.message || 'unknown error'})`);
}

function closeRing(ring) {
  if (ring.length === 0) {
    return ring;
  }

  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) {
    return ring;
  }

  return [...ring, first];
}

function kocaeliRingToCoordinates(ring) {
  return closeRing((ring || []).map((point) => [point.longitude, point.latitude]));
}

function kocaeliGeometryToGeojson(geometry) {
  const coordinates = geometry?.coordinates || [];
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    return { type: 'Polygon', coordinates: [] };
  }

  if (coordinates[0]?.[0]?.longitude !== undefined) {
    return {
      type: 'Polygon',
      coordinates: coordinates.map(kocaeliRingToCoordinates),
    };
  }

  return {
    type: 'MultiPolygon',
    coordinates: coordinates.map((polygon) => polygon.map(kocaeliRingToCoordinates)),
  };
}

async function readKocaeliApiSource(source) {
  const districts = await fetchJsonWithRetry(source.district_list_url);
  const features = [];

  for (const districtRow of districts) {
    const districtRefId = districtRow.source?.categoryData?.refId;
    if (!districtRefId) {
      continue;
    }

    const listUrl = source.neighborhood_list_url.replace('{district_ref_id}', encodeURIComponent(districtRefId));
    const neighborhoods = await fetchJsonWithRetry(listUrl);

    for (const neighborhoodRow of neighborhoods) {
      const neighborhoodRefId = neighborhoodRow.source?.categoryData?.refId;
      const detailUrl = source.neighborhood_detail_url.replace('{neighborhood_ref_id}', encodeURIComponent(neighborhoodRefId));
      const detail = await fetchJsonWithRetry(detailUrl);
      const item = detail.source || detail;
      const properties = item.categoryData || {};
      features.push({
        type: 'Feature',
        properties,
        geometry: kocaeliGeometryToGeojson(item.geometry),
      });
    }
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

function normalizeArcgisGuid(value) {
  return String(value || '').replace(/[{}]/g, '').toUpperCase();
}

function arcgisRingsToGeojsonGeometry(rings) {
  const normalizedRings = (rings || []).map(stripRingZ).filter((ring) => ring.length >= 4);
  const polygons = normalizedRings
    .filter((ring) => !normalizedRings.some((candidate) => candidate !== ring && ringContainsPoint(candidate, ring[0])))
    .map((outerRing) => [outerRing]);

  for (const ring of normalizedRings) {
    if (polygons.some((polygon) => polygon[0] === ring)) {
      continue;
    }

    const containingPolygons = polygons
      .filter((polygon) => ringContainsPoint(polygon[0], ring[0]))
      .sort((a, b) => ringArea(a[0]) - ringArea(b[0]));
    if (containingPolygons[0]) {
      containingPolygons[0].push(ring);
    } else {
      polygons.push([ring]);
    }
  }

  if (polygons.length === 1) {
    return { type: 'Polygon', coordinates: polygons[0] };
  }

  return { type: 'MultiPolygon', coordinates: polygons };
}

function arcgisJsonToGeojson(payload) {
  return {
    type: 'FeatureCollection',
    features: (payload.features || []).map((feature) => ({
      type: 'Feature',
      properties: feature.attributes || {},
      geometry: arcgisRingsToGeojsonGeometry(feature.geometry?.rings || []),
    })),
  };
}

async function applyArcgisLookup(collection, lookup) {
  const params = new URLSearchParams({
    where: '1=1',
    outFields: `${lookup.lookup_key_field},${lookup.lookup_value_field}`,
    returnGeometry: 'false',
    f: 'json',
  });
  const response = await fetch(`${lookup.service_url}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`ArcGIS lookup request failed: ${lookup.service_url} (${response.status})`);
  }

  const payload = await response.json();
  if (payload.error) {
    throw new Error(`ArcGIS lookup query failed: ${lookup.service_url} ${JSON.stringify(payload.error)}`);
  }

  const lookupMap = new Map((payload.features || []).map((feature) => [
    normalizeArcgisGuid(feature.attributes?.[lookup.lookup_key_field]),
    feature.attributes?.[lookup.lookup_value_field],
  ]));

  for (const feature of collection.features) {
    const lookupValue = lookupMap.get(normalizeArcgisGuid(feature.properties?.[lookup.source_field]));
    if (lookupValue) {
      feature.properties[lookup.output_field] = lookupValue;
    }
  }
}

function readKmzSource(source) {
  const filePath = findFileByExtension(path.join(paths.mahalleGeometryDir, source.slug), '.kmz');
  const zip = new AdmZip(filePath);
  const entry = zip.getEntries().find((item) => item.entryName.toLowerCase().endsWith('.kml'));
  if (!entry) {
    throw new Error(`KMZ has no KML entry: ${filePath}`);
  }

  let xml = zip.readAsText(entry);
  xml = xml.replace('<Document id=', '<Document xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" id=');
  return kml(new DOMParser().parseFromString(xml, 'text/xml'));
}

function readKmlSource(source) {
  const filePath = findFileByExtension(path.join(paths.mahalleGeometryDir, source.slug), '.kml');
  let xml = fs.readFileSync(filePath, 'utf8');
  xml = xml.replace('<Document id=', '<Document xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" id=');
  return kml(new DOMParser().parseFromString(xml, 'text/xml'));
}

function resolveSourceFormat(source) {
  if (source.format === 'arcgis') {
    return source.format;
  }
  if (source.format !== 'auto') {
    return source.format;
  }

  const dir = path.join(paths.mahalleGeometryDir, source.slug);
  const files = fs.readdirSync(dir).map((file) => file.toLowerCase());
  if (files.some((file) => file.endsWith('.kml'))) {
    return 'kml';
  }
  if (files.some((file) => file.endsWith('.kmz'))) {
    return 'kmz';
  }
  if (files.some((file) => file.endsWith('.shp'))) {
    return 'shp';
  }
  throw new Error(`No supported geometry source found for ${source.province_name}`);
}

function parseHtmlDescription(description) {
  const html = typeof description === 'object' ? description.value || '' : description || '';
  const rows = [...html.matchAll(/<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi)];
  const properties = {};

  for (const [, rawKey, rawValue] of rows) {
    const key = normalizeDisplayText(rawKey.replaceAll(/<[^>]+>/g, '')).toLowerCase();
    const value = normalizeDisplayText(rawValue.replaceAll(/<[^>]+>/g, ''));
    if (key) {
      properties[key] = value;
    }
  }

  return properties;
}

function buildSettlementIndexes(settlements) {
  const byDistrictAndName = new Map();
  const byProvinceAndName = new Map();

  for (const settlement of settlements.filter((item) => item.type === 'mahalle')) {
    for (const nameKey of nameMatchKeys(settlement.name)) {
      addIndexValue(byDistrictAndName, `${settlement.district_id}|${nameKey}`, settlement);
      addIndexValue(byProvinceAndName, `${settlement.province_id}|${nameKey}`, settlement);
    }
  }

  return { byDistrictAndName, byProvinceAndName };
}

function buildOverrideIndex(overrides) {
  const byDistrictAndRaw = new Map();
  const byProvinceAndRaw = new Map();
  for (const override of overrides || []) {
    const rawKey = override.raw_key || compactKey(override.raw_name);
    byDistrictAndRaw.set(`${override.province_id}|${override.district_id}|${rawKey}`, override);
    byProvinceAndRaw.set(`${override.province_id}|${rawKey}`, override);
  }
  return { byDistrictAndRaw, byProvinceAndRaw };
}

function buildDistrictIndexes(districts) {
  return {
    byProvinceAndName: new Map(districts.map((district) => [
      `${district.parent_id}|${compactKey(district.name)}`,
      district,
    ])),
    byId: new Map(districts.map((district) => [district.id, district])),
  };
}

function resolveDistrictByName(source, rawDistrictName, districtIndex) {
  const district = districtIndex.byProvinceAndName.get(`${source.province_id}|${compactKey(rawDistrictName)}`);
  if (!district) {
    throw new Error(`Mahalle geometry district not found: ${source.province_name} -> ${rawDistrictName}`);
  }
  return district;
}

function ringContainsPoint(ring, point) {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = ((yi > y) !== (yj > y)) &&
      (x < ((xj - xi) * (y - yi)) / (yj - yi || Number.EPSILON) + xi);
    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function polygonContainsPoint(polygon, point) {
  if (!ringContainsPoint(polygon[0], point)) {
    return false;
  }
  return polygon.slice(1).every((hole) => !ringContainsPoint(hole, point));
}

function geometryContainsPoint(geometry, point) {
  if (geometry.type === 'Polygon') {
    return polygonContainsPoint(geometry.coordinates, point);
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((polygon) => polygonContainsPoint(polygon, point));
  }
  return false;
}

function geometryCentroid(geometry) {
  const points = [];
  const walk = (coordinates) => {
    if (!Array.isArray(coordinates)) {
      return;
    }
    if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
      points.push(coordinates);
      return;
    }
    coordinates.forEach(walk);
  };
  walk(geometry.coordinates);

  return [
    points.reduce((sum, point) => sum + point[0], 0) / points.length,
    points.reduce((sum, point) => sum + point[1], 0) / points.length,
  ];
}

function inferDistrictFromGeometry(source, feature, districtFeatures) {
  const point = geometryCentroid(feature.geometry);
  const match = districtFeatures.find((districtFeature) => geometryContainsPoint(districtFeature.geometry, point));
  if (!match) {
    return null;
  }
  return match.properties.id;
}

function normalizeSourceFeature(source, feature, indexes, districtFeatures) {
  let rawName;
  let district;

  if (source.resolved_format === 'kmz' || source.resolved_format === 'kml') {
    const description = parseHtmlDescription(feature.properties.description);
    rawName = description.ad || description.mahalle || description.mahalle_adi || feature.properties.name;
    const rawDistrictName = description.ilce || description.ilceadi || description.ilce_adi || feature.properties.ilce || feature.properties.ILCE;
    if (rawDistrictName) {
      district = resolveDistrictByName(source, rawDistrictName, indexes.districts);
    } else if (source.infer_district_from_geometry) {
      const inferredDistrictId = inferDistrictFromGeometry(source, feature, districtFeatures);
      if (!inferredDistrictId) {
        const override = indexes.overrides.byProvinceAndRaw.get(`${source.province_id}|${compactKey(rawName)}`);
        if (override?.district_id) {
          district = indexes.districts.byId.get(override.target_district_id || override.district_id);
        } else {
          return {
            status: 'unmatched',
            raw_name: rawName,
            district_id: null,
            district_name: null,
            reason: 'district_not_inferred_from_geometry',
          };
        }
      } else {
        district = indexes.districts.byId.get(inferredDistrictId);
      }
    } else {
      throw new Error(`Mahalle geometry has no district field: ${source.province_name} -> ${rawName}`);
    }
  } else {
    rawName = feature.properties[source.name_field];
    if (source.infer_district_from_geometry) {
      district = indexes.districts.byId.get(inferDistrictFromGeometry(source, feature, districtFeatures));
    } else {
      district = resolveDistrictByName(source, feature.properties[source.district_field], indexes.districts);
    }
  }

  const override = indexes.overrides.byDistrictAndRaw.get(`${source.province_id}|${district.id}|${compactKey(rawName)}`);
  const outputDistrict = override?.target_district_id
    ? indexes.districts.byId.get(override.target_district_id)
    : district;
  if (override?.action === 'skip') {
    return {
      status: 'skipped',
      raw_name: rawName,
      district_id: district.id,
      district_name: district.name,
      reason: override.reason || 'manual_skip',
    };
  }

  const geometry = normalizePolygonalGeometry(feature.geometry);
  if (override?.action === 'include') {
    return {
      status: 'matched',
      feature: {
        type: 'Feature',
        properties: buildGeometryProperties(source, outputDistrict, rawName, override),
        geometry: roundGeometryCoordinates(rewindGeometry(geometry), 6),
      },
    };
  }

  const settlementMatches = override?.settlement_id
    ? [indexes.settlementsById.get(override.settlement_id)].filter(Boolean)
    : uniqueKeys(nameMatchKeys(rawName).flatMap((nameKey) => (
    indexes.settlements.byDistrictAndName.get(`${district.id}|${nameKey}`) || []
  )).map((item) => item.id))
    .map((id) => indexes.settlementsById.get(id));
  if (settlementMatches.length !== 1) {
    return {
      status: settlementMatches.length === 0 ? 'unmatched' : 'ambiguous',
      raw_name: rawName,
      district_id: district.id,
      district_name: district.name,
    };
  }

  const settlement = settlementMatches[0];
  return {
    status: 'matched',
    feature: {
      type: 'Feature',
      properties: buildGeometryProperties(source, district, rawName, override, settlement),
      geometry: roundGeometryCoordinates(rewindGeometry(geometry), 6),
    },
  };
}

function groupBy(features, keyFn) {
  const groups = new Map();
  for (const feature of features) {
    const key = keyFn(feature);
    const group = groups.get(key) || [];
    group.push(feature);
    groups.set(key, group);
  }
  return groups;
}

function featureCollection(features, name) {
  return {
    type: 'FeatureCollection',
    name,
    features: sortedCopy(features, (a, b) => a.properties.id.localeCompare(b.properties.id)),
  };
}

function geometryToPolygons(geometry) {
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

function polygonsToGeometry(polygons) {
  return polygons.length === 1
    ? { type: 'Polygon', coordinates: polygons[0] }
    : { type: 'MultiPolygon', coordinates: polygons };
}

function mergeDuplicateFeatureGeometries(features) {
  const byId = new Map();
  for (const feature of features) {
    const existing = byId.get(feature.properties.id);
    if (!existing) {
      byId.set(feature.properties.id, feature);
      continue;
    }

    const mergedRawNames = uniqueKeys([
      existing.properties.source_raw_name,
      feature.properties.source_raw_name,
    ]).join(' | ');
    existing.properties.source_raw_name = mergedRawNames || existing.properties.source_raw_name;
    existing.geometry = polygonsToGeometry([
      ...geometryToPolygons(existing.geometry),
      ...geometryToPolygons(feature.geometry),
    ]);
  }
  return [...byId.values()];
}

function writeGroupedGeojson(outDir, groups, namePrefix) {
  ensureDir(outDir);
  for (const [key, features] of groups.entries()) {
    writeJsonCompact(path.join(outDir, `${key}.geojson`), featureCollection(features, `${namePrefix}.${key}`));
  }
}

export async function main() {
  logStep('Normalizing mahalle geometry sources');

  const settlements = readJson(path.join(paths.processedDir, 'yerlesimler.metadata.json'));
  const overrides = readOptionalJson(path.join(paths.mahalleGeometryDir, 'name-overrides.json'), []);
  const districts = readJson(path.join(paths.processedDir, 'districts.metadata.json'));
  const districtGeometry = readJson(path.join(paths.processedDir, 'districts.geometry.geojson'));
  const indexes = {
    settlements: buildSettlementIndexes(settlements),
    settlementsById: new Map(settlements.map((item) => [item.id, item])),
    overrides: buildOverrideIndex(overrides),
    districts: buildDistrictIndexes(districts),
  };
  const districtFeaturesByProvince = groupBy(districtGeometry.features, (feature) => feature.properties.parent_id);
  const features = [];
  const sourceReports = [];

  for (const source of SOURCES) {
    const resolvedSource = {
      ...source,
      resolved_format: resolveSourceFormat(source),
    };
    const collection = resolvedSource.resolved_format === 'arcgis'
      ? await readArcgisSource(resolvedSource)
      : resolvedSource.resolved_format === 'kocaeli_api'
        ? await readKocaeliApiSource(resolvedSource)
        : resolvedSource.resolved_format === 'kmz'
          ? readKmzSource(resolvedSource)
          : resolvedSource.resolved_format === 'kml'
            ? readKmlSource(resolvedSource)
            : await readShapefileSource(resolvedSource);
    const districtFeatures = districtFeaturesByProvince.get(source.province_id) || [];
    const report = {
      province_id: source.province_id,
      province_name: source.province_name,
      source_name: source.source_name,
      format: resolvedSource.resolved_format,
      source_feature_count: collection.features.length,
      matched_count: 0,
      unmatched: [],
      ambiguous: [],
      skipped: [],
    };

    for (const feature of collection.features) {
      const result = normalizeSourceFeature(resolvedSource, feature, indexes, districtFeatures);
      if (result.status === 'matched') {
        features.push(result.feature);
        report.matched_count += 1;
      } else {
        report[result.status].push(result);
      }
    }

    sourceReports.push(report);
  }

  const mergedFeatures = mergeDuplicateFeatureGeometries(features);
  const collection = featureCollection(mergedFeatures, 'turkiye_map.processed.mahalle_geometrileri');
  writeJsonCompact(path.join(paths.processedDir, 'mahalle-geometrileri.geojson'), collection);
  writeJson(path.join(paths.processedDir, 'mahalle-geometrileri-report.json'), {
    source_count: SOURCES.length,
    geometry_count: mergedFeatures.length,
    sources: sourceReports,
  });

  writeJsonCompact(path.join(distGeojsonDir, 'mahalle-geometrileri.geojson'), collection);
  writeGroupedGeojson(
    path.join(distGeojsonDir, 'mahalle-geometrileri-by-province'),
    groupBy(mergedFeatures, (feature) => feature.properties.province_id),
    'turkiye_map.dist.mahalle_geometrileri_by_province',
  );
  writeGroupedGeojson(
    path.join(distGeojsonDir, 'mahalle-geometrileri-by-district'),
    groupBy(mergedFeatures, (feature) => feature.properties.district_id),
    'turkiye_map.dist.mahalle_geometrileri_by_district',
  );

  logStep(`Normalized ${mergedFeatures.length} mahalle geometries from ${SOURCES.length} sources`);
}

/* v8 ignore next -- CLI entrypoint guard */
if (invokedPath === scriptPath) {
  main().catch((error) => {
    console.error('[pipeline:normalize-mahalle-geometrileri] failed');
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exit(1);
  });
}
