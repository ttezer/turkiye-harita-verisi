import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import polygonClipping from 'polygon-clipping';

const root = process.cwd();
const provinceDir = process.argv.find((arg) => arg.startsWith('--province-dir='))?.split('=')[1];
if (!provinceDir) throw new Error('Usage: node scripts/prepare-external-mahalle-province.mjs --province-dir=19-corum');

const provinceCode = provinceDir.slice(0, 2);
const provinceSlug = provinceDir.slice(3);
const manualIdOverrides = {
  '18-cankiri': {
    '20281': 'TR-Y-18-009-M-0009',
    '140787': 'TR-Y-18-012-M-0005',
  },
  '19-corum': {
    '20336': 'TR-Y-19-004-M-0018',
    '20343': 'TR-Y-19-004-M-0019',
    '2009191': 'TR-Y-19-004-K-0109',
    '20334': 'TR-Y-19-004-M-0013',
    '20455': 'TR-Y-19-011-M-0002',
    '20458': 'TR-Y-19-011-M-0001',
  },
};
const manualNameOverrides = {
  '18-cankiri': {
    'TR-Y-18-004-M-0013': 'Yeni (Saçak)',
    'TR-Y-18-004-OSB-SRC-100250': 'Çerkeş OSB',
    'TR-Y-18-011-OSB-SRC-20315': 'Yeni OSB',
    'TR-Y-18-008-OSB-SRC-20274': 'Büyük OSB',
    'TR-Y-18-010-M-SRC-117002': 'Kalfat Nevzat Ayaz',
    'TR-Y-18-010-M-SRC-624106': 'Kalfat Hatipler',
    'TR-Y-18-010-M-SRC-452698': 'Kalfat Hacı Hasan',
    'TR-Y-18-010-M-SRC-689554': 'Kalfat Sünnetçiler',
  },
  '19-corum': {
    'TR-Y-19-004-M-0019': 'Düvenci Mimar Sinan',
    'TR-Y-19-011-M-0001': 'Aştavul Bahçelievler',
  },
};
const manualParentOverrides = {
  '19-corum': {
    'TR-Y-19-004-M-0018': 'Çorum-İlçe Merkezi',
  },
};
const externalRoot = path.join(root, 'data', 'external');
const inputRoot = path.join(externalRoot, 'eksik-iller-ilce-bazli', provinceDir, 'ilce');
const sourceFiles = fs.readdirSync(inputRoot)
  .filter((file) => file.endsWith('-mahalle-poligonlari.geojson'))
  .sort();
const sourceFeatures = [];

for (const file of sourceFiles) {
  const collection = JSON.parse(fs.readFileSync(path.join(inputRoot, file), 'utf8'));
  for (const [index, feature] of (collection.features || []).entries()) {
    sourceFeatures.push({ ...feature, _source_file: file, _source_index: index });
  }
}

const yerlesimler = JSON.parse(fs.readFileSync(path.join(root, 'dist', 'json', 'yerlesimler.json'), 'utf8'))
  .filter((row) => row.province_id === `TR-P-${provinceCode}`);
const districts = JSON.parse(fs.readFileSync(path.join(root, 'dist', 'json', 'districts.json'), 'utf8'))
  .filter((row) => row.parent_id === `TR-P-${provinceCode}`);

function compact(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i')
    .replace(/[^a-z0-9]+/g, '');
}

function normalizeName(value) {
  return compact(value).replace(/koyu$/g, '').replaceAll('camii', 'cami');
}

function normalizeDistrict(value) {
  const normalized = compact(value);
  return normalized === 'merkez' ? compact(yerlesimler[0]?.province_name || value) : normalized;
}

function settlementKey(district, name) {
  return `${normalizeDistrict(district)}|${normalizeName(name)}`;
}

function districtFor(sourceDistrict) {
  const normalized = normalizeDistrict(sourceDistrict);
  return districts.find((district) => compact(district.name) === normalized) || null;
}

function sourceTypeHint(rawName) {
  if (/\b(osb|sb)\b/i.test(rawName)) return 'osb';
  return /koyu$/i.test(compact(rawName)) ? 'koy' : 'mahalle';
}

