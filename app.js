import {
  buildPdfDocumentBlob,
  buildGeojsonPayload as buildFilteredGeojsonPayload,
  buildJsonPayload as buildFilteredJsonPayload,
  buildKmzBlobFromKml,
  buildGeoPackageBlob,
  featureCollectionToDxf,
  featureCollectionToGml,
  featureCollectionToOsm,
  buildShapefileZipBlob,
  getNetcadLayerName,
  buildTabularRows as buildFilteredTabularRows,
  buildTopojsonPayload as buildFilteredTopojsonPayload,
  buildXlsxArrayBuffer,
  douglasPeucker,
  featureCollectionToKml,
  pickFields,
  rowsToCsv,
  rowsToWkt,
  rowsToSql,
  encodeWindows1254Text,
} from './download.js?v=34';

const state = {
  format: 'geojson',
  scope: 'turkey',
  level: 'region',
  selectedFields: [],
  csvDelimiter: ',',
  style: 'filled',
  colorMode: 'single',
  palette: 'blue',
  baseLayer: 'none',
  resolution: '1920x1080',
  gpkgCrs: 'EPSG:4326',
  gpkgGeometryMode: 'auto',
  regionId: '',
  provinceId: '',
  districtId: '',
  search: '',
  selectedId: '',
  hoveredId: '',
};

const els = {
  formatSelect: document.querySelector('#formatSelect'),
  scopeSelect: document.querySelector('#scopeSelect'),
  detailSelect: document.querySelector('#detailSelect'),
  fieldChecklist: document.querySelector('#fieldChecklist'),
  styleSelect: document.querySelector('#styleSelect'),
  colorModeSelect: document.querySelector('#colorModeSelect'),
  paletteSelect: document.querySelector('#paletteSelect'),
  resolutionSelect: document.querySelector('#resolutionSelect'),
  gpkgCrsSelect: document.querySelector('#gpkgCrsSelect'),
  gpkgGeometrySelect: document.querySelector('#gpkgGeometrySelect'),
  csvDelimiterSelect: document.querySelector('#csvDelimiterSelect'),
  fieldsField: document.querySelector('#fieldsField'),
  shpFieldsNote: document.querySelector('#shpFieldsNote'),
  dxfFieldsNote: document.querySelector('#dxfFieldsNote'),
  styleField: document.querySelector('#styleField'),
  colorModeField: document.querySelector('#colorModeField'),
  paletteField: document.querySelector('#paletteField'),
  resolutionField: document.querySelector('#resolutionField'),
  gpkgCrsField: document.querySelector('#gpkgCrsField'),
  gpkgGeometryField: document.querySelector('#gpkgGeometryField'),
  gpkgEncodingField: document.querySelector('#gpkgEncodingField'),
  csvDelimiterField: document.querySelector('#csvDelimiterField'),
  formatStatus: document.querySelector('#formatStatus'),
  downloadTitle: document.querySelector('#downloadTitle'),
  downloadSummary: document.querySelector('#downloadSummary'),
  downloadButton: document.querySelector('#downloadButton'),
  regionSelect: document.querySelector('#regionSelect'),
  provinceSelect: document.querySelector('#provinceSelect'),
  districtSelect: document.querySelector('#districtSelect'),
  searchInput: document.querySelector('#searchInput'),
  heroFormatChips: document.querySelectorAll('.hero-format-chip[data-format]'),
  resetButton: document.querySelector('#resetButton'),
  regionCount: document.querySelector('#regionCount'),
  provinceCount: document.querySelector('#provinceCount'),
  districtCount: document.querySelector('#districtCount'),
  visibleCount: document.querySelector('#visibleCount'),
  detailPanel: document.querySelector('#detailPanel'),
  estimatedSize: document.querySelector('#estimatedSize'),
  mapSvg: document.querySelector('#mapSvg'),
  mapOverlay: document.querySelector('#mapOverlay'),
  mapLoadStatus: document.querySelector('#mapLoadStatus'),
  mapLoadText: document.querySelector('#mapLoadText'),
  mapLoadBar: document.querySelector('#mapLoadBar'),
  baseLayerSelect: document.querySelector('#baseLayerSelect'),
  baseMapAttribution: document.querySelector('#baseMapAttribution'),
  qualityButton: document.querySelector('#qualityButton'),
  qualityPanel: document.querySelector('#qualityPanel'),
  pageShell: document.querySelector('.page-shell'),
};

const numberFormat = new Intl.NumberFormat('tr-TR');
const defaultExportViewport = { width: 1200, height: 760, padding: 28 };
const maxPreviewFeatureCount = 20000;
const dataLoadProgress = {
  resources: new Map(),
  phase: 'idle',
};
let renderRequestId = 0;

const datasets = await loadDatasets();
const projections = {
  region: buildProjection(datasets.regionsGeojson),
  province: buildProjection(datasets.provincesGeojson),
  district: buildProjection(datasets.districtsGeojson),
  mahalle: null,
};

hydrateRegionSelect();
hydrateProvinceSelect();
normalizeInterfaceCopy();
hydrateHeroFormatCards();
bindEvents();
bindParallax();
syncConfigurator();
render();

async function loadDatasets() {
  const requiredRequests = [
    ['./dist/json/regions.json', 'Bölgeler'],
    ['./dist/json/provinces.json', 'İller'],
    ['./dist/json/districts.json', 'İlçeler'],
    ['./dist/json/yerlesimler.json', 'Yerleşimler'],
    ['./source/reference/source-labels.json', 'Kaynak etiketleri'],
    ['./source/yayinlanabilir/sources.json', 'Yayinlanabilir kaynaklar'],
    ['./dist/geojson/regions.geojson', 'Bölge geometrisi'],
    ['./dist/geojson/provinces.geojson', 'İl geometrisi'],
    ['./dist/geojson/districts.geojson', 'İlçe geometrisi'],
  ];
  const optionalRequests = [
    ['./source/reference/quality-overrides.json', 'Kalite notlari'],
    ['./dist/json/mahalle-geometrileri-report.json', 'Geometri raporu'],
    ['./dist/json/mahalle-geometrileri-coverage.json', 'Geometri kapsam listesi'],
  ];
  const requests = [...requiredRequests, ...optionalRequests];
  initDataLoadProgress(requests);

  const [
    regions,
    provinces,
    districts,
    yerlesimler,
    sourceLabels,
    publishableSources,
    regionsGeojson,
    provincesGeojson,
    districtsGeojson,
  ] = await Promise.all(requiredRequests.map(([url, label]) => fetchJson(url, label)));
  const [qualityOverrides, geometryReport, geometryCoverage] = await Promise.all(
    optionalRequests.map(([url, label]) => fetchJson(url, label, { silent404: true })),
  );

  updateDataLoadStatus('processing');

  const yerlesimlerById = new Map(yerlesimler.map((item) => [item.id, item]));
  const mahalleMetadataById = new Map(yerlesimlerById);
  const regionsById = new Map(regions.map((item) => [item.id, item]));
  const provincesById = new Map(provinces.map((item) => [item.id, item]));
  const districtsById = new Map(districts.map((item) => [item.id, item]));
  const publishableProvinceIds = new Set(
    (publishableSources?.province_sources || [])
      .filter((item) => item.publishable)
      .map((item) => `TR-P-${String(item.province_code).padStart(2, '0')}`),
  );

  updateDataLoadStatus('ready');

  return {
    regions,
    provinces,
    districts,
    yerlesimler,
    regionsGeojson: buildDissolvedRegionsGeojson(regions, regionsGeojson, provincesGeojson),
    provincesGeojson,
    districtsGeojson,
    mahalleGeometrileri: { type: 'FeatureCollection', features: [] },
    mahalleGeometryCache: new Map(),
    loadedMahalleGeometryKey: '',
    sourceLabels,
    qualityNotes: [...normalizeQualityNotes(qualityOverrides), ...normalizeReportNotes(geometryReport)],
    qualityIssueLabels: qualityOverrides?.issue_labels || {},
    mahalleGeometryCoverage: normalizeMahalleGeometryCoverage(geometryCoverage),
    publishableSources,
    publishableProvinceIds,
    regionsById,
    provincesById,
    districtsById,
    yerlesimlerById,
    mahalleMetadataById,
  };
}

function buildDissolvedRegionsGeojson(regions, regionsGeojson, provincesGeojson) {
  if (!window.topojson?.topology || !window.topojson?.merge) {
    return regionsGeojson;
  }

  const topology = window.topojson.topology({ provinces: provincesGeojson });
  const provinceGeometries = topology?.objects?.provinces?.geometries;
  if (!Array.isArray(provinceGeometries)) {
    return regionsGeojson;
  }

  const mergedFeatures = regionsGeojson.features.map((feature) => {
    const region = regions.find((item) => item.id === feature.properties.id);
    const memberIds = new Set(region?.member_ids || feature.properties.member_ids || []);
    const members = provinceGeometries.filter((geometry) => memberIds.has(geometry.properties?.id));
    if (members.length === 0) {
      return feature;
    }

    const mergedGeometry = window.topojson.merge(topology, members);
    return {
      ...feature,
      geometry: mergedGeometry || feature.geometry,
    };
  });

  return {
    ...regionsGeojson,
    features: mergedFeatures,
  };
}

function normalizeMahalleGeometryCoverage(payload) {
  const districtsByProvince = new Map();
  for (const [provinceId, districtIds] of Object.entries(payload?.districts_by_province || {})) {
    districtsByProvince.set(provinceId, new Set((districtIds || []).filter(Boolean)));
  }
  return {
    provinceIds: new Set((payload?.province_ids || []).filter(Boolean)),
    districtIds: new Set((payload?.district_ids || []).filter(Boolean)),
    districtsByProvince,
  };
}

function normalizeQualityNotes(payload) {
  const notes = Array.isArray(payload?.notes) ? payload.notes : Array.isArray(payload) ? payload : [];
  return notes.map((note) => {
    const affectedIds = [];
    const settlementNames = [];

    if (note.settlement_id) {
      affectedIds.push(note.settlement_id);
    }
    if (note.settlement_name) {
      settlementNames.push(note.settlement_name);
    }

    for (const settlement of note.settlements || []) {
      if (settlement?.settlement_id) {
        affectedIds.push(settlement.settlement_id);
      }
      if (settlement?.settlement_name) {
        settlementNames.push(settlement.settlement_name);
      }
    }

    return {
      level: note.level || 'mahalle',
      provinceId: note.province_id || '',
      provinceName: note.province_name || '',
      districtId: note.district_id || '',
      districtName: note.district_name || '',
      issue: note.issue || 'manual_quality_note',
      status: note.status || 'open',
      message: note.note || 'Bu kayt iin kalite notu bulunuyor.',
      settlementNames: [...new Set(settlementNames.filter(Boolean))],
      affectedIds: [...new Set(affectedIds.filter(Boolean))],
    };
  });
}

function normalizeReportNotes(report) {
  if (!report) return [];
  const notes = [];

  // OSB areas — group by province + district
  const osbMap = new Map();
  for (const src of Object.values(report.sources || {})) {
    for (const osb of src.osb_areas || []) {
      const key = `${src.province_id}::${osb.district_id || ''}`;
      if (!osbMap.has(key)) {
        osbMap.set(key, {
          provinceId: src.province_id,
          provinceName: src.province_name,
          districtId: osb.district_id || '',
          districtName: osb.district_name || '',
          names: [],
          ids: [],
        });
      }
      const g = osbMap.get(key);
      g.names.push(osb.raw_name);
      if (osb.osb_id) g.ids.push(osb.osb_id);
    }
  }
  for (const group of osbMap.values()) {
    notes.push({
      level: 'mahalle',
      provinceId: group.provinceId,
      provinceName: group.provinceName,
      districtId: group.districtId,
      districtName: group.districtName,
      issue: 'osb_area',
      status: 'open',
      message: 'Resmi mahalle listesinde bulunmuyor; OSB veya sanayi alanı olarak çizildi.',
      settlementNames: group.names,
      affectedIds: group.ids,
    });
  }

  // Geometry repairs — group by province + district
  const repairsMap = new Map();
  for (const repair of report.geometry_repairs || []) {
    if (repair.status !== 'applied') continue;
    const key = `${repair.province_id}::${repair.district_id}`;
    if (!repairsMap.has(key)) {
      repairsMap.set(key, {
        provinceId: repair.province_id,
        provinceName: repair.province_name,
        districtId: repair.district_id,
        districtName: repair.district_name,
        pairs: [],
        affectedIds: [],
      });
    }
    const group = repairsMap.get(key);
    group.pairs.push(`${repair.outer_name} içinde ${repair.inner_name}`);
    if (repair.outer_id) group.affectedIds.push(repair.outer_id);
  }
  for (const group of repairsMap.values()) {
    notes.push({
      level: 'mahalle',
      provinceId: group.provinceId,
      provinceName: group.provinceName,
      districtId: group.districtId,
      districtName: group.districtName,
      issue: 'geometry_repair',
      status: 'applied',
      message: 'İç içe geçen polygon düzeltildi; iç yerleşimi kapsayan dış mahallenin geometrisi kırpıldı.',
      settlementNames: group.pairs,
      affectedIds: group.affectedIds,
    });
  }

  // Far multipolygons — group by province + district
  const farMap = new Map();
  for (const item of report.far_multipolygons || []) {
    const key = `${item.province_id}::${item.district_id || ''}`;
    if (!farMap.has(key)) {
      farMap.set(key, {
        provinceId: item.province_id,
        provinceName: item.province_name || '',
        districtId: item.district_id || '',
        districtName: item.district_name || '',
        names: [],
        ids: [],
      });
    }
    const g = farMap.get(key);
    const km = Math.round(item.max_dist_deg * 111);
    g.names.push(`${item.name} (${item.polygon_count} parça, ~${km} km arayla)`);
    if (item.id) g.ids.push(item.id);
  }
  for (const group of farMap.values()) {
    notes.push({
      level: 'mahalle',
      provinceId: group.provinceId,
      provinceName: group.provinceName,
      districtId: group.districtId,
      districtName: group.districtName,
      issue: 'far_multipolygon',
      status: 'open',
      message: 'Mahalle geometrisi birden fazla uzak parçadan oluşuyor; kaynak hatası olabilir.',
      settlementNames: group.names,
      affectedIds: group.ids,
    });
  }

  return notes;
}

