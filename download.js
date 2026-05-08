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

export function featureCollectionToGml(
  name,
  metadata,
  geometryCollection,
  propertyBuilder,
  options = {},
) {
  const metadataById = new Map(metadata.map((item) => [item.id, item]));
  const featureTypeName = sanitizeXmlTagName(options.featureTypeName || 'feature');
  const namespacePrefix = options.namespacePrefix || 'tm';
  const namespaceUri = options.namespaceUri || 'https://turkiye-map.local/gml';
  const geometryPropertyName = sanitizeXmlTagName(options.geometryPropertyName || 'geometry');
  const srsName = options.srsName || 'urn:ogc:def:crs:OGC::CRS84';

  const members = geometryCollection.features.map((feature) => {
    const item = metadataById.get(feature.properties.id);
    if (!item) {
      return '';
    }

    const properties = propertyBuilder(item) || {};
    const propertyNodes = Object.entries(properties)
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => {
        const tagName = sanitizeXmlTagName(key);
        return `<${namespacePrefix}:${tagName}>${xmlEscape(value)}</${namespacePrefix}:${tagName}>`;
      })
      .join('');

    return [
      '<gml:featureMember>',
      `<${namespacePrefix}:${featureTypeName} gml:id="${xmlEscape(item.id)}">`,
      propertyNodes,
      `<${namespacePrefix}:${geometryPropertyName}>${geometryToGml(feature.geometry, { srsName })}</${namespacePrefix}:${geometryPropertyName}>`,
      `</${namespacePrefix}:${featureTypeName}>`,
      '</gml:featureMember>',
    ].join('');
  }).join('');

  const bbox = geometryCollectionBbox(geometryCollection);
  const boundedBy = bbox
    ? [
        '<gml:boundedBy>',
        `<gml:Envelope srsName="${xmlEscape(srsName)}">`,
        `<gml:lowerCorner>${bbox[0]} ${bbox[1]}</gml:lowerCorner>`,
        `<gml:upperCorner>${bbox[2]} ${bbox[3]}</gml:upperCorner>`,
        '</gml:Envelope>',
        '</gml:boundedBy>',
      ].join('')
    : '';

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<gml:FeatureCollection xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:${namespacePrefix}="${xmlEscape(namespaceUri)}">`,
    `<gml:name>${xmlEscape(name)}</gml:name>`,
    boundedBy,
    members,
    '</gml:FeatureCollection>',
    '',
  ].join('');
}

function sanitizeOsmTagKey(key) {
  return String(key)
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9:_-]+/g, '_')
    .replaceAll(/^_+|_+$/g, '');
}

function normalizeOsmTagValue(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  if (Array.isArray(value)) {
    return value.join(';');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function ensureClosedRing(ring) {
  if (!Array.isArray(ring) || ring.length === 0) {
    return [];
  }
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) {
    return ring;
  }
  return [...ring, first];
}

function geometryBounds(geometry) {
  if (!geometry?.coordinates) {
    return null;
  }

  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  const visit = (coordinates) => {
    if (!Array.isArray(coordinates)) {
      return;
    }
    if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
      bounds[0] = Math.min(bounds[0], coordinates[0]);
      bounds[1] = Math.min(bounds[1], coordinates[1]);
      bounds[2] = Math.max(bounds[2], coordinates[0]);
      bounds[3] = Math.max(bounds[3], coordinates[1]);
      return;
    }
    coordinates.forEach(visit);
  };

  visit(geometry.coordinates);
  return bounds.every(Number.isFinite) ? bounds : null;
}

function mergeBounds(left, right) {
  if (!left) return right;
  if (!right) return left;
  return [
    Math.min(left[0], right[0]),
    Math.min(left[1], right[1]),
    Math.max(left[2], right[2]),
    Math.max(left[3], right[3]),
  ];
}

function getOsmBoundaryType(level) {
  if (level === 'region') {
    return 'statistical';
  }
  return 'administrative';
}

function getOsmAdminLevel(level) {
  const levels = {
    province: '4',
    district: '6',
    mahalle: '10',
    yerlesim: '10',
  };
  return levels[level] || '';
}

export function featureCollectionToOsm(name, metadata, geometryCollection, propertyBuilder) {
  const metadataById = new Map(metadata.map((item) => [item.id, item]));
  const nodes = [];
  const ways = [];
  const relations = [];
  let nextNodeId = -1;
  let nextWayId = -1;
  let nextRelationId = -1;
  let bounds = null;

  const createNodeRefs = (ring) => ensureClosedRing(ring).map(([lon, lat]) => {
    const id = nextNodeId--;
    nodes.push({ id, lon, lat });
    return id;
  });

  const buildTags = (item) => {
    const rawTags = {
      name: item.name || item.id,
      boundary: getOsmBoundaryType(item.level),
      admin_level: getOsmAdminLevel(item.level),
      source: item.source_label || item.source || 'turkiye_map',
      'turkiye_map:id': item.id,
      'turkiye_map:level': item.level || '',
      ...(propertyBuilder ? propertyBuilder(item) : {}),
    };

    return Object.entries(rawTags)
      .map(([key, value]) => [sanitizeOsmTagKey(key), normalizeOsmTagValue(value)])
      .filter(([key, value]) => key && value);
  };

  for (const feature of geometryCollection.features) {
    const item = metadataById.get(feature.properties.id);
    if (!item) {
      continue;
    }

    bounds = mergeBounds(bounds, geometryBounds(feature.geometry));
    const tags = buildTags(item);
    const polygonSets = feature.geometry.type === 'Polygon'
      ? [feature.geometry.coordinates]
      : feature.geometry.type === 'MultiPolygon'
        ? feature.geometry.coordinates
        : [];

    const members = [];

    for (const polygon of polygonSets) {
      polygon.forEach((ring, ringIndex) => {
        const wayId = nextWayId--;
        const nodeRefs = createNodeRefs(ring);
        ways.push({
          id: wayId,
          nodeRefs,
          tags: [],
        });
        members.push({
          type: 'way',
          ref: wayId,
          role: ringIndex === 0 ? 'outer' : 'inner',
        });
      });
    }

    if (members.length === 1 && feature.geometry.type === 'Polygon') {
      ways[ways.length - 1].tags = tags;
      continue;
    }

    relations.push({
      id: nextRelationId--,
      members,
      tags: [['type', 'multipolygon'], ...tags],
    });
  }

  const boundsMarkup = bounds
    ? `<bounds minlon="${bounds[0]}" minlat="${bounds[1]}" maxlon="${bounds[2]}" maxlat="${bounds[3]}"/>`
    : '';

  const nodeMarkup = nodes
    .map((node) => `<node id="${node.id}" lon="${node.lon}" lat="${node.lat}"/>`)
    .join('');

  const wayMarkup = ways
    .map((way) => [
      `<way id="${way.id}">`,
      ...way.nodeRefs.map((ref) => `<nd ref="${ref}"/>`),
      ...way.tags.map(([key, value]) => `<tag k="${xmlEscape(key)}" v="${xmlEscape(value)}"/>`),
      '</way>',
    ].join(''))
    .join('');

  const relationMarkup = relations
    .map((relation) => [
      `<relation id="${relation.id}">`,
      ...relation.members.map((member) => `<member type="${member.type}" ref="${member.ref}" role="${member.role}"/>`),
      ...relation.tags.map(([key, value]) => `<tag k="${xmlEscape(key)}" v="${xmlEscape(value)}"/>`),
      '</relation>',
    ].join(''))
    .join('');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<osm version="0.6" generator="${xmlEscape(name)}">`,
    boundsMarkup,
    nodeMarkup,
    wayMarkup,
    relationMarkup,
    '</osm>',
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