function displayName(rawName, typeCode) {
  const text = String(rawName || '').trim();
  return typeCode === 'koy' ? text.replace(/\s+Köyü$/iu, '') : text;
}

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function ringToKml(ring) {
  return `<LinearRing><coordinates>${ring.map(([lon, lat, altitude = 0]) => `${lon},${lat},${altitude}`).join(' ')}</coordinates></LinearRing>`;
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

function typeLabel(typeCode) {
  return typeCode === 'koy' ? 'Köy' : typeCode === 'osb' ? 'OSB' : 'Mahalle';
}

function featureToKml(feature) {
  const p = feature.properties;
  const data = [
    ['district', p.district],
    ['district_id', p.district_id],
    ['mahalle_id', p.mahalle_id],
    ['match_name', p.match_name],
    ['administrative_unit_name', p.administrative_unit_name],
    ['type', typeLabel(p.type_code)],
    ['type_code', p.type_code],
    ['source_id', p.source_id],
    ['source_match_status', p.source_match_status],
    ['source_name', p.source_name],
  ].map(([name, value]) => `<Data name="${escapeXml(name)}"><value>${escapeXml(value)}</value></Data>`).join('');
  const description = `İlçe: ${p.district}\nTür: ${typeLabel(p.type_code)}\nMahalle ID: ${p.mahalle_id}\nKaynak adı: ${p.source_name}`;
  return `<Placemark><name>${escapeXml(p.name)}</name><styleUrl>#mahalle</styleUrl><ExtendedData>${data}</ExtendedData><description>${escapeXml(description)}</description>${geometryToKml(feature.geometry)}</Placemark>`;
}

function bbox(geometry) {
  const values = [];
  function visit(value) {
    if (Array.isArray(value)) {
      if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') values.push(value);
      else value.forEach(visit);
    }
  }
  visit(geometry?.coordinates);
  if (!values.length) return null;
  return values.reduce((out, [lon, lat]) => [
    Math.min(out[0], lon), Math.min(out[1], lat), Math.max(out[2], lon), Math.max(out[3], lat),
  ], [Infinity, Infinity, -Infinity, -Infinity]);
}

function bboxIntersects(a, b) {
  return a && b && a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
}

function asMultiPolygon(geometry) {
  if (geometry?.type === 'Polygon') return [geometry.coordinates];
  if (geometry?.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}

function ringArea(ring) {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i += 1) area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return Math.abs(area) / 2;
}

function multiPolygonArea(multiPolygon) {
  return multiPolygon.reduce((total, polygon) => total + ringArea(polygon[0]) - polygon.slice(1).reduce((holes, ring) => holes + ringArea(ring), 0), 0);
}

function geometryKey(geometry) {
  return JSON.stringify(geometry);
}

function ringIssues(geometry) {
  const issues = [];
  function checkRing(ring) {
    if (!Array.isArray(ring) || ring.length < 4) {
      issues.push('ring-too-short');
      return;
    }
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) issues.push('unclosed-ring');
  }
  for (const polygon of asMultiPolygon(geometry)) for (const ring of polygon) checkRing(ring);
  return issues;
}