function getActiveQualityNotes() {
  return datasets.qualityNotes || [];
}

function initDataLoadProgress(requests) {
  dataLoadProgress.resources = new Map(requests.map(([url, label]) => [
    url,
    {
      label,
      loaded: 0,
      total: 0,
      done: false,
      processing: false,
    },
  ]));
  updateDataLoadStatus('loading');
}

function updateResourceProgress(url, patch) {
  const current = dataLoadProgress.resources.get(url) || {};
  dataLoadProgress.resources.set(url, {
    ...current,
    ...patch,
  });
  updateDataLoadStatus(patch.processing ? 'processing' : 'loading');
}

function updateDataLoadStatus(phase) {
  dataLoadProgress.phase = phase || dataLoadProgress.phase;
  if (!els.mapLoadStatus || !els.mapLoadText || !els.mapLoadBar) {
    return;
  }

  const resources = [...dataLoadProgress.resources.values()];
  const hasResources = resources.length > 0;
  const allDone = hasResources && resources.every((resource) => resource.done);
  const allKnown = hasResources && resources.every((resource) => resource.total > 0);
  const total = resources.reduce((sum, resource) => sum + resource.total, 0);
  const loaded = resources.reduce((sum, resource) => sum + Math.min(resource.loaded, resource.total || resource.loaded), 0);
  const percent = allKnown && total > 0
    ? Math.min(100, Math.round((loaded / total) * 100))
    : null;

  els.mapLoadStatus.classList.toggle('is-ready', phase === 'ready' || allDone);
  els.mapLoadStatus.classList.toggle('is-error', phase === 'error');
  els.mapLoadStatus.classList.toggle('is-indeterminate', percent === null && phase !== 'ready' && phase !== 'error');

  if (phase === 'ready' || allDone) {
    els.mapLoadText.textContent = 'Veri haz\u0131r';
    els.mapLoadBar.style.width = '100%';
    return;
  }

  if (phase === 'error') {
    els.mapLoadText.textContent = 'Veri y\u00fcklenemedi';
    els.mapLoadBar.style.width = '100%';
    return;
  }

  if (phase === 'processing') {
    els.mapLoadText.textContent = 'Veri i\u015fleniyor...';
    els.mapLoadBar.style.width = percent === null ? '' : `${Math.max(percent, 96)}%`;
    return;
  }

  els.mapLoadText.textContent = percent === null
    ? 'Veri y\u00fckleniyor...'
    : `Veri y\u00fckleniyor: %${percent}`;
  els.mapLoadBar.style.width = percent === null ? '' : `${percent}%`;
}

async function fetchJson(url, label = url, { silent404 = false } = {}) {
  updateResourceProgress(url, { label });
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    if (silent404 && response.status === 404) {
      updateResourceProgress(url, { done: true });
      return null;
    }
    updateDataLoadStatus('error');
    throw new Error(`Yüklenemedi (${response.status}): ${url}`);
  }
  const total = Number(response.headers.get('Content-Length')) || 0;
  updateResourceProgress(url, { total });

  if (!response.body.getReader) {
    const text = await response.text();
    updateResourceProgress(url, { loaded: total || text.length, total: total || text.length, processing: true });
    const payload = JSON.parse(text);
    updateResourceProgress(url, { done: true, processing: false });
    return payload;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let loaded = 0;
  let text = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    loaded += value.byteLength;
    text += decoder.decode(value, { stream: true });
    updateResourceProgress(url, { loaded, total });
  }

  text += decoder.decode();
  updateResourceProgress(url, { loaded: total || loaded, total: total || loaded, processing: true });
  const payload = JSON.parse(text);
  updateResourceProgress(url, { done: true, processing: false });
  return payload;
}

function getMahalleGeometryUrlsForState() {
  if (state.level !== 'mahalle') {
    return [];
  }

  const coverage = datasets.mahalleGeometryCoverage || { districtIds: new Set() };
  const districtIds = state.districtId
    ? (coverage.districtIds.size === 0 || coverage.districtIds.has(state.districtId) ? [state.districtId] : [])
    : datasets.districts
      .filter((district) => {
        if (!datasets.publishableProvinceIds.has(district.parent_id)) return false;
        if (state.provinceId && district.parent_id !== state.provinceId) return false;
        if (!state.provinceId && state.regionId && district.region_id !== state.regionId) return false;
        if (coverage.districtIds.size > 0 && !coverage.districtIds.has(district.id)) return false;
        return true;
      })
      .map((district) => district.id);

  return districtIds.map((districtId) => ({
    key: `district:${districtId}`,
    url: `./dist/geojson/mahalle-geometrileri-by-district-v2/${districtId}.geojson`,
    label: `Mahalle geometrisi: ${datasets.districtsById.get(districtId)?.name || districtId}`,
  }));
}

async function ensureActiveMahalleGeometries() {
  if (state.level !== 'mahalle') {
    return;
  }

  const resources = getMahalleGeometryUrlsForState();
  const activeKey = resources.map((resource) => resource.key).join('|');
  if (datasets.loadedMahalleGeometryKey === activeKey) {
    return;
  }

  updateDataLoadStatus('loading');

  for (const resource of resources) {
    if (!dataLoadProgress.resources.has(resource.url)) {
      dataLoadProgress.resources.set(resource.url, {
        label: resource.label,
        loaded: 0,
        total: 0,
        done: false,
        processing: false,
      });
    }
  }

  const collections = await Promise.all(resources.map(async (resource) => {
    if (!datasets.mahalleGeometryCache.has(resource.key)) {
      const request = fetchJson(resource.url, resource.label, { silent404: true })
        .then((data) => data ?? { type: 'FeatureCollection', features: [] })
        .catch((error) => {
          datasets.mahalleGeometryCache.delete(resource.key);
          throw error;
        });
      datasets.mahalleGeometryCache.set(resource.key, request);
    }
    return datasets.mahalleGeometryCache.get(resource.key);
  }));

  const featuresById = new Map();
  for (const collection of collections) {
    for (const feature of collection.features || []) {
      featuresById.set(feature.properties.id, feature);
      mergeMahalleFeatureMetadata(feature);
    }
  }

  datasets.mahalleGeometrileri = {
    type: 'FeatureCollection',
    features: [...featuresById.values()],
  };
  datasets.loadedMahalleGeometryKey = activeKey;
  projections.mahalle = datasets.mahalleGeometrileri.features.length > 0
    ? buildProjection(datasets.mahalleGeometrileri)
    : null;
}

function mergeMahalleFeatureMetadata(feature) {
  const existing = datasets.mahalleMetadataById.get(feature.properties.id);
  datasets.mahalleMetadataById.set(feature.properties.id, {
    ...(existing || {}),
    ...feature.properties,
    name: existing?.name || feature.properties.name || feature.properties.source_raw_name || feature.properties.id,
    parent_id: existing?.parent_id || feature.properties.parent_id || feature.properties.district_id || '',
    slug: existing?.slug || feature.properties.slug || feature.properties.id.toLowerCase(),
  });
}

function hydrateRegionSelect() {
  if (!els.regionSelect) {
    return;
  }

  for (const region of datasets.regions) {
    const option = document.createElement('option');
    option.value = region.id;
    option.textContent = region.name;
    els.regionSelect.append(option);
  }
}

function hydrateProvinceSelect() {
  if (!els.provinceSelect) {
    return;
  }

  for (const province of datasets.provinces) {
    const option = document.createElement('option');
    option.value = province.id;
    option.textContent = `${province.name} (${province.plate_code})`;
    els.provinceSelect.append(option);
  }
}

function normalizeInterfaceCopy() {
  const csvLabel = document.querySelector('#csvDelimiterField span');
  const csvOptions = document.querySelectorAll('#csvDelimiterSelect option');

  if (csvLabel) {
    csvLabel.textContent = 'CSV ayırıcı';
  }

  if (csvOptions[0]) {
    csvOptions[0].textContent = 'Virgül (,)';
  }

  if (csvOptions[1]) {
    csvOptions[1].textContent = 'Noktalı virgül (;)';
  }
}


function bindEvents() {
  els.heroFormatChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const format = chip.dataset.format;
      if (!format) {
        return;
      }

      if (state.format !== format) {
        state.selectedFields = [];
      }
      state.format = format;
      if (els.formatSelect) {
        els.formatSelect.value = format;
      }
      syncConfigurator();
      render();
    });
  });

  els.formatSelect.addEventListener('change', (event) => {
    if (state.format !== event.target.value) {
      state.selectedFields = [];
    }
    state.format = event.target.value;
    syncConfigurator();
    render();
  });

  els.scopeSelect.addEventListener('change', (event) => {
    state.scope = event.target.value;

    if (state.scope === 'turkey') {
      state.regionId = '';
      state.provinceId = '';
      state.districtId = '';
      if (els.regionSelect) els.regionSelect.value = '';
      if (els.provinceSelect) els.provinceSelect.value = '';
      if (els.districtSelect) els.districtSelect.value = '';
    } else if (state.scope === 'region') {
      state.provinceId = '';
      state.districtId = '';
      if (els.provinceSelect) els.provinceSelect.value = '';
      if (els.districtSelect) els.districtSelect.value = '';
    } else {
      state.districtId = '';
      if (state.provinceId) {
        state.regionId = datasets.provincesById.get(state.provinceId)?.region_id || state.regionId;
      }
      if (els.districtSelect) els.districtSelect.value = '';
    }

    syncConfigurator();
    render();
  });

  els.detailSelect.addEventListener('change', (event) => {
    if (state.level !== event.target.value) {
      state.selectedFields = [];
    }
    state.level = event.target.value;

    if (state.level === 'region') {
      if (state.provinceId) {
        state.regionId = datasets.provincesById.get(state.provinceId)?.region_id || state.regionId;
      } else if (state.districtId) {
        const district = datasets.districtsById.get(state.districtId);
        state.regionId = district?.region_id || state.regionId;
      }
      state.scope = state.regionId ? 'region' : 'turkey';
      state.provinceId = '';
      state.districtId = '';
      if (els.scopeSelect) els.scopeSelect.value = state.scope;
      if (els.provinceSelect) els.provinceSelect.value = '';
      if (els.districtSelect) els.districtSelect.value = '';
    } else if (state.level === 'province') {
      if (state.districtId && !state.provinceId) {
        const district = datasets.districtsById.get(state.districtId);
        state.provinceId = district?.parent_id || '';
        state.regionId = district?.region_id || state.regionId;
      }
      state.districtId = '';
      if (state.provinceId) {
        state.scope = 'province';
      } else if (state.regionId) {
        state.scope = 'region';
      } else {
        state.scope = 'turkey';
      }
      if (els.scopeSelect) els.scopeSelect.value = state.scope;
      if (els.provinceSelect) els.provinceSelect.value = '';
      if (els.districtSelect) els.districtSelect.value = '';
    } else if (state.level === 'mahalle') {
      if (state.districtId) {
        const district = datasets.districtsById.get(state.districtId);
        state.provinceId = district?.parent_id || state.provinceId;
        state.regionId = district?.region_id || state.regionId;
        state.scope = 'province';
        if (els.scopeSelect) els.scopeSelect.value = 'province';
        if (els.provinceSelect) els.provinceSelect.value = state.provinceId;
        if (els.regionSelect) els.regionSelect.value = state.regionId;
      } else if (state.provinceId) {
        state.scope = 'province';
        state.regionId = datasets.provincesById.get(state.provinceId)?.region_id || state.regionId;
        if (els.scopeSelect) els.scopeSelect.value = 'province';
        if (els.regionSelect) els.regionSelect.value = state.regionId;
      } else if (state.regionId) {
        state.scope = 'region';
        if (els.scopeSelect) els.scopeSelect.value = 'region';
      } else {
        state.scope = 'turkey';
        if (els.scopeSelect) els.scopeSelect.value = 'turkey';
      }
    } else {
      if (state.districtId) {
        const district = datasets.districtsById.get(state.districtId);
        state.provinceId = district?.parent_id || state.provinceId;
        state.regionId = district?.region_id || state.regionId;
        state.scope = 'province';
        if (els.provinceSelect) els.provinceSelect.value = state.provinceId;
        if (els.regionSelect) els.regionSelect.value = state.regionId;
      } else if (state.provinceId) {
        state.regionId = datasets.provincesById.get(state.provinceId)?.region_id || state.regionId;
        state.scope = 'province';
        if (els.regionSelect) els.regionSelect.value = state.regionId;
      } else if (state.regionId) {
        state.scope = 'region';
      } else {
        state.scope = 'turkey';
      }
      if (els.scopeSelect) els.scopeSelect.value = state.scope;
    }

    syncConfigurator();
    render();
  });

  els.styleSelect.addEventListener('change', (event) => {
    state.style = event.target.value;
    syncConfigurator();
    render();
  });

  els.colorModeSelect.addEventListener('change', (event) => {
    state.colorMode = event.target.value;
    syncConfigurator();
    render();
  });

  els.paletteSelect.addEventListener('change', (event) => {
    state.palette = event.target.value;
    syncConfigurator();
    render();
  });

  els.resolutionSelect.addEventListener('change', (event) => {
    state.resolution = event.target.value;
    syncConfigurator();
  });

  els.gpkgCrsSelect.addEventListener('change', (event) => {
    state.gpkgCrs = event.target.value;
    syncConfigurator();
  });

  els.gpkgGeometrySelect.addEventListener('change', (event) => {
    state.gpkgGeometryMode = event.target.value;
    syncConfigurator();
  });

  els.csvDelimiterSelect.addEventListener('change', (event) => {
    state.csvDelimiter = event.target.value;
    syncConfigurator();
  });

  els.baseLayerSelect.addEventListener('change', (event) => {
    state.baseLayer = event.target.value;
    render();
  });

  els.regionSelect.addEventListener('change', (event) => {
    state.regionId = event.target.value;
    state.selectedId = '';

    if (state.regionId) {
      state.scope = 'region';
      if (els.scopeSelect) els.scopeSelect.value = 'region';
      state.provinceId = '';
      state.districtId = '';
      if (els.provinceSelect) els.provinceSelect.value = '';
      if (els.districtSelect) els.districtSelect.value = '';
    } else if (state.scope === 'region') {
      state.scope = 'turkey';
      if (els.scopeSelect) els.scopeSelect.value = 'turkey';
      if (state.level === 'district') {
        state.provinceId = '';
        state.districtId = '';
        if (els.provinceSelect) els.provinceSelect.value = '';
        if (els.districtSelect) els.districtSelect.value = '';
      } else {
        state.level = 'region';
        if (els.detailSelect) els.detailSelect.value = 'region';
      }
    }

    syncConfigurator();
    render();
  });

  els.provinceSelect.addEventListener('change', (event) => {
    state.provinceId = event.target.value;
    state.districtId = '';
    state.selectedId = '';

    if (state.provinceId) {
      state.scope = 'province';
      state.level = state.level === 'mahalle' ? 'mahalle' : 'district';
      state.regionId = datasets.provincesById.get(state.provinceId)?.region_id || '';
      if (els.scopeSelect) els.scopeSelect.value = 'province';
      if (els.detailSelect) els.detailSelect.value = state.level;
      if (els.regionSelect) els.regionSelect.value = state.regionId;
      if (els.districtSelect) els.districtSelect.value = '';
    }

    syncConfigurator();
    render();
  });

  els.districtSelect.addEventListener('change', (event) => {
    state.districtId = event.target.value;
    state.selectedId = '';

    if (state.districtId) {
      const district = datasets.districtsById.get(state.districtId);
      state.provinceId = district.parent_id || state.provinceId;
      state.regionId = district.region_id || state.regionId;
      if (els.provinceSelect) els.provinceSelect.value = state.provinceId;
      if (els.regionSelect) els.regionSelect.value = state.regionId;
      if (els.scopeSelect) els.scopeSelect.value = 'province';
      state.scope = 'province';
    }

    syncConfigurator();
    render();
  });

  let searchDebounceTimer = 0;
  els.searchInput.addEventListener('input', (event) => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = window.setTimeout(() => {
      state.search = normalizeSearchText(event.target.value);
      render();
    }, 160);
  });

  els.downloadButton.addEventListener('click', async () => {
    const availability = getFormatAvailability();
    if (!availability.available) {
      return;
    }

    const button = els.downloadButton;
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Hazırlanıyor…';
    button.classList.remove('is-ready', 'is-error', 'is-success');
    button.classList.add('is-preparing');

    try {
      await triggerDownload(availability.filename);
      button.classList.remove('is-preparing');
      button.classList.add('is-success');
      button.textContent = 'İndirildi';
      window.setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
        button.classList.remove('is-success');
        button.classList.add('is-ready');
      }, 2000);
    } catch (error) {
      console.error('Download failed', state.format, error);
      button.classList.remove('is-preparing');
      button.classList.add('is-error');
      button.textContent = 'Hata oluştu';
      window.setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
        button.classList.remove('is-error');
        button.classList.add('is-ready');
      }, 2500);
    }
  });

  els.qualityButton.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = !els.qualityPanel.classList.contains('is-hidden');
    setQualityPanelOpen(!isOpen);
  });

  document.addEventListener('click', (e) => {
    if (!els.qualityPanel.classList.contains('is-hidden')) {
      if (!els.qualityPanel.contains(e.target) && e.target !== els.qualityButton) {
        setQualityPanelOpen(false);
      }
    }
  });

  els.resetButton.addEventListener('click', () => {
    state.format = 'geojson';
    state.scope = 'turkey';
    state.level = 'region';
    state.selectedFields = [];
    state.csvDelimiter = ',';
    state.style = 'filled';
    state.colorMode = 'single';
    state.palette = 'blue';
    state.resolution = '1920x1080';
    state.gpkgCrs = 'EPSG:4326';
    state.gpkgGeometryMode = 'auto';
    state.regionId = '';
    state.provinceId = '';
    state.districtId = '';
    state.search = '';
    state.selectedId = '';
    state.hoveredId = '';

    if (els.formatSelect) els.formatSelect.value = state.format;
    if (els.scopeSelect) els.scopeSelect.value = state.scope;
    if (els.detailSelect) els.detailSelect.value = state.level;
    if (els.styleSelect) els.styleSelect.value = state.style;
    if (els.colorModeSelect) els.colorModeSelect.value = state.colorMode;
    if (els.paletteSelect) els.paletteSelect.value = state.palette;
    if (els.resolutionSelect) els.resolutionSelect.value = state.resolution;
    if (els.gpkgCrsSelect) els.gpkgCrsSelect.value = state.gpkgCrs;
    if (els.gpkgGeometrySelect) els.gpkgGeometrySelect.value = state.gpkgGeometryMode;
    if (els.csvDelimiterSelect) els.csvDelimiterSelect.value = state.csvDelimiter;
    if (els.regionSelect) els.regionSelect.value = '';
    if (els.provinceSelect) els.provinceSelect.value = '';
    if (els.districtSelect) els.districtSelect.value = '';
    if (els.searchInput) els.searchInput.value = '';

    syncConfigurator();
    render();
  });
}

