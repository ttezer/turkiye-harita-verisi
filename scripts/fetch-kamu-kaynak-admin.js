#!/usr/bin/env node

import path from 'node:path';
import { ensureDir, normalizeDisplayText, paths, readJson, writeJson, writeJsonCompact } from './lib/pipeline.js';

const BASE_URL = 'https://bulutkbs.gov.tr/Rehber/';
const DEFAULT_DELAY_MS = 120;
const kamuKaynakDir = path.join(paths.rootDir, 'source', 'kamu-kaynak');
const sourceLabels = readJson(paths.sourceLabels);
const PUBLIC_SOURCE_LABEL = sourceLabels.public_sources;

function parseArgs(argv) {
  const args = {
    level: 'all',
    delayMs: DEFAULT_DELAY_MS,
    provinceIds: null,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--level') {
      args.level = argv[++index];
    } else if (arg === '--delay-ms') {
      args.delayMs = Number(argv[++index]);
    } else if (arg === '--province-ids') {
      args.provinceIds = argv[++index].split(',').map((value) => Number(value.trim())).filter(Number.isInteger);
    } else {
      throw new Error(`Bilinmeyen arguman: ${arg}`);
    }
  }

  if (!['province', 'district', 'all'].includes(args.level)) {
    throw new Error('--level province, district veya all olmali.');
  }
  if (!Number.isFinite(args.delayMs) || args.delayMs < 0) {
    throw new Error('--delay-ms sifir veya pozitif sayi olmali.');
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

function slugProvince(province) {
  return `${String(province.id).padStart(2, '0')}-${normalizeDisplayText(province.ad).toLocaleLowerCase('tr-TR').replaceAll(/\s+/g, '-')}`;
}

function normalizeGeometry(rawGeometry) {
  if (!rawGeometry) {
    return null;
  }
  const geometry = typeof rawGeometry === 'string' ? JSON.parse(rawGeometry) : rawGeometry;
  if (!['Polygon', 'MultiPolygon'].includes(geometry.type)) {
    throw new Error(`Desteklenmeyen geometri tipi: ${geometry.type}`);
  }
  return geometry;
}

async function fetchSourceProvinces(request, provinceIds) {
  const provinces = await request('il/getAll', null);
  const selected = provinceIds?.length > 0
    ? provinces.filter((province) => provinceIds.includes(province.id))
    : provinces;
  return selected.sort((a, b) => a.id - b.id);
}

async function fetchProvinceGeometries(request, provinces, delayMs) {
  const outDir = path.join(kamuKaynakDir, 'il');
  ensureDir(outDir);
  const features = [];
  const errors = [];

  for (const province of provinces) {
    await sleep(delayMs);
    try {
      const geometry = normalizeGeometry(await request('il/getGeometry', { id: province.id }));
      if (!geometry) {
        throw new Error('Bos geometri');
      }
      features.push({
        type: 'Feature',
        properties: {
          kaynak: PUBLIC_SOURCE_LABEL,
          il_id: province.id,
          il_adi: normalizeDisplayText(province.ad),
        },
        geometry,
      });
      console.log(`${String(province.id).padStart(2, '0')} ${province.ad}: il geometrisi alindi`);
    } catch (error) {
      errors.push({
        il_id: province.id,
        il_adi: normalizeDisplayText(province.ad),
        error: error.message,
      });
      console.log(`${String(province.id).padStart(2, '0')} ${province.ad}: il geometrisi alinamadi`);
    }
  }

  const featureCollection = {
    type: 'FeatureCollection',
    name: 'kamu-kaynak-il-geometrileri',
    features,
  };
const report = {
    source: 'https://bulutkbs.gov.tr/Rehber/#/app',
    source_name: 'Bulut KBS Rehber',
    source_label: PUBLIC_SOURCE_LABEL,
    accessed_at: new Date().toISOString(),
    province_count: provinces.length,
    geometry_count: features.length,
    error_count: errors.length,
    errors,
  };

  writeJsonCompact(path.join(outDir, 'il-geometrileri.geojson'), featureCollection);
  writeJson(path.join(outDir, 'report.json'), report);
  return report;
}

async function fetchDistrictGeometries(request, provinces, delayMs) {
  const rootDir = path.join(kamuKaynakDir, 'ilce');
  ensureDir(rootDir);
  const reports = [];

  for (const province of provinces) {
    const outDir = path.join(rootDir, slugProvince(province));
    ensureDir(outDir);
    const features = [];
    const errors = [];
    let districts = [];
    try {
      districts = await request('ilce/getIlceler', { id: province.id }, 6);
    } catch (error) {
const report = {
        source: 'https://bulutkbs.gov.tr/Rehber/#/app',
        source_name: 'Bulut KBS Rehber',
        source_label: PUBLIC_SOURCE_LABEL,
        accessed_at: new Date().toISOString(),
        province,
        district_count: 0,
        geometry_count: 0,
        error_count: 1,
        errors: [{
          il_id: province.id,
          il_adi: normalizeDisplayText(province.ad),
          error: error.message,
        }],
      };
      writeJsonCompact(path.join(outDir, 'ilce-geometrileri.geojson'), {
        type: 'FeatureCollection',
        name: `kamu-kaynak-${slugProvince(province)}-ilce`,
        features,
      });
      writeJson(path.join(outDir, 'report.json'), report);
      reports.push({
        plate_code: String(province.id).padStart(2, '0'),
        province_name: normalizeDisplayText(province.ad),
        district_count: 0,
        geometry_count: 0,
        error_count: 1,
      });
      console.log(`${String(province.id).padStart(2, '0')} ${province.ad}: ilce listesi alinamadi`);
      continue;
    }

    for (const district of districts) {
      await sleep(delayMs);
      try {
        const geometry = normalizeGeometry(await request('ilce/getGeometry', { id: district.id }));
        if (!geometry) {
          throw new Error('Bos geometri');
        }
        features.push({
          type: 'Feature',
          properties: {
            kaynak: PUBLIC_SOURCE_LABEL,
            il_id: province.id,
            il_adi: normalizeDisplayText(province.ad),
            ilce_id: district.id,
            ilce_adi: normalizeDisplayText(district.ad),
          },
          geometry,
        });
      } catch (error) {
        errors.push({
          ilce_id: district.id,
          ilce_adi: normalizeDisplayText(district.ad),
          error: error.message,
        });
      }
    }

    const featureCollection = {
      type: 'FeatureCollection',
      name: `kamu-kaynak-${slugProvince(province)}-ilce`,
      features,
    };
const report = {
      source: 'https://bulutkbs.gov.tr/Rehber/#/app',
      source_name: 'Bulut KBS Rehber',
      source_label: PUBLIC_SOURCE_LABEL,
      accessed_at: new Date().toISOString(),
      province,
      district_count: districts.length,
      geometry_count: features.length,
      error_count: errors.length,
      errors,
    };

    writeJsonCompact(path.join(outDir, 'ilce-geometrileri.geojson'), featureCollection);
    writeJson(path.join(outDir, 'report.json'), report);
    reports.push({
      plate_code: String(province.id).padStart(2, '0'),
      province_name: normalizeDisplayText(province.ad),
      district_count: report.district_count,
      geometry_count: report.geometry_count,
      error_count: report.error_count,
    });
    console.log(`${String(province.id).padStart(2, '0')} ${province.ad}: ilce ${report.district_count}, geometri ${report.geometry_count}, hata ${report.error_count}`);
  }

  writeJson(path.join(rootDir, `report-${provinces.map((province) => String(province.id).padStart(2, '0')).join('-')}.json`), {
    source: 'https://bulutkbs.gov.tr/Rehber/#/app',
    accessed_at: new Date().toISOString(),
    province_count: reports.length,
    district_count: reports.reduce((sum, report) => sum + report.district_count, 0),
    geometry_count: reports.reduce((sum, report) => sum + report.geometry_count, 0),
    error_count: reports.reduce((sum, report) => sum + report.error_count, 0),
    reports,
  });
  return reports;
}

async function main() {
  const args = parseArgs(process.argv);
  let cookie = await createSession();
  async function request(endpoint, body, attempts = 4) {
    try {
      return await postJsonWithRetry(endpoint, body, cookie, attempts);
    } catch {
      cookie = await createSession();
      return postJsonWithRetry(endpoint, body, cookie, attempts + 2);
    }
  }

  const provinces = await fetchSourceProvinces(request, args.provinceIds);
  if (args.level === 'province' || args.level === 'all') {
    const report = await fetchProvinceGeometries(request, provinces, args.delayMs);
    console.log(`Il raporu: ${report.geometry_count}/${report.province_count} geometri, hata ${report.error_count}`);
  }
  if (args.level === 'district' || args.level === 'all') {
    const reports = await fetchDistrictGeometries(request, provinces, args.delayMs);
    const districtCount = reports.reduce((sum, report) => sum + report.district_count, 0);
    const geometryCount = reports.reduce((sum, report) => sum + report.geometry_count, 0);
    const errorCount = reports.reduce((sum, report) => sum + report.error_count, 0);
    console.log(`Ilce raporu: ${geometryCount}/${districtCount} geometri, hata ${errorCount}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
