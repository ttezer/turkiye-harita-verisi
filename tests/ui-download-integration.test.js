import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';
import { topology } from 'topojson-server';
import { describe, expect, it } from 'vitest';
import {
  buildGeojsonPayload,
  buildJsonPayload,
  buildTabularRows,
  buildTopojsonPayload,
  buildXlsxArrayBuffer,
  featureCollectionToKml,
  rowsToCsv,
  rowsToSql,
  rowsToWkt,
} from '../download.js';

const rootDir = path.resolve('D:/turkiye_map');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function countPlacemark(kml) {
  return (kml.match(/<Placemark>/g) || []).length;
}

describe('ui download integration with real datasets', () => {
  it('builds region-scoped province outputs consistently across formats', () => {
    const provinces = readJson('dist/json/provinces.json');
    const provincesGeojson = readJson('dist/geojson/provinces.geojson');
    const marmaraProvinces = provinces.filter((item) => item.region_id === 'TR-R-MAR');
    const marmaraProvinceIds = new Set(marmaraProvinces.map((item) => item.id));
    const marmaraFeatures = provincesGeojson.features.filter((feature) => marmaraProvinceIds.has(feature.properties.id));
    const geometryById = new Map(marmaraFeatures.map((feature) => [feature.properties.id, feature.geometry]));

    const jsonPayload = buildJsonPayload(
      marmaraProvinces,
      ['id', 'name', 'region_name'],
      () => null,
    );
    const geojsonPayload = buildGeojsonPayload(
      marmaraFeatures,
      (id) => {
        const item = marmaraProvinces.find((province) => province.id === id);
        return { id: item.id, name: item.name, region_name: item.region_name };
      },
    );
    const rows = buildTabularRows(marmaraProvinces, geometryById);
    const topojsonPayload = buildTopojsonPayload(geojsonPayload, topology, 'provinces');
    const csv = rowsToCsv(rows);
    const sql = rowsToSql('provinces', rows);
    const wkt = rowsToWkt(rows);
    const kml = featureCollectionToKml(
      'marmara provinces',
      marmaraProvinces,
      geojsonPayload,
      (item) => ({ id: item.id, name: item.name, region_name: item.region_name }),
    );
    const workbookBuffer = buildXlsxArrayBuffer(rows, 'provinces', XLSX);
    const workbook = XLSX.read(workbookBuffer, { type: 'array' });
    const xlsxRows = XLSX.utils.sheet_to_json(workbook.Sheets.provinces, { defval: null });

    expect(marmaraProvinces).toHaveLength(11);
    expect(jsonPayload).toHaveLength(11);
    expect(geojsonPayload.features).toHaveLength(11);
    expect(rows).toHaveLength(11);
    expect(Object.keys(topojsonPayload.objects)).toEqual(['provinces']);
    expect(csv.split('\n')).toHaveLength(12);
    expect(sql.match(/INSERT INTO "provinces"/g)?.length).toBe(11);
    expect(wkt.split('\n')).toHaveLength(11);
    expect(countPlacemark(kml)).toBe(11);
    expect(xlsxRows).toHaveLength(11);
    expect(xlsxRows[0].geometry_wkt).toBeUndefined();
  });

  it('builds province-scoped district outputs consistently across formats', () => {
    const districts = readJson('dist/json/districts.json');
    const districtsGeojson = readJson('dist/geojson/districts.geojson');
    const adalarProvinceId = 'TR-P-34';
    const provinceDistricts = districts.filter((item) => item.parent_id === adalarProvinceId);
    const provinceDistrictIds = new Set(provinceDistricts.map((item) => item.id));
    const provinceFeatures = districtsGeojson.features.filter((feature) => provinceDistrictIds.has(feature.properties.id));
    const geometryById = new Map(provinceFeatures.map((feature) => [feature.properties.id, feature.geometry]));

    const jsonPayload = buildJsonPayload(
      provinceDistricts,
      ['id', 'name', 'parent_name', 'region_name'],
      (item) => item.parent_name ?? 'İstanbul',
    );
    const geojsonPayload = buildGeojsonPayload(
      provinceFeatures,
      (id) => {
        const item = provinceDistricts.find((district) => district.id === id);
        return {
          id: item.id,
          name: item.name,
          parent_name: item.parent_name ?? 'İstanbul',
          region_name: item.region_name,
        };
      },
    );
    const rows = buildTabularRows(provinceDistricts, geometryById);

    expect(provinceDistricts.length).toBeGreaterThan(0);
    expect(jsonPayload).toHaveLength(provinceDistricts.length);
    expect(geojsonPayload.features).toHaveLength(provinceDistricts.length);
    expect(rows).toHaveLength(provinceDistricts.length);
    expect(rows.every((row) => row.parent_id === adalarProvinceId)).toBe(true);
  });
});
