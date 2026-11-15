import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { main, targets } from '../scripts/clean.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('clean script', () => {
  it('removes every generated artifact target', () => {
    const rmSync = vi.spyOn(fs, 'rmSync').mockImplementation(() => {});

    main();

    expect(rmSync).toHaveBeenCalledTimes(targets.length);
    expect(rmSync).toHaveBeenCalledWith(expect.stringContaining('regions.metadata.json'), { recursive: true, force: true });
    expect(rmSync).toHaveBeenCalledWith(expect.stringContaining('districts.geojson'), { recursive: true, force: true });
    expect(rmSync).toHaveBeenCalledWith(expect.stringContaining(path.join('dist', 'topojson')), { recursive: true, force: true });
    expect(rmSync).toHaveBeenCalledWith(expect.stringContaining(path.join('dist', 'gml')), { recursive: true, force: true });
    expect(rmSync).toHaveBeenCalledWith(expect.stringContaining(path.join('dist', 'dxf')), { recursive: true, force: true });
    expect(rmSync).toHaveBeenCalledWith(expect.stringContaining(path.join('dist', 'osm')), { recursive: true, force: true });
    expect(rmSync).toHaveBeenCalledWith(expect.stringContaining(path.join('dist', 'gpkg')), { recursive: true, force: true });
  });
});
