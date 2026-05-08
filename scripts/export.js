#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { topology } from 'topojson-server';
import XLSX from 'xlsx';
import { featureCollectionToGml, featureCollectionToOsm } from '../download.js';
import {
  ensureDir,
  paths,
  readJson,
  roundGeometryCoordinates,
  rewindGeometry,
  runPipelineStep,
  sortedCopy,
  writeJson,
  writeJsonCompact,
  logStep,
} from './lib/pipeline.js';

const scriptPath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const distRoot = path.join(paths.rootDir, 'dist');
const INTERNAL_EXPORT_FIELDS = new Set([
  'hdx_id',
  'parent_hdx_id',
  'member_hdx_ids',
  'source_valid_on',
  'source_valid_to',
  'source_version',
  'source_file',
  'source_row',
  'source_raw_name',
  'source_report',
  'source_label',
  'geometry_type',
  'area_sqkm',
  'administrative_unit_name_ascii',
]);

function ensureMetadataGeometrySync(label, metadata, geometryCollection) {
  const metadataIds = new Set(metadata.map((item) => item.id));
  const geometryIds = new Set(geometryCollection.features.map((feature) => feature.properties.id));

  const missingMetadataIds = [...geometryIds].filter((id) => !metadataIds.has(id));
  if (missingMetadataIds.length > 0) {
    throw new Error(`${label}: geometry features missing metadata for ids ${missingMetadataIds.slice(0, 10).join(', ')}`);
  }

  const missingGeometryIds = [...metadataIds].filter((id) => !geometryIds.has(id));
  if (missingGeometryIds.length > 0) {
    throw new Error(`${label}: metadata rows missing geometry for ids ${missingGeometryIds.slice(0, 10).join(', ')}`);
  }
}

function sanitizeTabularMetadata(item) {
  const sanitized = {};
  for (const [key, value] of Object.entries(item)) {
    if (INTERNAL_EXPORT_FIELDS.has(key)) {
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
}

function sanitizeKmlMetadata(item) {
  const allowedKeys = [
    'id',
    'name',
    'parent_id',
    'parent_name',
    'region_id',
    'region_name',
    'level',
    'plate_code',
    'district_local_code',
    'lau_code',
    'tuik_id',
    'icisleri_id',
    'osm_relation_id',
    'iso_3166_2',
    'nuts_code',
    'municipality_type',
  ];
  const sanitized = {};
  for (const key of allowedKeys) {
    if (item[key] === undefined || item[key] === null || typeof item[key] === 'object' || item[key] === '') {
      continue;
    }
    sanitized[key] = item[key];
  }
  return sanitized;
}

function geometryToWkt(geometry) {
  if (geometry.type === 'Polygon') {
    return `POLYGON (${geometry.coordinates.map((ring) => `(${ring.map(([lon, lat]) => `${lon} ${lat}`).join(', ')})`).join(', ')})`;
  }

  if (geometry.type === 'MultiPolygon') {
    return `MULTIPOLYGON (${geometry.coordinates
      .map((polygon) => `(${polygon.map((ring) => `(${ring.map(([lon, lat]) => `${lon} ${lat}`).join(', ')})`).join(', ')})`)
      .join(', ')})`;
  }

  throw new Error(`Unsupported geometry type for WKT export: ${geometry.type}`);
}

function toTabularRows(metadata, geometryCollection, propertyBuilder = null) {
  const geometryById = new Map(geometryCollection.features.map((feature) => [feature.properties.id, feature.geometry]));
  return metadata.map((item) => {
    const geometry = geometryById.get(item.id);
    if (!geometry) {
      throw new Error(`toTabularRows: no geometry found for id "${item.id}"`);
    }
    const { centroid, bbox, aliases, member_ids, ...rest } = sanitizeTabularMetadata(item);
    return {
      ...rest,
      ...(propertyBuilder ? propertyBuilder(item) : {}),
      centroid_lat: centroid?.lat ?? null,
      centroid_lon: centroid?.lon ?? null,
      bbox_min_lon: bbox?.[0] ?? null,
      bbox_min_lat: bbox?.[1] ?? null,
      bbox_max_lon: bbox?.[2] ?? null,
      bbox_max_lat: bbox?.[3] ?? null,
      aliases: JSON.stringify(aliases || []),
      member_ids: JSON.stringify(member_ids || []),
      x: centroid?.lon ?? null,
      y: centroid?.lat ?? null,
      coordinate_system: centroid ? 'EPSG:4326' : null,
      geometry_wkt: geometryToWkt(geometry),
    };
  });
}

function withoutGeometryWkt(rows) {
  return rows.map(({ geometry_wkt, ...rest }) => rest);
}

function escapeCsvValue(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const stringValue = String(value);
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }
  return stringValue;
}

function rowsToCsv(rows) {
  if (rows.length === 0) {
    return '';
  }

  const columns = Object.keys(rows[0]);
  return [
    columns.join(','),
    ...rows.map((row) => columns.map((column) => escapeCsvValue(row[column])).join(',')),
  ].join('\n');
}

function escapeSqlValue(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'NULL';
  }
  return `'${String(value).replaceAll("'", "''")}'`;
}

