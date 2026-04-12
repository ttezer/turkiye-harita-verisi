import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertFileExists,
  computeBbox,
  getHdxLayerPaths,
  readFeatureCollection,
  readJson,
  readOptionalJson,
  rewindGeometry,
  roundGeometryCoordinates,
  writeJson,
  writeJsonCompact,
} from '../scripts/lib/pipeline.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('pipeline IO helpers', () => {
  it('writes and reads json files', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'turkiye-map-io-'));
    const prettyPath = path.join(tempDir, 'nested', 'pretty.json');
    const compactPath = path.join(tempDir, 'nested', 'compact.json');

    writeJson(prettyPath, { hello: 'world' });
    writeJsonCompact(compactPath, { ok: true });

    expect(readJson(prettyPath)).toEqual({ hello: 'world' });
    expect(fs.readFileSync(compactPath, 'utf8')).toBe('{"ok":true}');

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns fallback for missing optional json and throws for missing required file', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'turkiye-map-optional-'));
    const missingPath = path.join(tempDir, 'missing.json');
    const existingPath = path.join(tempDir, 'existing.json');
    fs.writeFileSync(existingPath, JSON.stringify({ ok: true }));

    expect(readOptionalJson(missingPath, ['fallback'])).toEqual(['fallback']);
    expect(readOptionalJson(existingPath, ['fallback'])).toEqual({ ok: true });
    expect(() => assertFileExists(missingPath, 'custom-label')).toThrow('Required file missing: custom-label');

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('validates feature collections and rounds nested multipolygon coordinates', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'turkiye-map-feature-'));
    const featurePath = path.join(tempDir, 'feature.json');
    fs.writeFileSync(featurePath, JSON.stringify({
      type: 'FeatureCollection',
      features: [],
    }));

    expect(readFeatureCollection(featurePath)).toMatchObject({ type: 'FeatureCollection', features: [] });
    fs.writeFileSync(path.join(tempDir, 'bad.json'), JSON.stringify({ type: 'Feature', properties: {} }));
    expect(() => readFeatureCollection(path.join(tempDir, 'bad.json'))).toThrow(`Expected FeatureCollection: ${path.join(tempDir, 'bad.json')}`);

    const rounded = roundGeometryCoordinates({
      type: 'MultiPolygon',
      coordinates: [[[[28.12345678, 40.12345678], [29.98765432, 41.98765432], [28.12345678, 40.12345678]]]],
    }, 4);

    expect(rounded.coordinates[0][0][0]).toEqual([28.1235, 40.1235]);
    expect(roundGeometryCoordinates({ type: 'Point', coordinates: null }).coordinates).toBeNull();
    expect(computeBbox({ type: 'Polygon', coordinates: [[[28, 40], null, [29, 41], [28, 40]]] })).toEqual([28, 40, 29, 41]);
    expect(rewindGeometry({
      type: 'MultiPolygon',
      coordinates: [[[[28, 40], [28, 41], [29, 41], [28, 40]]]],
    }).type).toBe('MultiPolygon');
    expect(rewindGeometry({ type: 'Point', coordinates: [0, 0] }).type).toBe('Point');

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns HDX layer paths and skips extraction when extracted files exist', async () => {
    const existsSync = vi.spyOn(fs, 'existsSync').mockImplementation((target) => {
      const file = String(target);
      if (file.endsWith('tur_admin_boundaries.geojson.zip')) {
        return true;
      }
      if (file.endsWith('tur_admin1.geojson') || file.endsWith('tur_admin2.geojson')) {
        return true;
      }
      return false;
    });
    const rmSync = vi.spyOn(fs, 'rmSync').mockImplementation(() => {});
    const mkdirSync = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);

    const result = getHdxLayerPaths();

    expect(result.provincePath).toContain('tur_admin1.geojson');
    expect(result.districtPath).toContain('tur_admin2.geojson');
    expect(rmSync).not.toHaveBeenCalled();
    expect(mkdirSync).toHaveBeenCalled();
    existsSync.mockRestore();
  });

  it('extracts HDX zip when extracted files are missing', async () => {
    const pipeline = await import('../scripts/lib/pipeline.js');
    const originalZip = pipeline.paths.hdxZip;
    const originalExtractedDir = pipeline.paths.hdxExtractedDir;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'turkiye-map-hdx-'));
    const zipPath = path.join(tempDir, 'hdx.zip');
    const extractedDir = path.join(tempDir, 'extracted');

    const zip = new AdmZip();
    zip.addFile('tur_admin1.geojson', Buffer.from('{"type":"FeatureCollection","features":[]}'));
    zip.addFile('tur_admin2.geojson', Buffer.from('{"type":"FeatureCollection","features":[]}'));
    zip.writeZip(zipPath);

    pipeline.paths.hdxZip = zipPath;
    pipeline.paths.hdxExtractedDir = extractedDir;

    try {
      const result = getHdxLayerPaths();
      expect(fs.existsSync(result.provincePath)).toBe(true);
      expect(fs.existsSync(result.districtPath)).toBe(true);
    } finally {
      pipeline.paths.hdxZip = originalZip;
      pipeline.paths.hdxExtractedDir = originalExtractedDir;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('surfaces extraction failures from invalid HDX archives', async () => {
    const pipeline = await import('../scripts/lib/pipeline.js');
    const originalZip = pipeline.paths.hdxZip;
    const originalExtractedDir = pipeline.paths.hdxExtractedDir;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'turkiye-map-hdx-bad-'));
    const zipPath = path.join(tempDir, 'broken.zip');
    const extractedDir = path.join(tempDir, 'extracted');
    fs.writeFileSync(zipPath, 'not-a-zip');

    pipeline.paths.hdxZip = zipPath;
    pipeline.paths.hdxExtractedDir = extractedDir;

    try {
      expect(() => getHdxLayerPaths()).toThrow('Failed to extract HDX zip:');
    } finally {
      pipeline.paths.hdxZip = originalZip;
      pipeline.paths.hdxExtractedDir = originalExtractedDir;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
