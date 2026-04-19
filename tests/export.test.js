import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import XLSX from 'xlsx';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { main, sortGeometry, sortMetadata } from '../scripts/export.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('export helpers', () => {
  it('sorts metadata by canonical id', () => {
    const sorted = sortMetadata([
      { id: 'TR-P-34', name: 'İstanbul' },
      { id: 'TR-P-06', name: 'Ankara' },
    ]);

    expect(sorted.map((item) => item.id)).toEqual(['TR-P-06', 'TR-P-34']);
  });

  it('sorts geometry, rewinds rings and rounds coordinates', () => {
    const collection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { id: 'TR-P-34' },
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [28.123456789, 40.123456789],
              [28.123456789, 41.123456789],
              [29.123456789, 41.123456789],
              [29.123456789, 40.123456789],
              [28.123456789, 40.123456789],
            ]],
          },
        },
        {
          type: 'Feature',
          properties: { id: 'TR-P-06' },
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [32.987654321, 39.987654321],
              [32.987654321, 40.987654321],
              [33.987654321, 40.987654321],
              [33.987654321, 39.987654321],
              [32.987654321, 39.987654321],
            ]],
          },
        },
      ],
    };

    const sorted = sortGeometry(collection);

    expect(sorted.features.map((feature) => feature.properties.id)).toEqual(['TR-P-06', 'TR-P-34']);
    const firstRing = sorted.features[0].geometry.coordinates[0];
    expect(firstRing).toContainEqual([32.987654, 39.987654]);
    expect(firstRing).toContainEqual([33.987654, 39.987654]);
    expect(firstRing).toContainEqual([33.987654, 40.987654]);
    expect(firstRing.every((point) => point.every((value) => Number(value.toFixed(6)) === value))).toBe(true);
  });

  it('runs main and writes deterministic format outputs without touching real dist artifacts', async () => {
    const pipeline = await import('../scripts/lib/pipeline.js');
    vi.spyOn(pipeline, 'readJson').mockImplementation((filePath) => {
      const file = String(filePath);
      if (file.includes('regions.metadata.json')) {
        return [{ id: 'TR-R-MAR', name: 'Marmara', aliases: [], member_ids: [] }];
      }
      if (file.includes('provinces.metadata.json')) {
        return [{ id: 'TR-P-34', name: 'Istanbul', aliases: [], member_ids: [] }];
      }
      if (file.includes('districts.metadata.json')) {
        return [{ id: 'TR-D-34-001', name: 'Adalar', aliases: [], member_ids: [] }];
      }
      if (file.includes('yerlesimler.metadata.json')) {
        return [{ id: 'TR-Y-34-001-M-0001', name: 'Maden', province_id: 'TR-P-34', district_id: 'TR-D-34-001' }];
      }
      return {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: { id: file.includes('regions') ? 'TR-R-MAR' : file.includes('provinces') ? 'TR-P-34' : 'TR-D-34-001' },
          geometry: {
            type: 'Polygon',
            coordinates: [[[28.1234567, 40.1234567], [29.1234567, 40.1234567], [29.1234567, 41.1234567], [28.1234567, 40.1234567]]],
          },
        }],
      };
    });
    const writeJsonSpy = vi.spyOn(pipeline, 'writeJson').mockImplementation(() => {});
    const writeJsonCompactSpy = vi.spyOn(pipeline, 'writeJsonCompact').mockImplementation(() => {});
    const mkdirSyncSpy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
    const writeFileSyncSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);
    const xlsxWriteFileSpy = vi.spyOn(XLSX, 'writeFile').mockImplementation(() => {});

    main();

    expect(writeJsonSpy).toHaveBeenCalledTimes(6);
    expect(writeJsonCompactSpy).toHaveBeenCalledTimes(6);
    expect(String(writeJsonSpy.mock.calls[0][0])).toContain('regions.json');
    expect(String(writeJsonSpy.mock.calls[3][0])).toContain('yerlesimler.json');
    expect(String(writeJsonCompactSpy.mock.calls[2][0])).toContain('districts.geojson');
    expect(mkdirSyncSpy).toHaveBeenCalled();
    expect(xlsxWriteFileSpy).toHaveBeenCalledWith(
      expect.objectContaining({ SheetNames: ['regions', 'provinces', 'districts'] }),
      expect.stringContaining(path.join('dist', 'xlsx', 'turkiye-map.xlsx')),
    );

    const textWrites = writeFileSyncSpy.mock.calls
      .filter(([, content, encoding]) => typeof content === 'string' && encoding === 'utf8')
      .map(([filePath, content]) => [String(filePath), content]);

    const sep = path.sep;
    expect(textWrites.find(([filePath]) => filePath.includes(`dist${sep}csv${sep}regions.csv`))?.[1]).toContain(
      'TR-R-MAR,Marmara',
    );
    expect(textWrites.find(([filePath]) => filePath.includes(`dist${sep}csv${sep}regions.csv`))?.[1]?.charCodeAt(0)).toBe(65279);
    expect(textWrites.find(([filePath]) => filePath.includes(`dist${sep}sql${sep}regions.sql`))?.[1]).toContain(
      'INSERT INTO "regions"',
    );
    expect(textWrites.find(([filePath]) => filePath.includes(`dist${sep}wkt${sep}regions.wkt`))?.[1]).toContain(
      'POLYGON',
    );

    const regionKml = textWrites.find(([filePath]) => filePath.includes(`dist${sep}kml${sep}regions.kml`))?.[1];
    expect(regionKml).toContain('<name>Marmara</name>');
    expect(regionKml).toContain('<description>ID: TR-R-MAR');
    expect(regionKml).toContain('<coordinates>28.123457,40.123457,0');

    const kmzBuffer = writeFileSyncSpy.mock.calls.find(([filePath, content]) => (
      String(filePath).includes(`dist${sep}kmz${sep}regions.kmz`) && Buffer.isBuffer(content)
    ))?.[1];
    const kmz = new AdmZip(kmzBuffer);
    expect(kmz.getEntries().map((entry) => entry.entryName)).toEqual(['doc.kml']);
    expect(kmz.readAsText('doc.kml')).toContain('<name>Marmara</name>');

    // Shapefile ZIP
    const shpZipBuffer = writeFileSyncSpy.mock.calls.find(([filePath, content]) => (
      String(filePath).includes(`dist${sep}shp${sep}regions.zip`) && Buffer.isBuffer(content)
    ))?.[1];
    expect(shpZipBuffer).toBeDefined();
    const shpZip = new AdmZip(shpZipBuffer);
    const shpEntryNames = shpZip.getEntries().map((e) => e.entryName).sort();
    expect(shpEntryNames).toEqual(['regions.cpg', 'regions.dbf', 'regions.prj', 'regions.shp', 'regions.shx']);
    // PRJ should contain WGS84
    expect(shpZip.readAsText('regions.prj')).toContain('GCS_WGS_1984');
    // SHP header: file code 9994 at byte 0 (big-endian)
    const shpBuf = shpZip.readFile('regions.shp');
    expect(shpBuf.readInt32BE(0)).toBe(9994);
    // CSV: bbox columns present as separate fields
    const regionCsv = textWrites.find(([filePath]) => filePath.includes(`dist${sep}csv${sep}regions.csv`))?.[1];
    expect(regionCsv).toContain('bbox_min_lon');
    expect(regionCsv).toContain('bbox_min_lat');
    expect(regionCsv).toContain('centroid_lat');
    expect(regionCsv).toContain('geometry_wkt');
    expect(regionCsv).not.toContain('"bbox":');
  });
});