function hydrateHeroFormatCards() {
  const meta = {
    geojson: { subtitle: 'Vektör', color: '#61d7ff' },
    json: { subtitle: 'Veri', color: '#ff9f43' },
    topojson: { subtitle: 'Topo', color: '#7f8cff' },
    csv: { subtitle: 'Tablo', color: '#ffcd38' },
    xlsx: { subtitle: 'Excel', color: '#4be38a' },
    sql: { subtitle: 'Sorgu', color: '#8c9bff' },
    wkt: { subtitle: 'Metin', color: '#c9d2e7' },
    kml: { subtitle: 'Harita', color: '#45e27d' },
    kmz: { subtitle: 'Sıkışık', color: '#42c9ff' },
    gml: { subtitle: 'OGC', color: '#ff6f91' },
    osm: { subtitle: 'OSM XML', color: '#56d68b' },
    svg: { subtitle: 'Vektör', color: '#3dbbff' },
    png: { subtitle: 'Görsel', color: '#a9ef57' },
    gpkg: { subtitle: 'GIS Paket', color: '#ff8a3d' },
    shp: { subtitle: 'Shapefile', color: '#59a7ff' },
    dxf: { subtitle: 'CAD', color: '#3ee6c4' },
    pdf: { subtitle: 'Belge', color: '#ffd166' },
    'react-component': { subtitle: 'Kod', color: '#ff7de9' },
  };

  els.heroFormatChips.forEach((chip) => {
    const format = chip.dataset.format;
    if (!format || !meta[format]) {
      return;
    }
    const title = chip.textContent.trim();
    const info = meta[format];
    chip.style.setProperty('--format-accent', info.color);
    chip.innerHTML = `
      <span class="hero-format-title">${title}</span>
      <span class="hero-format-meta">${info.subtitle}</span>
    `;
  });
}

function bindParallax() {
  if (!els.pageShell) {
    return;
  }

  let frameId = 0;

  const applyParallax = (clientX = window.innerWidth / 2, scrollY = window.scrollY) => {
    const xRatio = (clientX / window.innerWidth) - 0.5;
    const xOffset = Math.max(-24, Math.min(24, xRatio * 48));
    const yOffset = Math.max(-36, Math.min(84, scrollY * 0.08));
    els.pageShell.style.setProperty('--parallax-x', `${xOffset.toFixed(2)}px`);
    els.pageShell.style.setProperty('--parallax-y', `${yOffset.toFixed(2)}px`);
  };

  applyParallax();

  window.addEventListener('pointermove', (event) => {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = window.requestAnimationFrame(() => applyParallax(event.clientX, window.scrollY));
  });

  window.addEventListener('scroll', () => {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = window.requestAnimationFrame(() => applyParallax(window.innerWidth / 2, window.scrollY));
  }, { passive: true });
}

function syncConfigurator() {
  syncFormatFields();
  syncRegionFilter();
  syncProvinceFilter();
  syncProvinceOptions();
  syncDistrictFilter();
  syncDistrictOptions();
  syncFieldOptions();
  syncDownloadState();
}

function syncFormatFields() {
  const isGeoPackage = state.format === 'gpkg';
  const isStructuredData = ['json', 'geojson', 'topojson', 'csv', 'xlsx', 'sql', 'wkt', 'kml', 'kmz', 'gml', 'osm', 'gpkg', 'react-component'].includes(state.format);
  const isTabularData = ['csv', 'xlsx', 'sql', 'wkt'].includes(state.format);
  const isVectorVisual = state.format === 'svg' || state.format === 'react-component';
  const isRasterVisual = state.format === 'png' || state.format === 'pdf';
  const isVisual = isVectorVisual || isRasterVisual;
  const showColorMode = isVisual && (state.style === 'filled' || state.style === 'transparent');
  const showPalette = showColorMode && state.colorMode === 'palette';

  toggleField(els.fieldsField, isStructuredData || isVisual);
  toggleField(els.shpFieldsNote, state.format === 'shp');
  toggleField(els.dxfFieldsNote, state.format === 'dxf');
  toggleField(els.styleField, isVisual);
  toggleField(els.colorModeField, showColorMode);
  toggleField(els.paletteField, showPalette);
  toggleField(els.resolutionField, isRasterVisual);
  toggleField(els.gpkgCrsField, isGeoPackage);
  toggleField(els.gpkgGeometryField, isGeoPackage);
  toggleField(els.gpkgEncodingField, isGeoPackage);
  toggleField(els.csvDelimiterField, state.format === 'csv');

  if (!isTabularData && els.csvDelimiterSelect) {
    els.csvDelimiterSelect.value = state.csvDelimiter;
  }

  if (!isGeoPackage) {
    if (els.gpkgCrsSelect) els.gpkgCrsSelect.value = state.gpkgCrs;
    if (els.gpkgGeometrySelect) els.gpkgGeometrySelect.value = state.gpkgGeometryMode;
  }
}

function syncProvinceFilter() {
  const needsProvince = state.scope === 'province' || state.level === 'district' || state.level === 'mahalle';
  toggleField(els.provinceSelect.closest('.field'), needsProvince);

  if (!needsProvince && els.provinceSelect) {
    els.provinceSelect.value = '';
    state.provinceId = '';
  }
}

function syncDistrictFilter() {
  const needsDistrict = state.level === 'district' || state.level === 'mahalle';
  toggleField(els.districtSelect.closest('.field'), needsDistrict);

  if (!needsDistrict && els.districtSelect) {
    els.districtSelect.value = '';
    state.districtId = '';
  }
}

function syncRegionFilter() {
  const needsRegion = state.scope === 'region' || state.scope === 'province' || state.level === 'province' || state.level === 'district' || state.level === 'mahalle';
  toggleField(els.regionSelect.closest('.field'), needsRegion);

  if (!needsRegion && els.regionSelect) {
    els.regionSelect.value = '';
    state.regionId = '';
  }
}

function syncFieldOptions() {
  const options = getAvailableFieldDefinitions();
  const allowed = new Set(options.map((option) => option.key));
  const selected = state.selectedFields.filter((field) => allowed.has(field));

  state.selectedFields = selected.length > 0
    ? selected
    : options.filter((option) => option.default).map((option) => option.key);

  renderFieldChecklist(options);
}

function syncProvinceOptions() {
  if (!els.provinceSelect) {
    return;
  }

  const currentValue = state.provinceId;
  const allowedMahalleProvinceIds = state.level === 'mahalle'
    ? datasets.publishableProvinceIds
    : null;
  const provinces = state.regionId
    ? datasets.provinces.filter((item) => item.region_id === state.regionId)
    : datasets.provinces;
  const visibleProvinces = allowedMahalleProvinceIds
    ? provinces.filter((item) => allowedMahalleProvinceIds.has(item.id))
    : provinces;

  els.provinceSelect.replaceChildren(new Option('Tüm Türkiye', ''));

  for (const province of visibleProvinces) {
    const option = document.createElement('option');
    option.value = province.id;
    option.textContent = `${province.name} (${province.plate_code})`;
    els.provinceSelect.append(option);
  }

  if (currentValue && visibleProvinces.some((item) => item.id === currentValue)) {
    els.provinceSelect.value = currentValue;
  } else {
    state.provinceId = '';
    els.provinceSelect.value = '';
  }
}

function syncDistrictOptions() {
  if (!els.districtSelect) {
    return;
  }

  const currentValue = state.districtId;
  const allDistricts = state.level === 'mahalle'
    ? datasets.districts.filter((item) => datasets.publishableProvinceIds.has(item.parent_id))
    : datasets.districts;
  const districts = state.provinceId
    ? allDistricts.filter((item) => item.parent_id === state.provinceId)
    : state.regionId
      ? allDistricts.filter((item) => item.region_id === state.regionId)
      : allDistricts;

  els.districtSelect.replaceChildren(new Option('Tüm ilçeler', ''));

  for (const district of districts) {
    const option = document.createElement('option');
    option.value = district.id;
    option.textContent = `${district.name} (${datasets.provincesById.get(district.parent_id)?.name || ''})`;
    els.districtSelect.append(option);
  }

  if (currentValue && districts.some((item) => item.id === currentValue)) {
    els.districtSelect.value = currentValue;
  } else {
    state.districtId = '';
  }
}

function renderFieldChecklist(options) {
  if (!els.fieldChecklist) {
    return;
  }

  els.fieldChecklist.replaceChildren();
  for (const option of options) {
    const label = document.createElement('label');
    label.className = 'field-option';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = option.key;
    checkbox.checked = state.selectedFields.includes(option.key);

    const textWrapper = document.createElement('span');
    textWrapper.append(document.createTextNode(option.label));

    const description = document.createElement('small');
    description.textContent = option.description;
    textWrapper.append(description);

    label.append(checkbox, textWrapper);
    els.fieldChecklist.append(label);
  }

  const checkboxes = els.fieldChecklist.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach((checkbox) => {
    checkbox.addEventListener('change', (event) => {
      const next = new Set(state.selectedFields);

      if (event.target.checked) {
        next.add(event.target.value);
      } else {
        next.delete(event.target.value);
      }

      if (next.size === 0) {
        event.target.checked = true;
        return;
      }

      state.selectedFields = [...next];
      syncDownloadState();
    });
  });
}