function quoteSqlIdentifier(name) {
  return `"${String(name).replaceAll('"', '""')}"`;
}

function rowsToSql(tableName, rows) {
  const quotedTable = quoteSqlIdentifier(tableName);

  if (rows.length === 0) {
    return `CREATE TABLE ${quotedTable} (id TEXT PRIMARY KEY);\n`;
  }

  const columns = Object.keys(rows[0]);
  const createColumns = columns.map((column) => `${quoteSqlIdentifier(column)} TEXT`).join(',\n  ');
  const inserts = rows.map((row) => `INSERT INTO ${quotedTable} (${columns.map(quoteSqlIdentifier).join(', ')}) VALUES (${columns.map((column) => escapeSqlValue(row[column])).join(', ')});`);
  return [
    `CREATE TABLE ${quotedTable} (`,
    `  ${createColumns}`,
    ');',
    ...inserts,
    '',
  ].join('\n');
}

function rowsToWkt(rows) {
  return rows
    .map((row) => row.geometry_wkt)
    .filter(Boolean)
    .join('\n');
}

// --- Shapefile writer ---

const WGS84_PRJ = 'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';

function geometryToShpRings(geometry) {
  if (geometry.type === 'Polygon') return geometry.coordinates;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat(1);
  throw new Error(`Unsupported geometry type for SHP: ${geometry.type}`);
}

function buildShpRecord(geometry) {
  const rings = geometryToShpRings(geometry);
  const numParts = rings.length;
  const numPoints = rings.reduce((s, r) => s + r.length, 0);
  const contentSize = 4 + 32 + 4 + 4 + numParts * 4 + numPoints * 16;
  const buf = Buffer.allocUnsafe(contentSize);
  let off = 0;

  buf.writeInt32LE(5, off); off += 4;

  let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < xmin) xmin = x; if (y < ymin) ymin = y;
      if (x > xmax) xmax = x; if (y > ymax) ymax = y;
    }
  }
  buf.writeDoubleLE(xmin, off); off += 8;
  buf.writeDoubleLE(ymin, off); off += 8;
  buf.writeDoubleLE(xmax, off); off += 8;
  buf.writeDoubleLE(ymax, off); off += 8;

  buf.writeInt32LE(numParts, off); off += 4;
  buf.writeInt32LE(numPoints, off); off += 4;

  let pointIndex = 0;
  for (const ring of rings) {
    buf.writeInt32LE(pointIndex, off); off += 4;
    pointIndex += ring.length;
  }
  for (const ring of rings) {
    for (const [x, y] of ring) {
      buf.writeDoubleLE(x, off); off += 8;
      buf.writeDoubleLE(y, off); off += 8;
    }
  }
  return buf;
}