export function geometryToGml(geometry, options = {}) {
  const srsName = options.srsName || 'urn:ogc:def:crs:OGC::CRS84';
  const ringToPosList = (ring) => normalizeKmlRing(ring)
    .map(([lon, lat]) => `${lon} ${lat}`)
    .join(' ');
  const polygonToGml = (polygon, includeSrsName = true) => {
    const [outerBoundary, ...innerBoundaries] = polygon;
    return [
      `<gml:Polygon${includeSrsName ? ` srsName="${xmlEscape(srsName)}"` : ''}>`,
      '<gml:exterior>',
      '<gml:LinearRing>',
      `<gml:posList srsDimension="2">${ringToPosList(outerBoundary)}</gml:posList>`,
      '</gml:LinearRing>',
      '</gml:exterior>',
      ...innerBoundaries.map((ring) => [
        '<gml:interior>',
        '<gml:LinearRing>',
        `<gml:posList srsDimension="2">${ringToPosList(ring)}</gml:posList>`,
        '</gml:LinearRing>',
        '</gml:interior>',
      ].join('')),
      '</gml:Polygon>',
    ].join('');
  };

  if (geometry.type === 'Polygon') {
    return polygonToGml(geometry.coordinates);
  }

  if (geometry.type === 'MultiPolygon') {
    return [
      `<gml:MultiSurface srsName="${xmlEscape(srsName)}">`,
      ...geometry.coordinates.map((polygon) => `<gml:surfaceMember>${polygonToGml(polygon, false)}</gml:surfaceMember>`),
      '</gml:MultiSurface>',
    ].join('');
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

function sanitizeXmlTagName(value) {
  const normalized = String(value || 'field')
    .trim()
    .replaceAll(/[^A-Za-z0-9_.-]+/g, '_')
    .replaceAll(/_{2,}/g, '_')
    .replaceAll(/^_+|_+$/g, '');
  const base = normalized || 'field';
  return /^[A-Za-z_]/.test(base) ? base : `_${base}`;
}

function formatPdfNumber(value) {
  return Number(value.toFixed(2)).toString();
}

function toAsciiText(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapePdfLiteral(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}

function parseCssColor(value, fallback = { r: 255, g: 255, b: 255, a: 1 }) {
  if (!value || value === 'none' || value === 'transparent') {
    return null;
  }

  const hexMatch = /^#([0-9a-fA-F]{6})$/.exec(value);
  if (hexMatch) {
    const hex = hexMatch[1];
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: 1,
    };
  }

  const rgbMatch = /^rgba?\(([^)]+)\)$/.exec(value);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(',').map((part) => Number(part.trim()));
    if (parts.length >= 3 && parts.slice(0, 3).every(Number.isFinite)) {
      return {
        r: parts[0],
        g: parts[1],
        b: parts[2],
        a: Number.isFinite(parts[3]) ? parts[3] : 1,
      };
    }
  }

  return fallback;
}

