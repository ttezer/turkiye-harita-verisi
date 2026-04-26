#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
import {
  compactKey,
  createDistrictIndex,
  createProvinceIndex,
  readWorksheetRows,
  resolveDistrict,
  resolveProvince,
  titleCaseTurkish,
} from './normalize-yerlesimler.js';

const scriptPath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;

export const BAGLI_FILE = 'Bagli_Listesi.xls';
export const BAGLI_SOURCE = 'e-icisleri-mulki-idare-bagli-birimleri';
export const BAGLI_SOURCE_LABEL = 'Kamuya açık kaynaklar';

function splitLocation(rawLocation) {
  return normalizeDisplayText(rawLocation)
    .split('->')
    .map((part) => normalizeDisplayText(part))
    .filter(Boolean);
}

function createParentSettlementIndex(settlements) {
  const index = new Map();
  for (const settlement of settlements) {
    index.set(`${settlement.district_id}|${compactKey(settlement.name)}`, settlement);
  }
  return index;
}

function resolveParentSettlement({ district, rawParentName, parentSettlementIndex }) {
  if (!district || !rawParentName) {
    return null;
  }
  const candidates = [
    compactKey(rawParentName),
    compactKey(rawParentName.replace(/-\s*(ilce|il)\s*merkezi$/iu, '')),
    compactKey(rawParentName.replace(/\s+(beldesi|belediyesi)$/iu, '')),
  ].filter(Boolean);

  return candidates
    .map((candidate) => parentSettlementIndex.get(`${district.id}|${candidate}`))
    .find(Boolean) || null;
}

export function parseBagliRows(rows, provinceIndex, districtIndex, parentSettlementIndex) {
  return rows
    .map((row, index) => ({ row, source_row: index + 1 }))
    .filter(({ row }) => /^\d+$/.test(String(row[0] || '').trim()))
    .map(({ row, source_row }) => {
      const rawName = normalizeDisplayText(String(row[3] || ''));
      const [rawProvinceName, rawDistrictName, rawParentName] = splitLocation(row[6] || '');
      const province = resolveProvince(rawProvinceName, provinceIndex);
      let district = null;
      try {
        district = resolveDistrict(rawDistrictName, province, districtIndex);
      } catch {
        district = null;
      }
      const parentSettlement = resolveParentSettlement({
        district,
        rawParentName,
        parentSettlementIndex,
      });
      const name = titleCaseTurkish(rawName);
      const parentName = rawParentName ? titleCaseTurkish(rawParentName) : '';

      return {
        id: null,
        level: 'bagli_yerlesim',
        type: 'bagli',
        parent_id: parentSettlement?.id || null,
        parent_type: parentSettlement?.type || null,
        parent_settlement_name: parentName,
        parent_settlement_name_ascii: toNameAscii(parentName),
        province_id: province.id,
        district_id: district?.id || null,
        province_name: province.name,
        district_name: district?.name || titleCaseTurkish(rawDistrictName),
        raw_district_name: titleCaseTurkish(rawDistrictName),
        name,
        name_ascii: toNameAscii(name),
        slug: `${toSlug(name)}-bagli-${toSlug(parentName)}-${district?.slug || toSlug(rawDistrictName)}-${toSlug(province.name)}`,
        source: BAGLI_SOURCE,
        source_label: BAGLI_SOURCE_LABEL,
        source_file: BAGLI_FILE,
        source_row,
        matched_parent: Boolean(parentSettlement),
        matched_district: Boolean(district),
      };
    });
}

function assignBagliIds(items) {
  const groups = new Map();
  for (const item of items) {
    const key = `${item.district_id || item.raw_district_name}|${item.parent_settlement_name_ascii}`;
    const group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
  }

  const withIds = [];
  for (const group of groups.values()) {
    sortedCopy(group, (a, b) => (
      a.name_ascii.localeCompare(b.name_ascii, 'tr') ||
      a.source_row - b.source_row
    )).forEach((item, index) => {
      const sequence = String(index + 1).padStart(4, '0');
      withIds.push({
        ...item,
        id: `TR-B-${(item.district_id || `${item.province_id}-UNK`).replace(/^TR-[DP]-/, '')}-${toSlug(item.parent_settlement_name).slice(0, 24)}-${sequence}`,
        slug: `${item.slug}-${sequence}`,
      });
    });
  }
  return sortedCopy(withIds, (a, b) => a.id.localeCompare(b.id));
}

export function main() {
  logStep('Normalizing bagli yerlesim snapshot');

  const provinces = readJson(path.join(paths.processedDir, 'provinces.metadata.json'));
  const districts = readJson(path.join(paths.processedDir, 'districts.metadata.json'));
  const settlements = readJson(path.join(paths.processedDir, 'yerlesimler.metadata.json'));
  const provinceIndex = createProvinceIndex(provinces);
  const districtIndex = createDistrictIndex(districts);
  const parentSettlementIndex = createParentSettlementIndex(settlements);

  const rows = readWorksheetRows(BAGLI_FILE);
  const bagliYerlesimler = assignBagliIds(parseBagliRows(
    rows,
    provinceIndex,
    districtIndex,
    parentSettlementIndex,
  ));

  writeJson(path.join(paths.processedDir, 'bagli-yerlesimler.metadata.json'), bagliYerlesimler);
  writeJson(path.join(paths.processedDir, 'bagli-yerlesimler-report.json'), {
    source: BAGLI_SOURCE,
    source_label: BAGLI_SOURCE_LABEL,
    files: [BAGLI_FILE],
    bagli_count: bagliYerlesimler.length,
    matched_parent_count: bagliYerlesimler.filter((item) => item.matched_parent).length,
    unmatched_parent_count: bagliYerlesimler.filter((item) => !item.matched_parent).length,
  });

  logStep(`Normalized ${bagliYerlesimler.length} bagli yerlesimler (${bagliYerlesimler.filter((item) => item.matched_parent).length} matched parent)`);
}

/* v8 ignore next -- CLI entrypoint guard */
if (invokedPath === scriptPath) {
  runPipelineStep('normalize-bagli-yerlesimler', main);
}