function buildShpAndShx(features) {
  const records = features.map((f, i) => {
    const content = buildShpRecord(f.geometry);
    const recHeader = Buffer.allocUnsafe(8);
    recHeader.writeInt32BE(i + 1, 0);
    recHeader.writeInt32BE(content.length / 2, 4);
    return Buffer.concat([recHeader, content]);
  });

  let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
  for (const f of features) {
    for (const ring of geometryToShpRings(f.geometry)) {
      for (const [x, y] of ring) {
        if (x < xmin) xmin = x; if (y < ymin) ymin = y;
        if (x > xmax) xmax = x; if (y > ymax) ymax = y;
      }
    }
  }

  const totalRecordBytes = records.reduce((s, r) => s + r.length, 0);
  const shpFileWords = (100 + totalRecordBytes) / 2;

  const shpHeader = Buffer.alloc(100, 0);
  shpHeader.writeInt32BE(9994, 0);
  shpHeader.writeInt32BE(shpFileWords, 24);
  shpHeader.writeInt32LE(1000, 28);
  shpHeader.writeInt32LE(5, 32);
  shpHeader.writeDoubleLE(xmin, 36);
  shpHeader.writeDoubleLE(ymin, 44);
  shpHeader.writeDoubleLE(xmax, 52);
  shpHeader.writeDoubleLE(ymax, 60);

  const shp = Buffer.concat([shpHeader, ...records]);

  const shxHeader = Buffer.alloc(100, 0);
  shpHeader.copy(shxHeader);
  shxHeader.writeInt32BE((100 + features.length * 8) / 2, 24);
  const shxBody = Buffer.allocUnsafe(features.length * 8);
  let shpOffset = 100;
  for (let i = 0; i < features.length; i++) {
    const contentLen = shp.readInt32BE(shpOffset + 4);
    shxBody.writeInt32BE(shpOffset / 2, i * 8);
    shxBody.writeInt32BE(contentLen, i * 8 + 4);
    shpOffset += 8 + contentLen * 2;
  }

  return { shp, shx: Buffer.concat([shxHeader, shxBody]) };
}

// Windows-1254 (Turkish) karakter eşleme — ISO-8859-9 ile aynı üst yarı
const WIN1254_OVERRIDES = new Map([
  [0x11E, 0xD0], [0x11F, 0xF0], // Ğ ğ
  [0x130, 0xDD], [0x131, 0xFD], // İ ı
  [0x15E, 0xDE], [0x15F, 0xFE], // Ş ş
]);

function encodeWin1254(str, length) {
  const out = Buffer.alloc(length, 0x20);
  const s = str.slice(0, length);
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (WIN1254_OVERRIDES.has(code)) {
      out[i] = WIN1254_OVERRIDES.get(code);
    } else {
      out[i] = code < 256 ? code : 0x3F;
    }
  }
  return out;
}

function buildDbfFile(rows, fieldDefs) {
  const recordSize = 1 + fieldDefs.reduce((s, f) => s + f.length, 0);
  const headerSize = 32 + fieldDefs.length * 32 + 1;
  const buf = Buffer.alloc(headerSize + rows.length * recordSize + 1, 0);
  const now = new Date();
  buf[0] = 0x03;
  buf[1] = now.getFullYear() % 100;
  buf[2] = now.getMonth() + 1;
  buf[3] = now.getDate();
  buf.writeInt32LE(rows.length, 4);
  buf.writeUInt16LE(headerSize, 8);
  buf.writeUInt16LE(recordSize, 10);
  buf[29] = 0x62; // LDID Windows-1254 Turkish

  let off = 32;
  for (const field of fieldDefs) {
    const nameBytes = Buffer.alloc(11, 0);
    Buffer.from(field.name.slice(0, 10), 'ascii').copy(nameBytes);
    nameBytes.copy(buf, off);
    buf[off + 11] = 0x43; // 'C' = Character
    buf[off + 16] = field.length;
    off += 32;
  }
  buf[off++] = 0x0D; // header terminator

  for (const row of rows) {
    buf[off++] = 0x20; // active record
    for (const field of fieldDefs) {
      const val = row[field.name] === null || row[field.name] === undefined ? '' : String(row[field.name]);
      encodeWin1254(val, field.length).copy(buf, off);
      off += field.length;
    }
  }
  buf[off] = 0x1A; // EOF
  return buf;
}