function blendOnWhite(color) {
  if (!color) {
    return null;
  }

  const alpha = Number.isFinite(color.a) ? Math.max(0, Math.min(1, color.a)) : 1;
  return {
    r: Math.round((color.r * alpha) + (255 * (1 - alpha))),
    g: Math.round((color.g * alpha) + (255 * (1 - alpha))),
    b: Math.round((color.b * alpha) + (255 * (1 - alpha))),
  };
}

function pdfRgb(color) {
  return [
    formatPdfNumber(color.r / 255),
    formatPdfNumber(color.g / 255),
    formatPdfNumber(color.b / 255),
  ].join(' ');
}

function svgPathDataToPdfCommands(pathData, pageHeight) {
  if (!pathData) {
    return '';
  }

  const subpaths = pathData
    .split('Z')
    .map((segment) => segment.trim())
    .filter(Boolean);

  const commands = [];

  for (const subpath of subpaths) {
    const matches = [...subpath.matchAll(/([ML])(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)];
    if (matches.length === 0) {
      continue;
    }

    for (const [, verb, xRaw, yRaw] of matches) {
      const x = Number(xRaw);
      const y = pageHeight - Number(yRaw);
      commands.push(`${formatPdfNumber(x)} ${formatPdfNumber(y)} ${verb === 'M' ? 'm' : 'l'}`);
    }
    commands.push('h');
  }

  return commands.join('\n');
}

function buildPdfObjects(documentBody, infoTitle) {
  const objects = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objects.push('2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n');
  objects.push(documentBody.pageObject);
  objects.push(documentBody.contentObject);
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');
  objects.push(
    `6 0 obj\n<< /Producer (${escapePdfLiteral('turkiye_map')}) /Creator (${escapePdfLiteral('turkiye_map export')}) /Title (${escapePdfLiteral(infoTitle)}) >>\nendobj\n`,
  );
  return objects;
}

export function buildPdfDocumentBlob(
  {
    width = 1920,
    height = 1080,
    title = 'Turkiye Haritasi',
    subtitle = '',
    backgroundColor = '#ffffff',
    paths = [],
  } = {},
) {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 1920;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 1080;
  const titleText = toAsciiText(title) || 'Turkiye Haritasi';
  const subtitleText = toAsciiText(subtitle);

  const contentLines = ['q'];
  const pageColor = blendOnWhite(parseCssColor(backgroundColor));
  if (pageColor) {
    contentLines.push(`${pdfRgb(pageColor)} rg`);
    contentLines.push(`0 0 ${formatPdfNumber(safeWidth)} ${formatPdfNumber(safeHeight)} re f`);
  }
  contentLines.push('Q');

  if (titleText) {
    contentLines.push('BT');
    contentLines.push('/F1 22 Tf');
    contentLines.push(`36 ${formatPdfNumber(safeHeight - 34)} Td`);
    contentLines.push(`(${escapePdfLiteral(titleText)}) Tj`);
    if (subtitleText) {
      contentLines.push('0 -18 Td');
      contentLines.push('/F1 11 Tf');
      contentLines.push(`(${escapePdfLiteral(subtitleText)}) Tj`);
    }
    contentLines.push('ET');
  }

  for (const path of paths) {
    const pathCommands = svgPathDataToPdfCommands(path.d, safeHeight);
    if (!pathCommands) {
      continue;
    }

    const fillColor = blendOnWhite(parseCssColor(path.fill));
    const strokeColor = blendOnWhite(parseCssColor(path.stroke, { r: 66, g: 83, b: 143, a: 1 }));
    const lineWidth = Number.isFinite(path.lineWidth) ? Math.max(0.1, path.lineWidth) : 1;

    contentLines.push('q');
    if (fillColor) {
      contentLines.push(`${pdfRgb(fillColor)} rg`);
    }
    if (strokeColor) {
      contentLines.push(`${pdfRgb(strokeColor)} RG`);
    }
    contentLines.push(`${formatPdfNumber(lineWidth)} w`);
    contentLines.push('1 j');
    contentLines.push('1 J');
    contentLines.push(pathCommands);
    contentLines.push(fillColor && strokeColor ? 'B' : fillColor ? 'f' : 'S');
    contentLines.push('Q');
  }

  const content = `${contentLines.join('\n')}\n`;
  const encoder = new TextEncoder();
  const contentBytes = encoder.encode(content);
  const pageObject = [
    '3 0 obj',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${formatPdfNumber(safeWidth)} ${formatPdfNumber(safeHeight)}] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>`,
    'endobj',
    '',
  ].join('\n');
  const contentObject = [
    '4 0 obj',
    `<< /Length ${contentBytes.length} >>`,
    'stream',
    content,
    'endstream',
    'endobj',
    '',
  ].join('\n');

  const objects = buildPdfObjects({ pageObject, contentObject }, titleText);
  const header = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  let body = header;
  let currentOffset = encoder.encode(header).length;
  const offsets = [0];

  for (const object of objects) {
    offsets.push(currentOffset);
    body += object;
    currentOffset += encoder.encode(object).length;
  }

  const xrefOffset = currentOffset;
  const xrefLines = [
    `xref`,
    `0 ${objects.length + 1}`,
    '0000000000 65535 f ',
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `),
    'trailer',
    `<< /Size ${objects.length + 1} /Root 1 0 R /Info 6 0 R >>`,
    'startxref',
    String(xrefOffset),
    '%%EOF',
    '',
  ];

  const pdfBytes = encoder.encode(body + xrefLines.join('\n'));
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

