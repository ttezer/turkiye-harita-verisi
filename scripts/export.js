#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { topology } from 'topojson-server';
import XLSX from 'xlsx';
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
    return {
      ...item,
      ...(propertyBuilder ? propertyBuilder(item) : {}),
      centroid_lat: item.centroid?.lat ?? null,
      centroid_lon: item.centroid?.lon ?? null,
      bbox: JSON.stringify(item.bbox),
      aliases: JSON.stringify(item.aliases || []),
      member_ids: JSON.stringify(item.member_ids || []),
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
    const extendedData = Object.entries(item)
      .filter(([, value]) => value !== null && value !== undefined && typeof value !== 'object')
      .map(([key, value]) => `<Data name="${xmlEscape(key)}"><value>${xmlEscape(value)}</value></Data>`)
      .join('');

    return [
      '<Placemark>',
      `<styleUrl>#${styleId}</styleUrl>`,
      `<name>${xmlEscape(item.name)}</name>`,
      `<description>${xmlEscape(buildKmlDescription(item))}</description>`,
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

export function sortMetadata(items) {
  return sortedCopy(items, (a, b) => a.id.localeCompare(b.id));
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
  const regionGeometry = sortGeometry(readJson(path.join(paths.processedDir, 'regions.geometry.geojson')));
  const provinceGeometry = sortGeometry(readJson(path.join(paths.processedDir, 'provinces.geometry.geojson')));
  const districtGeometry = sortGeometry(readJson(path.join(paths.processedDir, 'districts.geometry.geojson')));
  const provincesById = new Map(provinces.map((item) => [item.id, item]));
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
  writeJsonCompact(path.join(paths.distGeojsonDir, 'regions.geojson'), regionGeometry);
  writeJsonCompact(path.join(paths.distGeojsonDir, 'provinces.geojson'), provinceGeometry);
  writeJsonCompact(path.join(paths.distGeojsonDir, 'districts.geojson'), districtGeometry);

  writeJsonCompact(path.join(distRoot, 'topojson', 'regions.topojson'), topology({ regions: regionGeometry }));
  writeJsonCompact(path.join(distRoot, 'topojson', 'provinces.topojson'), topology({ provinces: provinceGeometry }));
  writeJsonCompact(path.join(distRoot, 'topojson', 'districts.topojson'), topology({ districts: districtGeometry }));

  writeText(path.join(distRoot, 'csv', 'regions.csv'), `\ufeff${rowsToCsv(regionRows)}`);
  writeText(path.join(distRoot, 'csv', 'provinces.csv'), `\ufeff${rowsToCsv(provinceRows)}`);
  writeText(path.join(distRoot, 'csv', 'districts.csv'), `\ufeff${rowsToCsv(districtRows)}`);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(regionWorkbookRows), 'regions');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(provinceWorkbookRows), 'provinces');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(districtWorkbookRows), 'districts');
  ensureDir(path.join(distRoot, 'xlsx'));
  XLSX.writeFile(workbook, path.join(distRoot, 'xlsx', 'turkiye-map.xlsx'));

  writeText(path.join(distRoot, 'sql', 'regions.sql'), rowsToSql('regions', regionRows));
  writeText(path.join(distRoot, 'sql', 'provinces.sql'), rowsToSql('provinces', provinceRows));
  writeText(path.join(distRoot, 'sql', 'districts.sql'), rowsToSql('districts', districtRows));

  writeText(path.join(distRoot, 'wkt', 'regions.wkt'), rowsToWkt(regionRows));
  writeText(path.join(distRoot, 'wkt', 'provinces.wkt'), rowsToWkt(provinceRows));
  writeText(path.join(distRoot, 'wkt', 'districts.wkt'), rowsToWkt(districtRows));

  const regionKml = featureCollectionToKml('turkiye_map.regions', regions, regionGeometry);
  const provinceKml = featureCollectionToKml('turkiye_map.provinces', provinces, provinceGeometry);
  const districtKml = featureCollectionToKml('turkiye_map.districts', districts, districtGeometry);
  writeText(path.join(distRoot, 'kml', 'regions.kml'), regionKml);
  writeText(path.join(distRoot, 'kml', 'provinces.kml'), provinceKml);
  writeText(path.join(distRoot, 'kml', 'districts.kml'), districtKml);

  const regionKmz = new AdmZip();
  regionKmz.addFile('doc.kml', Buffer.from(regionKml, 'utf8'));
  const provinceKmz = new AdmZip();
  provinceKmz.addFile('doc.kml', Buffer.from(provinceKml, 'utf8'));
  const districtKmz = new AdmZip();
  districtKmz.addFile('doc.kml', Buffer.from(districtKml, 'utf8'));
  writeBinary(path.join(distRoot, 'kmz', 'regions.kmz'), regionKmz.toBuffer());
  writeBinary(path.join(distRoot, 'kmz', 'provinces.kmz'), provinceKmz.toBuffer());
  writeBinary(path.join(distRoot, 'kmz', 'districts.kmz'), districtKmz.toBuffer());

  logStep(`Exported ${regions.length} regions, ${provinces.length} provinces and ${districts.length} districts`);
}

/* v8 ignore next -- CLI entrypoint guard */
if (invokedPath === scriptPath) {
  runPipelineStep('export', main);
}