function getAvailableFieldDefinitions() {
  const structuredFormats = new Set(['json', 'geojson', 'topojson', 'csv', 'xlsx', 'sql', 'wkt', 'kml', 'kmz', 'gml', 'osm', 'gpkg', 'svg', 'png', 'pdf', 'react-component']);
  const spatialAttributeFormats = new Set(['csv', 'xlsx', 'sql', 'wkt', 'gml', 'gpkg']);

  if (!structuredFormats.has(state.format)) {
    return [];
  }

  let options;

  const netcadGeojsonFields = state.format === 'geojson'
    ? getNetcadGeojsonFieldDefinitions(state.level)
    : [];

  const spatialFields = spatialAttributeFormats.has(state.format) ? [
    fieldDef('centroid_lat', 'Merkez Noktası (Lat)', 'Merkez noktas? enlemi', false),
    fieldDef('centroid_lon', 'Merkez Noktası (Lon)', 'Merkez noktas? boylamı', false),
    fieldDef('x', 'X / Boylam', 'EPSG:4326 boylam değeri; CSV için sayısal noktalı format', false),
    fieldDef('y', 'Y / Enlem', 'EPSG:4326 enlem değeri; CSV için sayısal noktalı format', false),
    fieldDef('coordinate_system', 'Koordinat Sistemi', 'Koordinat referans sistemi', false),
    fieldDef('bbox_min_lon', 'Sınır Kutusu Batı', 'Minimum boylam (bbox_min_lon)', false),
    fieldDef('bbox_min_lat', 'Sınır Kutusu Güney', 'Minimum enlem (bbox_min_lat)', false),
    fieldDef('bbox_max_lon', 'Sınır Kutusu Doğu', 'Maksimum boylam (bbox_max_lon)', false),
    fieldDef('bbox_max_lat', 'Sınır Kutusu Kuzey', 'Maksimum enlem (bbox_max_lat)', false),
  ] : [];
  if (state.format === 'wkt') {
    spatialFields.push(fieldDef('geometry_wkt', 'Tam Sınır (WKT)', 'Tam sınır geometrisi — yalnızca ileri düzey kullanım', false));
  }

  if (state.level === 'region') {
    options = [
      fieldDef('id', 'Bölge ID', 'Bölgenin Benzersiz Kimliği', true),
      fieldDef('name', 'Bölge Adı', 'Bölge Görünür Adı', true),
      ...netcadGeojsonFields,
      ...spatialFields,
    ];
  } else if (state.level === 'province') {
    options = [
      fieldDef('id', 'İl ID', 'İl Benzersiz Kimliği', true),
      fieldDef('name', 'İl Adı', 'İl Görünür Adı', true),
      fieldDef('region_id', 'Bölge ID', 'Bölge Benzersiz Kimliği', true),
      fieldDef('region_name', 'Bölge Adı', 'Bölge Görünür Adı', true),
      ...netcadGeojsonFields,
      ...spatialFields,
    ];
  } else if (state.level === 'district') {
    options = [
      fieldDef('id', 'İlçe ID', 'İlçe Benzersiz Kimliği', true),
      fieldDef('name', 'İlçe Adı', 'İlçe Görünür Adı', true),
      fieldDef('parent_id', 'İl ID', 'İl Benzersiz Kimliği', true),
      fieldDef('parent_name', 'İl Adı', 'İl Görünür Adı', true),
      fieldDef('region_id', 'Bölge ID', 'Bölge Benzersiz Kimliği', true),
      fieldDef('region_name', 'Bölge Adı', 'Bölge Görünür Adı', true),
      ...netcadGeojsonFields,
      ...spatialFields,
    ];
  } else {
    options = [
      fieldDef('id', 'Mahalle ID', 'Mahalle Benzersiz Kimliği', true),
      fieldDef('name', 'Mahalle Adı', 'Mahalle Görünür Adı', true),
      fieldDef('source_label', 'Kaynak', 'Opsiyonel provenance alanı; GeoPackage için zorunlu temel kolon değildir', false),
      fieldDef('parent_id', 'İlçe ID', 'İlçe Benzersiz Kimliği', true),
      fieldDef('parent_name', 'İlçe Adı', 'İlçe Görünür Adı', true),
      fieldDef('province_id', 'İl ID', 'İl Benzersiz Kimliği', true),
      fieldDef('province_name', 'İl Adı', 'İl Görünür Adı', true),
      ...netcadGeojsonFields,
      ...spatialFields,
    ];
  }

  return options;
}

function getNetcadGeojsonFieldDefinitions(level) {
  const fields = [
    fieldDef('TABAKA', 'Netcad Tabaka', 'Netcad katman adı', true),
    fieldDef('BOLGE_ADI', 'Netcad Bölge Adı', 'Büyük harfli bölge adı', true),
  ];

  if (level === 'province' || level === 'district' || level === 'mahalle') {
    fields.push(
      fieldDef('IL_ADI', 'Netcad İl Adı', 'Büyük harfli il adı', true),
      fieldDef('IL_KODU', 'Netcad İl Kodu', 'Plaka kodu', true),
    );
  }

  if (level === 'district' || level === 'mahalle') {
    fields.push(fieldDef('ILCE_ADI', 'Netcad İlçe Adı', 'Büyük harfli ilçe adı', true));
  }

  if (level === 'mahalle') {
    fields.push(fieldDef('MAHALLE_ADI', 'Netcad Mahalle Adı', 'Büyük harfli mahalle adı', true));
  }

  return fields;
}

function fieldDef(key, label, description, defaultChecked) {
  return { key, label, description, default: defaultChecked };
}

function syncDownloadState() {
  const availability = getFormatAvailability();
  syncHeroFormatChips();
  const detailLabel = state.level;
  const scopeLabel = currentScopeLabel();

  if (els.formatStatus) {
    els.formatStatus.textContent = availability.label;
    els.formatStatus.classList.toggle('is-planned', !availability.available);
  }

  if (els.downloadTitle) {
    els.downloadTitle.textContent = availability.title;
  }

  if (els.downloadSummary) {
    els.downloadSummary.textContent = availability.summary(scopeLabel, detailLabel, state.selectedFields);
  }

  if (els.downloadButton) {
    els.downloadButton.textContent = availability.available ? 'İndir' : 'Planlanan';
    els.downloadButton.disabled = !availability.available;
    els.downloadButton.classList.toggle('is-planned', !availability.available);
    els.downloadButton.classList.toggle('is-ready', availability.available);
  }

  if (els.estimatedSize) {
    const size = estimateDownloadSize();
    els.estimatedSize.textContent = size ? `~${size}` : '';
  }
}

