import AdmZip from 'adm-zip';
import JSZip from 'jszip';
import XLSX from 'xlsx';
import { topology } from 'topojson-server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildPdfDocumentBlob,
  buildGeojsonPayload,
  featureCollectionToGml,
  buildJsonPayload,
  buildKmzBlobFromKml,
  buildTabularRows,
  buildTopojsonPayload,
  buildXlsxArrayBuffer,
  escapeCsvValue,
  escapeSqlValue,
  featureCollectionToKml,
  featureCollectionToOsm,
  geometryToGml,
  geometryToKml,
  rowsToCsv,
  rowsToSql,
  rowsToWkt,
} from '../download.js';

afterEach(() => {
  vi.restoreAllMocks();
});

const visibleItems = [
  {
    id: 'TR-P-34',
    level: 'province',
    region_id: 'TR-R-MAR',
    name: 'İstanbul',
    region_name: 'Marmara',
    name_ascii: 'istanbul',
    slug: 'istanbul',
    plate_code: '34',
    aliases: ['İstanbul', 'Constantinople'],
    member_ids: [],
    bbox: [28, 40, 29, 41],
    centroid: { lat: 40.5, lon: 28.5 },
  },
  {
    id: 'TR-P-55',
    level: 'province',
    region_id: 'TR-R-KAR',
    name: 'Samsun',
    region_name: 'Karadeniz',
    name_ascii: 'samsun',
    slug: 'samsun',
    plate_code: '55',
    aliases: [],
    member_ids: [],
    bbox: [35, 40, 37, 42],
    centroid: { lat: 41.2, lon: 36.3 },
  },
];

const polygonGeometry = {
  type: 'Polygon',
  coordinates: [[[28, 40], [29, 40], [29, 41], [28, 40]]],
};

const multiPolygonGeometry = {
  type: 'MultiPolygon',
  coordinates: [
    [[[35, 40], [36, 40], [36, 41], [35, 40]]],
    [[[36.5, 40.5], [37, 40.5], [37, 41], [36.5, 40.5]]],
  ],
};

const visibleFeatures = [
  {
    type: 'Feature',
    properties: { id: 'TR-P-34' },
    geometry: polygonGeometry,
  },
  {
    type: 'Feature',
    properties: { id: 'TR-P-55' },
    geometry: multiPolygonGeometry,
  },
];

const geometryById = new Map([
  ['TR-P-34', polygonGeometry],
  ['TR-P-55', multiPolygonGeometry],
]);