function matchSourceFeatures() {
  const exact = new Map();
  const composite = new Map();
  for (const row of yerlesimler) {
    const exactKey = settlementKey(row.district_name, row.name);
    if (!exact.has(exactKey)) exact.set(exactKey, []);
    exact.get(exactKey).push(row);
    if (row.administrative_unit_name) {
      const compositeKey = `${normalizeDistrict(row.district_name)}|${normalizeName(row.name + row.administrative_unit_name)}`;
      if (!composite.has(compositeKey)) composite.set(compositeKey, []);
      composite.get(compositeKey).push(row);
    }
  }
  const used = new Set();
  const output = [];
  const unmatched = [];

  for (const sourceFeature of sourceFeatures) {
    const sourceProperties = sourceFeature.properties || {};
    const rawName = sourceProperties.District || sourceProperties.description || '';
    const sourceDistrict = sourceProperties.County || '';
    const sourceHint = sourceTypeHint(rawName);
    const compositeKey = `${normalizeDistrict(sourceDistrict)}|${normalizeName(rawName)}`;
    const exactKey = settlementKey(sourceDistrict, rawName);
    const compositeCandidates = composite.get(compositeKey) || [];
    const exactCandidates = [...(exact.get(exactKey) || [])].sort((left, right) => {
      const centerName = `${compact(sourceDistrict)}ilcemerkezi`;
      const score = (candidate) => (
        (candidate.type === sourceHint ? 4 : 0)
        + (candidate.administrative_unit_name && compact(candidate.administrative_unit_name).includes(centerName) ? 2 : 0)
        + (!candidate.administrative_unit_name ? 1 : 0)
      );
      return score(right) - score(left);
    });
    const candidates = [...compositeCandidates, ...exactCandidates];
    const row = candidates.find((candidate) => !used.has(candidate.id) && (sourceHint === 'osb' || candidate.type === sourceHint))
      || candidates.find((candidate) => !used.has(candidate.id));
    const district = districtFor(sourceDistrict);
    const sourceId = String(sourceProperties.DistrictId ?? sourceProperties.id ?? `${provinceCode}-${sourceProperties.CountyId ?? ''}-${rawName}`);
    const manualId = manualIdOverrides[provinceDir]?.[sourceId] || null;
    const canonicalRow = manualId ? yerlesimler.find((candidate) => candidate.id === manualId) || row : row;
    const typeCode = canonicalRow?.type || sourceHint;
    const id = manualId || canonicalRow?.id || `TR-Y-${provinceCode}-${district?.district_local_code || '000'}-${typeCode === 'koy' ? 'K' : typeCode === 'osb' ? 'OSB' : 'M'}-SRC-${sourceId.replace(/[^A-Za-z0-9]+/g, '').toUpperCase()}`;
    const status = canonicalRow ? (manualId ? 'matched_manual_override' : 'matched') : 'source_only';
    if (canonicalRow) used.add(canonicalRow.id);
    else unmatched.push({
      source_id: sourceId,
      district: sourceDistrict,
      name: manualNameOverrides[provinceDir]?.[id] || displayName(rawName, typeCode),
      source_name: rawName,
      type_code: typeCode,
    });
    output.push({
      type: 'Feature',
      properties: {
        id,
        mahalle_id: id,
        name: manualNameOverrides[provinceDir]?.[id] || canonicalRow?.name || displayName(rawName, typeCode),
        match_name: canonicalRow?.name || displayName(rawName, typeCode),
        administrative_unit_name: manualParentOverrides[provinceDir]?.[id] || canonicalRow?.administrative_unit_name || null,
        district: canonicalRow?.district_name || district?.name || sourceDistrict,
        district_id: canonicalRow?.district_id || district?.id || `TR-D-${provinceCode}-${district?.district_local_code || '000'}`,
        province: canonicalRow?.province_name || yerlesimler[0]?.province_name || sourceProperties.City || '',
        province_id: `TR-P-${provinceCode}`,
        type_code: typeCode,
        type: typeLabel(typeCode),
        source_id: sourceId,
        source_name: rawName,
        source_file: sourceFeature._source_file,
        source: 'Açık Kaynak',
        source_match_status: status,
      },
      geometry: sourceFeature.geometry,
    });
  }

  const missingOfficial = yerlesimler.filter((row) => !used.has(row.id));
  return { output, unmatched, missingOfficial };
}

