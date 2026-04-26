export function buildJsonPayload(items, selectedFields, parentNameResolver) {
  return items.map((item) => pickFields({
    ...item,
    parent_name: parentNameResolver(item),
  }, selectedFields));
}

export function buildGeojsonPayload(features, buildProperties) {
  return {
    type: 'FeatureCollection',
    features: features.map((feature) => ({
      ...feature,
      properties: buildProperties(feature.properties.id),
    })),
  };
}

export function buildTopojsonPayload(featureCollection, topologyFn, objectName) {
  return topologyFn({ [objectName]: featureCollection });
}

export function buildTabularRows(items, geometryById) {
  return items.map((item) => {
    const geometry = geometryById.get(item.id);
    const bbox = item.bbox || geometryBbox(geometry);
    const centroid = item.centroid || centroidFromBbox(bbox);

    return {
      id: item.id,
      name: item.name ?? '',
      parent_id: item.parent_id ?? '',
      parent_name: item.parent_name ?? '',
      region_id: item.region_id ?? '',
      region_name: item.region_name ?? '',
      level: item.level ?? '',
      name_ascii: item.name_ascii ?? '',
      slug: item.slug ?? '',
      plate_code: item.plate_code ?? '',
      district_local_code: item.district_local_code ?? '',
      nuts_code: item.nuts_code ?? '',
      tuik_id: item.tuik_id ?? '',
      icisleri_id: item.icisleri_id ?? '',
      source_label: item.source_label ?? item.source ?? '',
      aliases: JSON.stringify(item.aliases || []),
      member_ids: JSON.stringify(item.member_ids || []),
      bbox_min_lon: bbox?.[0] ?? '',
      bbox_min_lat: bbox?.[1] ?? '',
      bbox_max_lon: bbox?.[2] ?? '',
      bbox_max_lat: bbox?.[3] ?? '',
      centroid_lat: centroid?.lat ?? '',
      centroid_lon: centroid?.lon ?? '',
      x: centroid?.lon ?? '',
      y: centroid?.lat ?? '',
      coordinate_system: centroid ? 'EPSG:4326' : '',
      geometry_wkt: geometryToWkt(geometry),
    };
  });
}

function geometryBbox(geometry) {
  if (!geometry?.coordinates) {
    return null;
  }

  const bbox = [Infinity, Infinity, -Infinity, -Infinity];
  const visit = (coordinates) => {
    if (!Array.isArray(coordinates)) {
      return;
    }
    if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
      bbox[0] = Math.min(bbox[0], coordinates[0]);
      bbox[1] = Math.min(bbox[1], coordinates[1]);
      bbox[2] = Math.max(bbox[2], coordinates[0]);
      bbox[3] = Math.max(bbox[3], coordinates[1]);
      return;
    }
    coordinates.forEach(visit);
  };

  visit(geometry.coordinates);
  return bbox.every(Number.isFinite) ? bbox : null;
}

function centroidFromBbox(bbox) {
  if (!bbox) {
    return null;
  }
  return {
    lat: (bbox[1] + bbox[3]) / 2,
    lon: (bbox[0] + bbox[2]) / 2,
  };
}

export function geometryToWkt(geometry) {
  if (!geometry) {
    return '';
  }

  if (geometry.type === 'Polygon') {
    return `POLYGON (${geometry.coordinates.map((ring) => `(${ring.map(([lon, lat]) => `${lon} ${lat}`).join(', ')})`).join(', ')})`;
  }

  if (geometry.type === 'MultiPolygon') {
    return `MULTIPOLYGON (${geometry.coordinates
      .map((polygon) => `(${polygon.map((ring) => `(${ring.map(([lon, lat]) => `${lon} ${lat}`).join(', ')})`).join(', ')})`)
      .join(', ')})`;
  }

  return '';
}

export function rowsToCsv(rows, delimiter = ',') {
  if (rows.length === 0) {
    return '';
  }

  const columns = Object.keys(rows[0]);
  return [
    columns.join(delimiter),
    ...rows.map((row) => columns.map((column) => escapeCsvValue(row[column], delimiter)).join(delimiter)),
  ].join('\n');
}

