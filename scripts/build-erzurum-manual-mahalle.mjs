import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DOMParser } from '@xmldom/xmldom';
import * as toGeoJSON from '@tmcw/togeojson';
import polygonClipping from 'polygon-clipping';

const root = process.cwd();
const manualDir = join(root, 'source', 'mahalle-manual', '25-erzurum');
const bbKmlPath = join(root, 'data', 'erzurum-mahalle-sources-2026-11-15', 'erzurum-bb', 'erzurum-bb-aktar3-mahalle.kml');
const canonicalKmlPath = join(root, 'data', 'erzurum-mahalle-sources-2026-11-15', 'resmi-adlandirilmis', 'erzurum-bulutkbs-resmi-adlandirilmis.kml');
const officialPath = join(root, 'dist', 'json', 'yerlesimler.json');
const outputPath = join(manualDir, 'erzurum-mahalle-manual.kml');

function key(value) {
  return String(value ?? '')
    .replace(/İ/g, 'I')
    .replace(/ı/g, 'i')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function districtKey(value) {
  return key(value);
}

function polygons(geometry) {
  if (geometry?.type === 'Polygon') return [geometry.coordinates];
  if (geometry?.type === 'MultiPolygon') return geometry.coordinates;
  if (geometry?.type === 'GeometryCollection') {
    return (geometry.geometries || []).flatMap(polygons);
  }
  return [];
}

function ringArea(ring) {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    area += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return Math.abs(area) / 2;
}

function geometryArea(geometry) {
  return polygons(geometry).reduce((sum, polygon) => (
    sum + ringArea(polygon[0]) - polygon.slice(1).reduce((holes, ring) => holes + ringArea(ring), 0)
  ), 0);
}

function bbox(geometry) {
  const result = [Infinity, Infinity, -Infinity, -Infinity];
  for (const polygon of polygons(geometry)) {
    for (const ring of polygon) {
      for (const point of ring) {
        result[0] = Math.min(result[0], point[0]);
        result[1] = Math.min(result[1], point[1]);
        result[2] = Math.max(result[2], point[0]);
        result[3] = Math.max(result[3], point[1]);
      }
    }
  }
  return result;
}

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function coordinatesText(ring) {
  return ring.map(([lon, lat, altitude = 0]) => `${lon},${lat},${altitude}`).join(' ');
}

function polygonKml(polygon) {
  const [outer, ...holes] = polygon || [];
  if (!outer || outer.length < 4) return '';
  const boundary = (tag, ring) => `<${tag}><LinearRing><coordinates>${coordinatesText(ring)}</coordinates></LinearRing></${tag}>`;
  return `<Polygon>${boundary('outerBoundaryIs', outer)}${holes.map((ring) => boundary('innerBoundaryIs', ring)).join('')}</Polygon>`;
}

function geometryKml(geometry) {
  const parts = polygons(geometry).map(polygonKml).filter(Boolean);
  return parts.length === 1 ? parts[0] : `<MultiGeometry>${parts.join('')}</MultiGeometry>`;
}

function data(name, value) {
  return `<Data name="${xmlEscape(name)}"><value>${xmlEscape(value)}</value></Data>`;
}

function explicitAliases() {
  const entries = [
    ['Aşkale', 'Pırnakaban', 'Aşkale', 'Pırnakapan'],
    ['Aşkale', 'Üç mart', 'Aşkale', '3 Mart'],
    ['Aşkale', 'Çiftlik bucağı çatören', 'Aşkale', 'Çatören'],
    ['Aşkale', 'Merkez bucağı çatören', 'Aşkale', 'Merkez Çatören'],
    ['Aşkale', 'Merkez bucağı gölören', 'Aşkale', 'Merkez Gölören'],
    ['Aşkale', 'Nahiye gölören', 'Aşkale', 'Gölören'],
    ['Aziziye', 'Gez köyüosb', 'Aziziye', 'Gezköy'],
    ['Aziziye', 'Kapulu', 'Aziziye', 'Kapılı'],
    ['Aziziye', 'Sarıyayla', 'Aziziye', 'Sarıyazla'],
    ['Aziziye', 'Söğütlü (ovacık)', 'Aziziye', 'Ovacık Söğütlü'],
    ['Çat', 'Aşağıçat', 'Çat', 'Aşağıçatköy'],
    ['Hınıs', 'Alikırı', 'Hınıs', 'Alikırı Abdalan'],
    ['Hınıs', 'Arpaderesi', 'Hınıs', 'Arpadere'],
    ['Hınıs', 'Erbeyli', 'Hınıs', 'Elbeyli'],
    ['Hınıs', 'Gülistan', 'Hınıs', 'Gülüstan'],
    ['Hınıs', 'Mezra', 'Hınıs', 'Mezraa'],
    ['Hınıs', 'Taşbudak', 'Hınıs', 'Taşbulak'],
    ['Horasan', 'Azap', 'Horasan', 'Azapköy'],
    ['Horasan', 'Bahçe', 'Horasan', 'Bahçeköy'],
    ['Horasan', 'Çiftlik', 'Horasan', 'Çiftlikköy'],
    ['Horasan', 'Pınar', 'Horasan', 'Pinarli'],
    ['İspir', 'Ardıçlı', 'İspir', 'Ardışlı'],
    ['İspir', 'Koç', 'İspir', 'Koçköy'],
    ['Karaçoban', 'Bozyar', 'Karaçoban', 'Bozyer'],
    ['Karaçoban', 'Gündüz', 'Karaçoban', 'Gündüzköy'],
    ['Karaçoban', 'Maruf', 'Karaçoban', 'Marufköy'],
    ['Karayazı', 'Dündar', 'Karayazı', 'Dündarköy'],
    ['Karayazı', 'Kırıkpınar', 'Karayazı', 'Kırkpınar'],
    ['Narman', 'Camiikebir', 'Narman', 'Camikebir'],
    ['Narman', 'Camiisağır', 'Narman', 'Camisağır'],
    ['Oltu', 'İnci', 'Oltu', 'İnciköy'],
    ['Oltu', 'İpekçayırı', 'Oltu', 'İpekçayır'],
    ['Oltu', 'Tuzla', 'Narman', 'Tuzla'],
    ['Olur', 'Süngübayır', 'Olur', 'Süngübayırı'],
    ['Palandöken', 'Adnan Menderes', 'Palandöken', 'A.Menderes'],
    ['Palandöken', 'Ali Bezirgan', 'Palandöken', 'Alibezirgan'],
    ['Palandöken', 'Güllü', 'Palandöken', 'Güllüköy'],
    ['Palandöken', 'Yıkılgan', 'Palandöken', 'Yıkılhan'],
    ['Pasinler', 'Ali Bezirgan', 'Palandöken', 'Alibezirgan'],
    ['Pasinler', 'Camikebir', 'Pasinler', 'Camiikebir'],
    ['Pasinler', 'Cennetpınarı', 'Pazaryolu', 'Cenetpınarı'],
    ['Pasinler', 'Kurbançayır', 'Pasinler', 'Kurbançayırı'],
    ['Pazaryolu', 'Cennetpınarı', 'Pazaryolu', 'Cenetpınarı'],
    ['Şenkaya', 'Zümrüt', 'Şenkaya', 'Zümrütköy'],
    ['Tekman', 'Kırıkan', 'Tekman', 'Kırıkhan'],
    ['Tortum', 'Alparslan', 'Tortum', 'Alpaslan'],
    ['Tortum', 'Pehlivanlı', 'Uzundere', 'Pehlivanlı'],
    ['Yakutiye', 'Yazı Pınarı', 'Yakutiye', 'Yazıpınar'],
  ];
  return new Map(entries.map(([sourceDistrict, sourceName, targetDistrict, targetName]) => [
    `${districtKey(sourceDistrict)}|${key(sourceName)}`,
    { district: targetDistrict, name: targetName },
  ]));
}

function parseKml(xml) {
  return toGeoJSON.kml(new DOMParser().parseFromString(xml, 'text/xml'));
}

function chooseByName(properties, officialByDistrictName, officialByName, aliases) {
  const sourceDistrict = properties.district;
  const sourceName = properties.mahalle || properties.name;
  const alias = aliases.get(`${districtKey(sourceDistrict)}|${key(sourceName)}`);
  if (alias) {
    return officialByDistrictName.get(`${districtKey(alias.district)}|${key(alias.name)}`) || null;
  }

  const candidates = officialByName.get(key(sourceName)) || [];
  const sameDistrict = candidates.filter((item) => districtKey(item.district_name) === districtKey(sourceDistrict));
  if (sameDistrict.length === 1) return sameDistrict[0];
  if (candidates.length === 1) return candidates[0];
  return null;
}

function bestSpatialMatch(feature, canonical) {
  const sourceBbox = bbox(feature.geometry);
  const sourceArea = geometryArea(feature.geometry);
  let best = null;
  for (const candidate of canonical) {
    const b = candidate.bbox;
    if (sourceBbox[2] <= b[0] || b[2] <= sourceBbox[0] || sourceBbox[3] <= b[1] || b[3] <= sourceBbox[1]) continue;
    let overlapArea = 0;
    try {
      overlapArea = geometryArea({
        type: 'MultiPolygon',
        coordinates: polygonClipping.intersection(polygons(feature.geometry), polygons(candidate.geometry)),
      });
    } catch {
      continue;
    }
    if (!overlapArea) continue;
    const score = overlapArea / Math.min(sourceArea, candidate.area);
    if (!best || score > best.score) best = { candidate, score };
  }
  return best;
}

function buildKml(features) {
  const placemarks = features.map(({ feature, settlement }) => {
    const properties = settlement;
    const description = `İlçe: ${properties.district_name}\nTip: Mahalle\nMahalle ID: ${properties.id}`;
    return [
      '<Placemark>',
      `<name>${xmlEscape(properties.name)}</name>`,
      `<description>${xmlEscape(description)}</description>`,
      '<ExtendedData>',
      data('district', properties.district_name),
      data('mahalle_id', properties.id),
      data('type', 'Mahalle'),
      '</ExtendedData>',
      geometryKml(feature.geometry),
      '</Placemark>',
    ].join('');
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Erzurum Mahalleleri</name>${placemarks}</Document></kml>\n`;
}

async function main() {
  const [bbXml, canonicalXml, officialRaw] = await Promise.all([
    readFile(bbKmlPath, 'utf8'),
    readFile(canonicalKmlPath, 'utf8'),
    readFile(officialPath, 'utf8').then(JSON.parse),
  ]);
  const bb = parseKml(bbXml).features;
  const canonical = parseKml(canonicalXml).features.map((feature) => ({
    feature,
    geometry: feature.geometry,
    bbox: bbox(feature.geometry),
    area: geometryArea(feature.geometry),
    settlement: {
      id: feature.properties.id,
      district_name: feature.properties.district,
      name: feature.properties.mahalle,
    },
  }));
  const official = officialRaw.filter((item) => item.province_id === 'TR-P-25' && item.type === 'mahalle');
  const officialByDistrictName = new Map(official.map((item) => [
    `${districtKey(item.district_name)}|${key(item.name)}`,
    item,
  ]));
  const officialByName = new Map();
  for (const item of official) {
    const list = officialByName.get(key(item.name)) || [];
    list.push(item);
    officialByName.set(key(item.name), list);
  }
  const aliases = explicitAliases();
  const intentionalProjectAliases = new Map([
    [`${districtKey('İspir')}|${key('Meydanlı')}`, `${districtKey('İspir')}|${key('Madenköprübaşı')}`],
  ]);
  const excludedSourceKeys = new Set([
    `${districtKey('Olur')}|${key('Merkez Yeşilbağlar')}`,
  ]);
  const mapped = [];
  const unresolved = [];
  const matchMethods = {};
  for (const feature of bb) {
    if (excludedSourceKeys.has(`${districtKey(feature.properties.district)}|${key(feature.properties.mahalle)}`)) {
      matchMethods.excluded_source_record = (matchMethods.excluded_source_record || 0) + 1;
      continue;
    }
    const spatial = bestSpatialMatch(feature, canonical);
    const byName = chooseByName(feature.properties, officialByDistrictName, officialByName, aliases);
    const settlement = spatial?.score >= 0.5 ? officialByDistrictName.get(`${districtKey(spatial.candidate.settlement.district_name)}|${key(spatial.candidate.settlement.name)}`) : byName;
    const method = spatial?.score >= 0.5 ? 'spatial' : byName ? 'name' : 'unresolved';
    if (!settlement) {
      unresolved.push({ district: feature.properties.district, name: feature.properties.mahalle, best_spatial_score: spatial?.score || 0 });
      continue;
    }
    mapped.push({ feature, settlement });
    matchMethods[method] = (matchMethods[method] || 0) + 1;
  }

  const seen = new Map();
  for (const item of mapped) {
    const prior = seen.get(item.settlement.id);
    if (prior) {
      throw new Error(`Aynı proje mahallesi iki kez eşleşti: ${item.settlement.district_name}/${item.settlement.name} <- ${prior} ve ${item.feature.properties.mahalle}`);
    }
    seen.set(item.settlement.id, item.feature.properties.mahalle);
  }
  if (unresolved.length) {
    throw new Error(`Eşleşmeyen belediye kaydı: ${JSON.stringify(unresolved)}`);
  }

  await mkdir(manualDir, { recursive: true });
  await writeFile(outputPath, buildKml(mapped));
  console.log(JSON.stringify({
    source_features: bb.length,
    output_features: mapped.length,
    project_official_features: official.length,
    renamed_project_features: ['İspir/Meydanlı -> İspir/Madenköprübaşı'],
    missing_project_features: official
      .filter((item) => !seen.has(item.id))
      .filter((item) => !intentionalProjectAliases.has(`${districtKey(item.district_name)}|${key(item.name)}`))
      .map((item) => `${item.district_name}/${item.name}`),
    match_methods: matchMethods,
    output: outputPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