function qcFeatures(features, missingOfficial, unmatched) {
  const byDistrict = new Map();
  const sameName = new Map();
  const sameNameAndType = new Map();
  const sameGeometry = new Map();
  const empty = [];
  const geometryIssues = [];
  const multipolygons = [];
  const bboxRows = [];
  for (const feature of features) {
    const p = feature.properties;
    const districtKey = `${p.district_id}|${p.district}`;
    if (!byDistrict.has(districtKey)) byDistrict.set(districtKey, []);
    byDistrict.get(districtKey).push(feature);
    const nameKey = `${districtKey}|${compact(p.name)}`;
    if (!sameName.has(nameKey)) sameName.set(nameKey, []);
    sameName.get(nameKey).push(feature);
    const nameAndTypeKey = `${nameKey}|${p.type_code}`;
    if (!sameNameAndType.has(nameAndTypeKey)) sameNameAndType.set(nameAndTypeKey, []);
    sameNameAndType.get(nameAndTypeKey).push(feature);
    const key = geometryKey(feature.geometry);
    if (!sameGeometry.has(key)) sameGeometry.set(key, []);
    sameGeometry.get(key).push(feature);
    if (!feature.geometry?.coordinates?.length) empty.push({ id: p.id, district: p.district, name: p.name });
    const issues = ringIssues(feature.geometry);
    if (issues.length) geometryIssues.push({ id: p.id, district: p.district, name: p.name, issues });
    if (feature.geometry?.type === 'MultiPolygon') multipolygons.push({ id: p.id, district: p.district, name: p.name, type: p.type_code, parts: feature.geometry.coordinates.length });
    bboxRows.push({ feature, bbox: bbox(feature.geometry) });
  }
  const overlaps = [];
  for (const [districtKey, rows] of byDistrict) {
    for (let i = 0; i < rows.length; i += 1) {
      const left = rows[i];
      const leftBox = bbox(left.geometry);
      if (!leftBox) continue;
      for (let j = i + 1; j < rows.length; j += 1) {
        const right = rows[j];
        const rightBox = bbox(right.geometry);
        if (!bboxIntersects(leftBox, rightBox)) continue;
        let intersection;
        try {
          intersection = polygonClipping.intersection(asMultiPolygon(left.geometry), asMultiPolygon(right.geometry));
        } catch (error) {
          overlaps.push({ district: districtKey, left: left.properties.id, right: right.properties.id, error: error.message });
          continue;
        }
        const area = multiPolygonArea(intersection || []);
        if (area > 1e-12) overlaps.push({ district: districtKey, left: left.properties.id, right: right.properties.id, area_degrees: Number(area.toFixed(12)) });
      }
    }
  }
  const officialCounts = new Map();
  for (const row of yerlesimler) {
    const key = `${row.district_id}|${row.district_name}`;
    if (!officialCounts.has(key)) officialCounts.set(key, { district_id: row.district_id, district: row.district_name, mahalle: 0, koy: 0 });
    officialCounts.get(key)[row.type] += 1;
  }
  const outputCounts = new Map();
  for (const feature of features.filter((item) => item.properties.type_code !== 'osb')) {
    const p = feature.properties;
    const key = `${p.district_id}|${p.district}`;
    if (!outputCounts.has(key)) outputCounts.set(key, { district_id: p.district_id, district: p.district, mahalle: 0, koy: 0 });
    outputCounts.get(key)[p.type_code] += 1;
  }
  const countComparison = [...new Set([...officialCounts.keys(), ...outputCounts.keys()])].sort().map((key) => {
    const official = officialCounts.get(key) || { district_id: key.split('|')[0], district: key.split('|')[1], mahalle: 0, koy: 0 };
    const output = outputCounts.get(key) || { mahalle: 0, koy: 0 };
    return { district_id: official.district_id, district: official.district, kml_mahalle: output.mahalle, official_mahalle: official.mahalle, mahalle_fark: output.mahalle - official.mahalle, kml_koy: output.koy, official_koy: official.koy, koy_fark: output.koy - official.koy };
  });
  return {
    source_feature_count: sourceFeatures.length,
    output_feature_count: features.length,
    output_counts: features.reduce((counts, feature) => { counts[feature.properties.type_code] = (counts[feature.properties.type_code] || 0) + 1; return counts; }, {}),
    official_counts: yerlesimler.reduce((counts, row) => { counts[row.type] = (counts[row.type] || 0) + 1; return counts; }, {}),
    count_comparison: countComparison,
    unmatched_source: unmatched,
    missing_official: missingOfficial.map((row) => ({ id: row.id, district_id: row.district_id, district: row.district_name, name: row.name, type: row.type, administrative_unit_name: row.administrative_unit_name || null })),
    duplicate_names_same_district: [...sameNameAndType.values()].filter((items) => items.length > 1).map((items) => ({ district: items[0].properties.district, name: items[0].properties.name, type: items[0].properties.type_code, records: items.map((item) => ({ id: item.properties.id, type: item.properties.type_code, source_name: item.properties.source_name })) })),
    same_name_different_type: [...sameName.values()].filter((items) => items.length > 1 && new Set(items.map((item) => item.properties.type_code)).size > 1).map((items) => ({ district: items[0].properties.district, name: items[0].properties.name, records: items.map((item) => ({ id: item.properties.id, type: item.properties.type_code, source_name: item.properties.source_name })) })),
    duplicate_geometries: [...sameGeometry.values()].filter((items) => items.length > 1).map((items) => items.map((item) => ({ id: item.properties.id, district: item.properties.district, name: item.properties.name }))),
    empty_geometries: empty,
    geometry_issues: geometryIssues,
    multipolygons,
    overlap_pairs: overlaps,
  };
}