export const GPKG_CRS_OPTIONS = [
  {
    code: 'EPSG:4326',
    label: 'EPSG:4326 · WGS 84',
    srsId: 4326,
    organization: 'EPSG',
    organizationCoordsysId: 4326,
    definition: 'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]]',
    proj4: '+proj=longlat +datum=WGS84 +no_defs +type=crs',
  },
  {
    code: 'EPSG:3857',
    label: 'EPSG:3857 · Web Mercator',
    srsId: 3857,
    organization: 'EPSG',
    organizationCoordsysId: 3857,
    definition: 'PROJCS["WGS 84 / Pseudo-Mercator",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]],PROJECTION["Mercator_1SP"],PARAMETER["central_meridian",0],PARAMETER["scale_factor",1],PARAMETER["false_easting",0],PARAMETER["false_northing",0],UNIT["metre",1]]',
    proj4: '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs +type=crs',
  },
  {
    code: 'EPSG:32635',
    label: 'EPSG:32635 · WGS 84 / UTM zone 35N',
    srsId: 32635,
    organization: 'EPSG',
    organizationCoordsysId: 32635,
    definition: 'PROJCS["WGS 84 / UTM zone 35N",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",27],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",0],UNIT["metre",1]]',
    proj4: '+proj=utm +zone=35 +datum=WGS84 +units=m +no_defs +type=crs',
  },
  {
    code: 'EPSG:32636',
    label: 'EPSG:32636 · WGS 84 / UTM zone 36N',
    srsId: 32636,
    organization: 'EPSG',
    organizationCoordsysId: 32636,
    definition: 'PROJCS["WGS 84 / UTM zone 36N",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",33],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",0],UNIT["metre",1]]',
    proj4: '+proj=utm +zone=36 +datum=WGS84 +units=m +no_defs +type=crs',
  },
  {
    code: 'EPSG:5254',
    label: 'EPSG:5254 · Türkiye yerel',
    srsId: 5254,
    organization: 'EPSG',
    organizationCoordsysId: 5254,
    definition: 'PROJCS["TUREF / TM30",GEOGCS["TUREF",DATUM["Turkish_National_Reference_Frame",SPHEROID["GRS 1980",6378137,298.257222101]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",30],PARAMETER["scale_factor",1],PARAMETER["false_easting",500000],PARAMETER["false_northing",0],UNIT["metre",1]]',
    proj4: '+proj=tmerc +lat_0=0 +lon_0=30 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +towgs84=0.023,0.036,-0.068,0.00176,0.00912,-0.01136,0.00439 +units=m +no_defs +type=crs',
  },
];

