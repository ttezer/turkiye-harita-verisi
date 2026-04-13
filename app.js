import {
  buildGeojsonPayload as buildFilteredGeojsonPayload,
  buildJsonPayload as buildFilteredJsonPayload,
  buildKmzBlobFromKml,
  buildTabularRows as buildFilteredTabularRows,
  buildTopojsonPayload as buildFilteredTopojsonPayload,
  buildXlsxArrayBuffer,
  douglasPeucker,
  featureCollectionToKml,
  pickFields,
  rowsToCsv,
  rowsToSql,
  rowsToWkt,
} from './download.js?v=21';

const state = {
  format: 'geojson',
  scope: 'turkey',
  level: 'region',
  selectedFields: [],
  csvDelimiter: ',',
  style: 'filled',
  colorMode: 'single',
  palette: 'blue',
  resolution: '1920x1080',
  regionId: '',
  provinceId: '',
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
  csvDelimiterSelect: document.querySelector('#csvDelimiterSelect'),
  fieldsField: document.querySelector('#fieldsField'),
  styleField: document.querySelector('#styleField'),
  colorModeField: document.querySelector('#colorModeField'),
  paletteField: document.querySelector('#paletteField'),
  resolutionField: document.querySelector('#resolutionField'),
  csvDelimiterField: document.querySelector('#csvDelimiterField'),
  formatStatus: document.querySelector('#formatStatus'),
  downloadTitle: document.querySelector('#downloadTitle'),
  downloadSummary: document.querySelector('#downloadSummary'),
  downloadButton: document.querySelector('#downloadButton'),
  regionSelect: document.querySelector('#regionSelect'),
  provinceSelect: document.querySelector('#provinceSelect'),
  searchInput: document.querySelector('#searchInput'),
  heroFormatChips: document.querySelectorAll('.hero-format-chip[data-format]'),
  resetButton: document.querySelector('#resetButton'),
  regionCount: document.querySelector('#regionCount'),
  provinceCount: document.querySelector('#provinceCount'),
  districtCount: document.querySelector('#districtCount'),
  visibleCount: document.querySelector('#visibleCount'),
  detailPanel: document.querySelector('#detailPanel'),
  mapSvg: document.querySelector('#mapSvg'),
  mapOverlay: document.querySelector('#mapOverlay'),
  pageShell: document.querySelector('.page-shell'),
};

const numberFormat = new Intl.NumberFormat('tr-TR');
const defaultExportViewport = { width: 1200, height: 760, padding: 28 };
const datasets = await loadDatasets();
const projections = {
  region: buildProjection(datasets.regionsGeojson),
  province: buildProjection(datasets.provincesGeojson),
  district: buildProjection(datasets.districtsGeojson),
};

hydrateRegionSelect();
hydrateProvinceSelect();
normalizeInterfaceCopy();
organizeWorkspaceLayout();
bindEvents();
bindParallax();
syncConfigurator();
render();

