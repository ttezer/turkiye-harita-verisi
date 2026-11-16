import { describe, expect, it } from 'vitest';
import {
  buildGeometryProperties,
  findCompositeSettlementMatches,
} from '../scripts/normalize-mahalle-geometrileri.js';

describe('mahalle geometry metadata', () => {
  it('resolves a parent-qualified KML name to the canonical settlement', () => {
    const settlement = {
      id: 'TR-Y-67-002-M-0025',
      name: 'Merkez',
      district_id: 'TR-D-67-002',
      administrative_unit_name: 'Karapınar',
    };

    const matches = findCompositeSettlementMatches('TR-D-67-002', 'Karapınar Merkez', {
      byDistrict: new Map([['TR-D-67-002', [settlement]]]),
    });

    expect(matches).toEqual([settlement]);
  });

  it('keeps source-only metadata hierarchically complete', () => {
    expect(buildGeometryProperties(
      {
        province_id: 'TR-P-67',
        province_name: 'Zonguldak',
        source_label: 'Manuel Kaynak',
        source_name: 'Zonguldak Mahalle KML',
      },
      { id: 'TR-D-67-002', name: 'Çaycuma' },
      'Gökçeler',
      { id: 'TR-Y-67-002-M-SRC-GOKCELER', name: 'Gökçeler' },
    )).toMatchObject({
      province_id: 'TR-P-67',
      province_name: 'Zonguldak',
      district_id: 'TR-D-67-002',
      district_name: 'Çaycuma',
      source_label: 'Manuel Kaynak',
    });
  });

  it('preserves a parent-qualified source name for display after canonical matching', () => {
    expect(buildGeometryProperties(
      {
        province_id: 'TR-P-67',
        province_name: 'Zonguldak',
        source_label: 'Manuel Kaynak',
      },
      { id: 'TR-D-67-002', name: 'Çaycuma' },
      'Karapınar Merkez',
      {},
      {
        id: 'TR-Y-67-002-M-0025',
        parent_id: 'TR-D-67-002',
        province_id: 'TR-P-67',
        district_id: 'TR-D-67-002',
        name: 'Merkez',
      },
      'Karapınar Merkez',
    )).toMatchObject({
      id: 'TR-Y-67-002-M-0025',
      name: 'Karapınar Merkez',
      source_raw_name: 'Karapınar Merkez',
    });
  });

  it('keeps canonical settlement type and hierarchy in geometry properties', () => {
    expect(buildGeometryProperties(
      {
        province_id: 'TR-P-14',
        province_name: 'Bolu',
        source_label: 'Açık Veri',
      },
      { id: 'TR-D-14-001', name: 'Bolu' },
      'Afşar',
      {},
      {
        id: 'TR-Y-14-001-K-0001',
        level: 'yerlesim',
        type: 'koy',
        parent_id: 'TR-D-14-001',
        province_id: 'TR-P-14',
        district_id: 'TR-D-14-001',
        name: 'Afşar',
      },
    )).toMatchObject({
      id: 'TR-Y-14-001-K-0001',
      type: 'koy',
      province_name: 'Bolu',
      district_name: 'Bolu',
      source: 'Açık Veri',
      source_label: 'Açık Veri',
    });
  });
});
