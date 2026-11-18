import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

const root = process.cwd();
const manualRoot = path.join(root, 'source', 'mahalle-manual');
const adanaSourceRoot = path.join(root, 'source', 'yayinlanabilir', 'municipal', '01-adana', 'mahalle', 'raw');
const adanaOutputRoot = path.join(manualRoot, '01-adana', 'raw');
const clean = process.argv.includes('--clean');
const requestedProvince = process.argv.find((arg) => arg.startsWith('--province='))?.split('=')[1] || null;

function localName(node) {
  return node?.localName || node?.nodeName?.split(':').pop() || '';
}

function descendants(node, wanted) {
  return [...node.getElementsByTagName('*')].filter((item) => localName(item) === wanted);
}

function text(node) {
  return String(node?.textContent || '').trim();
}

function parseXml(filePath) {
  const xml = (String(filePath).trimStart().startsWith('<')
    ? String(filePath)
    : fs.readFileSync(filePath, 'utf8')).replace(/^\uFEFF/, '');
  const document = new DOMParser().parseFromString(xml, 'text/xml');
  if (!document.documentElement || localName(document.documentElement) !== 'kml') {
    throw new Error(`Geçersiz KML: ${filePath}`);
  }
  return document;
}

function placemarkProperties(placemark) {
  const properties = {};
  for (const data of descendants(placemark, 'Data')) {
    const name = data.getAttribute('name');
    const value = descendants(data, 'value')[0];
    if (name) properties[name] = text(value);
  }
  const nameNode = descendants(placemark, 'name')[0];
  if (!properties.name && nameNode) properties.name = text(nameNode);
  if (!properties.mahalle && nameNode) properties.mahalle = text(nameNode);
  return properties;
}

function compact(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i')
    .replace(/[^a-z0-9]+/g, '');
}

function placemarkKey(placemark) {
  const properties = placemarkProperties(placemark);
  const id = properties.mahalle_id || properties.id || placemark.getAttribute('id');
  if (id) return `id:${compact(id)}`;
  const geometry = descendants(placemark, 'Polygon').map((node) => new XMLSerializer().serializeToString(node)).join('');
  const geometryHash = crypto.createHash('sha1').update(geometry).digest('hex');
  return `name:${compact(properties.district)}|${compact(properties.mahalle || properties.name)}|${geometryHash}`;
}

function allPlacemarks(document) {
  return descendants(document, 'Placemark');
}

function outputDocument(title) {
  return parseXml(`<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${escapeXml(title)}</name><Style id="mahalle"><LineStyle><color>ff2f2f2f</color><width>1.2</width></LineStyle><PolyStyle><color>66ffffff</color></PolyStyle></Style></Document></kml>`);
}

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function appendPlacemark(document, placemark) {
  const clone = placemark.cloneNode(true);
  for (const styleUrl of descendants(clone, 'styleUrl')) styleUrl.parentNode.removeChild(styleUrl);
  const styleUrl = document.createElement('styleUrl');
  styleUrl.appendChild(document.createTextNode('#mahalle'));
  clone.appendChild(styleUrl);
  document.getElementsByTagName('Document')[0].appendChild(clone);
}