function estimateDownloadSize() {
  const features = getVisibleFeatures();
  const count = features.length;
  if (count === 0) return '';

  const totalCoords = features.reduce((sum, f) => {
    const rings = f.geometry.type === 'MultiPolygon'
      ? f.geometry.coordinates.flat(1)
      : (f.geometry.type === 'Polygon' ? f.geometry.coordinates : []);
    return sum + rings.reduce((s, r) => s + r.length, 0);
  }, 0);

  const geoBytes = totalCoords * 20;
  const metaBytes = count * 200;
  const fmt = state.format;

  let bytes;
  if (fmt === 'json') bytes = metaBytes;
  else if (fmt === 'geojson') bytes = geoBytes + metaBytes * 0.3;
  else if (fmt === 'topojson') bytes = (geoBytes + metaBytes * 0.3) * 0.4;
  else if (fmt === 'csv') bytes = metaBytes * 0.8;
  else if (fmt === 'xlsx') bytes = metaBytes * 0.6;
  else if (fmt === 'sql') bytes = metaBytes * 1.2;
  else if (fmt === 'wkt') bytes = geoBytes * 0.9;
  else if (fmt === 'kml' || fmt === 'kmz') bytes = geoBytes * 1.1;
  else if (fmt === 'gml') bytes = (geoBytes + metaBytes) * 1.15;
  else if (fmt === 'osm') bytes = geoBytes * 1.4 + metaBytes * 0.2;
  else if (fmt === 'shp') bytes = geoBytes * 0.7;
  else if (fmt === 'dxf') bytes = geoBytes * 0.9;
  else if (fmt === 'gpkg') bytes = (geoBytes + metaBytes) * 0.65;
  else if (fmt === 'svg' || fmt === 'png' || fmt === 'react-component') bytes = geoBytes * 0.6;
  else return '';

  if (fmt === 'kmz' || fmt === 'shp' || fmt === 'xlsx') bytes *= 0.5;

  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function syncHeroFormatChips() {
  els.heroFormatChips.forEach((chip) => {
    chip.classList.toggle('is-active', chip.dataset.format === state.format);
  });
}

function getFormatAvailability() {
  const builtArtifactFormats = new Set(['topojson', 'csv', 'xlsx', 'sql', 'wkt', 'kml', 'gml', 'osm']);

  if (state.format === 'json') {
    return {
      available: true,
      label: 'Hazır',
      title: 'JSON hazır',
      filename: getDownloadFilename('json', `${state.level}s`),
      summary(scopeLabel, detailLabel, fields) {
        return `${scopeLabel} için ${getDetailLabel(detailLabel)} verisi indirilebilir. Seçilen alanlar: ${formatSelectedFieldLabels(fields)}.`;
      },
    };
  }

  if (state.format === 'geojson') {
    return {
      available: true,
      label: 'Hazır',
      title: 'GeoJSON hazır',
      filename: getDownloadFilename('geojson', `${state.level}s`),
      summary(scopeLabel, detailLabel, fields) {
        return `${scopeLabel} için ${getDetailLabel(detailLabel)} geometrisi indirilebilir. Özellik alanları: ${formatSelectedFieldLabels(fields)}.`;
      },
    };
  }

  if (state.format === 'svg') {
    return {
      available: true,
      label: 'Hazır',
      title: 'SVG hazır',
      filename: getDownloadFilename('svg', `${state.level}s`),
      summary(scopeLabel, detailLabel, fields) {
        let colorMode = '';
        if (state.style === 'filled') {
          colorMode = ` Renk modu: ${getColorModeLabel(state.colorMode)}.`;
          if (state.colorMode === 'palette') {
            colorMode += ` Palet: ${getPaletteLabel(state.palette)}.`;
          }
        }
        return `${scopeLabel} için ${getDetailLabel(detailLabel)} SVG indirilebilir. Seçilen alanlar: ${formatSelectedFieldLabels(fields)}. Stil: ${getStyleLabel(state.style)}.${colorMode}`;
      },
    };
  }

  if (state.format === 'react-component') {
    return {
      available: true,
      label: 'Hazır',
      title: 'React Component hazır',
      filename: getDownloadFilename('jsx', `${state.level}s-react`),
      summary(scopeLabel, detailLabel, fields) {
        return `${scopeLabel} için ${getDetailLabel(detailLabel)} React component indirilebilir. Seçilen alanlar data-* öznitelikleri olarak eklenir. Stil: ${getStyleLabel(state.style)}.`;
      },
    };
  }

  if (state.format === 'png') {
    return {
      available: true,
      label: 'Hazır',
      title: 'PNG hazır',
      filename: getDownloadFilename('png', `${state.level}s`),
      summary(scopeLabel, detailLabel, fields) {
        let colorMode = '';
        if (state.style === 'filled') {
          colorMode = ` Renk modu: ${getColorModeLabel(state.colorMode)}.`;
          if (state.colorMode === 'palette') {
            colorMode += ` Palet: ${getPaletteLabel(state.palette)}.`;
          }
        }
        return `${scopeLabel} için ${getDetailLabel(detailLabel)} PNG indirilebilir. Stil: ${getStyleLabel(state.style)}.${colorMode} Çözünürlük: ${state.resolution}.`;
      },
    };
  }

  if (state.format === 'pdf') {
    return {
      available: true,
      label: 'Hazır',
      title: 'PDF hazır',
      filename: getDownloadFilename('pdf', `${state.level}s`),
      summary(scopeLabel, detailLabel) {
        let colorMode = '';
        if (state.style === 'filled') {
          colorMode = ` Renk modu: ${getColorModeLabel(state.colorMode)}.`;
          if (state.colorMode === 'palette') {
            colorMode += ` Palet: ${getPaletteLabel(state.palette)}.`;
          }
        }
        return `${scopeLabel} için ${getDetailLabel(detailLabel)} PDF indirilebilir. Stil: ${getStyleLabel(state.style)}.${colorMode} Sayfa boyutu: ${state.resolution}.`;
      },
    };
  }

  if (state.format === 'osm') {
    return {
      available: true,
      label: 'Hazır',
      title: 'OSM XML hazır',
      filename: getDownloadFilename('osm', `${state.level}s`),
      summary(scopeLabel, detailLabel, fields) {
        return `${scopeLabel} için ${getDetailLabel(detailLabel)} OpenStreetMap XML çıktısı indirilebilir. Alanlar: ${formatSelectedFieldLabels(fields)}. Geometri OSM node/way/relation yapısına dönüştürülür.`;
      },
    };
  }

  if (builtArtifactFormats.has(state.format)) {
    return {
      available: true,
      label: 'Hazır',
      title: `${state.format.toUpperCase()} hazır`,
      filename: getDownloadFilename(state.format, `${state.level}s`),
      summary(scopeLabel, detailLabel) {
        return `${scopeLabel} için ${getDetailLabel(detailLabel)} ${state.format.toUpperCase()} çıktısı indirilebilir. Payload seçili filtrelere göre tarayıcıda üretilir.`;
      },
    };
  }

  if (state.format === 'kmz') {
    return {
      available: true,
      label: 'Hazır',
      title: 'KMZ hazır',
      filename: getDownloadFilename('kmz', `${state.level}s`),
      summary(scopeLabel, detailLabel) {
        return `${scopeLabel} için ${getDetailLabel(detailLabel)} KMZ çıktısı indirilebilir. Payload seçili filtrelere göre tarayıcıda üretilir.`;
      },
    };
  }

  if (state.format === 'shp') {
    return {
      available: true,
      label: 'Hazır',
      title: 'Shapefile hazır',
      filename: `${state.level}s.zip`,
      summary(scopeLabel, detailLabel) {
        return `${scopeLabel} için ${getDetailLabel(detailLabel)} Shapefile ZIP paketi indirilebilir (.shp + .shx + .dbf + .prj, WGS84).`;
      },
    };
  }

  if (state.format === 'dxf') {
    return {
      available: true,
      label: 'Hazır',
      title: 'DXF hazır',
      filename: getDownloadFilename('dxf', `${state.level}s`),
      summary(scopeLabel, detailLabel) {
        return `${scopeLabel} için ${getDetailLabel(detailLabel)} DXF çıktısı indirilebilir. Netcad uyumlu katman: ${getNetcadLayerName(state.level)}. Adlar TEXT etiketi olarak otomatik eklenir.`;
      },
    };
  }

  if (state.format === 'gpkg') {
    return {
      available: true,
      label: 'Hazır',
      title: 'GeoPackage hazır',
      filename: getDownloadFilename('gpkg', `${state.level}s`),
      summary(scopeLabel, detailLabel, fields) {
        return `${scopeLabel} için ${getDetailLabel(detailLabel)} GeoPackage indirilebilir. CRS: ${state.gpkgCrs}. Geometri: ${getGpkgGeometryModeLabel(state.gpkgGeometryMode)}. Alanlar: ${formatSelectedFieldLabels(fields)}. Kodlama: UTF-8.`;
      },
    };
  }

  return {
    available: false,
    label: 'Planlandı',
      title: `${state.format.toUpperCase()} planlandı`,
      filename: '',
      summary(scopeLabel, detailLabel) {
        return `${scopeLabel} için ${getDetailLabel(detailLabel)} ${state.format.toUpperCase()} çıktısı sonraki fazda üretilecek.`;
      },
    };
  }

async function render() {
  const requestId = ++renderRequestId;
  try {
    await ensureActiveMahalleGeometries();
  } catch (error) {
    console.error('Mahalle geometrisi yüklenemedi', error);
    updateDataLoadStatus('error');
  }
  if (requestId !== renderRequestId) {
    return;
  }

  const visibleFeatures = getVisibleFeatures();
  const renderableFeatures = limitPreviewFeatures(getRenderableFeatures());

  setText(els.regionCount, numberFormat.format(datasets.regions.length));
  setText(els.provinceCount, numberFormat.format(datasets.provinces.length));
  setText(els.districtCount, numberFormat.format(datasets.districts.length));
  setText(els.visibleCount, numberFormat.format(visibleFeatures.length));

  renderMap(renderableFeatures);
  syncQualityIndicator(visibleFeatures);
  renderDetail();
}

function limitPreviewFeatures(features) {
  if (features.length <= maxPreviewFeatureCount) {
    return features;
  }

  if (state.level !== 'mahalle' || state.districtId || state.provinceId) {
    return features;
  }

  return features.slice(0, maxPreviewFeatureCount);
}

function isPreviewLimited(renderedCount = getRenderableFeatures().length) {
  return state.level === 'mahalle'
    && !state.districtId
    && !state.provinceId
    && renderedCount > maxPreviewFeatureCount;
}

function getVisibleFeatures() {
  const metadata = getActiveMetadataMap();
  return getRenderableFeatures()
    .filter((feature) => {
      const item = metadata.get(feature.properties.id);
      return item && isSearchMatch(item);
    });
}

function syncQualityIndicator(visibleFeatures) {
  if (!els.qualityButton || !els.qualityPanel) {
    return;
  }

  const summary = getQualitySummary(visibleFeatures);
  const shouldShow = summary.total > 0 && ['mahalle', 'district', 'province', 'region'].includes(state.level);
  els.qualityButton.classList.toggle('is-hidden', !shouldShow);
  if (!shouldShow) {
    setQualityPanelOpen(false);
    return;
  }

  els.qualityButton.textContent = summary.bucketCount
    ? `Bilinen kalite notu · ${summary.bucketCount}`
    : 'Bilinen kalite notu yok';
  els.qualityButton.classList.toggle('has-warnings', summary.bucketCount > 0);
  els.qualityButton.title = summary.bucketCount
    ? `${summary.bucketCount} kayıt için kalite notu mevcut.`
    : 'Görünen kayıtlarda bilinen kalite notu yok; bu durum tüm verinin doğrulandığı anlamına gelmez.';
  renderQualityPanel(summary);
}

function getQualitySummary(visibleFeatures) {
  const visibleIds = new Set(visibleFeatures.map((feature) => feature.properties.id));
  const visibleDistrictIds = new Set();
  const visibleProvinceIds = new Set();

  for (const feature of visibleFeatures) {
    const props = feature.properties;
    if (state.level === 'mahalle') {
      if (props.district_id) visibleDistrictIds.add(props.district_id);
      if (props.province_id) visibleProvinceIds.add(props.province_id);
    } else if (state.level === 'district') {
      visibleDistrictIds.add(props.id);
      if (props.parent_id) visibleProvinceIds.add(props.parent_id);
    } else if (state.level === 'province' || state.level === 'region') {
      visibleProvinceIds.add(props.id);
    }
  }

  const warnings = [];

  for (const note of getActiveQualityNotes()) {
    let relevant = false;
    let affected = [];

    if (note.affectedIds.length > 0) {
      const affectedMeta = note.affectedIds
        .map((id) => datasets.mahalleMetadataById.get(id))
        .filter(Boolean);

      if (state.level === 'mahalle') {
        affected = affectedMeta.filter((item) => visibleIds.has(item.id));
        relevant = affected.length > 0;
      } else if (state.level === 'district') {
        affected = affectedMeta.filter((item) => visibleDistrictIds.has(item.district_id));
        relevant = affected.length > 0;
      } else {
        affected = affectedMeta.filter((item) => visibleProvinceIds.has(item.province_id));
        relevant = affected.length > 0;
      }
    } else {
      const districtMatch = note.districtId && visibleDistrictIds.has(note.districtId);
      const provinceMatch = note.provinceId && visibleProvinceIds.has(note.provinceId);
      relevant = state.level === 'mahalle' || state.level === 'district'
        ? !!districtMatch
        : !!provinceMatch || !!districtMatch;
    }

    if (relevant) {
      warnings.push({ ...note, affected });
    }
  }

  const buckets = buildQualityBuckets(warnings);
  const bucketCount = buckets.reduce((sum, bucket) => sum + bucket.count, 0);

  return {
    total: visibleFeatures.length,
    noteCount: warnings.length,
    bucketCount,
    warnings,
    buckets,
  };
}

function renderQualityPanel(summary) {
  els.qualityPanel.replaceChildren();

  const title = document.createElement('h3');
  title.textContent = buildQualityPanelTitle();
  els.qualityPanel.append(title);

  if (summary.noteCount === 0) {
    const empty = document.createElement('p');
    empty.textContent = `Görünen ${numberFormat.format(summary.total)} kayıt için kayıtlı kalite notu bulunmuyor.`;
    const disclaimer = document.createElement('p');
    disclaimer.textContent = 'Bu, verilerin doğrulandığı anlamına gelmez. Yalnızca şu ana kadar elle işaretlenmiş bir not olmadığını gösterir.';
    els.qualityPanel.append(empty, disclaimer);
    return;
  }

  const disclaimer = document.createElement('p');
  disclaimer.textContent = buildQualityPanelDisclaimer();
  els.qualityPanel.append(disclaimer);

  const list = document.createElement('ul');
  for (const bucket of summary.buckets) {
    const li = document.createElement('li');
    li.textContent = `${bucket.label}: ${bucket.count} uyarı`;
    if (bucket.details.length) {
      li.title = bucket.details.join(' | ');
      const detail = document.createElement('div');
      detail.textContent = bucket.details.join(' | ');
      detail.style.fontSize = '0.92em';
      detail.style.opacity = '0.88';
      detail.style.marginTop = '0.2rem';
      li.append(detail);
    }
    list.append(li);
  }
  els.qualityPanel.append(list);
}

function buildQualityBuckets(warnings) {
  const bucketMap = new Map();

  function pushToBucket(label, detail = '') {
    if (!label) return;
    const key = label.toLocaleLowerCase('tr');
    const current = bucketMap.get(key) || { label, count: 0, details: [] };
    current.count += 1;
    if (detail && !current.details.includes(detail)) current.details.push(detail);
    bucketMap.set(key, current);
  }

  function provinceName(warning) {
    return datasets.provincesById.get(warning.provinceId)?.name
      || warning.provinceName
      || warning.provinceId
      || 'İl geneli';
  }

  function regionName(warning) {
    const province = warning.provinceId
      ? datasets.provincesById.get(warning.provinceId)
      : null;
    return datasets.regionsById.get(province?.region_id)?.name
      || warning.regionName
      || warning.regionId
      || 'Bölge geneli';
  }

  function districtName(warning) {
    return datasets.districtsById.get(warning.districtId)?.name
      || warning.districtName
      || warning.districtId
      || 'İlçe geneli';
  }

  function settlementNames(warning) {
    const names = [];

    for (const item of warning.affected || []) {
      if (item.name) names.push(item.name);
    }

    for (const name of warning.settlementNames || []) {
      if (name) names.push(name);
    }

    return [...new Set(names)];
  }

  function settlementDetail(name, warning) {
    for (const candidate of warning.settlementNames || []) {
      if (candidate === name) continue;
      if (candidate.startsWith(`${name} (`) && candidate.endsWith(')')) {
        return candidate.slice(name.length + 2, -1);
      }
    }
    return '';
  }

  for (const warning of warnings) {
    if (state.level === 'region') {
      pushToBucket(regionName(warning), warning.message || '');
      continue;
    }

    if (state.level === 'province') {
      pushToBucket(provinceName(warning), warning.message || '');
      continue;
    }

    if (state.level === 'district') {
      pushToBucket(`${provinceName(warning)} / ${districtName(warning)}`, warning.message || '');
      continue;
    }

    const affectedItems = [...new Map((warning.affected || []).map((item) => [item.id, item])).values()];
    if (affectedItems.length > 0) {
      for (const item of affectedItems) {
        pushToBucket(
          `${provinceName(warning)} / ${districtName(warning)} / ${item.name}`,
          settlementDetail(item.name, warning) || warning.message || '',
        );
      }
      continue;
    }

    const names = settlementNames(warning);
    if (names.length === 0) {
      pushToBucket(`${provinceName(warning)} / ${districtName(warning)} / Mahalle geneli`, warning.message || '');
      continue;
    }

    for (const name of names) {
      pushToBucket(
        `${provinceName(warning)} / ${districtName(warning)} / ${name}`,
        settlementDetail(name, warning) || warning.message || '',
      );
    }
  }

  return [...bucketMap.values()].sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    return a.label.localeCompare(b.label, 'tr');
  });
}

function buildQualityPanelDisclaimer() {
  if (state.level === 'region') {
    return 'Bu panel yalnızca bölge bazlı bilinen kalite notu sayılarını gösterir.';
  }
  if (state.level === 'province') {
    return 'Bu panel yalnızca il bazlı bilinen kalite notu sayılarını gösterir.';
  }
  if (state.level === 'district') {
    return 'Bu panel yalnızca ilçe bazlı bilinen kalite notu sayılarını gösterir.';
  }
  return 'Bu panel yalnızca mahalle bazlı bilinen kalite notu sayılarını gösterir.';
}

function buildQualityPanelTitle() {
  const provinceName = state.provinceId
    ? datasets.provincesById.get(state.provinceId)?.name || state.provinceId
    : '';
  const districtName = state.districtId
    ? datasets.districtsById.get(state.districtId)?.name || state.districtId
    : '';

  if (provinceName && districtName) {
    return `Veri Kalitesi · ${provinceName} / ${districtName}`;
  }
  if (provinceName) {
    return `Veri Kalitesi · ${provinceName}`;
  }
  if (state.regionId) {
    const regionName = datasets.regionsById.get(state.regionId)?.name || state.regionId;
    return `Veri Kalitesi · ${regionName}`;
  }
  return 'Veri Kalitesi';
}





function setQualityPanelOpen(isOpen) {
  if (!els.qualityButton || !els.qualityPanel) {
    return;
  }
  els.qualityPanel.classList.toggle('is-hidden', !isOpen);
  els.qualityButton.setAttribute('aria-expanded', String(isOpen));
}

function getRenderableFeatures() {
  const metadata = getActiveMetadataMap();
  const features = getActiveFeatureCollection().features;

  return features.filter((feature) => {
    const item = metadata.get(feature.properties.id);
    if (!item) return false;
    if (state.level === 'region' && state.regionId && item.id !== state.regionId) return false;
    if (state.level === 'province' && state.provinceId && item.id !== state.provinceId) return false;
    if (state.level === 'province' && state.regionId && item.region_id !== state.regionId) return false;
    if (state.level === 'district' && state.regionId && item.region_id !== state.regionId) return false;
    if (state.level === 'district' && state.provinceId && item.parent_id !== state.provinceId) return false;
    if (state.level === 'district' && state.districtId && item.id !== state.districtId) return false;
    if (state.level === 'mahalle' && !datasets.publishableProvinceIds.has(item.province_id)) return false;
    if (state.level === 'mahalle' && state.regionId && datasets.provincesById.get(item.province_id)?.region_id !== state.regionId) return false;
    if (state.level === 'mahalle' && state.provinceId && item.province_id !== state.provinceId) return false;
    if (state.level === 'mahalle' && state.districtId && item.district_id !== state.districtId) return false;
    return true;
  });
}

function getVisibleMetadataItems() {
  const metadata = getActiveMetadataMap();
  return getVisibleFeatures()
    .map((feature) => metadata.get(feature.properties.id))
    .filter(Boolean);
}

function getActiveMetadataMap() {
  if (state.level === 'region') {
    return datasets.regionsById;
  }
  if (state.level === 'province') {
    return datasets.provincesById;
  }
  if (state.level === 'mahalle') {
    return datasets.mahalleMetadataById;
  }
  return datasets.districtsById;
}