const GPKG_CRS_BY_CODE = new Map(GPKG_CRS_OPTIONS.map((item) => [item.code, item]));

function getGpkgCrsDefinition(code) {
  return GPKG_CRS_BY_CODE.get(code) || GPKG_CRS_BY_CODE.get('EPSG:4326');
}

function ensureProjDefinition(proj4Api, crsCode) {
  const definition = getGpkgCrsDefinition(crsCode);
  if (!definition || !proj4Api?.defs) {
    return;
  }
  if (!proj4Api.defs(crsCode)) {
    proj4Api.defs(crsCode, definition.proj4);
  }
}

function transformCoordinateArray(coordinates, sourceCrs, targetCrs, proj4Api) {
  if (!Array.isArray(coordinates)) {
    return coordinates;
  }

  if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
    return proj4Api(sourceCrs, targetCrs, [coordinates[0], coordinates[1]]);
  }

  return coordinates.map((item) => transformCoordinateArray(item, sourceCrs, targetCrs, proj4Api));
}

function transformGeometryToCrs(geometry, targetCrs, proj4Api) {
  if (!geometry || targetCrs === 'EPSG:4326') {
    return geometry;
  }
  if (!proj4Api) {
    throw new Error(`CRS dönüşümü için proj4 yüklenemedi: ${targetCrs}`);
  }

  ensureProjDefinition(proj4Api, 'EPSG:4326');
  ensureProjDefinition(proj4Api, targetCrs);

  return {
    ...geometry,
    coordinates: transformCoordinateArray(geometry.coordinates, 'EPSG:4326', targetCrs, proj4Api),
  };
}

