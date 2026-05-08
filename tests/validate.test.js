import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import { main, matchesType, validateCollection, validateMetadataCollection, validateRelationships, validateValue } from '../scripts/validate.js';

const region = {
  id: 'TR-R-MAR',
  slug: 'marmara',
  hdx_id: 'GEOGRAPHIC7:TR-R-MAR',
  member_ids: ['TR-P-34'],
};

const province = {
  id: 'TR-P-34',
  parent_id: 'TR-R-MAR',
  region_id: 'TR-R-MAR',
  slug: 'istanbul',
  hdx_id: 'TUR034',
};

const district = {
  id: 'TR-D-34-001',
  parent_id: 'TR-P-34',
  region_id: 'TR-R-MAR',
  plate_code: '34',
  district_local_code: '001',
  slug: 'adalar-istanbul',
  hdx_id: 'TUR034001',
};

const settlement = {
  id: 'TR-Y-34-001-M-0001',
  level: 'yerlesim',
  type: 'mahalle',
  parent_id: 'TR-D-34-001',
  province_id: 'TR-P-34',
  district_id: 'TR-D-34-001',
  slug: 'maden-mahalle-adalar-istanbul-0001',
};

describe('validateCollection', () => {
  it('rejects duplicate metadata ids', () => {
    const schema = {
      type: 'object',
      properties: {
        id: { type: 'string' },
        slug: { type: 'string' },
        hdx_id: { type: 'string' },
      },
      required: ['id', 'slug', 'hdx_id'],
      additionalProperties: true,
    };

    const metadata = [
      { id: 'A', slug: 'alpha', hdx_id: 'SRC-1' },
      { id: 'A', slug: 'beta', hdx_id: 'SRC-2' },
    ];
    const geometry = {
      features: [
        { properties: { id: 'A' } },
        { properties: { id: 'A' } },
      ],
    };

    expect(() => validateCollection(metadata, geometry, schema, 'unit')).toThrow('unit duplicate id A');
  });
});

describe('validateMetadataCollection', () => {
  it('validates metadata-only datasets', () => {
    const schema = {
      type: 'object',
      properties: {
        id: { type: 'string' },
        slug: { type: 'string' },
      },
      required: ['id', 'slug'],
      additionalProperties: true,
    };

    expect(() => validateMetadataCollection([{ id: 'A', slug: 'alpha' }], schema, 'unit')).not.toThrow();
  });
});

describe('validateValue helpers', () => {
  it('covers type helpers and schema constraints', () => {
    expect(matchesType(null, 'null')).toBe(true);
    expect(matchesType([], 'array')).toBe(true);
    expect(matchesType(3, 'integer')).toBe(true);
    expect(matchesType({}, 'object')).toBe(true);
    expect(matchesType('x', 'string')).toBe(true);

    expect(() => validateValue('ab', { type: 'string', minLength: 3 }, {}, 'unit')).toThrow('unit must have minLength 3');
    expect(() => validateValue('abc', { type: 'string', pattern: '^z' }, {}, 'unit')).toThrow('unit does not match pattern ^z');
    expect(() => validateValue(2, { const: 1 }, {}, 'unit')).toThrow('unit must equal 1');
    expect(() => validateValue([1, 1], { type: 'array', uniqueItems: true }, {}, 'unit')).toThrow('unit must contain unique items');
    expect(() => validateValue([], { type: 'array', minItems: 1 }, {}, 'unit')).toThrow('unit must have at least 1 items');
    expect(() => validateValue([1, 2], { type: 'array', maxItems: 1 }, {}, 'unit')).toThrow('unit must have at most 1 items');
    expect(() => validateValue({ ok: true, extra: true }, {
      type: 'object',
      properties: { ok: { type: 'boolean' } },
      additionalProperties: false,
    }, {}, 'unit')).toThrow('unit.extra is not allowed');
    expect(() => validateValue({}, {
      type: 'object',
      required: ['ok'],
      properties: { ok: { type: 'boolean' } },
    }, {}, 'unit')).toThrow('unit.ok is required');

    expect(() => validateValue(['aa', 2], {
      type: 'array',
      prefixItems: [{ type: 'string' }, { type: 'integer' }],
    }, {}, 'unit')).not.toThrow();

    expect(() => validateValue('ok', { $ref: '#/$defs/myString' }, {
      myString: { type: 'string' },
    }, 'unit')).not.toThrow();
  });
});