function getActiveFeatureCollection() {
  if (state.level === 'region') {
    return datasets.regionsGeojson;
  }
  if (state.level === 'province') {
    return datasets.provincesGeojson;
  }
  if (state.level === 'mahalle') {
    return datasets.mahalleGeometrileri;
  }
  return datasets.districtsGeojson;
}

function renderMap(features) {
  if (!els.mapSvg || !els.mapOverlay) {
    return;
  }

  els.mapSvg.replaceChildren();
  applyPreviewTheme();

  if (features.length === 0) {
    renderBaseLayer([], null);
    els.mapOverlay.title = '';
    els.mapOverlay.textContent = 'Filtreyle eşleşen geometri yok.';
    return;
  }

  const allRenderableCount = getRenderableFeatures().length;
  updateMapOverlay(features.length, allRenderableCount);
  const matchedIds = new Set(getVisibleFeatures().map((feature) => feature.properties.id));

  const projection = getActiveProjection(features);
  renderBaseLayer(features, projection);
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('class', 'feature-layer');

  for (const feature of features) {
    const id = feature.properties.id;
    const item = getActiveMetadataMap().get(id);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', getFeatureClass(id, matchedIds));
    path.setAttribute('fill-rule', 'evenodd');
    path.setAttribute('d', projection.path(feature));
    path.dataset.id = id;
    applyPreviewFeatureStyle(path, item);

    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = metadataLabelForFeature(id);
    path.append(title);

    path.addEventListener('mouseenter', () => {
      state.hoveredId = id;
      path.setAttribute('class', getFeatureClass(id, matchedIds));
      updateMapOverlay();
      renderDetail(id);
    });

    path.addEventListener('mouseleave', () => {
      state.hoveredId = '';
      path.setAttribute('class', getFeatureClass(id, matchedIds));
      updateMapOverlay();
      renderDetail();
    });

    path.addEventListener('click', () => {
      if (state.level === 'region') {
        state.level = 'province';
        state.scope = 'region';
        state.regionId = id;
        state.provinceId = '';
        state.selectedId = '';
        state.hoveredId = '';
        if (els.scopeSelect) els.scopeSelect.value = 'region';
        if (els.detailSelect) els.detailSelect.value = 'province';
        if (els.regionSelect) els.regionSelect.value = id;
        if (els.provinceSelect) els.provinceSelect.value = '';
        syncConfigurator();
      } else if (state.level === 'province') {
        state.level = 'district';
        state.scope = 'province';
        state.provinceId = id;
        state.districtId = '';
        state.regionId = datasets.provincesById.get(id)?.region_id || '';
        state.selectedId = '';
        state.hoveredId = '';
        if (els.scopeSelect) els.scopeSelect.value = 'province';
        if (els.detailSelect) els.detailSelect.value = 'district';
        if (els.regionSelect) els.regionSelect.value = state.regionId;
        if (els.provinceSelect) els.provinceSelect.value = id;
        if (els.districtSelect) els.districtSelect.value = '';
        syncConfigurator();
      } else {
        state.selectedId = id;
      }

      updateMapOverlay();
      render();
    });

    group.append(path);
  }

  els.mapSvg.append(group);
}

function renderBaseLayer(features, projection) {
  if (!els.mapSvg || !els.baseMapAttribution) {
    return;
  }

  const enabled = state.baseLayer.startsWith('osm') && features.length > 0 && projection.projection;
  els.baseMapAttribution.classList.toggle('is-hidden', !enabled);
  if (!enabled) {
    return;
  }

  const tiles = buildOsmTiles(features, projection.projection);
  if (tiles.length === 0) {
    els.baseMapAttribution.classList.add('is-hidden');
    return;
  }

  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('class', `basemap-tile-layer is-${state.baseLayer}`);
  for (const tile of tiles) {
    const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    image.setAttribute('class', 'basemap-tile');
    image.setAttribute('href', `https://tile.openstreetmap.org/${tile.z}/${tile.x}/${tile.y}.png`);
    image.setAttribute('x', String(tile.xPos));
    image.setAttribute('y', String(tile.yPos));
    image.setAttribute('width', String(tile.width));
    image.setAttribute('height', String(tile.height));
    image.setAttribute('preserveAspectRatio', 'none');
    group.append(image);
  }

  els.mapSvg.append(group);
}


function buildOsmTiles(features, projection) {
  const collection = { type: 'FeatureCollection', features };
  const bounds = window.d3.geoBounds(collection);
  if (!Number.isFinite(bounds[0][0]) || !Number.isFinite(bounds[1][0])) {
    return [];
  }

  const zoom = chooseOsmZoom(projection, bounds);
  const [[minLon, minLat], [maxLon, maxLat]] = bounds;
  const northWest = lonLatToTile(minLon, maxLat, zoom);
  const southEast = lonLatToTile(maxLon, minLat, zoom);
  const maxTile = (2 ** zoom) - 1;
  const xStart = clampNumber(Math.min(northWest.x, southEast.x) - 1, 0, maxTile);
  const xEnd = clampNumber(Math.max(northWest.x, southEast.x) + 1, 0, maxTile);
  const yStart = clampNumber(Math.min(northWest.y, southEast.y) - 1, 0, maxTile);
  const yEnd = clampNumber(Math.max(northWest.y, southEast.y) + 1, 0, maxTile);
  const tiles = [];

  for (let x = xStart; x <= xEnd; x += 1) {
    for (let y = yStart; y <= yEnd; y += 1) {
      const [west, north] = tileToLonLat(x, y, zoom);
      const [east, south] = tileToLonLat(x + 1, y + 1, zoom);
      const topLeft = projection([west, north]);
      const bottomRight = projection([east, south]);
      if (!topLeft || !bottomRight) {
        continue;
      }

      tiles.push({
        z: zoom,
        x,
        y,
        xPos: Number(topLeft[0].toFixed(2)),
        yPos: Number(topLeft[1].toFixed(2)),
        width: Number((bottomRight[0] - topLeft[0]).toFixed(2)),
        height: Number((bottomRight[1] - topLeft[1]).toFixed(2)),
      });
    }
  }

  return tiles;
}

function chooseOsmZoom(projection, bounds) {
  const scale = projection.scale?.() || 1;
  let zoom = Math.round(Math.log2((scale * 2 * Math.PI) / 256));
  zoom = clampNumber(zoom, 4, 12);

  while (zoom > 4 && estimateTileCount(bounds, zoom) > 72) {
    zoom -= 1;
  }

  return zoom;
}

function estimateTileCount(bounds, zoom) {
  const [[minLon, minLat], [maxLon, maxLat]] = bounds;
  const northWest = lonLatToTile(minLon, maxLat, zoom);
  const southEast = lonLatToTile(maxLon, minLat, zoom);
  return (Math.abs(southEast.x - northWest.x) + 3) * (Math.abs(southEast.y - northWest.y) + 3);
}

function lonLatToTile(lon, lat, zoom) {
  const n = 2 ** zoom;
  const safeLat = clampNumber(lat, -85.05112878, 85.05112878);
  const latRad = (safeLat * Math.PI) / 180;
  return {
    x: clampNumber(Math.floor(((lon + 180) / 360) * n), 0, n - 1),
    y: clampNumber(Math.floor(((1 - Math.log(Math.tan(latRad) + (1 / Math.cos(latRad))) / Math.PI) / 2) * n), 0, n - 1),
  };
}

function tileToLonLat(x, y, zoom) {
  const n = 2 ** zoom;
  const lon = (x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  return [lon, (latRad * 180) / Math.PI];
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getActiveProjection(features, viewport = defaultExportViewport) {
  if (features.length === 0) {
    return projections[state.level];
  }

  if (state.level === 'district' && state.provinceId) {
    return buildProjection({ type: 'FeatureCollection', features }, viewport);
  }

  if (state.level === 'mahalle') {
    return buildProjection({ type: 'FeatureCollection', features }, viewport);
  }

  if (state.level === 'province' && state.regionId) {
    return buildProjection({ type: 'FeatureCollection', features }, viewport);
  }

  if (state.level === 'district' && state.regionId) {
    return buildProjection({ type: 'FeatureCollection', features }, viewport);
  }

  if (viewport.width !== defaultExportViewport.width || viewport.height !== defaultExportViewport.height) {
    return buildProjection({ type: 'FeatureCollection', features }, viewport);
  }

  if (state.level !== 'district') {
    return projections[state.level];
  }

  return projections[state.level];
}

function getFeatureClass(id, matchedIds = null) {
  const classNames = ['feature'];
  if (state.search) {
    classNames.push('is-muted');
    if (matchedIds.has(id)) {
      classNames.push('is-search-match');
    }
  }
  if (state.selectedId === id) classNames.push('is-selected');
  if (state.hoveredId === id) classNames.push('is-hovered');
  return classNames.join(' ');
}

function isSearchMatch(item) {
  if (!state.search) {
    return true;
  }

  return normalizeSearchText(item.name).includes(state.search);
}

function normalizeSearchText(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR');
}

function updateMapOverlay(previewCount = null, totalRenderableCount = null) {
  if (!els.mapOverlay) {
    return;
  }

  const activeId = state.hoveredId || state.selectedId;
  if (activeId) {
    els.mapOverlay.textContent = metadataLabelForFeature(activeId);
    return;
  }

  if (state.level === 'region') {
    els.mapOverlay.textContent = 'Bölge görünümü';
    return;
  }

  if (totalRenderableCount !== null && previewCount !== null && isPreviewLimited(totalRenderableCount)) {
    els.mapOverlay.textContent = `Mahalle önizlemesi: ${numberFormat.format(previewCount)} / ${numberFormat.format(totalRenderableCount)} gösteriliyor`;
    els.mapOverlay.title = 'Siteyi dondurmamak için ekrandaki önizleme sınırlandı. İndirme tam görünür veri kapsamıyla yapılır.';
    return;
  }

  els.mapOverlay.title = '';
  els.mapOverlay.textContent = state.level === 'province'
    ? (state.regionId ? 'İl görünümü: bölge filtreli' : 'İl görünümü')
    : state.level === 'mahalle'
      ? (state.districtId ? 'Mahalle görünümü: ilçe filtreli' : state.provinceId ? 'Mahalle görünümü: il filtreli' : 'Mahalle görünümü: geometri olan iller')
      : state.provinceId ? 'İlçe görünümü: filtreli' : 'İlçe görünümü: tüm Türkiye';
}

function applyPreviewTheme() {
  if (!els.mapSvg) {
    return;
  }

  const theme = getCurrentVisualTheme();
  els.mapSvg.style.background = theme.background;
}

function applyPreviewFeatureStyle(path, item) {
  const theme = getCurrentVisualTheme();
  const fill = resolveFeatureFill(item, theme);
  const regionStroke = state.level === 'region' ? 'transparent' : (theme.stroke || '');
  const regionStrokeWidth = state.level === 'region' ? '0' : (theme.strokeWidth || '');
  path.style.setProperty('--feature-fill', fill || '');
  path.style.setProperty('--feature-stroke', regionStroke);
  path.style.setProperty('--feature-stroke-width', regionStrokeWidth);
}

function getCurrentVisualTheme() {
  if (state.format === 'svg' || state.format === 'png') {
    const theme = getSvgTheme();
    return state.level === 'region'
      ? { ...theme, stroke: 'transparent', strokeWidth: '0' }
      : theme;
  }

  if (state.level === 'region') {
    return {
      background: 'transparent',
      fill: '',
      stroke: 'transparent',
      strokeWidth: '0',
    };
  }

  return {
    background: 'transparent',
    fill: '',
    stroke: '',
  };
}

function metadataLabelForFeature(id) {
  const item = getActiveMetadataMap().get(id);
  return item ? item.name : '';
}

function renderDetail(forcedId = '') {
  if (!els.detailPanel) {
    return;
  }

  const activeId = forcedId || state.hoveredId || state.selectedId;

  if (!activeId) {
    renderDetailEmpty('Haritada bir öğe seç.');
    return;
  }

  const item = getActiveMetadataMap().get(activeId);

  if (!item) {
    renderDetailEmpty('Kayıt bulunamadı.');
    return;
  }

  const parentName = state.level === 'mahalle'
    ? datasets.districtsById.get(item.parent_id)?.name || '-'
    : state.level === 'district'
      ? datasets.provincesById.get(item.parent_id)?.name || '-'
      : state.level === 'province'
        ? datasets.regionsById.get(item.region_id)?.name || '-'
        : '-';

  const rows = state.level === 'region'
    ? [
      ['Ad', item.name],
      ['ID', item.id],
      ['Seviye', getLevelLabel(item.level)],
      ['Bölge Türü', item.region_kind || '-'],
      ['İl Sayısı', item.member_ids?.length || 0],
    ]
    : state.level === 'province'
      ? [
        ['Ad', item.name],
        ['ID', item.id],
        ['Seviye', getLevelLabel(item.level)],
        ['Bölge', item.region_name || '-'],
        ['İl Kodu', item.plate_code || '-'],
      ]
      : state.level === 'district'
      ? [
        ['Ad', item.name],
        ['ID', item.id],
        ['Seviye', getLevelLabel(item.level)],
        ['Bölge', item.region_name || '-'],
        ['İl', parentName],
        ['İlçe Kodu', item.district_local_code || '-'],
      ]
      : [
        ['Ad', item.name],
        ['ID', item.id],
        ['Seviye', getLevelLabel(item.level)],
        ['İl', item.province_name || '-'],
        ['İlçe', parentName],
      ];

  const sourceLabel = state.level === 'mahalle'
    ? (item.source_label || datasets.sourceLabels?.public_sources || item.source || '')
    : (item.source_label || item.source || '');
  if (sourceLabel) {
    rows.push(['Kaynak', sourceLabel]);
  }

  const visibleRows = state.level === 'region'
    ? rows.filter(([label]) => label !== 'Bölge Türü')
    : rows;

  const list = document.createElement('dl');
  list.className = 'detail-grid';
  for (const [label, value] of visibleRows) {
    const term = document.createElement('dt');
    term.textContent = label;
    const description = document.createElement('dd');
    description.textContent = String(value);
    list.append(term, description);
  }
  els.detailPanel.replaceChildren(list);
}

function renderDetailEmpty(message) {
  const empty = document.createElement('p');
  empty.className = 'detail-empty';
  empty.textContent = message;
  els.detailPanel.replaceChildren(empty);
}

function buildProjection(featureCollection, viewport = defaultExportViewport) {
  const { width, height, padding } = viewport;
  const projection = window.d3.geoMercator().fitExtent(
    [
      [padding, padding],
      [width - padding, height - padding],
    ],
    featureCollection,
  );
  const pathDigits = state.level === 'mahalle'
    ? 2
    : state.level === 'district'
      ? 2
      : 1;
  const path = window.d3.geoPath(projection).digits(pathDigits);

  return {
    projection,
    path(feature) {
      return path(feature) || '';
    },
  };
}

function getDownloadFilename(format, baseName) {
  const suffix = ['kml', 'kmz'].includes(format)
    ? `-${new Date().toISOString().replaceAll(/[-:]/g, '').replace(/\.\d{3}Z$/, '')}`
    : '';

  if (state.scope === 'region' && state.regionId) {
    const slug = datasets.regionsById.get(state.regionId)?.slug || 'region';
    return `${slug}-${baseName}${suffix}.${format}`;
  }

  if (state.scope === 'province' && state.provinceId) {
    const slug = datasets.provincesById.get(state.provinceId)?.slug || 'province';
    if (state.districtId) {
      const districtSlug = datasets.districtsById.get(state.districtId)?.slug || 'district';
      return `${districtSlug}-${baseName}${suffix}.${format}`;
    }
    return `${slug}-${baseName}${suffix}.${format}`;
  }

  return `turkiye-${baseName}${suffix}.${format}`;
}

function getDetailLabel(detail) {
  if (detail === 'region') return 'bölge';
  if (detail === 'mahalle') return 'mahalle';
  return detail === 'district' ? 'ilçe' : 'il';
}

function getStyleLabel(style) {
  const labels = {
    filled: 'Dolgulu',
    'outline-only': 'Sadece sınır',
    dark: 'Koyu',
    light: 'Açık',
  };

  if (style === 'transparent') {
    return 'Transparan';
  }

  return labels[style] || style;
}

function getLevelLabel(level) {
  const labels = {
    region: 'Bölge',
    province: 'İl',
    district: 'İlçe',
    mahalle: 'Mahalle',
    yerlesim: 'Mahalle',
  };

  return labels[level] || level;
}

function getColorModeLabel(colorMode) {
  const labels = {
    single: 'Tek renk',
    auto: 'Otomatik renk',
    palette: 'Palet',
  };

  return labels[colorMode] || colorMode;
}

function getPaletteLabel(palette) {
  const labels = {
    blue: 'Mavi',
    violet: 'Mor',
    turquoise: 'Turkuaz',
    pastel: 'Pastel',
    contrast: 'Kontrast',
  };

  return labels[palette] || palette;
}

function getGpkgGeometryModeLabel(mode) {
  const labels = {
    auto: 'Otomatik',
    polygon: 'Polygon',
    multiPolygon: 'MultiPolygon',
  };

  return labels[mode] || mode;
}

async function triggerDownload(filename) {
  const blob = await buildDownloadBlob();
  if (!blob || blob.size === 0) {
    throw new Error('Boş indirme çıktısı üretildi.');
  }

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();

  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }, 4000);
}