export function escapeCsvValue(value, delimiter = ',') {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);
  if (stringValue.includes(delimiter) || /["\n\r]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }

  return stringValue;
}

function quoteSqlIdentifier(name) {
  return `"${String(name).replaceAll('"', '""')}"`;
}

export function rowsToSql(tableName, rows) {
  const quotedTable = quoteSqlIdentifier(tableName);

  if (rows.length === 0) {
    return `CREATE TABLE ${quotedTable} (id TEXT PRIMARY KEY);\n`;
  }

  const columns = Object.keys(rows[0]);
  const createColumns = columns.map((column) => `${quoteSqlIdentifier(column)} TEXT`).join(',\n  ');
  const inserts = rows.map((row) => (
    `INSERT INTO ${quotedTable} (${columns.map(quoteSqlIdentifier).join(', ')}) VALUES (${columns.map((column) => escapeSqlValue(row[column])).join(', ')});`
  ));

  return [
    `CREATE TABLE ${quotedTable} (`,
    `  ${createColumns}`,
    ');',
    ...inserts,
    '',
  ].join('\n');
}

export function escapeSqlValue(value) {
  if (value === null || value === undefined || value === '') {
    return 'NULL';
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'NULL';
  }

  return `'${String(value).replaceAll("'", "''")}'`;
}

export function rowsToWkt(rows) {
  return rows
    .map((row) => row.geometry_wkt)
    .filter(Boolean)
    .join('\n');
}

export function buildXlsxArrayBuffer(rows, sheetName, xlsxApi) {
  const workbook = xlsxApi.utils.book_new();
  const workbookRows = rows.map(({ geometry_wkt, ...rest }) => rest);
  xlsxApi.utils.book_append_sheet(workbook, xlsxApi.utils.json_to_sheet(workbookRows), sheetName);
  return xlsxApi.write(workbook, { bookType: 'xlsx', type: 'array' });
}

function cssHexToKmlColor(cssHex, alpha = 'cc') {
  const hex = cssHex.replace('#', '');
  if (hex.length !== 6) {
    return `${alpha}ffddc7`;
  }
  const r = hex.slice(0, 2);
  const g = hex.slice(2, 4);
  const b = hex.slice(4, 6);
  return `${alpha}${b}${g}${r}`;
}

export function featureCollectionToKml(name, metadata, geometryCollection, propertyBuilder, colorResolver = null) {
  const metadataById = new Map(metadata.map((item) => [item.id, item]));
  const defaultStyleId = 'turkiye-map-style';
  const defaultFillColor = '99ffddc7';

  const featureStyleIds = new Map();
  const customStyles = new Map();

  if (colorResolver) {
    for (const feature of geometryCollection.features) {
      const item = metadataById.get(feature.properties.id);
      if (!item) {
        continue;
      }
      const cssColor = colorResolver(item);
      if (cssColor && /^#[0-9a-fA-F]{6}$/.test(cssColor)) {
        const kmlFill = cssHexToKmlColor(cssColor);
        const styleId = `style-${kmlFill}`;
        featureStyleIds.set(feature.properties.id, styleId);
        customStyles.set(styleId, kmlFill);
      }
    }
  }

  const styleDefinitions = customStyles.size > 0
    ? [...customStyles.entries()].map(([styleId, kmlFill]) =>
        `<Style id="${styleId}"><LineStyle><color>ff8f5f34</color><width>1.4</width></LineStyle><PolyStyle><color>${kmlFill}</color><fill>1</fill><outline>1</outline></PolyStyle></Style>`)
    : [`<Style id="${defaultStyleId}"><LineStyle><color>ff8f5f34</color><width>1.4</width></LineStyle><PolyStyle><color>${defaultFillColor}</color><fill>1</fill><outline>1</outline></PolyStyle></Style>`];

  const placemarks = geometryCollection.features.map((feature) => {
    const item = metadataById.get(feature.properties.id);
    if (!item) {
      return '';
    }
    const properties = propertyBuilder(item);
    const extendedData = Object.entries(properties)
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => {
        const label = getKmlFieldLabel(key, item);
        return `<Data name="${xmlEscape(key)}"><displayName>${xmlEscape(label)}</displayName><value>${xmlEscape(value)}</value></Data>`;
      })
      .join('');
    const description = buildKmlDescription(item, properties);
    const resolvedStyleId = featureStyleIds.get(feature.properties.id) || defaultStyleId;

    return [
      '<Placemark>',
      `<styleUrl>#${resolvedStyleId}</styleUrl>`,
      `<name>${xmlEscape(item.name)}</name>`,
      `<description>${xmlEscape(description)}</description>`,
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
    '<open>1</open>',
    buildKmlLookAt(geometryCollection),
    ...styleDefinitions,
    placemarks,
    '</Document>',
    '</kml>',
    '',
  ].join('');
}

export function buildKmlDescription(item, properties) {
  const lines = [];

  for (const [key, value] of Object.entries(properties)) {
    if (value === null || value === undefined || value === '') {
      continue;
    }
    lines.push(`${getKmlFieldLabel(key, item)}: ${value}`);
  }

  return lines.length > 0 ? lines.join('\n') : item.id;
}

function getKmlFieldLabel(key, item) {
  const labels = {
    id: 'ID',
    name: 'Ad',
    region_id: 'Bölge ID',
    region_name: 'Bölge Adı',
    province_id: 'İl ID',
    province_name: 'İl Adı',
    source_label: 'Kaynak',
    slug: 'Kısa Ad',
    name_ascii: 'ASCII Ad',
    plate_code: 'Plaka Kodu',
    level: 'Seviye',
  };

  if (key === 'parent_id') {
    return item.level === 'yerlesim' ? 'İlçe ID' : 'İl ID';
  }

  if (key === 'parent_name') {
    return item.level === 'yerlesim' ? 'İlçe Adı' : 'İl Adı';
  }

  return labels[key] || key;
}

export function geometryToKml(geometry) {
  const ringToKml = (ring) => normalizeKmlRing(ring).map(([lon, lat]) => `${lon},${lat},0`).join(' ');
  const polygonToKml = (polygon) => {
    const [outerBoundary, ...innerBoundaries] = polygon;
    return [
      '<Polygon>',
      '<tessellate>1</tessellate>',
      '<altitudeMode>clampToGround</altitudeMode>',
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

  return '';
}

export function buildKmlLookAt(geometryCollection) {
  const bbox = geometryCollectionBbox(geometryCollection);
  if (!bbox) {
    return '';
  }

  const [minLon, minLat, maxLon, maxLat] = bbox;
  const centerLon = (minLon + maxLon) / 2;
  const centerLat = (minLat + maxLat) / 2;
  const lonSpanMeters = Math.abs(maxLon - minLon) * 111320 * Math.cos(centerLat * Math.PI / 180);
  const latSpanMeters = Math.abs(maxLat - minLat) * 111320;
  const range = Math.max(1000, Math.round(Math.max(lonSpanMeters, latSpanMeters) * 2.4));

  return [
    '<LookAt>',
    `<longitude>${centerLon.toFixed(6)}</longitude>`,
    `<latitude>${centerLat.toFixed(6)}</latitude>`,
    '<altitude>0</altitude>',
    '<heading>0</heading>',
    '<tilt>0</tilt>',
    `<range>${range}</range>`,
    '<altitudeMode>clampToGround</altitudeMode>',
    '</LookAt>',
  ].join('');
}

function geometryCollectionBbox(geometryCollection) {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  const visit = (coordinates) => {
    if (!Array.isArray(coordinates)) {
      return;
    }

    if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
      const [lon, lat] = coordinates;
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
        return;
      }
      minLon = Math.min(minLon, lon);
      minLat = Math.min(minLat, lat);
      maxLon = Math.max(maxLon, lon);
      maxLat = Math.max(maxLat, lat);
      return;
    }

    coordinates.forEach(visit);
  };

  for (const feature of geometryCollection.features || []) {
    visit(feature.geometry?.coordinates);
  }

  if (![minLon, minLat, maxLon, maxLat].every(Number.isFinite)) {
    return null;
  }

  return [minLon, minLat, maxLon, maxLat];
}

function normalizeKmlRing(ring) {
  const cleaned = ring.filter((point) => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]));
  if (cleaned.length === 0) {
    return cleaned;
  }

  const isClosed = cleaned.length > 1
    && cleaned[0][0] === cleaned.at(-1)[0]
    && cleaned[0][1] === cleaned.at(-1)[1];

  return isClosed ? cleaned : [...cleaned, cleaned[0]];
}