const { output, unmatched, missingOfficial } = matchSourceFeatures();
const qc = qcFeatures(output, missingOfficial, unmatched);
const outputBase = path.join(externalRoot, `${provinceSlug}-ilce-bazli-mahalleler-proje-standard`);
const kmlPath = path.join(root, 'source', 'mahalle-manual', provinceDir, 'raw', `${provinceSlug}-mahalle.kml`);
const geojsonPath = `${outputBase}.geojson`;
const kmzPath = `${outputBase}.kmz`;
const qcJsonPath = path.join(externalRoot, `${provinceSlug}-mahalle-qc-raporu.json`);
const qcMdPath = path.join(externalRoot, `${provinceSlug}-mahalle-qc-raporu.md`);

const geojson = { type: 'FeatureCollection', name: `${yerlesimler[0]?.province_name || provinceSlug} İlçe Bazlı Mahalleler`, features: output };
const kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${escapeXml(yerlesimler[0]?.province_name || provinceSlug)} Mahalleleri</name><Style id="mahalle"><LineStyle><color>ff2f2f2f</color><width>1.2</width></LineStyle><PolyStyle><color>66ffffff</color></PolyStyle></Style>${output.map(featureToKml).join('')}</Document></kml>\n`;

fs.mkdirSync(path.dirname(kmlPath), { recursive: true });
fs.mkdirSync(path.dirname(geojsonPath), { recursive: true });
fs.writeFileSync(kmlPath, kml, 'utf8');
fs.writeFileSync(geojsonPath, `${JSON.stringify(geojson, null, 2)}\n`, 'utf8');
const zip = new AdmZip();
zip.addFile('doc.kml', Buffer.from(kml, 'utf8'));
zip.writeZip(kmzPath);
fs.writeFileSync(qcJsonPath, `${JSON.stringify({ province: yerlesimler[0]?.province_name || provinceSlug, province_id: `TR-P-${provinceCode}`, source_directory: path.relative(root, inputRoot), ...qc }, null, 2)}\n`, 'utf8');

const problematic = [
  qc.unmatched_source.length ? `- Kaynak-ilave (source-only) kayıtlar: ${qc.unmatched_source.length}` : '- Kaynak-ilave kayıt yok.',
  qc.missing_official.length ? `- Geometride bulunmayan mülki idare kayıtları: ${qc.missing_official.length}` : '- Mülki idarede olup geometride bulunmayan kayıt yok.',
  qc.duplicate_names_same_district.length ? `- Aynı ilçe içinde aynı ad ve aynı tür kayıt grupları: ${qc.duplicate_names_same_district.length}` : '- Aynı ilçe içinde aynı ad ve aynı tür kayıt yok.',
  qc.duplicate_geometries.length ? `- Birebir aynı geometri grupları: ${qc.duplicate_geometries.length}` : '- Birebir aynı geometri yok.',
  qc.empty_geometries.length ? `- Boş geometri: ${qc.empty_geometries.length}` : '- Boş geometri yok.',
  qc.geometry_issues.length ? `- Geometri/ring sorunu: ${qc.geometry_issues.length}` : '- Geometri/ring sorunu yok.',
  qc.overlap_pairs.length ? `- Pozitif alanlı overlap çifti: ${qc.overlap_pairs.length}` : '- Pozitif alanlı overlap çifti yok.',
  qc.same_name_different_type.length ? `- Aynı ad, farklı tür (bilgilendirme): ${qc.same_name_different_type.length}` : '- Aynı ad, farklı tür kaydı yok.',
];
const comparisonTable = qc.count_comparison.map((row) => `| ${row.district} | ${row.kml_mahalle} | ${row.official_mahalle} | ${row.mahalle_fark} | ${row.kml_koy} | ${row.official_koy} | ${row.koy_fark} |`).join('\n');
const markdown = `# ${yerlesimler[0]?.province_name || provinceSlug} Mahalle QC\n\n- Kaynak özellik: ${qc.source_feature_count}\n- Çıktı özellik: ${qc.output_feature_count}\n- Çıktı türleri: ${Object.entries(qc.output_counts).map(([key, value]) => `${key}=${value}`).join(', ')}\n\n## Bulgular\n\n${problematic.join('\n')}\n\n## İlçe sayım karşılaştırması\n\n| İlçe | KML mahalle | Mülki idare mahalle | Fark | KML köy | Mülki idare köy | Fark |\n|---|---:|---:|---:|---:|---:|---:|\n${comparisonTable}\n\n## Eşleşmeyen kaynak kayıtları\n\n${qc.unmatched_source.length ? qc.unmatched_source.map((row) => `- ${row.district} / ${row.name} / ${row.type_code} / source_id=${row.source_id}`).join('\n') : '- Yok.'}\n\n## Mülki idarede olup kaynakta bulunmayan kayıtlar\n\n${qc.missing_official.length ? qc.missing_official.map((row) => `- ${row.district} / ${row.name} / ${row.type} / ${row.id}`).join('\n') : '- Yok.'}\n\n## Aynı ilçe içinde aynı ad ve aynı tür\n\n${qc.duplicate_names_same_district.length ? qc.duplicate_names_same_district.map((row) => `- ${row.district} / ${row.name}: ${row.records.map((record) => `${record.type}:${record.id}`).join(', ')}`).join('\n') : '- Yok.'}\n\n## Çok parçalı geometri\n\n${qc.multipolygons.length ? qc.multipolygons.map((row) => `- ${row.district} / ${row.name} / ${row.type}: ${row.parts} parça`).join('\n') : '- Yok.'}\n`;
const sameNameDifferentTypeMarkdown = qc.same_name_different_type.length
  ? qc.same_name_different_type.map((row) => `- ${row.district} / ${row.name}: ${row.records.map((record) => `${record.type}:${record.id}`).join(', ')}`).join('\n')
  : '- Yok.';
const markdownWithTypeNotes = markdown.replace(
  '\n## Çok parçalı geometri\n',
  `\n## Aynı ad, farklı tür (bilgilendirme)\n\n${sameNameDifferentTypeMarkdown}\n\n## Çok parçalı geometri\n`,
);
fs.writeFileSync(qcMdPath, markdownWithTypeNotes, 'utf8');

console.log(JSON.stringify({
  province: yerlesimler[0]?.province_name || provinceSlug,
  source_features: qc.source_feature_count,
  output_features: qc.output_feature_count,
  output_counts: qc.output_counts,
  unmatched_source: qc.unmatched_source.length,
  missing_official: qc.missing_official.length,
  duplicate_names: qc.duplicate_names_same_district.length,
  duplicate_geometries: qc.duplicate_geometries.length,
  empty_geometries: qc.empty_geometries.length,
  geometry_issues: qc.geometry_issues.length,
  overlap_pairs: qc.overlap_pairs.length,
  kml: path.relative(root, kmlPath),
  geojson: path.relative(root, geojsonPath),
  kmz: path.relative(root, kmzPath),
  qc_json: path.relative(root, qcJsonPath),
  qc_md: path.relative(root, qcMdPath),
}, null, 2));