async function loadDatasets() {
  const [regions, provinces, districts, regionsGeojson, provincesGeojson, districtsGeojson] = await Promise.all([
    fetchJson('./dist/json/regions.json'),
    fetchJson('./dist/json/provinces.json'),
    fetchJson('./dist/json/districts.json'),
    fetchJson('./dist/geojson/regions.geojson'),
    fetchJson('./dist/geojson/provinces.geojson'),
    fetchJson('./dist/geojson/districts.geojson'),
  ]);

  return {
    regions,
    provinces,
    districts,
    regionsGeojson,
    provincesGeojson,
    districtsGeojson,
    regionsById: new Map(regions.map((item) => [item.id, item])),
    provincesById: new Map(provinces.map((item) => [item.id, item])),
    districtsById: new Map(districts.map((item) => [item.id, item])),
  };
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Yüklenemedi: ${url}`);
  }
  return response.json();
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

function organizeWorkspaceLayout() {
  const mapColumn = document.querySelector('.map-column');
  const mapStage = document.querySelector('.map-stage');
  const searchField = els.searchInput?.closest('.field');
  const downloadSummary = document.querySelector('.download-summary');
  const actionRow = document.querySelector('.action-row');
  const miniStats = document.querySelector('.mini-stats');
  const detailPanel = els.detailPanel;

  if (!mapColumn || !mapStage || !searchField || !downloadSummary || !actionRow || !miniStats || !detailPanel) {
    return;
  }

  const layout = document.createElement('div');
  layout.className = 'map-layout';

  const rail = document.createElement('aside');
  rail.className = 'map-rail';

  searchField.classList.add('rail-search');
  rail.append(searchField, downloadSummary, actionRow, miniStats, detailPanel);
  layout.append(mapStage, rail);
  mapColumn.replaceChildren(layout);
}

function bindEvents() {
  els.heroFormatChips?.forEach((chip) => {
    chip.addEventListener('click', () => {
      const format = chip.dataset.format;
      if (!format) {
        return;
      }

      state.format = format;
      if (els.formatSelect) {
        els.formatSelect.value = format;
      }
      syncConfigurator();
      render();
    });
  });

  els.formatSelect?.addEventListener('change', (event) => {
    state.format = event.target.value;
    syncConfigurator();
    render();
  });

  els.scopeSelect?.addEventListener('change', (event) => {
    state.scope = event.target.value;

    if (state.scope === 'turkey') {
      state.level = 'region';
      state.regionId = '';
      state.provinceId = '';
      if (els.detailSelect) els.detailSelect.value = 'region';
      if (els.regionSelect) els.regionSelect.value = '';
      if (els.provinceSelect) els.provinceSelect.value = '';
    } else if (state.scope === 'region') {
      state.level = 'province';
      state.provinceId = '';
      if (els.detailSelect) els.detailSelect.value = 'province';
      if (els.provinceSelect) els.provinceSelect.value = '';
    } else {
      state.level = 'district';
      if (els.detailSelect) els.detailSelect.value = 'district';
    }

    syncConfigurator();
    render();
  });

  els.detailSelect?.addEventListener('change', (event) => {
    state.level = event.target.value;

    if (state.level === 'region') {
      state.scope = 'turkey';
      state.regionId = '';
      state.provinceId = '';
      if (els.scopeSelect) els.scopeSelect.value = 'turkey';
      if (els.regionSelect) els.regionSelect.value = '';
      if (els.provinceSelect) els.provinceSelect.value = '';
    } else if (state.level === 'province') {
      if (state.regionId) {
        state.scope = 'region';
        if (els.scopeSelect) els.scopeSelect.value = 'region';
      } else {
        state.scope = 'turkey';
        if (els.scopeSelect) els.scopeSelect.value = 'turkey';
      }
      state.provinceId = '';
      if (els.provinceSelect) els.provinceSelect.value = '';
    } else {
      if (state.scope === 'region' || state.regionId) {
        state.scope = 'region';
        if (els.scopeSelect) els.scopeSelect.value = 'region';
        state.provinceId = '';
        if (els.provinceSelect) els.provinceSelect.value = '';
      } else {
        state.scope = 'province';
        if (els.scopeSelect) els.scopeSelect.value = 'province';
        if (!state.provinceId && datasets.provinces.length > 0) {
          state.provinceId = datasets.provinces[0].id;
          if (els.provinceSelect) els.provinceSelect.value = state.provinceId;
          state.regionId = datasets.provincesById.get(state.provinceId)?.region_id || '';
          if (els.regionSelect) els.regionSelect.value = state.regionId;
        }
      }
    }

    syncConfigurator();
    render();
  });

  els.styleSelect?.addEventListener('change', (event) => {
    state.style = event.target.value;
    syncConfigurator();
    render();
  });

  els.colorModeSelect?.addEventListener('change', (event) => {
    state.colorMode = event.target.value;
    syncConfigurator();
    render();
  });

  els.paletteSelect?.addEventListener('change', (event) => {
    state.palette = event.target.value;
    syncConfigurator();
    render();
  });

  els.resolutionSelect?.addEventListener('change', (event) => {
    state.resolution = event.target.value;
    syncConfigurator();
  });

  els.csvDelimiterSelect?.addEventListener('change', (event) => {
    state.csvDelimiter = event.target.value;
    syncConfigurator();
  });

  els.regionSelect?.addEventListener('change', (event) => {
    state.regionId = event.target.value;
    state.selectedId = '';

    if (state.regionId) {
      state.scope = 'region';
      if (els.scopeSelect) els.scopeSelect.value = 'region';
      state.provinceId = '';
      if (els.provinceSelect) els.provinceSelect.value = '';
    } else if (state.scope === 'region') {
      state.scope = 'turkey';
      if (els.scopeSelect) els.scopeSelect.value = 'turkey';
      if (state.level === 'district') {
        state.provinceId = '';
        if (els.provinceSelect) els.provinceSelect.value = '';
      } else {
        state.level = 'region';
        if (els.detailSelect) els.detailSelect.value = 'region';
      }
    }

    syncConfigurator();
    render();
  });

  els.provinceSelect?.addEventListener('change', (event) => {
    state.provinceId = event.target.value;
    state.selectedId = '';

    if (state.provinceId) {
      state.scope = 'province';
      state.level = 'district';
      state.regionId = datasets.provincesById.get(state.provinceId)?.region_id || '';
      if (els.scopeSelect) els.scopeSelect.value = 'province';
      if (els.detailSelect) els.detailSelect.value = 'district';
      if (els.regionSelect) els.regionSelect.value = state.regionId;
    }

    syncConfigurator();
    render();
  });

  let searchDebounceTimer = 0;
  els.searchInput?.addEventListener('input', (event) => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = window.setTimeout(() => {
      state.search = normalizeSearchText(event.target.value);
      render();
    }, 160);
  });

  els.downloadButton?.addEventListener('click', async () => {
    const availability = getFormatAvailability();
    if (!availability.available) {
      return;
    }

    const button = els.downloadButton;
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Hazırlanıyor…';

    try {
      await triggerDownload(availability.filename);
    } catch (error) {
      button.textContent = 'Hata oluştu';
      window.setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
      }, 2500);
      return;
    }

    button.textContent = originalText;
    button.disabled = false;
  });

  els.resetButton?.addEventListener('click', () => {
    state.format = 'geojson';
    state.scope = 'turkey';
    state.level = 'region';
    state.selectedFields = [];
    state.csvDelimiter = ',';
    state.style = 'filled';
    state.colorMode = 'single';
    state.palette = 'blue';
    state.resolution = '1920x1080';
    state.regionId = '';
    state.provinceId = '';
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
    if (els.csvDelimiterSelect) els.csvDelimiterSelect.value = state.csvDelimiter;
    if (els.regionSelect) els.regionSelect.value = '';
    if (els.provinceSelect) els.provinceSelect.value = '';
    if (els.searchInput) els.searchInput.value = '';

    syncConfigurator();
    render();
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
  syncFieldOptions();
  syncDownloadState();
}

function syncFormatFields() {
  const isStructuredData = ['json', 'geojson', 'topojson', 'csv', 'xlsx', 'sql', 'kml', 'kmz'].includes(state.format);
  const isTabularData = ['csv', 'xlsx', 'sql'].includes(state.format);
  const isVectorVisual = state.format === 'svg';
  const isRasterVisual = state.format === 'png' || state.format === 'pdf';
  const isVisual = isVectorVisual || isRasterVisual;
  const showColorMode = isVisual && (state.style === 'filled' || state.style === 'transparent');
  const showPalette = showColorMode && state.colorMode === 'palette';

  toggleField(els.fieldsField, isStructuredData || isVectorVisual);
  toggleField(els.styleField, isVisual);
  toggleField(els.colorModeField, showColorMode);
  toggleField(els.paletteField, showPalette);
  toggleField(els.resolutionField, isRasterVisual);
  toggleField(els.csvDelimiterField, state.format === 'csv');

  if (!isTabularData && els.csvDelimiterSelect) {
    els.csvDelimiterSelect.value = state.csvDelimiter;
  }
}

function syncProvinceFilter() {
  const needsProvince = state.scope === 'province' || state.level === 'district';
  toggleField(els.provinceSelect?.closest('.field'), needsProvince);

  if (!needsProvince && els.provinceSelect) {
    els.provinceSelect.value = '';
    state.provinceId = '';
  }
}

function syncRegionFilter() {
  const needsRegion = state.scope === 'region' || state.scope === 'province' || state.level === 'province' || state.level === 'district';
  toggleField(els.regionSelect?.closest('.field'), needsRegion);

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
  const provinces = state.regionId
    ? datasets.provinces.filter((item) => item.region_id === state.regionId)
    : datasets.provinces;

  els.provinceSelect.innerHTML = '<option value="">Tüm Türkiye</option>';

  for (const province of provinces) {
    const option = document.createElement('option');
    option.value = province.id;
    option.textContent = `${province.name} (${province.plate_code})`;
    els.provinceSelect.append(option);
  }

  if (currentValue && provinces.some((item) => item.id === currentValue)) {
    els.provinceSelect.value = currentValue;
  } else {
    state.provinceId = '';
  }
}

function renderFieldChecklist(options) {
  if (!els.fieldChecklist) {
    return;
  }

  els.fieldChecklist.innerHTML = options.map((option) => `
    <label class="field-option">
      <input type="checkbox" value="${escapeHtml(option.key)}" ${state.selectedFields.includes(option.key) ? 'checked' : ''}>
      <span>
        ${escapeHtml(option.label)}
        <small>${escapeHtml(option.description)}</small>
      </span>
    </label>
  `).join('');

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
  const structuredFormats = new Set(['json', 'geojson', 'topojson', 'csv', 'xlsx', 'sql', 'kml', 'kmz', 'svg']);

  if (!structuredFormats.has(state.format)) {
    return [];
  }

  let options;

  const spatialFields = [
    fieldDef('centroid_lat', 'Merkez Noktası (Lat)', 'Merkez noktası enlemi', false),
    fieldDef('centroid_lon', 'Merkez Noktası (Lon)', 'Merkez noktası boylamı', false),
    fieldDef('bbox_min_lon', 'Sınır Kutusu Batı', 'Minimum boylam (bbox_min_lon)', false),
    fieldDef('bbox_min_lat', 'Sınır Kutusu Güney', 'Minimum enlem (bbox_min_lat)', false),
    fieldDef('bbox_max_lon', 'Sınır Kutusu Doğu', 'Maksimum boylam (bbox_max_lon)', false),
    fieldDef('bbox_max_lat', 'Sınır Kutusu Kuzey', 'Maksimum enlem (bbox_max_lat)', false),
    fieldDef('geometry_wkt', 'Tam Sınır (WKT)', 'Tam sınır geometrisi — yalnızca ileri düzey kullanım', false),
  ];

  if (state.level === 'region') {
    options = [
      fieldDef('id', 'Bölge ID', 'Bölgenin Benzersiz Kimliği', true),
      fieldDef('name', 'Bölge Adı', 'Bölge Görünür Adı', true),
      ...spatialFields,
    ];
  } else if (state.level === 'province') {
    options = [
      fieldDef('id', 'İl ID', 'İl Benzersiz Kimliği', true),
      fieldDef('name', 'İl Adı', 'İl Görünür Adı', true),
      fieldDef('region_id', 'Bölge ID', 'Bölge Benzersiz Kimliği', true),
      fieldDef('region_name', 'Bölge Adı', 'Bölge Görünür Adı', true),
      ...spatialFields,
    ];
  } else {
    options = [
      fieldDef('id', 'İlçe ID', 'İlçe Benzersiz Kimliği', true),
      fieldDef('name', 'İlçe Adı', 'İlçe Görünür Adı', true),
      fieldDef('parent_id', 'İl ID', 'İl Benzersiz Kimliği', true),
      fieldDef('parent_name', 'İl Adı', 'İl Görünür Adı', true),
      fieldDef('region_id', 'Bölge ID', 'Bölge Benzersiz Kimliği', true),
      fieldDef('region_name', 'Bölge Adı', 'Bölge Görünür Adı', true),
      ...spatialFields,
    ];
  }

  return options;
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
}

function syncHeroFormatChips() {
  els.heroFormatChips?.forEach((chip) => {
    chip.classList.toggle('is-active', chip.dataset.format === state.format);
  });
}

function getFormatAvailability() {
  const builtArtifactFormats = new Set(['topojson', 'csv', 'xlsx', 'sql', 'wkt', 'kml']);

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

function render() {
  const visibleFeatures = getVisibleFeatures();
  const renderableFeatures = getRenderableFeatures();

  setText(els.regionCount, numberFormat.format(datasets.regions.length));
  setText(els.provinceCount, numberFormat.format(datasets.provinces.length));
  setText(els.districtCount, numberFormat.format(datasets.districts.length));
  setText(els.visibleCount, numberFormat.format(visibleFeatures.length));

  renderMap(renderableFeatures);
  renderDetail();
}

function getVisibleFeatures() {
  const metadata = getActiveMetadataMap();
  return getRenderableFeatures()
    .filter((feature) => {
      const item = metadata.get(feature.properties.id);
      return item && isSearchMatch(item);
    });
}

function getRenderableFeatures() {
  const metadata = getActiveMetadataMap();
  const features = getActiveFeatureCollection().features;

  return features.filter((feature) => {
    const item = metadata.get(feature.properties.id);
    if (!item) return false;
    if (state.level === 'province' && state.regionId && item.region_id !== state.regionId) return false;
    if (state.level === 'district' && state.regionId && item.region_id !== state.regionId) return false;
    if (state.level === 'district' && state.provinceId && item.parent_id !== state.provinceId) return false;
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
  return datasets.districtsById;
}

function getActiveFeatureCollection() {
  if (state.level === 'region') {
    return datasets.regionsGeojson;
  }
  if (state.level === 'province') {
    return datasets.provincesGeojson;
  }
  return datasets.districtsGeojson;
}

function renderMap(features) {
  if (!els.mapSvg || !els.mapOverlay) {
    return;
  }

  els.mapSvg.innerHTML = '';
  applyPreviewTheme();

  if (features.length === 0) {
    els.mapOverlay.textContent = 'Filtreyle eşleşen geometri yok.';
    return;
  }

  updateMapOverlay();
  const matchedIds = new Set(getVisibleFeatures().map((feature) => feature.properties.id));

  const projection = getActiveProjection(features);
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');

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
        state.regionId = datasets.provincesById.get(id)?.region_id || '';
        state.selectedId = '';
        state.hoveredId = '';
        if (els.scopeSelect) els.scopeSelect.value = 'province';
        if (els.detailSelect) els.detailSelect.value = 'district';
        if (els.regionSelect) els.regionSelect.value = state.regionId;
        if (els.provinceSelect) els.provinceSelect.value = id;
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

function getActiveProjection(features, viewport = defaultExportViewport) {
  if (features.length === 0) {
    return projections[state.level];
  }

  if (state.level === 'district' && state.provinceId) {
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
    if (matchedIds?.has(id)) {
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

function updateMapOverlay() {
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

  els.mapOverlay.textContent = state.level === 'province'
    ? (state.regionId ? 'İl görünümü: bölge filtreli' : 'İl görünümü')
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
  path.style.setProperty('--feature-fill', fill || '');
  path.style.setProperty('--feature-stroke', theme.stroke || '');
}

function getCurrentVisualTheme() {
  if (state.format === 'svg' || state.format === 'png') {
    return getSvgTheme();
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
    els.detailPanel.innerHTML = '<p class="detail-empty">Haritada bir öğe seç.</p>';
    return;
  }

  const item = getActiveMetadataMap().get(activeId);

  if (!item) {
    els.detailPanel.innerHTML = '<p class="detail-empty">Kayıt bulunamadı.</p>';
    return;
  }

  const parentName = state.level === 'district'
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
      : [
        ['Ad', item.name],
        ['ID', item.id],
        ['Seviye', getLevelLabel(item.level)],
        ['Bölge', item.region_name || '-'],
        ['İl', parentName],
        ['İlçe Kodu', item.district_local_code || '-'],
      ];

  const visibleRows = state.level === 'region'
    ? rows.filter(([label]) => label !== 'Bölge Türü')
    : rows;

  els.detailPanel.innerHTML = `
    <dl class="detail-grid">
      ${visibleRows.map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value))}</dd>`).join('')}
    </dl>
  `;
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
  const path = window.d3.geoPath(projection).digits(1);

  return {
    projection,
    path(feature) {
      return path(feature) || '';
    },
  };
}