describe('validateRelationships', () => {
  it('accepts a valid region-province-district chain', () => {
    expect(() => validateRelationships([region], [province], [district], [settlement])).not.toThrow();
  });

  it('rejects district region mismatch against parent province', () => {
    const invalidDistrict = {
      ...district,
      region_id: 'TR-R-EGE',
    };

    expect(() => validateRelationships([region], [province], [invalidDistrict]))
      .toThrow('District TR-D-34-001 region_id does not match parent province');
  });

  it('rejects non gap-free district local codes', () => {
    const invalidDistrict = {
      ...district,
      district_local_code: '002',
      id: 'TR-D-34-002',
      hdx_id: 'TUR034002',
    };

    expect(() => validateRelationships([region], [province], [invalidDistrict]))
      .toThrow('District codes for TR-P-34 are not gap-free at 2');
  });

  it('rejects missing region membership, missing parent province, unresolved source parent and bad prefix', () => {
    expect(() => validateRelationships([{
      ...region,
      member_ids: ['TR-P-35'],
    }], [{
      ...province,
      id: 'TR-P-35',
      hdx_id: 'TUR035',
      parent_id: 'TR-R-EGE',
      region_id: 'TR-R-EGE',
    }], [])).toThrow('Province TR-P-35 has missing parent region TR-R-EGE');

    expect(() => validateRelationships([{
      ...region,
      member_ids: ['TR-P-34'],
    }], [
      province,
      {
        ...province,
        id: 'TR-P-35',
        hdx_id: 'TUR035',
        parent_id: 'TR-R-MAR',
        region_id: 'TR-R-MAR',
      },
    ], [])).toThrow('Province TR-P-35 is missing from region membership coverage');

    expect(() => validateRelationships([region], [province], [{
      ...district,
      parent_id: 'TR-P-99',
    }])).toThrow('District TR-D-34-001 has missing parent_id TR-P-99');

    expect(() => validateRelationships([region], [{
      ...province,
      hdx_id: 'TUR035',
    }], [district])).toThrow('District TR-D-34-001 cannot resolve parent hdx_id TUR034');

    expect(() => validateRelationships([region], [province], [{
      ...district,
      hdx_id: 'BAD034001',
    }])).toThrow('District TR-D-34-001 hdx_id does not match parent prefix');

    expect(() => validateRelationships([region], [province], [district], [{
      ...settlement,
      province_id: 'TR-P-99',
    }])).toThrow('Yerlesim TR-Y-34-001-M-0001 has missing province_id TR-P-99');
  });

  it('runs main and writes build report', async () => {
    const pipeline = await import('../scripts/lib/pipeline.js');
    vi.spyOn(pipeline, 'readJson').mockImplementation((filePath) => {
      const file = String(filePath);
      if (file.includes('yerlesim.schema.json')) {
        return {
          type: 'object',
          properties: {
            id: { type: 'string' },
            slug: { type: 'string' },
          },
          required: ['id', 'slug'],
          additionalProperties: true,
        };
      }
      if (file.includes('region.schema.json') || file.includes('province.schema.json') || file.includes('district.schema.json')) {
        return {
          type: 'object',
          properties: {
            id: { type: 'string' },
            slug: { type: 'string' },
            hdx_id: { type: 'string' },
            parent_id: { type: ['string', 'null'] },
            region_id: { type: ['string', 'null'] },
            plate_code: { type: ['string', 'null'] },
            district_local_code: { type: ['string', 'null'] },
            member_ids: { type: 'array', items: { type: 'string' } },
          },
          required: ['id', 'slug', 'hdx_id'],
          additionalProperties: true,
        };
      }
      if (file.includes('regions.metadata.json')) {
        return [region];
      }
      if (file.includes('provinces.metadata.json')) {
        return [province];
      }
      if (file.includes('districts.metadata.json')) {
        return [district];
      }
      if (file.includes('yerlesimler.metadata.json')) {
        return [settlement];
      }
      if (file.includes('crosswalk-report.json')) {
        return { matched_provinces: 1, matched_districts: 0 };
      }
      if (file.includes('yerlesimler-report.json')) {
        return { settlement_count: 1 };
      }
      return {
        type: 'FeatureCollection',
        features: [{
          properties: {
            id: file.includes('regions') ? 'TR-R-MAR' : file.includes('provinces') ? 'TR-P-34' : 'TR-D-34-001',
          },
        }],
      };
    });
    const writeJsonSpy = vi.spyOn(pipeline, 'writeJson').mockImplementation(() => {});

    main();

    expect(writeJsonSpy).toHaveBeenCalledTimes(1);
    expect(writeJsonSpy.mock.calls[0][0]).toContain('build-report.json');
    expect(writeJsonSpy.mock.calls[0][1]).toMatchObject({
      region_count: 1,
      province_count: 1,
      district_count: 1,
      settlement_count: 1,
      status: 'ok',
    });
  });
});