async function buildDownloadBlob() {
  if (state.format === 'json') {
    return new Blob([JSON.stringify(buildJsonPayload(), null, 2)], {
      type: 'application/json;charset=utf-8',
    });
  }

  if (state.format === 'geojson') {
    return new Blob([JSON.stringify(buildGeojsonPayload())], {
      type: 'application/geo+json;charset=utf-8',
    });
  }

  if (state.format === 'svg') {
    return new Blob([buildSvgMarkup()], {
      type: 'image/svg+xml;charset=utf-8',
    });
  }

  if (state.format === 'react-component') {
    return new Blob([buildReactComponentSource()], {
      type: 'text/jsx;charset=utf-8',
    });
  }

  if (state.format === 'png') {
    return buildPngBlob();
  }

  if (state.format === 'pdf') {
    return buildPdfBlob();
  }

  if (state.format === 'topojson') {
    return new Blob([JSON.stringify(buildTopojsonPayload())], {
      type: 'application/json;charset=utf-8',
    });
  }

  if (state.format === 'csv') {
    return new Blob(['\ufeff', rowsToCsv(buildSelectedTabularRows(), state.csvDelimiter)], {
      type: 'text/csv;charset=utf-8',
    });
  }

  if (state.format === 'xlsx') {
    return buildXlsxBlob();
  }

  if (state.format === 'sql') {
    return new Blob([rowsToSql(`${state.level}s`, buildSelectedTabularRows())], {
      type: 'application/sql;charset=utf-8',
    });
  }

  if (state.format === 'wkt') {
    return new Blob([rowsToWkt(buildTabularRows())], {
      type: 'text/plain;charset=utf-8',
    });
  }

  if (state.format === 'kml') {
    return new Blob([buildKmlDocument()], {
      type: 'application/vnd.google-earth.kml+xml;charset=utf-8',
    });
  }

  if (state.format === 'gml') {
    return new Blob([buildGmlDocument()], {
      type: 'application/gml+xml;charset=utf-8',
    });
  }

  if (state.format === 'kmz') {
    return buildKmzBlobFromKml(buildKmlDocument());
  }

  if (state.format === 'osm') {
    return new Blob([buildOsmDocument()], {
      type: 'application/vnd.openstreetmap.data+xml;charset=utf-8',
    });
  }

  if (state.format === 'shp') {
    return buildShapefileZipBlob(getVisibleFeatures(), getVisibleMetadataItems(), `${state.level}s`);
  }

  if (state.format === 'dxf') {
    return new Blob([encodeWindows1254Text(buildDxfDocument())], {
      type: 'application/dxf',
    });
  }

  if (state.format === 'gpkg') {
    return buildGeoPackageBlob(
      getVisibleFeatures(),
      getVisibleMetadataItems(),
      `${state.level}s`,
      {
        selectedFields: state.selectedFields,
        crs: state.gpkgCrs,
        geometryMode: state.gpkgGeometryMode,
      },
    );
  }

  throw new Error(`Unsupported download format: ${state.format}`);
}


function buildJsonPayload() {
  return buildFilteredJsonPayload(
    getVisibleMetadataItems(),
    state.selectedFields,
    (item) => item.level === 'yerlesim'
      ? (item.parent_id ? datasets.districtsById.get(item.parent_id)?.name || null : null)
      : item.level === 'district'
      ? (item.parent_id ? datasets.provincesById.get(item.parent_id)?.name || null : null)
      : item.level === 'province'
        ? (item.region_id ? datasets.regionsById.get(item.region_id)?.name || null : null)
        : null,
  );
}

function buildGeojsonPayload() {
  return buildFilteredGeojsonPayload(
    getVisibleFeatures(),
    (id) => buildCommonProperties(getActiveMetadataMap().get(id)),
  );
}

function buildTopojsonPayload() {
  return buildFilteredTopojsonPayload(
    buildGeojsonPayload(),
    window.topojson.topology,
    `${state.level}s`,
  );
}

function buildTabularRows() {
  const geometryById = new Map(getVisibleFeatures().map((feature) => [feature.properties.id, feature.geometry]));
  const propertiesById = new Map(getVisibleMetadataItems().map((item) => [item.id, buildExportProperties(item)]));
  return buildFilteredTabularRows(getVisibleMetadataItems(), geometryById).map((row) => ({
    ...row,
    parent_name: propertiesById.get(row.id)?.parent_name ?? '',
  }));
}

function buildSelectedTabularRows() {
  const selectedFields = state.selectedFields.length > 0 ? state.selectedFields : ['id', 'name'];
  return buildTabularRows().map((row) => pickFields(row, selectedFields));
}

function buildKmlDocument() {
  const metadata = getVisibleMetadataItems();
  // KML joins geometry to metadata by feature.properties.id; selected fields must not strip it.
  const geometryCollection = {
    type: 'FeatureCollection',
    features: getVisibleFeatures(),
  };
  const name = state.scope === 'region' && currentRegionName()
    ? `${currentRegionName()} ${state.level}`
    : state.scope === 'province' && currentProvinceName()
      ? `${currentProvinceName()} ${state.level}`
      : `turkiye_map.${state.level}s`;

  const usePerFeatureColor = (state.style === 'filled' || state.style === 'transparent')
    && (state.colorMode === 'palette' || state.colorMode === 'auto');
  const colorResolver = usePerFeatureColor
    ? (item) => resolveFeatureFill(item, getSvgTheme())
    : null;

  return featureCollectionToKml(name, metadata, geometryCollection,
    (item) => pickFields(buildExportProperties(item), state.selectedFields),
    colorResolver);
}

function buildDxfDocument() {
  const metadata = getVisibleMetadataItems();
  const geometryCollection = {
    type: 'FeatureCollection',
    features: getVisibleFeatures(),
  };
  const name = state.scope === 'region' && currentRegionName()
    ? `${currentRegionName()} ${state.level}`
    : state.scope === 'province' && currentProvinceName()
      ? `${currentProvinceName()} ${state.level}`
      : `turkiye_map.${state.level}s`;

  return featureCollectionToDxf(name, metadata, geometryCollection);
}

function buildGmlDocument() {
  const metadata = getVisibleMetadataItems();
  const geometryCollection = {
    type: 'FeatureCollection',
    features: getVisibleFeatures(),
  };
  const name = state.scope === 'region' && currentRegionName()
    ? `${currentRegionName()} ${state.level}`
    : state.scope === 'province' && currentProvinceName()
      ? `${currentProvinceName()} ${state.level}`
      : `turkiye_map.${state.level}s`;

  return featureCollectionToGml(
    name,
    metadata,
    geometryCollection,
    (item) => pickFields(buildExportProperties(item), state.selectedFields),
    { featureTypeName: state.level },
  );
}

function buildOsmDocument() {
  const metadata = getVisibleMetadataItems();
  const geometryCollection = {
    type: 'FeatureCollection',
    features: getVisibleFeatures(),
  };
  const name = state.scope === 'region' && currentRegionName()
    ? `${currentRegionName()} ${state.level} osm`
    : state.scope === 'province' && currentProvinceName()
      ? `${currentProvinceName()} ${state.level} osm`
      : `turkiye_map.${state.level}s.osm`;

  return featureCollectionToOsm(
    name,
    metadata,
    geometryCollection,
    (item) => pickFields(buildExportProperties(item), state.selectedFields),
  );
}

function buildXlsxBlob() {
  const arrayBuffer = buildXlsxArrayBuffer(
    buildSelectedTabularRows(),
    `${state.level}s`,
    window.XLSX,
  );
  return new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function buildSvgMarkup(viewport = defaultExportViewport) {
  const features = getVisibleFeatures();
  const projection = getActiveProjection(features, viewport);
  const theme = getSvgTheme();
  const metadataMap = getActiveMetadataMap();
  const { width, height } = viewport;
  const title = getPdfExportTitle(features);

  const paths = features.map((feature) => {
    const item = metadataMap.get(feature.properties.id) || feature.properties || {};

    const pathData = buildSimplifiedSvgPath(feature, projection);
    const dataAttributes = buildSvgDataAttributes(item);
    const fill = resolveFeatureFill(item, theme);
    const strokeStyle = state.level === 'region'
      ? 'stroke:none'
      : `stroke:${escapeAttribute(theme.stroke)};stroke-width:${state.style === 'outline-only' ? '1.2' : '1'}`;
    const styleAttribute = ` style="fill:${escapeAttribute(fill || theme.fill)};${strokeStyle}"`;
    const titleText = metadataLabelForFeature(item.id || feature.properties.id) || '';
    return `<path d="${escapeAttribute(pathData)}"${styleAttribute} ${dataAttributes}><title>${escapeXml(titleText)}</title></path>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escapeAttribute(title)}">
  <desc>${escapeXml(title)}</desc>
  <style>
    svg { background: ${theme.background}; }
    path {
      fill: ${theme.fill};
      stroke: ${theme.stroke};
      stroke-width: ${state.level === 'region' ? '0' : '1'};
      pointer-events: all;
      vector-effect: non-scaling-stroke;
      transition: fill 140ms ease, stroke 140ms ease, opacity 140ms ease;
    }
    path:hover {
      opacity: 0.92;
      stroke: #0b1f4f;
      stroke-width: 2;
    }
  </style>
  <g>${paths}</g>
</svg>`;
}

function buildReactComponentSource(viewport = defaultExportViewport) {
  const features = getVisibleFeatures();
  const projection = getActiveProjection(features, viewport);
  const theme = getSvgTheme();
  const metadataMap = getActiveMetadataMap();
  const { width, height } = viewport;
  const title = state.level === 'region'
    ? 'Türkiye Bölgeleri'
    : state.scope === 'province' && currentProvinceName()
      ? `${currentProvinceName()} ilçeleri`
      : state.scope === 'region' && currentRegionName()
        ? `${currentRegionName()} illeri`
        : 'Türkiye Haritası';

  const componentName = toPascalCase(getDownloadFilename('jsx', `${state.level}s-react`).replace(/\.jsx$/i, ''));
  const paths = features.map((feature) => {
    const item = metadataMap.get(feature.properties.id) || feature.properties || {};
    const pathData = buildSimplifiedSvgPath(feature, projection);
    const fill = resolveFeatureFill(item, theme);
    const props = buildCommonProperties(item);
    const dataAttrs = Object.entries(props)
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => `        data-${key.replaceAll('_', '-')}=${JSON.stringify(String(value))}`)
      .join('\n');
    const titleText = escapeJsString(metadataLabelForFeature(item.id || feature.properties.id));
    return [
      '      <path',
      `        d=${JSON.stringify(pathData)}`,
      `        fill=${JSON.stringify(fill || theme.fill)}`,
      `        stroke=${JSON.stringify(theme.stroke)}`,
      `        strokeWidth=${JSON.stringify(state.style === 'outline-only' ? 1.2 : 1)}`,
      '        vectorEffect="non-scaling-stroke"',
      dataAttrs,
      '      >',
      `        <title>${titleText}</title>`,
      '      </path>',
    ].filter(Boolean).join('\n');
  }).join('\n');

  return [
    "import * as React from 'react';",
    '',
    `export default function ${componentName}({`,
    `  title = ${JSON.stringify(title)},`,
    "  width = '100%',",
    "  height = 'auto',",
    "  className = '',",
    '  ...props',
    '}) {',
    '  return (',
    `    <svg`,
    '      xmlns="http://www.w3.org/2000/svg"',
    `      viewBox=${JSON.stringify(`0 0 ${width} ${height}`)}`,
    '      preserveAspectRatio="xMidYMid meet"',
    '      role="img"',
    '      aria-label={title}',
    '      width={width}',
    '      height={height}',
    '      className={className || undefined}',
    '      {...props}',
    '    >',
    `      <title>{title}</title>`,
    `      <desc>${escapeJsString(title)}</desc>`,
    `      <rect width=${JSON.stringify(String(width))} height=${JSON.stringify(String(height))} fill=${JSON.stringify(theme.background)} />`,
    '      <g>',
    paths,
    '      </g>',
    '    </svg>',
    '  );',
    '}',
    '',
  ].join('\n');
}

async function buildPngBlob() {
  const { width, height } = getRasterDimensions(state.resolution);
  const svgMarkup = buildSvgMarkup({ width, height, padding: 48 });
  const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  const objectUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await loadImageFromUrl(objectUrl);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, width, height);

    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('PNG oluşturulamadı.'));
        }
      }, 'image/png');
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function buildPdfBlob() {
  const { width, height } = getRasterDimensions(state.resolution);
  const viewport = { width, height, padding: 48 };
  const features = getVisibleFeatures();
  const projection = getActiveProjection(features, viewport);
  const theme = getSvgTheme();
  const title = getPdfExportTitle(features);
  const subtitle = `${currentScopeLabel()} | ${getDetailLabel(state.level)} | ${state.resolution}`;
  const paths = features.map((feature) => {
    const item = getActiveMetadataMap().get(feature.properties.id);
    return {
      d: buildSimplifiedSvgPath(feature, projection),
      fill: resolveFeatureFill(item, theme),
      stroke: theme.stroke,
      lineWidth: state.style === 'outline-only' ? 1.2 : 0.9,
    };
  }).filter((path) => path.d);

  return buildPdfDocumentBlob({
    width,
    height,
    title,
    subtitle,
    backgroundColor: theme.background,
    paths,
  });
}

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('SVG görüntüsü yüklenemedi.'));
    image.src = url;
  });
}