function getDownloadFilename(format, baseName) {
  if (state.scope === 'region' && state.regionId) {
    const slug = datasets.regionsById.get(state.regionId)?.slug || 'region';
    return `${slug}-${baseName}.${format}`;
  }

  if (state.scope === 'province' && state.provinceId) {
    const slug = datasets.provincesById.get(state.provinceId)?.slug || 'province';
    return `${slug}-${baseName}.${format}`;
  }

  return `turkiye-${baseName}.${format}`;
}

function getDetailLabel(detail) {
  if (detail === 'region') return 'bölge';
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

async function triggerDownload(filename) {
  const blob = await buildDownloadBlob();
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

  if (state.format === 'png') {
    return buildPngBlob();
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

  if (state.format === 'kmz') {
    return buildKmzBlobFromKml(buildKmlDocument());
  }

  if (state.format === 'shp') {
    return buildShapefileZipBlob(getVisibleFeatures(), getVisibleMetadataItems(), `${state.level}s`);
  }

  throw new Error(`Unsupported download format: ${state.format}`);
}


function buildJsonPayload() {
  return buildFilteredJsonPayload(
    getVisibleMetadataItems(),
    state.selectedFields,
    (item) => item.level === 'district'
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
  const geometryCollection = buildGeojsonPayload();
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
  const { width, height } = viewport;
  const title = state.level === 'region'
    ? 'Türkiye Bölgeleri'
    : state.scope === 'province' && currentProvinceName()
    ? `${currentProvinceName()} ilçeleri`
    : state.scope === 'region' && currentRegionName()
      ? `${currentRegionName()} illeri`
    : 'Türkiye Haritası';

  const paths = features.map((feature) => {
    const item = getActiveMetadataMap().get(feature.properties.id);

    const pathData = buildSimplifiedSvgPath(feature, projection);
    const dataAttributes = buildSvgDataAttributes(item);
    const fill = resolveFeatureFill(item, theme);
    const styleAttribute = fill ? ` style="fill:${escapeAttribute(fill)}"` : '';
    return `<path d="${escapeAttribute(pathData)}"${styleAttribute} ${dataAttributes}><title>${escapeXml(metadataLabelForFeature(item.id))}</title></path>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escapeAttribute(title)}">
  <desc>${escapeXml(title)}</desc>
  <style>
    svg { background: ${theme.background}; }
    path {
      fill: ${theme.fill};
      stroke: ${theme.stroke};
      stroke-width: 1;
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

function buildExportProperties(item) {
  const parentName = item.level === 'district'
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
    slug: item.slug,
    plate_code: item.plate_code,
    district_local_code: item.district_local_code,
    nuts_code: item.nuts_code,
    tuik_id: item.tuik_id,
    icisleri_id: item.icisleri_id,
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
  if (state.level === 'district') {
    return state.provinceId ? 1.4 : 2.2;
  }
  return 0.9;
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
