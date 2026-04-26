import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  main,
  normalizeDistrict,
  normalizeProvince,
  preferredName,
  stripFeature,
} from '../scripts/normalize.js';

afterEach(() => {
  vi.restoreAllMocks();
});

function polygonFeature(properties) {
  return {
    type: 'Feature',
    properties,
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [32.1, 39.8],
        [33.1, 39.8],
        [33.1, 40.2],
        [32.1, 40.2],
        [32.1, 39.8],
      ]],
    },
  };
}

describe('normalize helpers', () => {
  it('prefers Turkish display names when available', () => {
    expect(preferredName({ adm1_name: 'Istanbul', adm1_name1: 'İstanbul' }, 'adm1_name', 'adm1_name1')).toBe('İstanbul');
    expect(preferredName({ adm1_name: 'Ankara' }, 'adm1_name', 'adm1_name1')).toBe('Ankara');
  });

  it('normalizes province and district metadata from HDX features', () => {
    const province = normalizeProvince(polygonFeature({
      adm1_pcode: 'TUR006',
      adm1_name: 'Ankara',
      adm1_name1: 'Ankara',
      valid_on: '2022-01-01',
      valid_to: null,
      version: 'v01',
      center_lat: 39.9,
      center_lon: 32.8,
      area_sqkm: 25000,
    }));
    const district = normalizeDistrict(polygonFeature({
      adm2_pcode: 'TUR006001',
      adm1_pcode: 'TUR006',
      adm2_name: 'Cankaya',
      adm2_name1: 'Çankaya',
      adm1_name: 'Ankara',
      adm1_name1: 'Ankara',
      valid_on: '2022-01-01',
      valid_to: null,
      version: 'v01',
      center_lat: 39.91,
      center_lon: 32.85,
      area_sqkm: 500,
    }));

    expect(province).toMatchObject({
      source_hdx_id: 'TUR006',
      name: 'Ankara',
      plate_code: '006',
      geometry_type: 'Polygon',
    });
    expect(district).toMatchObject({
      source_hdx_id: 'TUR006001',
      source_parent_hdx_id: 'TUR006',
      name: 'Çankaya',
      parent_name: 'Ankara',
      parent_name_ascii: 'ankara',
    });
  });

  it('strips features to build-time geometry provenance only', () => {
    const province = stripFeature(polygonFeature({ adm1_pcode: 'TUR006' }), 'province');
    const district = stripFeature(polygonFeature({ adm1_pcode: 'TUR006', adm2_pcode: 'TUR006001' }), 'district');

    expect(province.properties).toEqual({
      level: 'province',
      source_hdx_id: 'TUR006',
      source_parent_hdx_id: null,
    });
    expect(district.properties).toEqual({
      level: 'district',
      source_hdx_id: 'TUR006001',
      source_parent_hdx_id: 'TUR006',
    });
  });

  it('writes normalized outputs from HDX collections', async () => {
    const pipeline = await import('../scripts/lib/pipeline.js');

    const ensureDirSpy = vi.spyOn(pipeline, 'ensureDir').mockImplementation(() => {});
    vi.spyOn(pipeline, 'getHdxLayerPaths').mockReturnValue({
      provincePath: 'province.geojson',
      districtPath: 'district.geojson',
    });
    vi.spyOn(pipeline, 'readFeatureCollection')
      .mockImplementation((filePath) => {
        if (filePath === 'province.geojson') {
          return {
            type: 'FeatureCollection',
            features: [polygonFeature({
              adm1_pcode: 'TUR006',
              adm1_name: 'Ankara',
              adm1_name1: 'Ankara',
              valid_on: '2022-01-01',
              valid_to: null,
              version: 'v01',
              center_lat: 39.9,
              center_lon: 32.8,
              area_sqkm: 25000,
            })],
          };
        }
        return {
          type: 'FeatureCollection',
          features: [polygonFeature({
            adm2_pcode: 'TUR006001',
            adm1_pcode: 'TUR006',
            adm2_name: 'Cankaya',
            adm2_name1: 'Çankaya',
            adm1_name: 'Ankara',
            adm1_name1: 'Ankara',
            valid_on: '2022-01-01',
            valid_to: null,
            version: 'v01',
            center_lat: 39.91,
            center_lon: 32.85,
            area_sqkm: 500,
          })],
        };
      });

    const writeJsonSpy = vi.spyOn(pipeline, 'writeJson').mockImplementation(() => {});

    main({ source: 'hdx' });

    expect(ensureDirSpy).toHaveBeenCalledWith(pipeline.paths.normalizedDir);
    expect(writeJsonSpy).toHaveBeenCalledTimes(5);
    expect(writeJsonSpy.mock.calls[0][0]).toContain('provinces.metadata.partial.json');
    expect(writeJsonSpy.mock.calls[4][1]).toMatchObject({
      source: 'hdx',
      dataset: 'cod-ab-tur',
      province_count: 1,
      district_count: 1,
    });
  });
});
