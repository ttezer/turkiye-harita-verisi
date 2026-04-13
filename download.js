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
  return items.map((item) => ({
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
    aliases: JSON.stringify(item.aliases || []),
    member_ids: JSON.stringify(item.member_ids || []),
    bbox_min_lon: item.bbox?.[0] ?? '',
    bbox_min_lat: item.bbox?.[1] ?? '',
    bbox_max_lon: item.bbox?.[2] ?? '',
    bbox_max_lat: item.bbox?.[3] ?? '',
    centroid_lat: item.centroid?.lat ?? '',
    centroid_lon: item.centroid?.lon ?? '',
    geometry_wkt: geometryToWkt(geometryById.get(item.id)),
  }));
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
      .map(([key, value]) => `<Data name="${xmlEscape(key)}"><value>${xmlEscape(value)}</value></Data>`)
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
    ...styleDefinitions,
    placemarks,
    '</Document>',
    '</kml>',
    '',
  ].join('');
}

export function buildKmlDescription(item, properties) {
  const lines = [];
  const labels = {
    id: 'ID',
    name: 'Ad',
    parent_id: 'İl ID',
    parent_name: 'İl Adı',
    region_id: 'Bölge ID',
    region_name: 'Bölge Adı',
    level: 'Seviye',
  };

  for (const [key, value] of Object.entries(properties)) {
    if (value === null || value === undefined || value === '') {
      continue;
    }
    lines.push(`${labels[key] || key}: ${value}`);
  }

  return lines.length > 0 ? lines.join('\n') : item.id;
}

export function geometryToKml(geometry) {
  const ringToKml = (ring) => simplifyKmlRing(ring).map(([lon, lat]) => `${lon},${lat},0`).join(' ');
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

  return '';
}

function simplifyKmlRing(ring) {
  const cleaned = ring.filter((point) => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]));
  if (cleaned.length <= 12) {
    return cleaned;
  }

  const isClosed = cleaned.length > 1
    && cleaned[0][0] === cleaned.at(-1)[0]
    && cleaned[0][1] === cleaned.at(-1)[1];
  const openRing = isClosed ? cleaned.slice(0, -1) : cleaned;
  const simplified = douglasPeucker(openRing, 0.0035);
  const normalized = simplified.length >= 3 ? simplified : openRing;

  if (normalized.length < 3) {
    return cleaned;
  }

  return [...normalized, normalized[0]];
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