const SHAPEFILE_FIELD_DEFS = [
  { name: 'id', length: 20 },
  { name: 'name', length: 100 },
  { name: 'level', length: 10 },
  { name: 'parent_id', length: 20 },
  { name: 'region_id', length: 20 },
  { name: 'cntrd_lat', length: 20 },
  { name: 'cntrd_lon', length: 20 },
  { name: 'bbox_w', length: 20 },
  { name: 'bbox_s', length: 20 },
  { name: 'bbox_e', length: 20 },
  { name: 'bbox_n', length: 20 },
];

function toShapefileDbfRows(rows) {
  return rows.map((r) => ({
    id: r.id ?? '',
    name: r.name ?? '',
    level: r.level ?? '',
    parent_id: r.parent_id ?? '',
    region_id: r.region_id ?? '',
    cntrd_lat: r.centroid_lat ?? '',
    cntrd_lon: r.centroid_lon ?? '',
    bbox_w: r.bbox_min_lon ?? '',
    bbox_s: r.bbox_min_lat ?? '',
    bbox_e: r.bbox_max_lon ?? '',
    bbox_n: r.bbox_max_lat ?? '',
  }));
}

function writeShapefile(outDir, name, geojsonCollection, rows) {
  ensureDir(outDir);
  const { shp, shx } = buildShpAndShx(geojsonCollection.features);
  const dbf = buildDbfFile(toShapefileDbfRows(rows), SHAPEFILE_FIELD_DEFS);
  const zip = new AdmZip();
  zip.addFile(`${name}.shp`, shp);
  zip.addFile(`${name}.shx`, shx);
  zip.addFile(`${name}.dbf`, dbf);
  zip.addFile(`${name}.prj`, Buffer.from(WGS84_PRJ, 'utf8'));
  zip.addFile(`${name}.cpg`, Buffer.from('1254', 'utf8'));
  writeBinary(path.join(outDir, `${name}.zip`), zip.toBuffer());
}

// --- KML / KMZ ---

function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function geometryToKml(geometry) {
  const ringToKml = (ring) => ring.map(([lon, lat]) => `${lon},${lat},0`).join(' ');
  const polygonToKml = (polygon) => {
    const [outerBoundary, ...innerBoundaries] = polygon;
    return [
      '<Polygon>',
      `<outerBoundaryIs><LinearRing><coordinates>${ringToKml(outerBoundary)}</coordinates></LinearRing></outerBoundaryIs>`,
      ...innerBoundaries.map((ring) => `<innerBoundaryIs><LinearRing><coordinates>${ringToKml(ring)}</coordinates></LinearRing></innerBoundaryIs>`),
      '</Polygon>',
    ].join('');
  };

  if (geometry.type === 'Polygon') {
    return polygonToKml(geometry.coordinates);
  }

  if (geometry.type === 'MultiPolygon') {
    return `<MultiGeometry>${geometry.coordinates.map(polygonToKml).join('')}</MultiGeometry>`;
  }

  throw new Error(`Unsupported geometry type for KML export: ${geometry.type}`);
}

