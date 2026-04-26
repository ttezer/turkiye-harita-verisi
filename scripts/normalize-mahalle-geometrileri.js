#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import iconv from 'iconv-lite';
import shp from 'shpjs';
import proj4 from 'proj4';
import polygonClipping from 'polygon-clipping';
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
const distGeojsonDir = paths.distGeojsonDir;
const sourceLabels = readJson(paths.sourceLabels);
const PUBLIC_CITY_GUIDE_LABEL = sourceLabels.public_data_and_city_guides;
const PUBLIC_SOURCES_LABEL = sourceLabels.public_sources;
const USER_PROVIDED_KML_LABEL = sourceLabels.user_provided_kml;

const SOURCES = [
  {
    province_id: 'TR-P-06',
    province_name: 'Ankara',
    slug: 'ankara',
    source_name: 'Ankara BÃ¼yÃ¼kÅŸehir Belediyesi Kent Rehberi - Mahalle',
    source_label: PUBLIC_CITY_GUIDE_LABEL,
    format: 'ankara_kent_rehberi',
    neighborhood_service_url: 'https://MDY5MGY4NTQtMWQ1Ni00MmE5LTljZTUtZGQyZDE4YWY1YTdm.gissrv.org',
    district_service_url: 'https://ZjY0MGQyODEtYjU0Mi00YWY1LThiNjktZjVjMTcwNjE4OTJj.gissrv.org',
    name_field: 'ad',
    district_field: 'ILCE_AD',
    district_id_field: 'ilceid',
    repair_disjoint_rings: true,
  },
  {
    province_id: 'TR-P-48',
    province_name: 'MuÄŸla',
    slug: 'mugla',
    source_name: 'MuÄŸla BÃ¼yÃ¼kÅŸehir Belediyesi Kent Rehberi - MAKS Resmi Mahalleler',
    source_label: PUBLIC_CITY_GUIDE_LABEL,
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
    source_label: PUBLIC_CITY_GUIDE_LABEL,
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
    province_id: 'TR-P-27',
    province_name: 'Gaziantep',
    slug: 'gaziantep',
    source_name: 'Gaziantep AÃ§Ä±k Veri Platformu - Mahalle SÄ±nÄ±r AlanlarÄ±',
    source_label: PUBLIC_CITY_GUIDE_LABEL,
    format: 'kml',
    infer_district_from_geometry: true,
  },
  {
    province_id: 'TR-P-54',
    province_name: 'Sakarya',
    slug: 'sakarya',
    source_name: 'Sakarya BÃ¼yÃ¼kÅŸehir Belediyesi AÃ§Ä±k Veri PortalÄ± - Mahalle SÄ±nÄ±rlarÄ±',
    source_label: PUBLIC_CITY_GUIDE_LABEL,
    format: 'kmz',
  },
];

const municipalDir = path.join(paths.rootDir, 'source', 'yayinlanabilir', 'municipal');
const LOCAL_GEOJSON_CRS_DEFS = {
  'EPSG:5254': '+proj=tmerc +lat_0=0 +lon_0=30 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +towgs84=0.023,0.036,-0.068,0.00176,0.00912,-0.01136,0.00439 +units=m +no_defs +type=crs',
};

