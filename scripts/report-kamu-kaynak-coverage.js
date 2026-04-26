#!/usr/bin/env node

import path from 'node:path';
import { ensureDir, normalizeDisplayText, paths, readJson, writeJson } from './lib/pipeline.js';

const BASE_URL = 'https://bulutkbs.gov.tr/Rehber/';
const DEFAULT_DELAY_MS = 75;
const yerlesimDir = path.join(paths.rootDir, 'source', 'kamu-kaynak', 'yerlesim');
const sourceLabels = readJson(paths.sourceLabels);
const PUBLIC_SOURCE_LABEL = sourceLabels.public_sources;

function parseArgs(argv) {
  const args = {
    delayMs: DEFAULT_DELAY_MS,
    limit: 0,
    provinceIds: null,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--delay-ms') {
      args.delayMs = Number(argv[++index]);
    } else if (arg === '--limit') {
      args.limit = Number(argv[++index]);
    } else if (arg === '--province-ids') {
      args.provinceIds = argv[++index].split(',').map((value) => Number(value.trim())).filter(Number.isInteger);
    } else {
      throw new Error(`Bilinmeyen arguman: ${arg}`);
    }
  }

  return args;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mergeCookies(existingCookie, headers) {
  const cookies = new Map(
    existingCookie
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const [name, ...rest] = item.split('=');
        return [name, rest.join('=')];
      }),
  );

  for (const value of headers.getSetCookie?.() || []) {
    const [pair] = value.split(';');
    const [name, ...rest] = pair.split('=');
    if (name && rest.length > 0) {
      cookies.set(name, rest.join('='));
    }
  }

  return [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

async function createSession() {
  const response = await fetch(BASE_URL, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Kamu kaynak oturumu acilamadi: ${response.status}`);
  }
  return mergeCookies('', response.headers);
}

async function postJson(endpoint, body, cookie) {
  const response = await fetch(new URL(endpoint, BASE_URL), {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/json;charset=UTF-8',
      Cookie: cookie,
      Referer: BASE_URL,
    },
    body: body === null ? 'null' : JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`${endpoint} HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload.operationStatus !== true) {
    throw new Error(`${endpoint} operationStatus=false ${JSON.stringify(payload).slice(0, 300)}`);
  }
  return payload.operationData;
}

async function postJsonWithRetry(endpoint, body, cookie, attempts = 4) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await postJson(endpoint, body, cookie);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await sleep(500 * attempt);
      }
    }
  }
  throw lastError;
}

function buildMulkiCounts() {
  const provinces = readJson(path.join(paths.distJsonDir, 'provinces.json'));
  const districts = readJson(path.join(paths.distJsonDir, 'districts.json'));
  const settlements = readJson(path.join(paths.distJsonDir, 'yerlesimler.json'));

  const counts = new Map(provinces.map((province) => [province.plate_code, {
    province_id: province.id,
    plate_code: province.plate_code,
    province_name: province.name,
    mulki_district_count: 0,
    mulki_settlement_count: 0,
    mulki_mahalle_count: 0,
    mulki_koy_count: 0,
  }]));

  for (const district of districts) {
    const item = counts.get(district.plate_code);
    if (item) {
      item.mulki_district_count += 1;
    }
  }

  for (const settlement of settlements) {
    const plateCode = settlement.province_id?.replace('TR-P-', '');
    const item = counts.get(plateCode);
    if (!item) {
      continue;
    }
    item.mulki_settlement_count += 1;
    if (settlement.type === 'mahalle') {
      item.mulki_mahalle_count += 1;
    } else if (settlement.type === 'koy') {
      item.mulki_koy_count += 1;
    }
  }

  return counts;
}

