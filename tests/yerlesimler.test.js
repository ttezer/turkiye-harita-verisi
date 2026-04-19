import { describe, expect, it } from 'vitest';
import {
  assignSettlementIds,
  createDistrictIndex,
  createProvinceIndex,
  parseKoyRows,
  parseMahalleRows,
  titleCaseTurkish,
} from '../scripts/normalize-yerlesimler.js';

const provinces = [
  { id: 'TR-P-02', name: 'Adıyaman' },
  { id: 'TR-P-34', name: 'İstanbul' },
];

const districts = [
  { id: 'TR-D-02-001', parent_id: 'TR-P-02', name: 'Adıyaman', slug: 'adiyaman-adiyaman' },
  { id: 'TR-D-02-002', parent_id: 'TR-P-02', name: 'Besni', slug: 'besni-adiyaman' },
  { id: 'TR-D-34-021', parent_id: 'TR-P-34', name: 'Gazi Osmanpaşa', slug: 'gazi-osmanpasa-istanbul' },
];

describe('normalize-yerlesimler helpers', () => {
  it('title-cases Turkish source names', () => {
    expect(titleCaseTurkish('ÇAĞLAYAN İNÖNÜ')).toBe('Çağlayan İnönü');
  });

  it('parses koy rows and resolves MERKEZ districts', () => {
    const rows = [
      ['1', '', 'KUYUCAK', '', '', 'MERKEZ', '', 'ADIYAMAN'],
      ['2', '', 'AKDURAK', '', '', 'BESNİ', '', 'ADIYAMAN'],
    ];
    const parsed = parseKoyRows(rows, createProvinceIndex(provinces), createDistrictIndex(districts));

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      type: 'koy',
      parent_id: 'TR-D-02-001',
      name: 'Kuyucak',
    });
    expect(parsed[1].parent_id).toBe('TR-D-02-002');
  });

  it('parses mahalle rows with il merkezi and compact district aliases', () => {
    const rows = [
      ['1', '', '', 'CUMHURİYET', '', 'ADIYAMAN -> ADIYAMAN-İL MERKEZİ'],
      ['2', '', '', 'MERKEZ', '', 'İSTANBUL -> GAZİOSMANPAŞA'],
    ];
    const parsed = parseMahalleRows(rows, createProvinceIndex(provinces), createDistrictIndex(districts));

    expect(parsed.map((item) => item.parent_id)).toEqual(['TR-D-02-001', 'TR-D-34-021']);
  });

  it('assigns deterministic type-scoped ids and slug suffixes', () => {
    const rows = [
      ['1', '', 'KUYUCAK', '', '', 'MERKEZ', '', 'ADIYAMAN'],
      ['2', '', 'KUYUCAK', '', '', 'MERKEZ', '', 'ADIYAMAN'],
    ];
    const parsed = parseKoyRows(rows, createProvinceIndex(provinces), createDistrictIndex(districts));
    const withIds = assignSettlementIds(parsed);

    expect(withIds.map((item) => item.id)).toEqual([
      'TR-Y-02-001-K-0001',
      'TR-Y-02-001-K-0002',
    ]);
    expect(new Set(withIds.map((item) => item.slug)).size).toBe(2);
  });
});