export function douglasPeucker(points, tolerance) {
  if (points.length <= 2) {
    return points;
  }

  let maxDistance = 0;
  let maxIndex = 0;
  const start = points[0];
  const end = points.at(-1);

  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = perpendicularDistance(points[index], start, end);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = index;
    }
  }

  if (maxDistance <= tolerance) {
    return [start, end];
  }

  const left = douglasPeucker(points.slice(0, maxIndex + 1), tolerance);
  const right = douglasPeucker(points.slice(maxIndex), tolerance);
  return [...left.slice(0, -1), ...right];
}

function perpendicularDistance(point, start, end) {
  const [x, y] = point;
  const [x1, y1] = start;
  const [x2, y2] = end;
  const deltaX = x2 - x1;
  const deltaY = y2 - y1;

  if (deltaX === 0 && deltaY === 0) {
    return Math.hypot(x - x1, y - y1);
  }

  const numerator = Math.abs((deltaY * x) - (deltaX * y) + (x2 * y1) - (y2 * x1));
  const denominator = Math.hypot(deltaX, deltaY);
  return numerator / denominator;
}

export function pickFields(source, fields) {
  const picked = {};

  for (const field of fields) {
    if (field in source) {
      picked[field] = source[field];
    }
  }

  return picked;
}

export function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// --- Shapefile browser writer ---