function getRasterDimensions(resolution) {
  const presets = {
    '1920x1080': { width: 1920, height: 1080 },
    '2048x2048': { width: 2048, height: 2048 },
    '300dpi': { width: 2400, height: 1520 },
  };

  return presets[resolution] || presets['1920x1080'];
}

function buildSvgDataAttributes(item) {
  const properties = buildCommonProperties(item);

  return Object.entries(properties)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => `data-${key.replaceAll('_', '-')}="${escapeAttribute(String(value))}"`)
    .join(' ');
}

function buildCommonProperties(item) {
  return pickFields(buildExportProperties(item), state.selectedFields);
}

function formatNetcadText(value) {
  return value ? String(value).toLocaleUpperCase('tr-TR') : '';
}

function buildNetcadProperties(item, parentName) {
  const province = item.level === 'province'
    ? item
    : item.province_id
      ? datasets.provincesById.get(item.province_id)
      : item.parent_id
        ? datasets.provincesById.get(item.parent_id)
        : null;
  const regionName = item.level === 'region'
    ? item.name
    : item.region_name || (province?.region_id ? datasets.regionsById.get(province.region_id)?.name : '');
  const provinceName = item.level === 'province'
    ? item.name
    : item.level === 'district'
      ? parentName
      : item.province_name || province?.name || '';
  const districtName = item.level === 'district'
    ? item.name
    : item.level === 'yerlesim' || item.level === 'mahalle'
      ? parentName
      : '';

  return {
    TABAKA: getNetcadLayerName(item),
    BOLGE_ADI: formatNetcadText(regionName),
    IL_ADI: formatNetcadText(provinceName),
    IL_KODU: item.plate_code || province?.plate_code || '',
    ILCE_ADI: formatNetcadText(districtName),
    MAHALLE_ADI: item.level === 'yerlesim' || item.level === 'mahalle' ? formatNetcadText(item.name) : '',
  };
}

function buildExportProperties(item) {
  const parentName = item.level === 'yerlesim'
    ? (item.parent_id ? datasets.districtsById.get(item.parent_id)?.name || null : null)
    : item.level === 'district'
      ? (item.parent_id ? datasets.provincesById.get(item.parent_id)?.name || null : null)
      : item.level === 'province'
        ? (item.region_id ? datasets.regionsById.get(item.region_id)?.name || null : null)
        : null;

  return {
    id: item.id,
    parent_id: item.parent_id,
    region_id: item.region_id,
    level: item.level,
    name: item.name,
    region_name: item.region_name,
    parent_name: parentName,
    province_id: item.province_id,
    province_name: item.province_name,
    source_label: item.source_label || datasets.sourceLabels?.public_sources || item.source || '',
    slug: item.slug,
    plate_code: item.plate_code,
    district_local_code: item.district_local_code,
    nuts_code: item.nuts_code,
    tuik_id: item.tuik_id,
    icisleri_id: item.icisleri_id,
    ...buildNetcadProperties(item, parentName),
  };
}

function getSvgTheme() {
  const themes = {
    filled: { background: 'transparent', fill: '#d7dfff', stroke: '#42538f' },
    transparent: { background: 'transparent', fill: 'rgba(215, 223, 255, 0.72)', stroke: '#5872c4' },
    'outline-only': { background: 'transparent', fill: 'none', stroke: '#31406c' },
    dark: { background: '#0a1023', fill: '#2a3767', stroke: '#b8cbff' },
    light: { background: 'transparent', fill: '#dbe3ff', stroke: '#49609d' },
  };

  return themes[state.style] || themes.filled;
}

function resolveFeatureFill(item, theme) {
  if (state.style !== 'filled' && state.style !== 'transparent') {
    return theme.fill;
  }

  if (state.level === 'region' && state.colorMode === 'single') {
    return stableColorForId(item.id, getPaletteColors('contrast'));
  }

  if (state.colorMode === 'palette') {
    return stableColorForId(item.id, getPaletteColors(state.palette));
  }

  if (state.colorMode === 'auto') {
    return stableColorForId(item.id);
  }

  return theme.fill;
}

function stableColorForId(id, palette = getPaletteColors('pastel')) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = ((hash * 31) + id.charCodeAt(index)) >>> 0;
  }

  return palette[hash % palette.length];
}

function getPaletteColors(palette) {
  const palettes = {
    blue: ['#DCE8FF', '#CFE1FF', '#C6DBFF', '#BFD5FF', '#E3EEFF', '#D1E6FF'],
    violet: ['#EADFFF', '#DECFFF', '#D5C5FF', '#CDB7FF', '#F0E8FF', '#E4D8FF'],
    turquoise: ['#D9F7F5', '#C9F0EE', '#B7E7E5', '#A7DEDE', '#DCF8F8', '#C7F2F1'],
    pastel: ['#DCE8FF', '#E5D7FF', '#D8F3FF', '#CDEEDC', '#F6E1C8', '#F2D8E8'],
    contrast: ['#BFD5FF', '#CDB7FF', '#9FDCCA', '#FFD7A8', '#FFC3D8', '#AEE8FF'],
  };

  return palettes[palette] || palettes.pastel;
}

function buildSimplifiedSvgPath(feature, projectionWrapper) {
  const tolerance = getSvgTolerance();
  const projected = projectGeometry(feature.geometry, projectionWrapper.projection);
  return geometryToPathData(projected, tolerance);
}

function getSvgTolerance() {
  if (state.level === 'mahalle') {
    return state.districtId ? 0.1 : state.provinceId ? 0.18 : 0.28;
  }
  if (state.level === 'district') {
    return state.provinceId ? 0.8 : 1.2;
  }
  return 0.55;
}

function projectGeometry(geometry, projection) {
  if (!geometry) {
    return null;
  }

  if (geometry.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: geometry.coordinates.map((ring) => ring.map((coordinate) => projection(coordinate))),
    };
  }

  if (geometry.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: geometry.coordinates.map((polygon) =>
        polygon.map((ring) => ring.map((coordinate) => projection(coordinate)))),
    };
  }

  return null;
}

function geometryToPathData(geometry, tolerance) {
  if (!geometry) {
    return '';
  }

  if (geometry.type === 'Polygon') {
    return geometry.coordinates.map((ring) => ringToPathData(ring, tolerance)).join('');
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates
      .flatMap((polygon) => polygon.map((ring) => ringToPathData(ring, tolerance)))
      .join('');
  }

  return '';
}

function ringToPathData(ring, tolerance) {
  const cleaned = ring.filter((point) => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]));
  if (cleaned.length < 4) {
    return '';
  }

  const openRing = cleaned.slice(0, -1);
  const simplified = simplifyPoints(openRing, tolerance);
  const closed = [...simplified, simplified[0]];

  if (closed.length < 4) {
    return '';
  }

  const commands = closed.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${roundSvgNumber(x)},${roundSvgNumber(y)}`);
  return `${commands.join('')}Z`;
}

function simplifyPoints(points, tolerance) {
  if (points.length <= 6) {
    return points;
  }

  const simplified = douglasPeucker(points, tolerance);
  return simplified.length >= 3 ? simplified : points;
}


function roundSvgNumber(value) {
  if (state.level === 'mahalle' || state.level === 'district') {
    return Number(value.toFixed(2));
  }
  return Number(value.toFixed(1));
}

function formatSelectedFieldLabels(fields) {
  const optionMap = new Map(getAvailableFieldDefinitions().map((option) => [option.key, option.label]));
  return fields.map((field) => optionMap.get(field) || field).join(', ');
}

function currentProvinceName() {
  if (!state.provinceId) {
    return '';
  }

  return datasets.provincesById.get(state.provinceId)?.name || '';
}

function currentDistrictName() {
  if (!state.districtId) {
    return '';
  }

  return datasets.districtsById.get(state.districtId)?.name || '';
}

function firstMahalleProvinceId() {
  return [...datasets.publishableProvinceIds][0] || '';
}

function currentRegionName() {
  if (!state.regionId) {
    return '';
  }

  return datasets.regionsById.get(state.regionId)?.name || '';
}

function currentScopeLabel() {
  if (state.scope === 'region') {
    return currentRegionName() || 'seçili bölge';
  }
  if (state.scope === 'province') {
    return currentProvinceName() || 'seçili il';
  }
  return 'Türkiye';
}

function buildFullFeatureLabel(item) {
  if (!item) {
    return '';
  }

  if (item.level === 'region') {
    return item.name || '';
  }

  if (item.level === 'province') {
    return item.name || '';
  }

  if (item.level === 'district') {
    const provinceName = datasets.provincesById.get(item.parent_id)?.name || item.province_name || '';
    return [provinceName, item.name].filter(Boolean).join(' / ');
  }

  if (item.level === 'yerlesim' || item.level === 'mahalle') {
    const districtName = datasets.districtsById.get(item.parent_id)?.name || item.district_name || '';
    const provinceId = item.province_id || datasets.districtsById.get(item.parent_id)?.parent_id || '';
    const provinceName = datasets.provincesById.get(provinceId)?.name || item.province_name || '';
    return [provinceName, districtName, item.name].filter(Boolean).join(' / ');
  }

  return item.name || '';
}

function getPdfExportTitle(features = getVisibleFeatures()) {
  const metadataMap = getActiveMetadataMap();
  const selectedItem = state.selectedId ? metadataMap.get(state.selectedId) : null;
  if (selectedItem) {
    return buildFullFeatureLabel(selectedItem) || 'Türkiye Haritası';
  }

  if (features.length === 1) {
    const onlyItem = metadataMap.get(features[0].properties.id);
    if (onlyItem) {
      return buildFullFeatureLabel(onlyItem) || 'Türkiye Haritası';
    }
  }

  if (state.level === 'region') {
    return currentRegionName() || 'Türkiye Bölgeleri';
  }

  if (state.level === 'province') {
    if (currentProvinceName()) {
      return currentProvinceName();
    }
    if (currentRegionName()) {
      return `${currentRegionName()} illeri`;
    }
    return 'Türkiye İlleri';
  }

  if (state.level === 'district') {
    if (state.districtId) {
      const districtItem = datasets.districtsById.get(state.districtId);
      return buildFullFeatureLabel(districtItem) || 'Türkiye İlçeleri';
    }
    if (currentProvinceName()) {
      return `${currentProvinceName()} ilçeleri`;
    }
    if (currentRegionName()) {
      return `${currentRegionName()} ilçeleri`;
    }
    return 'Türkiye İlçeleri';
  }

  if (state.level === 'mahalle' || state.level === 'yerlesim') {
    if (state.districtId) {
      const districtItem = datasets.districtsById.get(state.districtId);
      const districtLabel = buildFullFeatureLabel(districtItem);
      return districtLabel ? `${districtLabel} mahalleleri` : 'Türkiye Mahalleleri';
    }
    if (currentProvinceName()) {
      return `${currentProvinceName()} mahalleleri`;
    }
    if (currentRegionName()) {
      return `${currentRegionName()} mahalleleri`;
    }
    return 'Türkiye Mahalleleri';
  }

  return 'Türkiye Haritası';
}

function toggleField(element, visible) {
  if (!element) {
    return;
  }

  element.classList.toggle('is-hidden', !visible);
}

function setText(element, value) {
  if (element) {
    element.textContent = value;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function escapeXml(value) {
  return escapeHtml(value);
}

function escapeJsString(value) {
  return String(value)
    .replaceAll('\\', '\\\\')
    .replaceAll('`', '\\`')
    .replaceAll('${', '\\${');
}

function toPascalCase(value) {
  return String(value)
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('') || 'TurkeyMapComponent';
}

