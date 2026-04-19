#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';
import {
  logStep,
  normalizeDisplayText,
  paths,
  readJson,
  runPipelineStep,
  sortedCopy,
  toNameAscii,
  toSlug,
  writeJson,
} from './lib/pipeline.js';

const scriptPath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;

export const SETTLEMENT_SOURCE = 'e-icisleri-mulki-idare-bolumleri';
export const MAHALLE_FILE = 'Mahalle_Listesi.xls';
export const KOY_FILE = 'Koy_Listesi.xls';

export function compactKey(value) {
  return toNameAscii(value).replaceAll(/[^a-z0-9]/g, '');
}

export function titleCaseTurkish(value) {
  const lower = normalizeDisplayText(value).toLocaleLowerCase('tr-TR');
  return lower.replaceAll(/(^|[\s([{.'’/-])(\p{L})/gu, (_, prefix, letter) => (
    `${prefix}${letter.toLocaleUpperCase('tr-TR')}`
  ));
}

export function readWorksheetRows(fileName) {
  const workbook = XLSX.readFile(path.join(paths.settlementsDir, fileName));
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
}

export function cell(row, index) {
  return normalizeDisplayText(String(row[index] || ''));
}

export function createProvinceIndex(provinces) {
  return new Map(provinces.map((province) => [compactKey(province.name), province]));
}

export function createDistrictIndex(districts) {
  return new Map(districts.map((district) => [`${district.parent_id}|${compactKey(district.name)}`, district]));
}

export function resolveProvince(rawProvinceName, provinceIndex) {
  const province = provinceIndex.get(compactKey(rawProvinceName));
  if (!province) {
    throw new Error(`Yerlesim province not found: ${rawProvinceName}`);
  }
  return province;
}

export function resolveDistrict(rawDistrictName, province, districtIndex) {
  let districtKey = compactKey(rawDistrictName)
    .replace(/ilcemerkezi$/, '')
    .replace(/ilmerkezi$/, '');

  if (districtKey === 'merkez') {
    districtKey = compactKey(province.name);
  }

  const district = districtIndex.get(`${province.id}|${districtKey}`);
  if (!district) {
    throw new Error(`Yerlesim district not found: ${province.name} -> ${rawDistrictName}`);
  }
  return district;
}

export function parseKoyRows(rows, provinceIndex, districtIndex) {
  return rows
    .map((row, index) => ({ row, source_row: index + 1 }))
    .filter(({ row }) => /^\d+$/.test(cell(row, 0)))
    .map(({ row, source_row }) => {
      const rawName = cell(row, 2);
      const rawDistrictName = cell(row, 5);
      const rawProvinceName = cell(row, 7);
      const province = resolveProvince(rawProvinceName, provinceIndex);
      const district = resolveDistrict(rawDistrictName, province, districtIndex);

      return createSettlement({
        type: 'koy',
        rawName,
        province,
        district,
        source_file: KOY_FILE,
        source_row,
      });
    });
}

export function parseMahalleRows(rows, provinceIndex, districtIndex) {
  return rows
    .map((row, index) => ({ row, source_row: index + 1 }))
    .filter(({ row }) => /^\d+$/.test(cell(row, 0)))
    .map(({ row, source_row }) => {
      const rawName = cell(row, 3);
      const [rawProvinceName, rawDistrictName] = cell(row, 5)
        .split('->')
        .map((part) => normalizeDisplayText(part));
      const province = resolveProvince(rawProvinceName, provinceIndex);
      const district = resolveDistrict(rawDistrictName, province, districtIndex);

      return createSettlement({
        type: 'mahalle',
        rawName,
        province,
        district,
        source_file: MAHALLE_FILE,
        source_row,
      });
    });
}

export function createSettlement({ type, rawName, province, district, source_file, source_row }) {
  const name = titleCaseTurkish(rawName);

  return {
    id: null,
    level: 'yerlesim',
    type,
    parent_id: district.id,
    province_id: province.id,
    district_id: district.id,
    province_name: province.name,
    district_name: district.name,
    name,
    name_ascii: toNameAscii(name),
    slug: `${toSlug(name)}-${type}-${district.slug}`,
    source: SETTLEMENT_SOURCE,
    source_file,
    source_row,
  };
}

export function assignSettlementIds(settlements) {
  const groups = new Map();

  for (const settlement of settlements) {
    const key = `${settlement.district_id}|${settlement.type}`;
    const group = groups.get(key) || [];
    group.push(settlement);
    groups.set(key, group);
  }

  const withIds = [];
  for (const group of groups.values()) {
    const sorted = sortedCopy(group, (a, b) => (
      a.name_ascii.localeCompare(b.name_ascii, 'tr') ||
      a.source_row - b.source_row
    ));

    sorted.forEach((settlement, index) => {
      const typeCode = settlement.type === 'mahalle' ? 'M' : 'K';
      const sequence = String(index + 1).padStart(4, '0');
      withIds.push({
        ...settlement,
        id: `TR-Y-${settlement.district_id.slice(5)}-${typeCode}-${sequence}`,
        slug: `${settlement.slug}-${sequence}`,
      });
    });
  }

  return sortedCopy(withIds, (a, b) => a.id.localeCompare(b.id));
}

export function main() {
  logStep('Normalizing yerlesim snapshot');

  const provinces = readJson(path.join(paths.processedDir, 'provinces.metadata.json'));
  const districts = readJson(path.join(paths.processedDir, 'districts.metadata.json'));
  const provinceIndex = createProvinceIndex(provinces);
  const districtIndex = createDistrictIndex(districts);

  const mahalleRows = readWorksheetRows(MAHALLE_FILE);
  const koyRows = readWorksheetRows(KOY_FILE);
  const settlements = assignSettlementIds([
    ...parseMahalleRows(mahalleRows, provinceIndex, districtIndex),
    ...parseKoyRows(koyRows, provinceIndex, districtIndex),
  ]);

  writeJson(path.join(paths.processedDir, 'yerlesimler.metadata.json'), settlements);
  writeJson(path.join(paths.processedDir, 'yerlesimler-report.json'), {
    source: SETTLEMENT_SOURCE,
    files: [MAHALLE_FILE, KOY_FILE],
    mahalle_count: settlements.filter((item) => item.type === 'mahalle').length,
    koy_count: settlements.filter((item) => item.type === 'koy').length,
    settlement_count: settlements.length,
  });

  logStep(`Normalized ${settlements.length} yerlesimler (${settlements.filter((item) => item.type === 'mahalle').length} mahalle, ${settlements.filter((item) => item.type === 'koy').length} koy)`);
}

/* v8 ignore next -- CLI entrypoint guard */
if (invokedPath === scriptPath) {
  runPipelineStep('normalize-yerlesimler', main);
}