async function buildKamuKaynakCounts(delayMs, limit, provinceIds) {
  let cookie = await createSession();
  const provinces = await postJsonWithRetry('il/getAll', null, cookie);
  const filteredProvinces = provinceIds?.length > 0
    ? provinces.filter((province) => provinceIds.includes(province.id))
    : provinces;
  const selectedProvinces = limit > 0 ? filteredProvinces.slice(0, limit) : filteredProvinces;
  const counts = [];

  for (const province of selectedProvinces) {
    const row = {
      kamu_kaynak_id: province.id,
      plate_code: String(province.id).padStart(2, '0'),
      province_name: normalizeDisplayText(province.ad),
      kamu_kaynak_district_count: 0,
      kamu_kaynak_neighborhood_count: 0,
      kamu_kaynak_errors: [],
    };

    try {
      let districts = [];
      try {
        districts = await postJsonWithRetry('ilce/getIlceler', { id: province.id }, cookie);
      } catch {
        cookie = await createSession();
        districts = await postJsonWithRetry('ilce/getIlceler', { id: province.id }, cookie, 5);
      }
      row.kamu_kaynak_district_count = districts.length;
      const failedDistricts = [];

      for (const district of districts) {
        await sleep(delayMs);
        try {
          const neighborhoods = await postJsonWithRetry('ilce/getMahalleler', { id: district.id }, cookie);
          row.kamu_kaynak_neighborhood_count += neighborhoods.length;
        } catch (error) {
          try {
            cookie = await createSession();
            const neighborhoods = await postJsonWithRetry('ilce/getMahalleler', { id: district.id }, cookie, 5);
            row.kamu_kaynak_neighborhood_count += neighborhoods.length;
          } catch (retryError) {
            failedDistricts.push({
              district,
              error: retryError.message || error.message,
            });
          }
        }
      }

      for (const failed of failedDistricts) {
        await sleep(delayMs * 5);
        try {
          cookie = await createSession();
          const neighborhoods = await postJsonWithRetry('ilce/getMahalleler', { id: failed.district.id }, cookie, 6);
          row.kamu_kaynak_neighborhood_count += neighborhoods.length;
        } catch (error) {
          row.kamu_kaynak_errors.push({
            ilce_id: failed.district.id,
            ilce_adi: normalizeDisplayText(failed.district.ad),
            error: error.message || failed.error,
          });
        }
      }
    } catch (error) {
      row.kamu_kaynak_errors.push({
        il_id: province.id,
        il_adi: normalizeDisplayText(province.ad),
        error: error.message,
      });
    }

    counts.push(row);
    console.log(`${row.plate_code} ${row.province_name}: ilce ${row.kamu_kaynak_district_count}, mahalle ${row.kamu_kaynak_neighborhood_count}, hata ${row.kamu_kaynak_errors.length}`);
  }

  return counts;
}

function mergeCounts(mulkiCounts, kamuKaynakCounts) {
  return kamuKaynakCounts.map((sourceRow) => {
    const mulkiRow = mulkiCounts.get(sourceRow.plate_code);
    return {
      plate_code: sourceRow.plate_code,
      province_name: mulkiRow?.province_name || sourceRow.province_name,
      kamu_kaynak_district_count: sourceRow.kamu_kaynak_district_count,
      mulki_district_count: mulkiRow?.mulki_district_count ?? null,
      district_diff: mulkiRow ? sourceRow.kamu_kaynak_district_count - mulkiRow.mulki_district_count : null,
      kamu_kaynak_neighborhood_count: sourceRow.kamu_kaynak_neighborhood_count,
      mulki_settlement_count: mulkiRow?.mulki_settlement_count ?? null,
      settlement_diff: mulkiRow ? sourceRow.kamu_kaynak_neighborhood_count - mulkiRow.mulki_settlement_count : null,
      mulki_mahalle_count: mulkiRow?.mulki_mahalle_count ?? null,
      mulki_koy_count: mulkiRow?.mulki_koy_count ?? null,
      kamu_kaynak_error_count: sourceRow.kamu_kaynak_errors.length,
      kamu_kaynak_errors: sourceRow.kamu_kaynak_errors,
    };
  });
}

const args = parseArgs(process.argv);
const kamuKaynakCounts = await buildKamuKaynakCounts(args.delayMs, args.limit, args.provinceIds);
const rows = mergeCounts(buildMulkiCounts(), kamuKaynakCounts);
const outDir = yerlesimDir;
ensureDir(outDir);
const outName = args.provinceIds?.length > 0
  ? `coverage-report-${args.provinceIds.map((id) => String(id).padStart(2, '0')).join('-')}.json`
  : 'coverage-report.json';
writeJson(path.join(outDir, outName), {
  source: 'https://bulutkbs.gov.tr/Rehber/#/app',
  source_name: 'Bulut KBS Rehber',
  source_label: PUBLIC_SOURCE_LABEL,
  accessed_at: new Date().toISOString(),
  row_count: rows.length,
  rows,
});
console.log(`Rapor yazildi: ${path.join(outDir, outName)}`);
