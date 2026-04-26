#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { ensureDir, normalizeDisplayText, paths, readJson, writeJson, writeJsonCompact } from './lib/pipeline.js';

const BASE_URL = 'https://bulutkbs.gov.tr/Rehber/';
const DEFAULT_DELAY_MS = 150;
const kamuKaynakDir = path.join(paths.rootDir, 'source', 'kamu-kaynak');
const yerlesimDir = path.join(kamuKaynakDir, 'yerlesim');
const sourceLabels = readJson(paths.sourceLabels);
const PUBLIC_SOURCE_LABEL = sourceLabels.public_sources;

function parseArgs(argv) {
  const args = {
    provinceId: 1,
    delayMs: DEFAULT_DELAY_MS,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--province-id') {
      args.provinceId = Number(argv[++index]);
    } else if (arg === '--delay-ms') {
      args.delayMs = Number(argv[++index]);
    } else {
      throw new Error(`Bilinmeyen arguman: ${arg}`);
    }
  }

  if (!Number.isInteger(args.provinceId) || args.provinceId < 1) {
    throw new Error('--province-id pozitif tam sayi olmali.');
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
  const response = await fetch(BASE_URL, {
    redirect: 'follow',
  });
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

async function postJsonWithRetry(endpoint, body, cookie, attempts = 3) {
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
  if (typeof rawGeometry !== 'string' || rawGeometry.trim() === '') {
    return null;
  }
  const geometry = JSON.parse(rawGeometry);
  if (!['Polygon', 'MultiPolygon'].includes(geometry.type)) {
    throw new Error(`Desteklenmeyen geometri tipi: ${geometry.type}`);
  }
  return geometry;
}

async function fetchProvince(provinceId, delayMs) {
  let cookie = await createSession();
  async function request(endpoint, body, attempts = 3) {
    try {
      return await postJsonWithRetry(endpoint, body, cookie, attempts);
    } catch {
      cookie = await createSession();
      return postJsonWithRetry(endpoint, body, cookie, attempts + 2);
    }
  }

  const provinces = await request('il/getAll', null);
  const province = provinces.find((item) => item.id === provinceId);
  if (!province) {
    throw new Error(`Il bulunamadi: ${provinceId}`);
  }

  const outDir = path.join(yerlesimDir, slugProvince(province));
  ensureDir(outDir);

  const districts = await request('ilce/getIlceler', { id: province.id });
  const lists = [];
  const features = [];
  const errors = [];
  const districtErrors = [];
  const failedDistricts = [];
  const failedNeighborhoods = [];

  async function fetchNeighborhoodGeometry(provinceItem, district, neighborhood) {
    const rawGeometry = await request('mahalle/getGeometry', { id: neighborhood.id });
    const geometry = normalizeGeometry(rawGeometry);
    if (!geometry) {
      throw new Error('Bos geometri');
    }
    features.push({
      type: 'Feature',
      properties: {
        kaynak: PUBLIC_SOURCE_LABEL,
        il_id: provinceItem.id,
        il_adi: normalizeDisplayText(provinceItem.ad),
        ilce_id: district.id,
        ilce_adi: normalizeDisplayText(district.ad),
        mahalle_id: neighborhood.id,
        mahalle_adi: normalizeDisplayText(neighborhood.ad),
      },
      geometry,
    });
  }

  for (const district of districts) {
    let neighborhoods = [];
    try {
      neighborhoods = await request('ilce/getMahalleler', { id: district.id });
    } catch (error) {
      districtErrors.push({ ilce_id: district.id, ilce_adi: district.ad, error: error.message });
      failedDistricts.push(district);
      console.log(`${province.ad} / ${district.ad}: mahalle listesi alinamadi`);
      continue;
    }
    lists.push({
      il_id: province.id,
      il_adi: province.ad,
      ilce_id: district.id,
      ilce_adi: district.ad,
      mahalleler: neighborhoods,
    });

    for (const neighborhood of neighborhoods) {
      await sleep(delayMs);
      try {
        await fetchNeighborhoodGeometry(province, district, neighborhood);
      } catch (error) {
        failedNeighborhoods.push({ district, neighborhood, error: error.message });
      }
    }

    console.log(`${province.ad} / ${district.ad}: ${neighborhoods.length} mahalle, toplam geometri ${features.length}`);
  }

  for (const district of failedDistricts) {
    await sleep(delayMs * 5);
    try {
      const neighborhoods = await request('ilce/getMahalleler', { id: district.id }, 5);
      lists.push({
        il_id: province.id,
        il_adi: province.ad,
        ilce_id: district.id,
        ilce_adi: district.ad,
        mahalleler: neighborhoods,
      });
      for (const neighborhood of neighborhoods) {
        await sleep(delayMs);
        try {
          await fetchNeighborhoodGeometry(province, district, neighborhood);
        } catch (error) {
          failedNeighborhoods.push({ district, neighborhood, error: error.message });
        }
      }
      districtErrors.splice(districtErrors.findIndex((item) => item.ilce_id === district.id), 1);
      console.log(`${province.ad} / ${district.ad}: retry basarili, ${neighborhoods.length} mahalle`);
    } catch {
      // Ilce hatasi raporda zaten duruyor.
    }
  }

  const existingFeatureIds = new Set(features.map((feature) => feature.properties.mahalle_id));
  for (const failed of failedNeighborhoods) {
    if (existingFeatureIds.has(failed.neighborhood.id)) {
      continue;
    }
    await sleep(delayMs * 5);
    try {
      await fetchNeighborhoodGeometry(province, failed.district, failed.neighborhood);
      existingFeatureIds.add(failed.neighborhood.id);
    } catch (error) {
      errors.push({
        ilce_id: failed.district.id,
        ilce_adi: failed.district.ad,
        mahalle_id: failed.neighborhood.id,
        mahalle_adi: failed.neighborhood.ad,
        error: error.message,
      });
    }
  }

  const featureCollection = {
    type: 'FeatureCollection',
    name: `kamu-kaynak-${slugProvince(province)}-yerlesim`,
    features,
  };
  const report = {
    source: 'https://bulutkbs.gov.tr/Rehber/#/app',
    source_name: 'Bulut KBS Rehber',
    source_label: PUBLIC_SOURCE_LABEL,
    accessed_at: new Date().toISOString(),
    province,
    district_count: districts.length,
    neighborhood_count: lists.reduce((sum, item) => sum + item.mahalleler.length, 0),
    geometry_count: features.length,
    error_count: errors.length,
    district_error_count: districtErrors.length,
    district_errors: districtErrors,
    errors,
  };

  writeJson(path.join(outDir, 'yerlesim-listesi.json'), lists);
  writeJsonCompact(path.join(outDir, 'yerlesim-geometrileri.geojson'), featureCollection);
  writeJson(path.join(outDir, 'report.json'), report);
  return { outDir, report };
}

const args = parseArgs(process.argv);
fetchProvince(args.provinceId, args.delayMs)
  .then(({ outDir, report }) => {
    console.log(`Bitti: ${outDir}`);
    console.log(`Ilce: ${report.district_count}, mahalle: ${report.neighborhood_count}, geometri: ${report.geometry_count}, hata: ${report.error_count}`);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