function mergeKmlFiles(provinceDir, inputFiles, outputPath) {
  const title = `${provinceDir.replace(/^\d+-/, '')} Mahalleleri`;
  const output = outputDocument(title);
  const seen = new Map();
  const collisions = [];
  let inputPlacemarkCount = 0;

  for (const filePath of inputFiles) {
    const document = parseXml(filePath);
    for (const placemark of allPlacemarks(document)) {
      inputPlacemarkCount += 1;
      const key = placemarkKey(placemark);
      if (seen.has(key)) {
        collisions.push({ key, kept: seen.get(key), skipped: filePath });
        continue;
      }
      seen.set(key, filePath);
      appendPlacemark(output, placemark);
    }
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const serialized = new XMLSerializer().serializeToString(output);
  fs.writeFileSync(outputPath, `${serialized}\n`, 'utf8');
  return {
    inputPlacemarkCount,
    outputPlacemarkCount: seen.size,
    collisionCount: collisions.length,
    collisions,
  };
}

function ringToKml(ring) {
  const coordinates = ring.map(([lon, lat, altitude = 0]) => `${lon},${lat},${altitude}`).join(' ');
  return `<LinearRing><coordinates>${coordinates}</coordinates></LinearRing>`;
}

function polygonToKml(polygon) {
  if (!polygon?.[0]?.length) return '';
  const [outer, ...holes] = polygon;
  return `<Polygon><outerBoundaryIs>${ringToKml(outer)}</outerBoundaryIs>${holes.map((ring) => `<innerBoundaryIs>${ringToKml(ring)}</innerBoundaryIs>`).join('')}</Polygon>`;
}

function geometryToKml(geometry) {
  if (!geometry) return '';
  if (geometry.type === 'Polygon') return polygonToKml(geometry.coordinates);
  if (geometry.type === 'MultiPolygon') return `<MultiGeometry>${geometry.coordinates.map(polygonToKml).join('')}</MultiGeometry>`;
  return '';
}

function featureToKml(feature) {
  const properties = feature.properties || {};
  const name = properties.mahalle || properties.name || '';
  const district = properties.district || '';
  const id = properties.mahalle_id || properties.id || '';
  const description = `İlçe: ${district}\nTip: Mahalle\nMahalle ID: ${id}`;
  return `<Placemark><name>${escapeXml(name)}</name><styleUrl>#mahalle</styleUrl><ExtendedData><Data name="district"><value>${escapeXml(district)}</value></Data><Data name="mahalle_id"><value>${escapeXml(id)}</value></Data><Data name="type"><value>Mahalle</value></Data></ExtendedData><description>${escapeXml(description)}</description>${geometryToKml(feature.geometry)}</Placemark>`;
}

function mergeAdanaGeoJson() {
  const files = ['adana-mahalleleri.geojson', 'adana-saricam-mahalleleri.geojson'];
  const features = [];
  const featureIndexes = new Map();
  let replacementCount = 0;
  let addedCount = 0;
  for (const [fileIndex, file] of files.entries()) {
    const sourcePath = path.join(adanaSourceRoot, file);
    const collection = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    for (const feature of collection.features || []) {
      const properties = feature.properties || {};
      const key = `name:${compact(properties.district)}|${compact(properties.mahalle || properties.name)}`;
      const existingIndex = featureIndexes.get(key);
      if (existingIndex !== undefined && fileIndex > 0) {
        features[existingIndex] = feature;
        replacementCount += 1;
      } else if (existingIndex === undefined) {
        featureIndexes.set(key, features.length);
        features.push(feature);
        if (fileIndex > 0) addedCount += 1;
      }
    }
  }
  const output = outputDocument('Adana Mahalleleri');
  const document = output.getElementsByTagName('Document')[0];
  for (const feature of features) {
    const parsed = parseXml(`<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>${featureToKml(feature)}</Document></kml>`);
    document.appendChild(parsed.getElementsByTagName('Placemark')[0]);
  }
  const outputPath = path.join(adanaOutputRoot, 'adana-mahalle.kml');
  fs.mkdirSync(adanaOutputRoot, { recursive: true });
  fs.writeFileSync(outputPath, `${new XMLSerializer().serializeToString(output)}\n`, 'utf8');
  return { inputFeatureCount: features.length, outputPath, replacementCount, addedCount };
}

function provinceDirectories() {
  return fs.readdirSync(manualRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{2}-/.test(entry.name))
    .map((entry) => entry.name)
    .filter((name) => !requestedProvince || name === requestedProvince)
    .sort();
}

function mergeProvince(provinceDir) {
  const sourceDir = path.join(manualRoot, provinceDir);
  const files = fs.readdirSync(sourceDir)
    .filter((file) => file.toLowerCase().endsWith('.kml'))
    .sort((a, b) => {
      const slug = provinceDir.replace(/^\d+-/, '');
      const preferred = `${slug}-mahalle.kml`;
      return Number(b.toLocaleLowerCase() === preferred) - Number(a.toLocaleLowerCase() === preferred) || a.localeCompare(b);
    })
    .map((file) => path.join(sourceDir, file));
  if (!files.length) return null;
  const outputPath = path.join(sourceDir, 'raw', `${provinceDir.replace(/^\d+-/, '')}-mahalle.kml`);
  const result = mergeKmlFiles(provinceDir, files, outputPath);
  if (clean) {
    for (const file of files) fs.unlinkSync(file);
  }
  return { provinceDir, outputPath, ...result };
}

const results = [];
if (!requestedProvince || requestedProvince === '01-adana') results.push({ provinceDir: '01-adana', ...mergeAdanaGeoJson() });
for (const provinceDir of provinceDirectories()) {
  const result = mergeProvince(provinceDir);
  if (result) results.push(result);
}

for (const result of results) {
  console.log(JSON.stringify({
    province: result.provinceDir,
    output: path.relative(root, result.outputPath),
    input_count: result.inputPlacemarkCount ?? result.inputFeatureCount,
    output_count: result.outputPlacemarkCount ?? result.inputFeatureCount,
    collision_count: result.collisionCount ?? 0,
    clean,
  }));
}
