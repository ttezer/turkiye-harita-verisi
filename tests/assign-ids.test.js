import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  aggregateRegionGeometry,
  applyDisplayOverride,
  applyDistrictCrosswalk,
  applyProvinceCrosswalk,
  applyRegionMembershipToProvince,
  createCrosswalkIndex,
  createOverrideIndex,
  createRegionGeometryCollection,
  createRegionIndex,
  createRegionRecords,
  districtRecord,
  dissolveRegionGeometry,
  findCrosswalk,
  main,
  mergeAliases,
  provinceRecord,
  withGeometryProperties,
} from '../scripts/assign-ids.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('assign-ids helpers', () => {
  it('merges aliases without duplicates', () => {
    expect(mergeAliases(['Merkez', 'Center'], ['Center', 'Kent'])).toEqual(['Merkez', 'Center', 'Kent']);
  });

  it('mergeAliases null ve undefined girişleri tolere eder', () => {
    expect(mergeAliases(null, ['a'])).toEqual(['a']);
    expect(mergeAliases(['a'], null)).toEqual(['a']);
    expect(mergeAliases(null, null)).toEqual([]);
    expect(mergeAliases(undefined, undefined)).toEqual([]);
  });

  it('createOverrideIndex null/eksik payload için boş index döner', () => {
    expect(() => createOverrideIndex(null)).not.toThrow();
    expect(() => createOverrideIndex({})).not.toThrow();
    const index = createOverrideIndex(null);
    expect(index.province.size).toBe(0);
    expect(index.district.size).toBe(0);
  });

  it('applyProvinceCrosswalk null crosswalk için kaydı değiştirmeden döner', () => {
    const record = { aliases: ['Test'], nuts_code: null };
    expect(applyProvinceCrosswalk(record, null)).toEqual(record);
  });

  it('applyDistrictCrosswalk null crosswalk için kaydı değiştirmeden döner', () => {
    const record = { aliases: [], lau_code: null };
    expect(applyDistrictCrosswalk(record, null)).toEqual(record);
  });

  it('indexes and finds crosswalk rows by source id and canonical id', () => {
    const index = createCrosswalkIndex([
      { source_hdx_id: 'TUR034', id: 'TR-P-34', tuik_id: 34 },
      { id: 'TR-P-06', tuik_id: 6 },
    ]);

    expect(findCrosswalk({ source_hdx_id: 'TUR034', id: 'TR-P-34' }, index)?.tuik_id).toBe(34);
    expect(findCrosswalk({ source_hdx_id: 'missing', id: 'TR-P-06' }, index)?.tuik_id).toBe(6);
    expect(findCrosswalk({ source_hdx_id: 'missing', id: 'TR-P-99' }, index)).toBeNull();
  });

  it('applies display overrides and crosswalk enrichments', () => {
    const overrideIndex = createOverrideIndex({
      province_overrides: [{ source_hdx_id: 'TUR034', name: 'İstanbul' }],
      district_overrides: [{ source_hdx_id: 'TUR034001', name: 'Adalar' }],
    });

    const province = applyDisplayOverride({
      source_hdx_id: 'TUR034',
      name: 'Istanbul',
      name_ascii: 'istanbul',
    }, overrideIndex, 'province');

    const district = applyDisplayOverride({
      source_hdx_id: 'TUR034001',
      name: 'Adalar',
      name_ascii: 'adalar',
    }, overrideIndex, 'district');

    expect(province.name).toBe('İstanbul');
    expect(province.name_ascii).toBe('istanbul');
    expect(district.name).toBe('Adalar');

    expect(applyProvinceCrosswalk({
      aliases: ['İstanbul'],
      iso_3166_2: 'TR-34',
      nuts_code: null,
      tuik_id: null,
      icisleri_id: null,
      osm_relation_id: null,
    }, {
      aliases: ['Constantinople'],
      nuts_code: 'TR10',
      tuik_id: 34,
      icisleri_id: 134,
    })).toMatchObject({
      aliases: ['İstanbul', 'Constantinople'],
      iso_3166_2: 'TR-34',
      nuts_code: 'TR10',
      tuik_id: 34,
      icisleri_id: 134,
    });

    expect(applyDistrictCrosswalk({
      aliases: [],
      lau_code: null,
      tuik_id: null,
      icisleri_id: null,
      osm_relation_id: null,
    }, {
      aliases: ['Princes Islands'],
      lau_code: 'LAU-34-001',
      osm_relation_id: 123,
    })).toMatchObject({
      aliases: ['Princes Islands'],
      lau_code: 'LAU-34-001',
      osm_relation_id: 123,
    });
  });

  it('creates province and district records with canonical hierarchy', () => {
    const province = provinceRecord({
      source_hdx_id: 'TUR034',
      name: 'İstanbul',
      name_ascii: 'istanbul',
      centroid: { lat: 41, lon: 29 },
      bbox: [28, 40, 30, 42],
    });

    const regionIndex = createRegionIndex({
      province_membership: [{
        id: 'TR-P-34',
        source_hdx_id: 'TUR034',
        region_id: 'TR-R-MAR',
        region_name: 'Marmara',
      }],
    });
    const regionProvince = applyRegionMembershipToProvince(province, regionIndex);

    const district = districtRecord({
      source_hdx_id: 'TUR034001',
      source_parent_hdx_id: 'TUR034',
      name: 'Adalar',
      name_ascii: 'adalar',
      centroid: { lat: 40.8, lon: 29.1 },
      bbox: [29, 40.7, 29.2, 40.9],
    }, new Map([['TUR034', regionProvince]]));

    expect(regionProvince).toMatchObject({
      id: 'TR-P-34',
      parent_id: 'TR-R-MAR',
      region_id: 'TR-R-MAR',
      region_name: 'Marmara',
    });
    expect(district).toMatchObject({
      id: 'TR-D-34-001',
      parent_id: 'TR-P-34',
      region_id: 'TR-R-MAR',
      slug: 'adalar-istanbul',
    });
  });

  it('binds geometry properties from metadata', () => {
    const collection = {
      type: 'FeatureCollection',
      name: 'turkiye_map.normalized.provinces',
      features: [{
        type: 'Feature',
        properties: { source_hdx_id: 'TUR034' },
        geometry: { type: 'Polygon', coordinates: [[[28, 40], [29, 40], [29, 41], [28, 40]]] },
      }],
    };
    const metadataMap = new Map([['TUR034', {
      id: 'TR-P-34',
      parent_id: 'TR-R-MAR',
      region_id: 'TR-R-MAR',
      level: 'province',
    }]]);

    const result = withGeometryProperties(collection, metadataMap);

    expect(result.name).toBe('turkiye_map.processed.provinces');
    expect(result.features[0].properties).toEqual({
      id: 'TR-P-34',
      parent_id: 'TR-R-MAR',
      region_id: 'TR-R-MAR',
      level: 'province',
    });
  });

  it('throws for missing district parent province and unsupported region geometry', () => {
    expect(() => districtRecord({
      source_hdx_id: 'TUR999001',
      source_parent_hdx_id: 'TUR999',
      name: 'Ghost',
      name_ascii: 'ghost',
      centroid: { lat: 0, lon: 0 },
      bbox: [0, 0, 0, 0],
    }, new Map())).toThrow('Missing parent province for district TUR999001');

    expect(() => aggregateRegionGeometry([
      {
        geometry: {
          type: 'LineString',
          coordinates: [[0, 0], [1, 1]],
        },
      },
    ])).toThrow('Unsupported province geometry type for region aggregation: LineString');
  });

  it('throws for missing region membership and missing geometry metadata', () => {
    expect(() => applyRegionMembershipToProvince({
      id: 'TR-P-34',
      source_hdx_id: 'TUR034',
    }, createRegionIndex({ province_membership: [] }))).toThrow('Missing region membership for province TR-P-34');

    expect(() => withGeometryProperties({
      type: 'FeatureCollection',
      name: 'turkiye_map.normalized.provinces',
      features: [{
        type: 'Feature',
        properties: { source_hdx_id: 'TUR034' },
        geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [0, 0]]] },
      }],
    }, new Map())).toThrow('Missing metadata for geometry feature TUR034');
  });

  it('aggregates region geometry and builds region metadata/geometry collections', () => {
    const featureA = {
      type: 'Feature',
      properties: { id: 'TR-P-34' },
      geometry: { type: 'Polygon', coordinates: [[[28, 40], [29, 40], [29, 41], [28, 40]]] },
    };
    const featureB = {
      type: 'Feature',
      properties: { id: 'TR-P-16' },
      geometry: { type: 'MultiPolygon', coordinates: [
        [[[29, 40], [30, 40], [30, 41], [29, 40]]],
      ] },
    };

    expect(aggregateRegionGeometry([featureA]).type).toBe('Polygon');
    expect(aggregateRegionGeometry([featureA, featureB]).type).toBe('MultiPolygon');

    const provinces = [
      {
        id: 'TR-P-34',
        centroid: { lat: 41, lon: 29 },
      },
      {
        id: 'TR-P-16',
        centroid: { lat: 40.1, lon: 29.5 },
      },
    ];
    const provinceGeometryCollection = {
      type: 'FeatureCollection',
      features: [
        { ...featureA, properties: { id: 'TR-P-34', parent_id: 'TR-R-MAR', region_id: 'TR-R-MAR', level: 'province' } },
        { ...featureB, properties: { id: 'TR-P-16', parent_id: 'TR-R-MAR', region_id: 'TR-R-MAR', level: 'province' } },
      ],
    };
    const reference = {
      regions: [{
        id: 'TR-R-MAR',
        name: 'Marmara',
        slug: 'marmara',
        region_kind: 'geographic-7',
        member_ids: ['TR-P-34', 'TR-P-16'],
      }],
    };

    const regions = createRegionRecords(reference, provinces, provinceGeometryCollection);
    const geometryCollection = createRegionGeometryCollection(regions, reference, provinceGeometryCollection);

    expect(regions[0]).toMatchObject({
      id: 'TR-R-MAR',
      name: 'Marmara',
      region_kind: 'geographic-7',
      member_ids: ['TR-P-34', 'TR-P-16'],
    });
    expect(regions[0].bbox).toEqual([28, 40, 30, 41]);
    expect(geometryCollection.features[0].properties).toEqual({
      id: 'TR-R-MAR',
      parent_id: null,
      region_id: 'TR-R-MAR',
      level: 'region',
    });
    expect(geometryCollection.features[0].geometry.type).toBe('MultiPolygon');
    expect(geometryCollection.features[0].geometry.coordinates).toHaveLength(2);
  });

  it('dissolves shared province borders into a single region outline', () => {
    const provinceGeometryCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { id: 'TR-P-34' },
          geometry: {
            type: 'Polygon',
            coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
          },
        },
        {
          type: 'Feature',
          properties: { id: 'TR-P-16' },
          geometry: {
            type: 'Polygon',
            coordinates: [[[1, 0], [2, 0], [2, 1], [1, 1], [1, 0]]],
          },
        },
      ],
    };

    const geometry = dissolveRegionGeometry(['TR-P-34', 'TR-P-16'], provinceGeometryCollection);

    expect(geometry.type).toBe('MultiPolygon');
    expect(geometry.coordinates).toHaveLength(1);
    expect(new Set(geometry.coordinates[0][0].map((point) => point.join(',')))).toEqual(new Set([
      '0,0',
      '0,1',
      '1,0',
      '1,1',
      '2,0',
      '2,1',
    ]));
  });

  it('throws when region references missing province or geometry member', () => {
    expect(() => createRegionRecords({
      regions: [{
        id: 'TR-R-MAR',
        name: 'Marmara',
        region_kind: 'geographic-7',
        member_ids: ['TR-P-34'],
      }],
    }, [], { type: 'FeatureCollection', features: [] })).toThrow('Region TR-R-MAR references missing province TR-P-34');

    expect(() => createRegionRecords({
      regions: [{
        id: 'TR-R-MAR',
        name: 'Marmara',
        region_kind: 'geographic-7',
        member_ids: ['TR-P-34'],
      }],
    }, [{
      id: 'TR-P-34',
      centroid: { lat: 41, lon: 29 },
    }], { type: 'FeatureCollection', features: [] })).toThrow('Region TR-R-MAR missing province geometry TR-P-34');

    expect(() => createRegionGeometryCollection(
      [{ id: 'TR-R-MAR', level: 'region' }],
      { regions: [{ id: 'TR-R-MAR', member_ids: ['TR-P-34'] }] },
      { type: 'FeatureCollection', features: [] },
    )).toThrow('Region geometry missing member province feature TR-P-34');
  });

  it('runs main and writes processed outputs', async () => {
    const pipeline = await import('../scripts/lib/pipeline.js');
    const readJsonSpy = vi.spyOn(pipeline, 'readJson').mockImplementation((filePath) => {
      const file = String(filePath);
      if (file.includes('provinces.metadata.partial.json')) {
        return [{
          source_hdx_id: 'TUR035',
          name: 'Izmir',
          name_ascii: 'izmir',
          centroid: { lat: 38.4, lon: 27.1 },
          bbox: [26, 37, 28, 39],
        }, {
          source_hdx_id: 'TUR034',
          name: 'Istanbul',
          name_ascii: 'istanbul',
          centroid: { lat: 41, lon: 29 },
          bbox: [28, 40, 30, 42],
        }];
      }
      if (file.includes('districts.metadata.partial.json')) {
        return [{
          source_hdx_id: 'TUR035002',
          source_parent_hdx_id: 'TUR035',
          name: 'Konak',
          name_ascii: 'konak',
          centroid: { lat: 38.4, lon: 27.1 },
          bbox: [27, 38.3, 27.2, 38.5],
        }, {
          source_hdx_id: 'TUR034001',
          source_parent_hdx_id: 'TUR034',
          name: 'Adalar',
          name_ascii: 'adalar',
          centroid: { lat: 40.8, lon: 29.1 },
          bbox: [29, 40.7, 29.2, 40.9],
        }];
      }
      if (file.includes('provinces.geometry.geojson')) {
        return {
          type: 'FeatureCollection',
          name: 'turkiye_map.normalized.provinces',
          features: [{
            type: 'Feature',
            properties: { source_hdx_id: 'TUR035' },
            geometry: { type: 'Polygon', coordinates: [[[26, 37], [28, 37], [28, 39], [26, 37]]] },
          }, {
            type: 'Feature',
            properties: { source_hdx_id: 'TUR034' },
            geometry: { type: 'Polygon', coordinates: [[[28, 40], [30, 40], [30, 42], [28, 40]]] },
          }],
        };
      }
      if (file.includes('districts.geometry.geojson')) {
        return {
          type: 'FeatureCollection',
          name: 'turkiye_map.normalized.districts',
          features: [{
            type: 'Feature',
            properties: { source_hdx_id: 'TUR035002' },
            geometry: { type: 'Polygon', coordinates: [[[27, 38.3], [27.2, 38.3], [27.2, 38.5], [27, 38.3]]] },
          }, {
            type: 'Feature',
            properties: { source_hdx_id: 'TUR034001' },
            geometry: { type: 'Polygon', coordinates: [[[29, 40.7], [29.2, 40.7], [29.2, 40.9], [29, 40.7]]] },
          }],
        };
      }
      if (file.includes('regions.geographic-7.json')) {
        return {
          regions: [{
            id: 'TR-R-EGE',
            name: 'Ege',
            slug: 'ege',
            region_kind: 'geographic-7',
            member_ids: ['TR-P-35'],
          }, {
            id: 'TR-R-MAR',
            name: 'Marmara',
            slug: 'marmara',
            region_kind: 'geographic-7',
            member_ids: ['TR-P-34'],
          }],
          province_membership: [{
            id: 'TR-P-35',
            source_hdx_id: 'TUR035',
            region_id: 'TR-R-EGE',
            region_name: 'Ege',
          }, {
            id: 'TR-P-34',
            source_hdx_id: 'TUR034',
            region_id: 'TR-R-MAR',
            region_name: 'Marmara',
          }],
        };
      }
      throw new Error(`unexpected readJson ${file}`);
    });
    vi.spyOn(pipeline, 'readOptionalJson').mockImplementation((filePath, fallbackValue) => {
      const file = String(filePath);
      if (file.includes('provinces.crosswalk.json')) {
        return [
          { source_hdx_id: 'TUR034', tuik_id: 34, aliases: ['Constantinople'] },
          { source_hdx_id: 'TUR035', tuik_id: 35, aliases: ['Smyrna'] },
        ];
      }
      if (file.includes('districts.crosswalk.json')) {
        return [
          { source_hdx_id: 'TUR034001', lau_code: 'LAU-34-001', aliases: ['Princes Islands'] },
          { source_hdx_id: 'TUR035002', lau_code: 'LAU-35-002', aliases: ['Konak Center'] },
        ];
      }
      if (file.includes('display-name-overrides.json')) {
        return {
          province_overrides: [{ source_hdx_id: 'TUR034', name: 'İstanbul' }, { source_hdx_id: 'TUR035', name: 'İzmir' }],
          district_overrides: [{ source_hdx_id: 'TUR034001', name: 'Adalar' }, { source_hdx_id: 'TUR035002', name: 'Konak' }],
        };
      }
      return fallbackValue;
    });
    const writeJsonSpy = vi.spyOn(pipeline, 'writeJson').mockImplementation(() => {});

    main();

    expect(readJsonSpy).toHaveBeenCalled();
    expect(writeJsonSpy).toHaveBeenCalledTimes(7);
    expect(writeJsonSpy.mock.calls[0][0]).toContain('regions.metadata.json');
    expect(writeJsonSpy.mock.calls[1][1][0]).toMatchObject({
      id: 'TR-P-34',
    });
    expect(writeJsonSpy.mock.calls[2][1][0]).toMatchObject({
      id: 'TR-D-34-001',
    });
    expect(writeJsonSpy.mock.calls[6][1]).toMatchObject({
      region_rows: 2,
      province_region_memberships: 2,
      matched_provinces: 2,
      matched_districts: 2,
    });
    expect(writeJsonSpy.mock.calls[1][1].map((item) => item.id)).toEqual(['TR-P-34', 'TR-P-35']);
    expect(writeJsonSpy.mock.calls[2][1].map((item) => item.id)).toEqual(['TR-D-34-001', 'TR-D-35-002']);
  });
});