function geometryToMultiPolygon(geometry) {
  if (!geometry) {
    return geometry;
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry;
  }
  if (geometry.type === 'Polygon') {
    return {
      type: 'MultiPolygon',
      coordinates: [geometry.coordinates],
    };
  }
  return geometry;
}

function normalizePolygonalGeometry(geometry, mode = 'auto') {
  if (!geometry) {
    return geometry;
  }

  if (mode === 'auto') {
    return geometry;
  }

  if (mode === 'multiPolygon') {
    return geometryToMultiPolygon(geometry);
  }

  if (mode === 'polygon') {
    if (geometry.type === 'Polygon') {
      return geometry;
    }
    if (geometry.type === 'MultiPolygon' && geometry.coordinates.length === 1) {
      return {
        type: 'Polygon',
        coordinates: geometry.coordinates[0],
      };
    }
    throw new Error('Polygon geometri tipi seçildi ama görünür veri çok parçalı MultiPolygon içeriyor.');
  }

  return geometry;
}

function inferSqlType(rows, key) {
  for (const row of rows) {
    const value = row[key];
    if (value === null || value === undefined || value === '') {
      continue;
    }
    if (typeof value === 'boolean' || Number.isInteger(value)) return 'INTEGER';
    if (typeof value === 'number') return 'REAL';
    return 'TEXT';
  }
  return 'TEXT';
}

function normalizeGpkgValue(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number' || typeof value === 'string') return value;
  return JSON.stringify(value);
}

function writeUint32Little(bytes, offset, value) {
  bytes[offset] = value & 0xFF;
  bytes[offset + 1] = (value >>> 8) & 0xFF;
  bytes[offset + 2] = (value >>> 16) & 0xFF;
  bytes[offset + 3] = (value >>> 24) & 0xFF;
}

function writeFloat64Little(bytes, offset, value) {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value, true);
  for (let index = 0; index < 8; index += 1) {
    bytes[offset + index] = view.getUint8(index);
  }
}