function buildKmlDescription(item) {
  const lines = [];
  const labelMap = {
    id: 'ID',
    name: 'Ad',
    parent_id: 'İl ID',
    parent_name: 'İl Adı',
    region_id: 'Bölge ID',
    region_name: 'Bölge Adı',
    level: 'Seviye',
  };

  for (const [key, value] of Object.entries(item)) {
    if (value === null || value === undefined || value === '' || typeof value === 'object') {
      continue;
    }
    if (!(key in labelMap)) {
      continue;
    }
    lines.push(`${labelMap[key]}: ${value}`);
  }

  return lines.length > 0 ? lines.join('\n') : item.id;
}

function featureCollectionToKml(name, metadata, geometryCollection) {
  const metadataById = new Map(metadata.map((item) => [item.id, item]));
  const styleId = 'turkiye-map-style';
  const placemarks = geometryCollection.features.map((feature) => {
    const item = metadataById.get(feature.properties.id);
    if (!item) {
      throw new Error(`featureCollectionToKml: no metadata found for id "${feature.properties.id}"`);
    }
    const kmlItem = sanitizeKmlMetadata(item);
    const extendedData = Object.entries(kmlItem)
      .filter(([, value]) => value !== null && value !== undefined && typeof value !== 'object')
      .map(([key, value]) => `<Data name="${xmlEscape(key)}"><value>${xmlEscape(value)}</value></Data>`)
      .join('');

    return [
      '<Placemark>',
      `<styleUrl>#${styleId}</styleUrl>`,
      `<name>${xmlEscape(item.name || item.id)}</name>`,
      `<description>${xmlEscape(buildKmlDescription(kmlItem))}</description>`,
      extendedData ? `<ExtendedData>${extendedData}</ExtendedData>` : '',
      geometryToKml(feature.geometry),
      '</Placemark>',
    ].join('');
  }).join('');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<kml xmlns="http://www.opengis.net/kml/2.2">',
    '<Document>',
    `<name>${xmlEscape(name)}</name>`,
    `<Style id="${styleId}"><LineStyle><color>ff8f5f34</color><width>1.4</width></LineStyle><PolyStyle><color>99ffddc7</color><fill>1</fill><outline>1</outline></PolyStyle></Style>`,
    placemarks,
    '</Document>',
    '</kml>',
    '',
  ].join('');
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function writeBinary(filePath, buffer) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer);
}