describe('test-ui download helpers', () => {
  describe('json ve geojson payload', () => {
    it('filtered json ve geojson üretir', () => {
      const jsonPayload = buildJsonPayload(
        visibleItems,
        ['id', 'name', 'region_name', 'parent_name'],
        () => null,
      );
      const geojsonPayload = buildGeojsonPayload(
        visibleFeatures,
        (id) => ({ id, name: visibleItems.find((item) => item.id === id)?.name }),
      );

      expect(jsonPayload).toHaveLength(2);
      expect(jsonPayload[0]).toEqual({
        id: 'TR-P-34',
        name: 'İstanbul',
        region_name: 'Marmara',
        parent_name: null,
      });
      expect(geojsonPayload.type).toBe('FeatureCollection');
      expect(geojsonPayload.features).toHaveLength(2);
      expect(geojsonPayload.features[0].properties.name).toBe('İstanbul');
    });
  });

  describe('tabular, csv, sql, wkt çıktıları', () => {
    it('Polygon geometry için tabular satırlar üretir', () => {
      const singleItem = [visibleItems[0]];
      const singleGeom = new Map([['TR-P-34', polygonGeometry]]);
      const rows = buildTabularRows(singleItem, singleGeom);

      expect(rows).toHaveLength(1);
      expect(rows[0].geometry_wkt).toBe('POLYGON ((28 40, 29 40, 29 41, 28 40))');
      expect(rows[0].centroid_lat).toBe(40.5);
      expect(rows[0].centroid_lon).toBe(28.5);
      expect(rows[0].x).toBe(28.5);
      expect(rows[0].y).toBe(40.5);
      expect(rows[0].coordinate_system).toBe('EPSG:4326');
      expect(rows[0].aliases).toBe('["İstanbul","Constantinople"]');
    });

    it('MultiPolygon geometry için tabular satırlar üretir', () => {
      const singleItem = [visibleItems[1]];
      const singleGeom = new Map([['TR-P-55', multiPolygonGeometry]]);
      const rows = buildTabularRows(singleItem, singleGeom);

      expect(rows[0].geometry_wkt).toContain('MULTIPOLYGON');
      expect(rows[0].geometry_wkt).toContain('35 40');
      expect(rows[0].geometry_wkt).toContain('36.5 40.5');
    });

    it('çoklu öğe için CSV üretir ve Türkçe karakter korur', () => {
      const rows = buildTabularRows(visibleItems, geometryById);
      const csv = rowsToCsv(rows);
      const lines = csv.split('\n');

      expect(lines[0]).toContain('id');
      expect(lines[0]).toContain('geometry_wkt');
      expect(lines[0]).toContain('coordinate_system');
      expect(csv).toContain('İstanbul');
      expect(csv).toContain('Samsun');
      expect(csv).toContain('TR-P-34');
    });

    it('boş satır dizisi için CSV boş string döner', () => {
      expect(rowsToCsv([])).toBe('');
    });

    it('SQL çıktısı identifier quoting kullanır', () => {
      const rows = buildTabularRows([visibleItems[0]], new Map([['TR-P-34', polygonGeometry]]));
      const sql = rowsToSql('provinces', rows);

      expect(sql).toContain('CREATE TABLE "provinces"');
      expect(sql).toContain('INSERT INTO "provinces"');
      expect(sql).toContain('"id" TEXT');
      expect(sql).toContain("'TR-P-34'");
      expect(sql).toContain('İstanbul');
    });

    it('boş satır dizisi için SQL CREATE TABLE döner', () => {
      const sql = rowsToSql('test', []);
      expect(sql).toContain('CREATE TABLE "test"');
      expect(sql).toContain('PRIMARY KEY');
    });

    it('WKT sadece geometri satırları döner', () => {
      const rows = buildTabularRows(visibleItems, geometryById);
      const wkt = rowsToWkt(rows);
      const wktLines = wkt.split('\n');

      expect(wktLines).toHaveLength(2);
      expect(wktLines[0]).toMatch(/^(POLYGON|MULTIPOLYGON)/);
      expect(wktLines[1]).toMatch(/^(POLYGON|MULTIPOLYGON)/);
      expect(wkt).not.toContain('TR-P-34');
      expect(wkt).not.toContain('İstanbul');
    });

    it('boş satır dizisi için WKT boş string döner', () => {
      expect(rowsToWkt([])).toBe('');
    });
  });

  describe('topojson, kml, kmz, xlsx çıktıları', () => {
    it('topojson üretir', () => {
      const geojson = buildGeojsonPayload(
        visibleFeatures,
        (id) => ({ id, name: visibleItems.find((item) => item.id === id)?.name }),
      );
      const topojson = buildTopojsonPayload(geojson, topology, 'provinces');

      expect(topojson.type).toBe('Topology');
      expect(Object.keys(topojson.objects)).toEqual(['provinces']);
    });

    it('KML üretir ve Türkçe karakterleri doğru escape eder', () => {
      const geojson = buildGeojsonPayload(
        visibleFeatures,
        (id) => ({ id, name: visibleItems.find((item) => item.id === id)?.name }),
      );
      const kml = featureCollectionToKml(
        'marmara province',
        visibleItems,
        geojson,
        (item) => ({ id: item.id, name: item.name, region_name: item.region_name }),
      );

      expect(kml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(kml).toContain('<name>İstanbul</name>');
      expect(kml).toContain('<name>Samsun</name>');
      expect(kml).toContain('Bölge Adı: Marmara');
      expect(kml).toContain('<Polygon>');
      expect(kml).toContain('<MultiGeometry>');
      expect(kml).not.toContain('undefined');
    });

    it('GML üretir ve polygon/multipolygon geometriyi korur', () => {
      const geojson = buildGeojsonPayload(
        visibleFeatures,
        (id) => ({ id, name: visibleItems.find((item) => item.id === id)?.name, region_name: visibleItems.find((item) => item.id === id)?.region_name }),
      );
      const gml = featureCollectionToGml(
        'marmara provinces',
        visibleItems,
        geojson,
        (item) => ({ id: item.id, name: item.name, region_name: item.region_name }),
        { featureTypeName: 'province' },
      );

      expect(gml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(gml).toContain('<gml:FeatureCollection');
      expect(gml).toContain('<gml:featureMember>');
      expect(gml).toContain('<tm:province');
      expect(gml).toContain('<tm:name>İstanbul</tm:name>');
      expect(gml).toContain('<gml:Polygon');
      expect(gml).toContain('<gml:MultiSurface');
      expect(gml).not.toContain('undefined');
    });

    it('KML renk modu: colorResolver per-feature style üretir', () => {
      const geojson = buildGeojsonPayload(
        [visibleFeatures[0]],
        (id) => ({ id }),
      );
      const kml = featureCollectionToKml(
        'test',
        [visibleItems[0]],
        geojson,
        (item) => ({ id: item.id }),
        () => '#d7dfff',
      );

      expect(kml).toContain('<Style id="style-');
      expect(kml).not.toContain('"turkiye-map-style"');
    });

    it('KML null metadata olan feature\'ı atlar, crash olmaz', () => {
      const geojsonWithOrphan = {
        type: 'FeatureCollection',
        features: [
          ...visibleFeatures,
          {
            type: 'Feature',
            properties: { id: 'TR-P-99' },
            geometry: polygonGeometry,
          },
        ],
      };

      expect(() => featureCollectionToKml(
        'test',
        visibleItems,
        geojsonWithOrphan,
        (item) => ({ id: item.id }),
      )).not.toThrow();

      const kml = featureCollectionToKml(
        'test',
        visibleItems,
        geojsonWithOrphan,
        (item) => ({ id: item.id }),
      );
      expect(kml).toContain('<name>İstanbul</name>');
    });

    it('KML mahalle olceginde ara koordinatlari sadelestirmeden korur', () => {
      const detailedRing = [
        [0, 0],
        [0.001, 0.0001],
        [0.002, 0],
        [0.003, 0.0001],
        [0.004, 0],
        [0.005, 0.0001],
        [0.006, 0],
        [0.007, 0.0001],
        [0.008, 0],
        [0.009, 0.0001],
        [0.01, 0],
        [0.011, 0.0001],
        [0.012, 0],
        [0.012, 0.01],
        [0, 0.01],
        [0, 0],
      ];
      const kml = geometryToKml({ type: 'Polygon', coordinates: [detailedRing] });

      expect(kml).toContain('0.001,0.0001,0');
      expect(kml).toContain('0.011,0.0001,0');
      expect((kml.match(/,0 /g) || []).length).toBeGreaterThan(12);
    });

    it('GML mahalle olceginde ara koordinatlari sadelestirmeden korur', () => {
      const detailedRing = [
        [0, 0],
        [0.001, 0.0001],
        [0.002, 0],
        [0.003, 0.0001],
        [0.004, 0],
        [0.005, 0.0001],
        [0.006, 0],
        [0.007, 0.0001],
        [0.008, 0],
        [0.009, 0.0001],
        [0.01, 0],
        [0.011, 0.0001],
        [0.012, 0],
        [0.012, 0.01],
        [0, 0.01],
        [0, 0],
      ];
      const gml = geometryToGml({ type: 'Polygon', coordinates: [detailedRing] });

      expect(gml).toContain('0.001 0.0001');
      expect(gml).toContain('0.011 0.0001');
      expect((gml.match(/ 0\.0001/g) || []).length).toBeGreaterThan(4);
    });

    it('KMZ, içinde doc.kml olan geçerli zip üretir', async () => {
      const geojson = buildGeojsonPayload(
        [visibleFeatures[0]],
        (id) => ({ id }),
      );
      const kml = featureCollectionToKml('test', [visibleItems[0]], geojson, (item) => ({ id: item.id }));
      const kmzBlob = await buildKmzBlobFromKml(kml, JSZip);
      const kmz = new AdmZip(Buffer.from(await kmzBlob.arrayBuffer()));

      expect(kmz.getEntries().map((entry) => entry.entryName)).toEqual(['doc.kml']);
      expect(kmz.readAsText('doc.kml')).toContain('<name>İstanbul</name>');
    });

    it('OSM XML üretir ve multipolygon relation kurar', () => {
      const geojson = buildGeojsonPayload(
        visibleFeatures,
        (id) => ({ id, name: visibleItems.find((item) => item.id === id)?.name, region_name: visibleItems.find((item) => item.id === id)?.region_name }),
      );
      const osm = featureCollectionToOsm(
        'test',
        visibleItems,
        geojson,
        (item) => ({ id: item.id, name: item.name, region_name: item.region_name }),
      );

      expect(osm).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(osm).toContain('<osm version="0.6" generator="test">');
      expect(osm).toContain('<node id="');
      expect(osm).toContain('<way id="');
      expect(osm).toContain('<relation id="');
      expect(osm).toContain('<tag k="type" v="multipolygon"/>');
      expect(osm).toContain('<tag k="name" v="İstanbul"/>');
      expect(osm).toContain('<tag k="turkiye_map:id" v="TR-P-34"/>');
    });

    it('XLSX: geometry_wkt sütunu hariç tüm alanları içerir', () => {
      const rows = buildTabularRows([visibleItems[0]], new Map([['TR-P-34', polygonGeometry]]));
      const workbookBuffer = buildXlsxArrayBuffer(rows, 'provinces', XLSX);
      const workbook = XLSX.read(workbookBuffer, { type: 'array' });
      const firstRow = XLSX.utils.sheet_to_json(workbook.Sheets.provinces, { defval: null })[0];

      expect(workbook.SheetNames).toEqual(['provinces']);
      expect(firstRow.id).toBe('TR-P-34');
      expect(firstRow.name).toBe('İstanbul');
      expect(firstRow.geometry_wkt).toBeUndefined();
    });
  });

  describe('pdf Ã§Ä±ktÄ±sÄ±', () => {
    it('PDF blob Ã¼retir ve temel belge iskeletini yazar', async () => {
      const blob = buildPdfDocumentBlob({
        width: 320,
        height: 180,
        title: 'Marmara Provinces',
        subtitle: 'Region scope',
        backgroundColor: '#ffffff',
        paths: [
          {
            d: 'M10,10L120,10L120,80L10,10Z',
            fill: '#d7dfff',
            stroke: '#42538f',
            lineWidth: 1,
          },
        ],
      });

      const text = new TextDecoder().decode(await blob.arrayBuffer());

      expect(blob.type).toBe('application/pdf');
      expect(text.startsWith('%PDF-1.4')).toBe(true);
      expect(text).toContain('/Type /Catalog');
      expect(text).toContain('Marmara Provinces');
      expect(text).toContain('/MediaBox [0 0 320 180]');
    });
  });

  describe('escapeCsvValue edge case\'leri', () => {
    it('virgül içeren değeri quote eder', () => {
      expect(escapeCsvValue('a,b')).toBe('"a,b"');
    });

    it('çift tırnak içeren değeri escape eder', () => {
      expect(escapeCsvValue('a"b')).toBe('"a""b"');
    });

    it('newline içeren değeri quote eder', () => {
      expect(escapeCsvValue('a\nb')).toBe('"a\nb"');
    });

    it('carriage return içeren değeri quote eder', () => {
      expect(escapeCsvValue('a\rb')).toBe('"a\rb"');
    });

    it('null ve undefined için boş string döner', () => {
      expect(escapeCsvValue(null)).toBe('');
      expect(escapeCsvValue(undefined)).toBe('');
    });

    it('Türkçe karakterleri değiştirmez', () => {
      expect(escapeCsvValue('İstanbul')).toBe('İstanbul');
      expect(escapeCsvValue('Şanlıurfa')).toBe('Şanlıurfa');
      expect(escapeCsvValue('Ağrı')).toBe('Ağrı');
    });

    it('noktalı virgül delimiter ile çalışır', () => {
      expect(escapeCsvValue('a;b', ';')).toBe('"a;b"');
      expect(escapeCsvValue('a,b', ';')).toBe('a,b');
    });
  });

  describe('escapeSqlValue edge case\'leri', () => {
    it('tek tırnak içeren string\'i escape eder', () => {
      expect(escapeSqlValue("O'Brien")).toBe("'O''Brien'");
    });

    it('null ve undefined için NULL döner', () => {
      expect(escapeSqlValue(null)).toBe('NULL');
      expect(escapeSqlValue(undefined)).toBe('NULL');
      expect(escapeSqlValue('')).toBe('NULL');
    });

    it('sayısal değerleri unquoted döner', () => {
      expect(escapeSqlValue(34)).toBe('34');
      expect(escapeSqlValue(40.5)).toBe('40.5');
    });

    it('Infinity ve NaN için NULL döner', () => {
      expect(escapeSqlValue(Infinity)).toBe('NULL');
      expect(escapeSqlValue(Number.NaN)).toBe('NULL');
    });

    it('Türkçe karakter içeren string\'i doğru escape eder', () => {
      expect(escapeSqlValue('İstanbul')).toBe("'İstanbul'");
      expect(escapeSqlValue('Şanlıurfa')).toBe("'Şanlıurfa'");
    });
  });
});