const LOCAL_MUNICIPAL_SOURCES = [
  {
    province_id: 'TR-P-06',
    province_name: 'Ankara',
    slug: 'ankara',
    source_name: 'Ankara Büyükşehir Belediyesi Seffaf Ankara Açık Veri Platformu - MAKS Mahalle',
    source_label: PUBLIC_CITY_GUIDE_LABEL,
    format: 'local_geojson',
    file_path: path.join(municipalDir, '06-ankara', 'mahalle', 'raw', 'ankara-mahalle-sinirlari.geojson'),
    reference_file: path.join(municipalDir, '06-ankara', 'mahalle', 'raw', 'ankara-ilce-referans.json'),
    name_field: 'ad',
    district_id_field: 'ilceid',
  },
  {
    province_id: 'TR-P-16',
    province_name: 'Bursa',
    slug: 'bursa',
    source_name: 'Bursa Açık Yeşil Platformu - Mahalle Sınırları',
    source_label: PUBLIC_CITY_GUIDE_LABEL,
    format: 'local_geojson',
    file_path: path.join(municipalDir, '16-bursa', 'mahalle', 'raw', 'bursa-mahalle-sinirlari.geojson'),
    name_field: 'AD',
    infer_district_from_geometry: true,
  },
  {
    province_id: 'TR-P-27',
    province_name: 'Gaziantep',
    slug: 'gaziantep',
    source_name: 'Gaziantep Açık Veri Platformu - Mahalle Sınır Alanları',
    source_label: PUBLIC_CITY_GUIDE_LABEL,
    format: 'local_kml',
    file_path: path.join(municipalDir, '27-gaziantep', 'mahalle', 'raw', 'gaziantep-mahalle-sinir-alanlari.kml'),
    infer_district_from_geometry: true,
  },
  {
    province_id: 'TR-P-38',
    province_name: 'Kayseri',
    slug: 'kayseri',
    source_name: 'Kayseri Büyükşehir Belediyesi Açık Veri Platformu - Mahalle Sınırı',
    source_label: PUBLIC_CITY_GUIDE_LABEL,
    format: 'local_geojson',
    file_path: path.join(municipalDir, '38-kayseri', 'mahalle', 'raw', 'kayseri-mahalle-siniri.geojson'),
    name_field: 'ADI',
    infer_district_from_geometry: true,
  },
  {
    province_id: 'TR-P-42',
    province_name: 'Konya',
    slug: 'konya',
    source_name: 'Konya Büyükşehir Belediyesi Açık Veri Platformu - Mahalleler',
    source_label: PUBLIC_CITY_GUIDE_LABEL,
    format: 'local_geojson',
    file_path: path.join(municipalDir, '42-konya', 'mahalle', 'raw', 'konya-mahalleler-2024.geojson'),
    name_field: 'ADI_NUMARA',
    infer_district_from_geometry: true,
  },
  {
    province_id: 'TR-P-52',
    province_name: 'Ordu',
    slug: 'ordu',
    source_name: 'Ordu Büyükşehir Belediyesi Akıllı Şehir Açık Veri Platformu - Mahalleler',
    source_label: PUBLIC_CITY_GUIDE_LABEL,
    format: 'local_geojson',
    file_path: path.join(municipalDir, '52-ordu', 'mahalle', 'raw', 'ordu-mahalleri-yapi-sayisina-gore-sirali.geojson'),
    name_field: 'MAHALLE ADI',
    district_field: 'İLÇE ADI',
  },
  {
    province_id: 'TR-P-48',
    province_name: 'Muğla',
    slug: 'mugla',
    source_name: 'Muğla Büyükşehir Belediyesi CBS - MAKS Resmi Mahalleler',
    source_label: PUBLIC_CITY_GUIDE_LABEL,
    format: 'local_geojson',
    file_path: path.join(municipalDir, '48-mugla', 'mahalle', 'raw', 'mugla-mahalle-sinirlari.geojson'),
    name_field: 'Mahalle',
    district_field: 'Ilce',
  },
  {
    province_id: 'TR-P-20',
    province_name: 'Denizli',
    slug: 'denizli',
    source_name: 'Denizli Adres Bilgi Sistemi - Mahalle Sınırları',
    source_label: PUBLIC_CITY_GUIDE_LABEL,
    format: 'local_geojson',
    file_path: path.join(municipalDir, '20-denizli', 'mahalle', 'raw', 'denizli-mahalle-sinirlari.geojson'),
    name_field: 'AD',
    district_field: 'ILCE_AD',
  },
  {
    province_id: 'TR-P-54',
    province_name: 'Sakarya',
    slug: 'sakarya',
    source_name: 'Sakarya Büyükşehir Belediyesi Açık Veri Portalı - Mahalle Sınırları',
    source_label: PUBLIC_CITY_GUIDE_LABEL,
    format: 'local_geojson',
    file_path: path.join(municipalDir, '54-sakarya', 'mahalle', 'raw', 'sakarya-mahalle-sinirlari.geojson'),
    name_field: 'ad',
    district_field: 'ilce',
  },
  {
    province_id: 'TR-P-58',
    province_name: 'Sivas',
    slug: 'sivas',
    source_name: 'Sivas Belediyesi Açık Veri Platformu - Mahalle Sınırları',
    source_label: PUBLIC_CITY_GUIDE_LABEL,
    format: 'local_geojson',
    file_path: path.join(municipalDir, '58-sivas', 'mahalle', 'raw', 'sivas-mahalle-sinirlari.geojson'),
    name_field: 'ADI',
    infer_district_from_geometry: true,
  },
  {
    province_id: 'TR-P-61',
    province_name: 'Trabzon',
    slug: 'trabzon',
    source_name: 'Trabzon BÃ¼yÃ¼kÅŸehir Belediyesi AÃ§Ä±k Veri PortalÄ± - Adrese DayalÄ± Mahalle SÄ±nÄ±rlarÄ±',
    source_label: PUBLIC_CITY_GUIDE_LABEL,
    format: 'local_geojson',
    file_path: path.join(municipalDir, '61-trabzon', 'mahalle', 'raw', 'trabzon-mahalle.geojson'),
    name_field: 'ad',
    infer_district_from_geometry: true,
  },
  {
    province_id: 'TR-P-41',
    province_name: 'Kocaeli',
    slug: '41-kocaeli',
    source_name: 'Kocaeli Mahalle KML - kullanıcı tarafından sağlandı',
    source_label: USER_PROVIDED_KML_LABEL,
    format: 'local_kml',
    file_path: path.join(paths.manualMahalleRawDir, '41-kocaeli', 'kocaeli-mahalle.kml'),
    district_field: 'ilce_adi',
  },
  {
    province_id: 'TR-P-22',
    province_name: 'Edirne',
    slug: '22-edirne',
    source_name: 'Edirne Mahalle KML - kullanıcı tarafından sağlandı',
    source_label: USER_PROVIDED_KML_LABEL,
    format: 'local_kml',
    file_path: path.join(paths.manualMahalleRawDir, '22-edirne', 'edirne-mahalleler.kml'),
    pre_matched_id_field: 'mahalle_id',
    district_field: 'ilce_adi',
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
  const normalizedText = toNameAscii(normalizeDisplayText(value)).trim();
  const keys = [key];
  const hasOsbSuffix = /(?:^|\s)osb$|organize sanayi bolgesi$/.test(normalizedText);
  const withoutOsb = hasOsbSuffix
    ? compactKey(normalizedText.replace(/(?:^|\s)osb$|organize sanayi bolgesi$/g, '').trim())
    : key;
  keys.push(withoutOsb);
  if (/\b(koyu|koy)$/.test(normalizedText)) {
    keys.push(compactKey(normalizedText.replace(/\b(koyu|koy)$/, '').trim()));
  }
  if (/\b(mahallesi|mahalle)$/.test(normalizedText)) {
    keys.push(compactKey(normalizedText.replace(/\b(mahallesi|mahalle)$/, '').trim()));
  }
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

function normalizePolygonalGeometry(geometry, repairDisjointRings = false) {
  if (geometry.type === 'Polygon') {
    const coordinates = stripPolygonZ(geometry.coordinates);
    if (!repairDisjointRings) {
      return {
        ...geometry,
        coordinates,
      };
    }

    const repairedCoordinates = repairPolygonRings(coordinates);
    if (repairedCoordinates.length === 1) {
      return {
        ...geometry,
        coordinates: repairedCoordinates[0],
      };
    }

    return {
      type: 'MultiPolygon',
      coordinates: repairedCoordinates,
    };
  }

  if (geometry.type === 'MultiPolygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates
        .map(stripPolygonZ)
        .flatMap((polygon) => (repairDisjointRings ? repairPolygonRings(polygon) : [polygon]))
        .filter(isValidPolygon),
    };
  }

  if (geometry.type === 'GeometryCollection') {
    const polygons = [];
    for (const item of geometry.geometries || []) {
        const normalized = normalizePolygonalGeometry(item, repairDisjointRings);
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

function repairPolygonRings(polygon) {
  const polygons = [];

  for (const ring of polygon) {
    if (!isValidPolygon([ring])) {
      continue;
    }

    const containingPolygons = polygons
      .filter((candidate) => ringContainsPoint(candidate[0], ring[0]))
      .sort((a, b) => ringArea(a[0]) - ringArea(b[0]));

    if (containingPolygons[0]) {
      containingPolygons[0].push(ring);
    } else {
      polygons.push([ring]);
    }
  }

  return polygons;
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
      source: source.source_label || PUBLIC_CITY_GUIDE_LABEL,
      source_label: source.source_label || PUBLIC_CITY_GUIDE_LABEL,
      source_name: source.source_name,
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
    source: source.source_label || PUBLIC_CITY_GUIDE_LABEL,
    source_label: source.source_label || PUBLIC_CITY_GUIDE_LABEL,
    source_name: source.source_name,
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

function getLegacySourceDir(source) {
  return path.join(paths.manualMahalleRawDir, source.slug);
}

function hasLegacySourceDir(source) {
  return fs.existsSync(getLegacySourceDir(source));
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
  const dir = getLegacySourceDir(source);
  const files = fs.readdirSync(dir);
  const shpFile = files.find((file) => file.toLowerCase().endsWith('.shp'));
  if (!shpFile) {
    throw new Error(`Missing .shp file in ${dir}`);
  }
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

function createAnkaraRequestToken() {
  const randomGuid = () => crypto.randomUUID();
  const tokenPayload = `${randomGuid()}|${Date.now()}|${randomGuid()}`;
  const cipher = crypto.createCipheriv('aes-128-ecb', Buffer.from('YpV0lECaM7sSw4US', 'utf8'), null);
  cipher.setAutoPadding(true);
  return `${cipher.update(tokenPayload, 'utf8', 'base64')}${cipher.final('base64')}`;
}

async function fetchAnkaraProxyJson(serviceUrl, params) {
  const query = new URLSearchParams(params);
  const proxiedUrl = `https://kentrehberi.ankara.bel.tr/api/Gis/Proxy?${serviceUrl}/query?${query.toString()}`;
  const response = await fetch(proxiedUrl, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${createAnkaraRequestToken()}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Ankara kent rehberi request failed: ${response.status}`);
  }

  const payload = await response.json();
  return typeof payload === 'string' ? JSON.parse(payload) : payload;
}

async function readAnkaraKentRehberiSource(source) {
  const districtPayload = await fetchAnkaraProxyJson(source.district_service_url, {
    where: '1=1',
    outFields: 'id,ad',
    returnGeometry: 'false',
    f: 'pjson',
    resultRecordCount: '5000',
  });
  const districtLookup = new Map((districtPayload.features || []).map((feature) => [
    normalizeArcgisGuid(feature.attributes?.id),
    normalizeDisplayText(feature.attributes?.ad),
  ]));

  const neighborhoodPayload = await fetchAnkaraProxyJson(source.neighborhood_service_url, {
    where: '1=1',
    outFields: '*',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'geojson',
    resultRecordCount: '5000',
  });

  for (const feature of neighborhoodPayload.features || []) {
    const districtName = districtLookup.get(normalizeArcgisGuid(feature.properties?.[source.district_id_field]));
    if (districtName) {
      feature.properties[source.district_field] = districtName;
    }
  }

  return neighborhoodPayload;
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
  const filePath = findFileByExtension(getLegacySourceDir(source), '.kmz');
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
  const filePath = findFileByExtension(getLegacySourceDir(source), '.kml');
  let xml = fs.readFileSync(filePath, 'utf8');
  xml = xml.replace('<Document id=', '<Document xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" id=');
  return kml(new DOMParser().parseFromString(xml, 'text/xml'));
}

function resolveSourceFormat(source) {
  if (source.format === 'arcgis' || source.format === 'ankara_kent_rehberi') {
    return source.format;
  }
  if (source.format !== 'auto') {
    return source.format;
  }

  const dir = path.join(paths.manualMahalleRawDir, source.slug);
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

  for (const settlement of settlements) {
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
  if (geometry.type === 'GeometryCollection') {
    (geometry.geometries || []).forEach((g) => walk(g.coordinates));
  } else {
    walk(geometry.coordinates);
  }

  return [
    points.reduce((sum, point) => sum + point[0], 0) / points.length,
    points.reduce((sum, point) => sum + point[1], 0) / points.length,
  ];
}

function inferDistrictFromGeometry(source, feature, districtFeatures) {
  const point = geometryCentroid(feature.geometry);
  const match = districtFeatures.find((districtFeature) => geometryContainsPoint(districtFeature.geometry, point));
  if (match) {
    return match.properties.id;
  }

  let bestMatch = null;
  let bestArea = 0;
  for (const districtFeature of districtFeatures) {
    const intersection = polygonClipping.intersection(
      toMultiPolygonCoordinates(feature.geometry),
      toMultiPolygonCoordinates(districtFeature.geometry),
    );
    const overlapGeometry = fromMultiPolygonCoordinates(intersection);
    if (!overlapGeometry) {
      continue;
    }
    const overlapArea = geometryAreaDegrees(overlapGeometry);
    if (overlapArea > bestArea) {
      bestArea = overlapArea;
      bestMatch = districtFeature.properties.id;
    }
  }

  return bestArea > 1e-12 ? bestMatch : null;
}

function normalizeSourceFeature(source, feature, indexes, districtFeatures) {
  // Pre-matched source: settlement ID is directly in the feature properties
  if (source.pre_matched_id_field) {
    const id = feature.properties[source.pre_matched_id_field];
    if (!id) {
      // No pre-matched ID — check for an explicit override by name+district before skipping
      const fallbackName = feature.properties.name;
      const fallbackDistrictName = source.district_field && feature.properties[source.district_field];
      if (fallbackName && fallbackDistrictName) {
        const fallbackDistrict = resolveDistrictByName(source, fallbackDistrictName, indexes.districts);
        if (fallbackDistrict) {
          const fallbackKey = compactKey(fallbackName);
          const fallbackOverride =
            indexes.overrides.byDistrictAndRaw.get(`${source.province_id}|${fallbackDistrict.id}|${fallbackKey}`) ||
            indexes.overrides.byProvinceAndRaw.get(`${source.province_id}|${fallbackKey}`);
          if (fallbackOverride?.action === 'include_as_osb' || fallbackOverride?.action === 'include') {
            const geometry = normalizePolygonalGeometry(feature.geometry, source.repair_disjoint_rings);
            if (fallbackOverride.action === 'include_as_osb') {
              const osbName = normalizeDisplayText(fallbackName);
              const nameKey = compactKey(fallbackName).toUpperCase();
              const distSeq = fallbackDistrict.id.split('-').pop();
              const provincePlate = source.province_id.replace('TR-P-', '');
              const osbId = `TR-Y-${provincePlate}-${distSeq}-OSB-${nameKey}`;
              return {
                status: 'osb',
                raw_name: fallbackName,
                district_id: fallbackDistrict.id,
                district_name: fallbackDistrict.name,
                osb_id: osbId,
                feature: {
                  type: 'Feature',
                  properties: {
                    id: osbId,
                    level: 'yerlesim',
                    type: 'osb',
                    parent_id: fallbackDistrict.id,
                    province_id: source.province_id,
                    district_id: fallbackDistrict.id,
                    name: osbName,
                    source_raw_name: osbName,
                    source: source.source_label || '',
                    source_label: source.source_label || '',
                    source_name: source.source_name,
                    source_only: true,
                  },
                  geometry: roundGeometryCoordinates(rewindGeometry(geometry), 6),
                },
              };
            }
            return {
              status: 'matched',
              feature: {
                type: 'Feature',
                properties: buildGeometryProperties(source, fallbackDistrict, fallbackName, fallbackOverride),
                geometry: roundGeometryCoordinates(rewindGeometry(geometry), 6),
              },
            };
          }
          if (fallbackOverride?.action === 'skip') {
            return { status: 'skipped', raw_name: fallbackName, district_id: fallbackDistrict.id, district_name: fallbackDistrict.name, reason: fallbackOverride.reason || 'manual_skip' };
          }
        }
      }
      return { status: 'skipped', reason: 'no_pre_matched_id' };
    }
    const settlement = indexes.settlementsById.get(id);
    if (!settlement) return { status: 'unmatched', raw_name: id, district_id: null, district_name: null };
    const district = indexes.districts.byId.get(settlement.district_id);
    const geometry = normalizePolygonalGeometry(feature.geometry, source.repair_disjoint_rings);
    return {
      status: 'matched',
      feature: {
        type: 'Feature',
        properties: buildGeometryProperties(source, district, feature.properties.name, null, settlement),
        geometry: roundGeometryCoordinates(rewindGeometry(geometry), 6),
      },
    };
  }

  let rawName;
  let district;

  if (source.resolved_format === 'kmz' || source.resolved_format === 'kml') {
    const description = parseHtmlDescription(feature.properties.description);
    rawName = description.ad || description.mahalle || description.mahalle_adi || feature.properties.name;
    const rawDistrictName = description.ilce || description.ilceadi || description.ilce_adi || feature.properties.ilce || feature.properties.ILCE || (source.district_field && feature.properties[source.district_field]);
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
      const inferredDistrictId = inferDistrictFromGeometry(source, feature, districtFeatures);
      if (!inferredDistrictId) {
        const provinceOverride = indexes.overrides.byProvinceAndRaw.get(`${source.province_id}|${compactKey(rawName)}`);
        if (provinceOverride?.district_id || provinceOverride?.target_district_id) {
          district = indexes.districts.byId.get(provinceOverride.target_district_id || provinceOverride.district_id);
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

  const geometry = normalizePolygonalGeometry(feature.geometry, source.repair_disjoint_rings);

  if (override?.action === 'include_as_osb') {
    const osbName = normalizeDisplayText(rawName);
    const nameKey = compactKey(rawName).toUpperCase();
    const distSeq = district.id.split('-').pop();
    const provincePlate = source.province_id.replace('TR-P-', '');
    const osbId = `TR-Y-${provincePlate}-${distSeq}-OSB-${nameKey}`;
    return {
      status: 'osb',
      raw_name: rawName,
      district_id: district.id,
      district_name: district.name,
      osb_id: osbId,
      feature: {
        type: 'Feature',
        properties: {
          id: osbId,
          level: 'yerlesim',
          type: 'osb',
          parent_id: district.id,
          province_id: source.province_id,
          district_id: district.id,
          name: osbName,
          source_raw_name: osbName,
          source: source.source_label || '',
          source_label: source.source_label || '',
          source_name: source.source_name,
          source_only: true,
        },
        geometry: roundGeometryCoordinates(rewindGeometry(geometry), 6),
      },
    };
  }

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
    const mergeKey = feature.properties.source_only
      ? [
          'source_only',
          feature.properties.province_id,
          feature.properties.district_id,
          toNameAscii(feature.properties.name || ''),
        ].join('|')
      : feature.properties.id;
    const existing = byId.get(mergeKey);
    if (!existing) {
      byId.set(mergeKey, feature);
      continue;
    }

    const mergedRawNames = uniqueKeys([
      existing.properties.source_raw_name,
      feature.properties.source_raw_name,
    ]).join(' | ');
    existing.properties.source_raw_name = mergedRawNames || existing.properties.source_raw_name;
    existing.properties.source_only_duplicate_ids = uniqueKeys([
      ...(existing.properties.source_only_duplicate_ids || []),
      feature.properties.id,
    ]);
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

function toMultiPolygonCoordinates(geometry) {
  if (geometry.type === 'Polygon') {
    return [geometry.coordinates];
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates;
  }
  if (geometry.type === 'GeometryCollection') {
    return (geometry.geometries || []).flatMap(toMultiPolygonCoordinates);
  }
  throw new Error(`Unsupported geometry repair type: ${geometry.type}`);
}

function fromMultiPolygonCoordinates(coordinates) {
  if (!coordinates || coordinates.length === 0) {
    return null;
  }
  return coordinates.length === 1
    ? { type: 'Polygon', coordinates: coordinates[0] }
    : { type: 'MultiPolygon', coordinates };
}

function ringAreaDegrees(ring) {
  let sum = 0;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    sum += (ring[previous][0] * ring[index][1]) - (ring[index][0] * ring[previous][1]);
  }
  return Math.abs(sum / 2);
}

function geometryAreaDegrees(geometry) {
  return toMultiPolygonCoordinates(geometry).reduce((sum, polygon) => {
    const outerArea = ringAreaDegrees(polygon[0] || []);
    const holeArea = polygon.slice(1).reduce((holeSum, ring) => holeSum + ringAreaDegrees(ring), 0);
    return sum + outerArea - holeArea;
  }, 0);
}

function geometryPolygonCount(geometry) {
  return toMultiPolygonCoordinates(geometry).length;
}

function geometryHoleCount(geometry) {
  return toMultiPolygonCoordinates(geometry).reduce((sum, polygon) => sum + Math.max(0, polygon.length - 1), 0);
}

function applyGeometryRepairs(features, repairConfig) {
  const repairs = repairConfig?.repairs || [];
  if (repairs.length === 0) {
    return { features, report: [] };
  }

  const featuresById = new Map(features.map((feature) => [feature.properties.id, feature]));
  const repairReport = [];

  for (const repair of repairs) {
    const outer = featuresById.get(repair.outer_id);
    const inner = featuresById.get(repair.inner_id);
    if (!outer || !inner) {
      repairReport.push({
        ...repair,
        status: 'skipped',
        reason: !outer ? 'outer_not_found' : 'inner_not_found',
      });
      continue;
    }

    const beforeArea = geometryAreaDegrees(outer.geometry);
    const beforePolygonCount = geometryPolygonCount(outer.geometry);
    const beforeHoleCount = geometryHoleCount(outer.geometry);
    const difference = polygonClipping.difference(
      toMultiPolygonCoordinates(outer.geometry),
      toMultiPolygonCoordinates(inner.geometry),
    );
    const repairedGeometry = fromMultiPolygonCoordinates(difference);
    if (!repairedGeometry) {
      repairReport.push({
        ...repair,
        status: 'skipped',
        reason: 'empty_result',
      });
      continue;
    }

    outer.geometry = roundGeometryCoordinates(rewindGeometry(repairedGeometry), 6);
    outer.properties.geometry_repair = 'outer_minus_inner';
    outer.properties.geometry_repair_removed_inner_ids = [
      ...new Set([...(outer.properties.geometry_repair_removed_inner_ids || []), inner.properties.id]),
    ];
    outer.properties.geometry_repair_note = 'Ä°Ã§ yerleÅŸim sÄ±nÄ±rÄ± dÄ±ÅŸ polygondan Ã§Ä±karÄ±ldÄ±.';

    const afterArea = geometryAreaDegrees(outer.geometry);
    repairReport.push({
      ...repair,
      status: 'applied',
      before_polygon_count: beforePolygonCount,
      after_polygon_count: geometryPolygonCount(outer.geometry),
      before_hole_count: beforeHoleCount,
      after_hole_count: geometryHoleCount(outer.geometry),
      before_area_degrees: Number(beforeArea.toFixed(8)),
      after_area_degrees: Number(afterArea.toFixed(8)),
      removed_area_degrees: Number((beforeArea - afterArea).toFixed(8)),
    });
  }

  return { features, report: repairReport };
}

// Threshold in degrees (~0.1° ≈ ~10 km)
const FAR_MULTIPOLYGON_THRESHOLD_DEG = 0.1;

function polygonRingCentroid(ring) {
  const lons = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  return [
    (Math.min(...lons) + Math.max(...lons)) / 2,
    (Math.min(...lats) + Math.max(...lats)) / 2,
  ];
}

function detectFarMultipolygons(features) {
  const results = [];
  for (const feature of features) {
    if (feature.geometry?.type !== 'MultiPolygon') continue;
    const polygons = feature.geometry.coordinates;
    if (polygons.length < 2) continue;
    const centroids = polygons.map((poly) => polygonRingCentroid(poly[0]));
    const [refLon, refLat] = centroids[0];
    const maxDist = centroids.slice(1).reduce((max, [lon, lat]) => {
      const d = Math.sqrt((lon - refLon) ** 2 + (lat - refLat) ** 2);
      return Math.max(max, d);
    }, 0);
    if (maxDist >= FAR_MULTIPOLYGON_THRESHOLD_DEG) {
      const p = feature.properties;
      results.push({
        id: p.id,
        name: p.name,
        province_id: p.province_id,
        district_id: p.district_id,
        district_name: null,
        polygon_count: polygons.length,
        max_dist_deg: Math.round(maxDist * 1000) / 1000,
      });
    }
  }
  return results;
}

function readLocalGeojsonSource(source) {
  const collection = JSON.parse(fs.readFileSync(source.file_path, 'utf8'));
  return normalizeLocalGeojsonCrs(collection);
}

function normalizeLocalGeojsonCrs(collection) {
  const sourceCrs = detectGeojsonCrs(collection);
  if (!sourceCrs || sourceCrs === 'EPSG:4326') {
    return collection;
  }

  ensureProjDefinition(sourceCrs);
  return {
    ...collection,
    features: (collection.features || []).map((feature) => ({
      ...feature,
      geometry: transformGeometryCoordinates(feature.geometry, sourceCrs, 'EPSG:4326'),
    })),
  };
}

function detectGeojsonCrs(collection) {
  const rawName = collection?.crs?.properties?.name;
  if (!rawName) {
    return 'EPSG:4326';
  }

  const normalized = String(rawName).trim().toUpperCase();
  if (normalized === 'CRS84' || normalized.endsWith(':CRS84') || normalized === 'EPSG:4326') {
    return 'EPSG:4326';
  }

  const epsgMatch = normalized.match(/EPSG(?::|::)(\d+)/);
  if (epsgMatch) {
    return `EPSG:${epsgMatch[1]}`;
  }

  return normalized;
}

function ensureProjDefinition(crsCode) {
  if (proj4.defs(crsCode)) {
    return;
  }

  const definition = LOCAL_GEOJSON_CRS_DEFS[crsCode];
  if (!definition) {
    throw new Error(`Unsupported local GeoJSON CRS: ${crsCode}`);
  }
  proj4.defs(crsCode, definition);
}

function transformGeometryCoordinates(geometry, sourceCrs, targetCrs) {
  if (!geometry?.coordinates) {
    return geometry;
  }

  return {
    ...geometry,
    coordinates: transformCoordinateArray(geometry.coordinates, sourceCrs, targetCrs),
  };
}

function transformCoordinateArray(coordinates, sourceCrs, targetCrs) {
  if (!Array.isArray(coordinates)) {
    return coordinates;
  }

  if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
    return proj4(sourceCrs, targetCrs, [coordinates[0], coordinates[1]]);
  }

  return coordinates.map((item) => transformCoordinateArray(item, sourceCrs, targetCrs));
}

function readLocalKmlSource(source) {
  let xml = fs.readFileSync(source.file_path, 'utf8');
  xml = xml.replace('<Document id=', '<Document xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" id=');
  return kml(new DOMParser().parseFromString(xml, 'text/xml'));
}

function buildReferenceDistrictMap(referenceFile) {
  const entries = JSON.parse(fs.readFileSync(referenceFile, 'utf8'));
  return new Map(entries.map((entry) => [entry.id.toLowerCase(), entry.ad]));
}

function safeNormalizeLocalFeature(resolvedSource, feature, indexes, districtFeatures) {
  try {
    return normalizeSourceFeature(resolvedSource, feature, indexes, districtFeatures);
  } catch (error) {
    return {
      status: 'unmatched',
      raw_name: feature.properties?.[resolvedSource.name_field] || '',
      district_id: null,
      district_name: null,
      reason: `error: ${error.message}`,
    };
  }
}

async function processLocalMunicipalSources(features, sourceReports, indexes, districtFeaturesByProvince) {
  for (const source of LOCAL_MUNICIPAL_SOURCES) {
    if (!fs.existsSync(source.file_path)) {
      sourceReports.push({
        province_id: source.province_id,
        province_name: source.province_name,
        source_name: source.source_name,
        source_label: source.source_label,
        format: source.format,
        source_feature_count: 0,
        matched_count: 0,
        unmatched: [],
        ambiguous: [],
        skipped: ['local_file_missing'],
      });
      continue;
    }

    const collection = source.format === 'local_kml'
      ? readLocalKmlSource(source)
      : readLocalGeojsonSource(source);

    const districtFeatures = districtFeaturesByProvince.get(source.province_id) || [];
    const report = {
      province_id: source.province_id,
      province_name: source.province_name,
      source_name: source.source_name,
      source_label: source.source_label,
      format: source.format,
      source_feature_count: collection.features.length,
      matched_count: 0,
      unmatched: [],
      ambiguous: [],
      skipped: [],
      osb_areas: [],
    };

    const districtRef = source.reference_file
      ? buildReferenceDistrictMap(source.reference_file)
      : null;

    for (const feature of collection.features) {
      let processedFeature = feature;

      if (districtRef && source.district_id_field) {
        const uuid = (feature.properties[source.district_id_field] || '').toLowerCase();
        const districtName = districtRef.get(uuid);
        processedFeature = {
          ...feature,
          properties: { ...feature.properties, _resolved_district: districtName },
        };
      }

      const resolvedSource = {
        ...source,
        resolved_format: source.format === 'local_kml' ? 'kml' : 'arcgis',
        district_field: districtRef ? '_resolved_district' : source.district_field,
      };

      const result = safeNormalizeLocalFeature(resolvedSource, processedFeature, indexes, districtFeatures);
      if (result.status === 'matched') {
        features.push(result.feature);
        report.matched_count += 1;
      } else if (result.status === 'osb') {
        features.push(result.feature);
        report.osb_areas.push({ raw_name: result.raw_name, district_id: result.district_id, district_name: result.district_name, osb_id: result.osb_id });
      } else if (report[result.status]) {
        report[result.status].push(result);
      }
    }

    sourceReports.push(report);
  }
}

export async function main() {
  logStep('Normalizing mahalle geometry sources');

  const settlements = readJson(path.join(paths.processedDir, 'yerlesimler.metadata.json'));
  const overrides = readOptionalJson(paths.mahalleOpenDataNameOverrides, []);
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

  await processLocalMunicipalSources(features, sourceReports, indexes, districtFeaturesByProvince);

  if (process.env.INCLUDE_MANUAL_MAHALLE_SOURCES === '1') {
    for (const source of SOURCES) {
      const resolvedSource = {
        ...source,
        resolved_format: resolveSourceFormat(source),
      };
      const isLegacyFileSource = ['kmz', 'kml', 'shapefile'].includes(resolvedSource.resolved_format);
      if (isLegacyFileSource && !hasLegacySourceDir(resolvedSource)) {
        sourceReports.push({
          province_id: source.province_id,
          province_name: source.province_name,
          source_name: source.source_name,
          source_label: source.source_label || PUBLIC_CITY_GUIDE_LABEL,
          format: resolvedSource.resolved_format,
          source_feature_count: 0,
          matched_count: 0,
          unmatched: [],
          ambiguous: [],
          skipped: ['manual_source_dir_missing'],
        });
        continue;
      }
      const collection = resolvedSource.resolved_format === 'arcgis'
        ? await readArcgisSource(resolvedSource)
        : resolvedSource.resolved_format === 'ankara_kent_rehberi'
          ? await readAnkaraKentRehberiSource(resolvedSource)
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
        source_label: source.source_label || PUBLIC_CITY_GUIDE_LABEL,
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
  }
  const mergedFeatures = mergeDuplicateFeatureGeometries(features);
  const geometryRepairs = readOptionalJson(path.join(paths.referenceDir, 'mahalle-geometry-repairs.json'), { repairs: [] });
  const repairResult = applyGeometryRepairs(mergedFeatures, geometryRepairs);
  const repairedFeatures = repairResult.features;
  const farMultipolygons = detectFarMultipolygons(repairedFeatures).map((item) => ({
    ...item,
    district_name: indexes.districts.byId.get(item.district_id)?.name || null,
  }));
  const collection = featureCollection(repairedFeatures, 'turkiye_map.processed.mahalle_geometrileri');
  writeJsonCompact(path.join(paths.processedDir, 'mahalle-geometrileri.geojson'), collection);
  writeJson(path.join(paths.processedDir, 'mahalle-geometrileri-report.json'), {
    source_count: sourceReports.length,
    geometry_count: repairedFeatures.length,
    geometry_repair_count: repairResult.report.filter((item) => item.status === 'applied').length,
    geometry_repairs: repairResult.report,
    far_multipolygons: farMultipolygons,
    sources: sourceReports,
  });

  writeJsonCompact(path.join(distGeojsonDir, 'mahalle-geometrileri.geojson'), collection);
  writeGroupedGeojson(
    path.join(distGeojsonDir, 'mahalle-geometrileri-by-province'),
    groupBy(repairedFeatures, (feature) => feature.properties.province_id),
    'turkiye_map.dist.mahalle_geometrileri_by_province',
  );
  writeGroupedGeojson(
    path.join(distGeojsonDir, 'mahalle-geometrileri-by-district'),
    groupBy(repairedFeatures, (feature) => feature.properties.district_id),
    'turkiye_map.dist.mahalle_geometrileri_by_district',
  );

  logStep(`Normalized ${repairedFeatures.length} mahalle geometries from ${sourceReports.length} sources`);
}

/* v8 ignore next -- CLI entrypoint guard */
if (invokedPath === scriptPath) {
  main().catch((error) => {
    console.error('[pipeline:normalize-mahalle-geometrileri] failed');
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exit(1);
  });
}