const WGS84_PRJ_STR = 'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';

// ISO-8859-9 (Latin-5 / Windows-1254) — Türkçe karakter eşleme tablosu
const ISO88599_OVERRIDES = new Map([
  [0x11E, 0xD0], [0x11F, 0xF0], // Ğ ğ
  [0x130, 0xDD], [0x131, 0xFD], // İ ı
  [0x15E, 0xDE], [0x15F, 0xFE], // Ş ş
  // Ç ç Ö ö Ü ü → Latin-1 ile aynı, ek eşleme gerekmez
]);

function encodeISO88599Char(code) {
  if (ISO88599_OVERRIDES.has(code)) return ISO88599_OVERRIDES.get(code);
  return code < 256 ? code : 0x3F;
}

function writeISO88599Field(u8, off, value, length) {
  const s = String(value ?? '').slice(0, length);
  for (let i = 0; i < length; i++) {
    u8[off + i] = i < s.length ? encodeISO88599Char(s.charCodeAt(i)) : 0x20;
  }
}

function shpGeomRings(geometry) {
  if (geometry.type === 'Polygon') return geometry.coordinates;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat(1);
  return [];
}

function buildShpContent(geometry) {
  const rings = shpGeomRings(geometry);
  const numParts = rings.length;
  const numPoints = rings.reduce((s, r) => s + r.length, 0);
  const buf = new ArrayBuffer(4 + 32 + 4 + 4 + numParts * 4 + numPoints * 16);
  const dv = new DataView(buf);
  let off = 0;
  dv.setInt32(off, 5, true); off += 4;
  let xn = Infinity, yn = Infinity, xx = -Infinity, yx = -Infinity;
  for (const ring of rings) for (const [x, y] of ring) {
    if (x < xn) xn = x; if (y < yn) yn = y;
    if (x > xx) xx = x; if (y > yx) yx = y;
  }
  dv.setFloat64(off, xn, true); off += 8;
  dv.setFloat64(off, yn, true); off += 8;
  dv.setFloat64(off, xx, true); off += 8;
  dv.setFloat64(off, yx, true); off += 8;
  dv.setInt32(off, numParts, true); off += 4;
  dv.setInt32(off, numPoints, true); off += 4;
  let pi = 0;
  for (const ring of rings) { dv.setInt32(off, pi, true); off += 4; pi += ring.length; }
  for (const ring of rings) for (const [x, y] of ring) {
    dv.setFloat64(off, x, true); off += 8;
    dv.setFloat64(off, y, true); off += 8;
  }
  return new Uint8Array(buf);
}