function writeGeoPackage(filePath, layers) {
  ensureDir(path.dirname(filePath));
  const payload = {
    layers: layers.map((layer) => ({
      table_name: layer.tableName,
      identifier: layer.identifier,
      description: layer.description,
      rows: layer.rows,
      geojson: layer.geojson,
    })),
  };

  execFileSync(
    'python',
    ['scripts/export-gpkg.py', '--output', filePath],
    {
      cwd: paths.rootDir,
      input: JSON.stringify(payload),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
}

export function sortMetadata(items) {
  return sortedCopy(items, (a, b) => a.id.localeCompare(b.id));
}

function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    const group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}

function writeGroupedJson(outDir, groups) {
  ensureDir(outDir);
  for (const [key, items] of groups.entries()) {
    writeJson(path.join(outDir, `${key}.json`), sortMetadata(items));
  }
}

export function sortGeometry(collection) {
  return {
    ...collection,
    features: sortedCopy(collection.features, (a, b) => a.properties.id.localeCompare(b.properties.id))
      .map((feature) => ({
        ...feature,
        geometry: roundGeometryCoordinates(rewindGeometry(feature.geometry), 6),
      })),
  };
}

export function main() {
  logStep('Exporting dist artifacts');

  const regions = sortMetadata(readJson(path.join(paths.processedDir, 'regions.metadata.json')));
  const provinces = sortMetadata(readJson(path.join(paths.processedDir, 'provinces.metadata.json')));
  const districts = sortMetadata(readJson(path.join(paths.processedDir, 'districts.metadata.json')));
  const settlements = sortMetadata(readJson(path.join(paths.processedDir, 'yerlesimler.metadata.json')));
  const regionGeometry = sortGeometry(readJson(path.join(paths.processedDir, 'regions.geometry.geojson')));
  const provinceGeometry = sortGeometry(readJson(path.join(paths.processedDir, 'provinces.geometry.geojson')));
  const districtGeometry = sortGeometry(readJson(path.join(paths.processedDir, 'districts.geometry.geojson')));
  const provincesById = new Map(provinces.map((item) => [item.id, item]));
  ensureMetadataGeometrySync('regions', regions, regionGeometry);
  ensureMetadataGeometrySync('provinces', provinces, provinceGeometry);
  ensureMetadataGeometrySync('districts', districts, districtGeometry);
  const regionRows = toTabularRows(regions, regionGeometry);
  const provinceRows = toTabularRows(provinces, provinceGeometry);
  const districtRows = toTabularRows(districts, districtGeometry, (item) => ({
    parent_name: item.parent_id ? provincesById.get(item.parent_id)?.name || '' : '',
  }));
  const regionWorkbookRows = withoutGeometryWkt(regionRows);
  const provinceWorkbookRows = withoutGeometryWkt(provinceRows);
  const districtWorkbookRows = withoutGeometryWkt(districtRows);

  writeJson(path.join(paths.distJsonDir, 'regions.json'), regions);
  writeJson(path.join(paths.distJsonDir, 'provinces.json'), provinces);
  writeJson(path.join(paths.distJsonDir, 'districts.json'), districts);
  writeJson(path.join(paths.distJsonDir, 'yerlesimler.json'), settlements);
  writeJsonCompact(path.join(paths.distGeojsonDir, 'regions.geojson'), regionGeometry);
  writeJsonCompact(path.join(paths.distGeojsonDir, 'provinces.geojson'), provinceGeometry);
  writeJsonCompact(path.join(paths.distGeojsonDir, 'districts.geojson'), districtGeometry);

  writeJsonCompact(path.join(distRoot, 'topojson', 'regions.topojson'), topology({ regions: regionGeometry }));
  writeJsonCompact(path.join(distRoot, 'topojson', 'provinces.topojson'), topology({ provinces: provinceGeometry }));
  writeJsonCompact(path.join(distRoot, 'topojson', 'districts.topojson'), topology({ districts: districtGeometry }));

  writeText(path.join(distRoot, 'csv', 'regions.csv'), `\ufeff${rowsToCsv(withoutGeometryWkt(regionRows))}`);
  writeText(path.join(distRoot, 'csv', 'provinces.csv'), `\ufeff${rowsToCsv(withoutGeometryWkt(provinceRows))}`);
  writeText(path.join(distRoot, 'csv', 'districts.csv'), `\ufeff${rowsToCsv(withoutGeometryWkt(districtRows))}`);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(regionWorkbookRows), 'regions');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(provinceWorkbookRows), 'provinces');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(districtWorkbookRows), 'districts');
  ensureDir(path.join(distRoot, 'xlsx'));
  XLSX.writeFile(workbook, path.join(distRoot, 'xlsx', 'turkiye-map.xlsx'));

  writeText(path.join(distRoot, 'sql', 'regions.sql'), rowsToSql('regions', withoutGeometryWkt(regionRows)));
  writeText(path.join(distRoot, 'sql', 'provinces.sql'), rowsToSql('provinces', withoutGeometryWkt(provinceRows)));
  writeText(path.join(distRoot, 'sql', 'districts.sql'), rowsToSql('districts', withoutGeometryWkt(districtRows)));

  writeText(path.join(distRoot, 'wkt', 'regions.wkt'), rowsToWkt(regionRows));
  writeText(path.join(distRoot, 'wkt', 'provinces.wkt'), rowsToWkt(provinceRows));
  writeText(path.join(distRoot, 'wkt', 'districts.wkt'), rowsToWkt(districtRows));

  const regionKml = featureCollectionToKml('turkiye_map.regions', regions, regionGeometry);
  const provinceKml = featureCollectionToKml('turkiye_map.provinces', provinces, provinceGeometry);
  const districtKml = featureCollectionToKml('turkiye_map.districts', districts, districtGeometry);
  const regionGml = featureCollectionToGml('turkiye_map.regions', regions, regionGeometry, (item) => sanitizeKmlMetadata(item), { featureTypeName: 'region' });
  const provinceGml = featureCollectionToGml('turkiye_map.provinces', provinces, provinceGeometry, (item) => sanitizeKmlMetadata(item), { featureTypeName: 'province' });
  const districtGml = featureCollectionToGml('turkiye_map.districts', districts, districtGeometry, (item) => sanitizeKmlMetadata(item), { featureTypeName: 'district' });
  const regionOsm = featureCollectionToOsm('turkiye_map.regions', regions, regionGeometry, (item) => sanitizeKmlMetadata(item));
  const provinceOsm = featureCollectionToOsm('turkiye_map.provinces', provinces, provinceGeometry, (item) => sanitizeKmlMetadata(item));
  const districtOsm = featureCollectionToOsm('turkiye_map.districts', districts, districtGeometry, (item) => sanitizeKmlMetadata(item));
  writeText(path.join(distRoot, 'kml', 'regions.kml'), regionKml);
  writeText(path.join(distRoot, 'kml', 'provinces.kml'), provinceKml);
  writeText(path.join(distRoot, 'kml', 'districts.kml'), districtKml);
  writeText(path.join(distRoot, 'gml', 'regions.gml'), regionGml);
  writeText(path.join(distRoot, 'gml', 'provinces.gml'), provinceGml);
  writeText(path.join(distRoot, 'gml', 'districts.gml'), districtGml);
  writeText(path.join(distRoot, 'osm', 'regions.osm'), regionOsm);
  writeText(path.join(distRoot, 'osm', 'provinces.osm'), provinceOsm);
  writeText(path.join(distRoot, 'osm', 'districts.osm'), districtOsm);

  const regionKmz = new AdmZip();
  regionKmz.addFile('doc.kml', Buffer.from(regionKml, 'utf8'));
  const provinceKmz = new AdmZip();
  provinceKmz.addFile('doc.kml', Buffer.from(provinceKml, 'utf8'));
  const districtKmz = new AdmZip();
  districtKmz.addFile('doc.kml', Buffer.from(districtKml, 'utf8'));
  writeBinary(path.join(distRoot, 'kmz', 'regions.kmz'), regionKmz.toBuffer());
  writeBinary(path.join(distRoot, 'kmz', 'provinces.kmz'), provinceKmz.toBuffer());
  writeBinary(path.join(distRoot, 'kmz', 'districts.kmz'), districtKmz.toBuffer());

  const shpDir = path.join(distRoot, 'shp');
  writeShapefile(shpDir, 'regions', regionGeometry, regionRows);
  writeShapefile(shpDir, 'provinces', provinceGeometry, provinceRows);
  writeShapefile(shpDir, 'districts', districtGeometry, districtRows);

  writeGeoPackage(path.join(distRoot, 'gpkg', 'turkiye-map.gpkg'), [
    {
      tableName: 'regions',
      identifier: 'regions',
      description: 'Turkey geographic regions',
      rows: regionWorkbookRows,
      geojson: regionGeometry,
    },
    {
      tableName: 'provinces',
      identifier: 'provinces',
      description: 'Turkey provinces',
      rows: provinceWorkbookRows,
      geojson: provinceGeometry,
    },
    {
      tableName: 'districts',
      identifier: 'districts',
      description: 'Turkey districts',
      rows: districtWorkbookRows,
      geojson: districtGeometry,
    },
  ]);

  logStep(`Exported ${regions.length} regions, ${provinces.length} provinces, ${districts.length} districts and ${settlements.length} yerlesimler`);
}

/* v8 ignore next -- CLI entrypoint guard */
if (invokedPath === scriptPath) {
  runPipelineStep('export', main);
}