function packPointBytes(point) {
  const bytes = new Uint8Array(16);
  writeFloat64Little(bytes, 0, point[0]);
  writeFloat64Little(bytes, 8, point[1]);
  return bytes;
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function polygonToWkbBytes(geometry) {
  const rings = geometry.coordinates;
  const parts = [];
  const header = new Uint8Array(5);
  header[0] = 1;
  writeUint32Little(header, 1, 3);
  parts.push(header);

  const ringCount = new Uint8Array(4);
  writeUint32Little(ringCount, 0, rings.length);
  parts.push(ringCount);

  for (const ring of rings) {
    const ringHeader = new Uint8Array(4);
    writeUint32Little(ringHeader, 0, ring.length);
    parts.push(ringHeader);
    parts.push(...ring.map(packPointBytes));
  }

  return concatBytes(parts);
}

function multiPolygonToWkbBytes(geometry) {
  const polygons = geometry.coordinates;
  const parts = [];
  const header = new Uint8Array(5);
  header[0] = 1;
  writeUint32Little(header, 1, 6);
  parts.push(header);

  const polygonCount = new Uint8Array(4);
  writeUint32Little(polygonCount, 0, polygons.length);
  parts.push(polygonCount);

  for (const polygon of polygons) {
    parts.push(polygonToWkbBytes({ type: 'Polygon', coordinates: polygon }));
  }

  return concatBytes(parts);
}

function geometryToWkbBytes(geometry) {
  if (geometry.type === 'Polygon') {
    return polygonToWkbBytes(geometry);
  }
  if (geometry.type === 'MultiPolygon') {
    return multiPolygonToWkbBytes(geometry);
  }
  throw new Error(`Unsupported GeoPackage geometry type: ${geometry.type}`);
}

function geometryToGpkgBlob(geometry, srsId) {
  const header = new Uint8Array(8);
  header[0] = 0x47;
  header[1] = 0x50;
  header[2] = 0;
  header[3] = 1;
  writeUint32Little(header, 4, srsId);
  return concatBytes([header, geometryToWkbBytes(geometry)]);
}

function geometryTypeNameForFeatures(features) {
  return features.some((feature) => feature.geometry.type === 'MultiPolygon') ? 'MULTIPOLYGON' : 'POLYGON';
}

function featuresBbox(features) {
  const bbox = [Infinity, Infinity, -Infinity, -Infinity];
  for (const feature of features) {
    const geomBbox = geometryBbox(feature.geometry);
    if (!geomBbox) continue;
    bbox[0] = Math.min(bbox[0], geomBbox[0]);
    bbox[1] = Math.min(bbox[1], geomBbox[1]);
    bbox[2] = Math.max(bbox[2], geomBbox[2]);
    bbox[3] = Math.max(bbox[3], geomBbox[3]);
  }
  return bbox.every(Number.isFinite) ? bbox : null;
}

async function loadSqlJsModule(initSqlJsFn) {
  if (!initSqlJsFn) {
    throw new Error('GeoPackage üretimi için sql.js yüklenemedi.');
  }

  if (!globalThis.__turkiyeMapSqlJsPromise) {
    globalThis.__turkiyeMapSqlJsPromise = initSqlJsFn({
      locateFile: (file) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/${file}`,
    });
  }

  return globalThis.__turkiyeMapSqlJsPromise;
}

export async function buildGeoPackageBlob(
  features,
  metadataItems,
  layerName,
  {
    selectedFields = [],
    crs = 'EPSG:4326',
    geometryMode = 'auto',
    initSqlJsFn = globalThis.initSqlJs,
    proj4Api = globalThis.proj4,
  } = {},
) {
  const crsDef = getGpkgCrsDefinition(crs);
  const visibleFeatures = features.map((feature) => ({
    ...feature,
    geometry: normalizePolygonalGeometry(
      transformGeometryToCrs(feature.geometry, crs, proj4Api),
      geometryMode,
    ),
  }));
  const featureById = new Map(visibleFeatures.map((feature) => [feature.properties.id, feature]));
  const missingIds = metadataItems.filter((item) => !featureById.has(item.id)).map((item) => item.id);
  if (missingIds.length > 0) {
    throw new Error(`GeoPackage üretilemedi; geometri bulunamayan kayıtlar var: ${missingIds.slice(0, 10).join(', ')}`);
  }

  const transformedGeometryById = new Map(visibleFeatures.map((feature) => [feature.properties.id, feature.geometry]));
  const normalizedItems = metadataItems.map((item) => ({
    ...item,
    bbox: null,
    centroid: null,
  }));
  const rows = buildTabularRows(normalizedItems, transformedGeometryById)
    .map((row) => ({ ...row, coordinate_system: crs }));
  const finalFields = selectedFields.length > 0 ? selectedFields.filter((field) => field !== 'geometry_wkt') : ['id', 'name'];
  const tableRows = rows.map((row) => pickFields(row, finalFields));
  const geometryTypeName = geometryTypeNameForFeatures(visibleFeatures);
  const bbox = featuresBbox(visibleFeatures);

  const SQL = await loadSqlJsModule(initSqlJsFn);
  const db = new SQL.Database();

  db.exec(`
    PRAGMA application_id = 1196444487;
    PRAGMA user_version = 10300;
    CREATE TABLE gpkg_spatial_ref_sys (
      srs_name TEXT NOT NULL,
      srs_id INTEGER NOT NULL PRIMARY KEY,
      organization TEXT NOT NULL,
      organization_coordsys_id INTEGER NOT NULL,
      definition TEXT NOT NULL,
      description TEXT
    );
    CREATE TABLE gpkg_contents (
      table_name TEXT NOT NULL PRIMARY KEY,
      data_type TEXT NOT NULL,
      identifier TEXT UNIQUE,
      description TEXT DEFAULT '',
      last_change DATETIME NOT NULL,
      min_x DOUBLE,
      min_y DOUBLE,
      max_x DOUBLE,
      max_y DOUBLE,
      srs_id INTEGER
    );
    CREATE TABLE gpkg_geometry_columns (
      table_name TEXT NOT NULL,
      column_name TEXT NOT NULL,
      geometry_type_name TEXT NOT NULL,
      srs_id INTEGER NOT NULL,
      z TINYINT NOT NULL,
      m TINYINT NOT NULL,
      PRIMARY KEY (table_name, column_name)
    );
  `);

  db.run(
    'INSERT INTO gpkg_spatial_ref_sys (srs_name, srs_id, organization, organization_coordsys_id, definition, description) VALUES (?, ?, ?, ?, ?, ?)',
    [
      crsDef.label,
      crsDef.srsId,
      crsDef.organization,
      crsDef.organizationCoordsysId,
      crsDef.definition,
      `Export CRS ${crsDef.code}`,
    ],
  );

  const columns = tableRows.length > 0 ? Object.keys(tableRows[0]) : ['id', 'name'];
  const columnDefinitions = columns.map((column) => `${quoteSqlIdentifier(column)} ${inferSqlType(tableRows, column)}`);
  db.exec(`CREATE TABLE ${quoteSqlIdentifier(layerName)} (fid INTEGER PRIMARY KEY AUTOINCREMENT, geom BLOB NOT NULL, ${columnDefinitions.join(', ')})`);

  const insertColumns = ['geom', ...columns];
  const placeholders = insertColumns.map(() => '?').join(', ');
  const insertStatement = db.prepare(
    `INSERT INTO ${quoteSqlIdentifier(layerName)} (${insertColumns.map(quoteSqlIdentifier).join(', ')}) VALUES (${placeholders})`,
  );

  for (let index = 0; index < tableRows.length; index += 1) {
    const row = tableRows[index];
    const feature = featureById.get(rows[index].id);
    insertStatement.run([
      geometryToGpkgBlob(feature.geometry, crsDef.srsId),
      ...columns.map((column) => normalizeGpkgValue(row[column])),
    ]);
  }
  insertStatement.free();

  const now = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z');
  db.run(
    `INSERT INTO gpkg_contents (table_name, data_type, identifier, description, last_change, min_x, min_y, max_x, max_y, srs_id)
     VALUES (?, 'features', ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      layerName,
      layerName,
      `${layerName} export`,
      now,
      bbox?.[0] ?? null,
      bbox?.[1] ?? null,
      bbox?.[2] ?? null,
      bbox?.[3] ?? null,
      crsDef.srsId,
    ],
  );
  db.run(
    'INSERT INTO gpkg_geometry_columns (table_name, column_name, geometry_type_name, srs_id, z, m) VALUES (?, ?, ?, ?, 0, 0)',
    [layerName, 'geom', geometryTypeName, crsDef.srsId],
  );

  const bytes = db.export();
  db.close();

  return new Blob([bytes], {
    type: 'application/geopackage+sqlite3',
  });
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