function concatUint8(...arrays) {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

function buildShpAndShx(features) {
  const contents = features.map(f => buildShpContent(f.geometry));
  let xn = Infinity, yn = Infinity, xx = -Infinity, yx = -Infinity;
  for (const f of features) for (const ring of shpGeomRings(f.geometry)) for (const [x, y] of ring) {
    if (x < xn) xn = x; if (y < yn) yn = y;
    if (x > xx) xx = x; if (y > yx) yx = y;
  }
  if (!isFinite(xn)) { xn = yn = xx = yx = 0; }

  function makeFileHeader(fileWords) {
    const b = new ArrayBuffer(100);
    const d = new DataView(b);
    d.setInt32(0, 9994, false);
    d.setInt32(24, fileWords, false);
    d.setInt32(28, 1000, true);
    d.setInt32(32, 5, true);
    d.setFloat64(36, xn, true); d.setFloat64(44, yn, true);
    d.setFloat64(52, xx, true); d.setFloat64(60, yx, true);
    return new Uint8Array(b);
  }

  const recParts = [];
  for (let i = 0; i < features.length; i++) {
    const rh = new ArrayBuffer(8);
    const rd = new DataView(rh);
    rd.setInt32(0, i + 1, false);
    rd.setInt32(4, contents[i].length / 2, false);
    recParts.push(new Uint8Array(rh), contents[i]);
  }
  const totalRecBytes = recParts.reduce((s, a) => s + a.length, 0);
  const shp = concatUint8(makeFileHeader((100 + totalRecBytes) / 2), ...recParts);

  const shxBody = new ArrayBuffer(features.length * 8);
  const shxDv = new DataView(shxBody);
  let shpOff = 100;
  for (let i = 0; i < features.length; i++) {
    shxDv.setInt32(i * 8, shpOff / 2, false);
    shxDv.setInt32(i * 8 + 4, contents[i].length / 2, false);
    shpOff += 8 + contents[i].length;
  }
  const shx = concatUint8(makeFileHeader((100 + features.length * 8) / 2), new Uint8Array(shxBody));
  return { shp, shx };
}

const SHP_FIELDS = [
  { name: 'id',        length: 20 },
  { name: 'name',      length: 100 },
  { name: 'level',     length: 10 },
  { name: 'parent_id', length: 20 },
  { name: 'region_id', length: 20 },
  { name: 'cntrd_lat', length: 20 },
  { name: 'cntrd_lon', length: 20 },
  { name: 'bbox_w',    length: 20 },
  { name: 'bbox_s',    length: 20 },
  { name: 'bbox_e',    length: 20 },
  { name: 'bbox_n',    length: 20 },
];

function buildDbf(rows) {
  const recSize = 1 + SHP_FIELDS.reduce((s, f) => s + f.length, 0);
  const hdrSize = 32 + SHP_FIELDS.length * 32 + 1;
  const buf = new ArrayBuffer(hdrSize + rows.length * recSize + 1);
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  const now = new Date();
  dv.setUint8(0, 0x03);
  dv.setUint8(1, now.getFullYear() % 100);
  dv.setUint8(2, now.getMonth() + 1);
  dv.setUint8(3, now.getDate());
  dv.setInt32(4, rows.length, true);
  dv.setUint16(8, hdrSize, true);
  dv.setUint16(10, recSize, true);
  dv.setUint8(29, 0x62); // LDID Windows-1254 Turkish
  let off = 32;
  for (const field of SHP_FIELDS) {
    const nb = new TextEncoder().encode(field.name.slice(0, 10));
    u8.set(nb, off);
    dv.setUint8(off + 11, 0x43); // 'C'
    dv.setUint8(off + 16, field.length);
    off += 32;
  }
  dv.setUint8(off++, 0x0D);
  for (const row of rows) {
    dv.setUint8(off++, 0x20);
    for (const field of SHP_FIELDS) {
      writeISO88599Field(u8, off, row[field.name], field.length);
      off += field.length;
    }
  }
  dv.setUint8(off, 0x1A);
  return u8;
}

export async function buildShapefileZipBlob(features, metadataItems, levelName, JSZipImpl = globalThis.JSZip) {
  if (!JSZipImpl) throw new Error('JSZip kullanılamıyor.');
  const { shp, shx } = buildShpAndShx(features);
  const dbfRows = metadataItems.map(item => ({
    id: item.id ?? '',
    name: item.name ?? '',
    level: item.level ?? '',
    parent_id: item.parent_id ?? '',
    region_id: item.region_id ?? '',
    cntrd_lat: item.centroid?.lat ?? '',
    cntrd_lon: item.centroid?.lon ?? '',
    bbox_w: item.bbox?.[0] ?? '',
    bbox_s: item.bbox?.[1] ?? '',
    bbox_e: item.bbox?.[2] ?? '',
    bbox_n: item.bbox?.[3] ?? '',
  }));
  const dbf = buildDbf(dbfRows);
  const prj = new TextEncoder().encode(WGS84_PRJ_STR);
  const zip = new JSZipImpl();
  zip.file(`${levelName}.shp`, shp);
  zip.file(`${levelName}.shx`, shx);
  zip.file(`${levelName}.dbf`, dbf);
  zip.file(`${levelName}.prj`, prj);
  zip.file(`${levelName}.cpg`, new TextEncoder().encode('1254'));
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

export async function buildKmzBlobFromKml(kmlString, JSZipImpl = globalThis.JSZip) {
  if (!JSZipImpl) {
    throw new Error('JSZip kullanılamıyor.');
  }

  const zip = new JSZipImpl();
  zip.file('doc.kml', kmlString);

  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    mimeType: 'application/vnd.google-earth.kmz',
  });
}
