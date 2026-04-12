import { describe, expect, it } from 'vitest';
import {
  findDistrictsByProvinceId,
  findDistrictsByRegionId,
  findProvinceById,
  findProvincesByRegionId,
  findRegionById,
  getDistricts,
  getDistrictGeometry,
  getProvinces,
  getProvinceGeometry,
  getRegions,
  getRegionGeometry,
} from '../packages/js/index.js';

describe('packages/js public API', () => {
  it('returns base collections', () => {
    expect(getRegions()).toHaveLength(7);
    expect(getProvinces()).toHaveLength(81);
    expect(getDistricts()).toHaveLength(973);
  });

  it('finds a region and its province members', () => {
    const marmara = findRegionById('TR-R-MAR');
    const provinces = findProvincesByRegionId('TR-R-MAR');

    expect(marmara?.name).toBe('Marmara');
    expect(provinces).toHaveLength(11);
    expect(provinces.some((item) => item.id === 'TR-P-34')).toBe(true);
  });

  it('finds provinces and districts through parent relationships', () => {
    const istanbul = findProvinceById('TR-P-34');
    const provinceDistricts = findDistrictsByProvinceId('TR-P-34');
    const regionDistricts = findDistrictsByRegionId('TR-R-MAR');

    expect(istanbul?.region_id).toBe('TR-R-MAR');
    expect(provinceDistricts.length).toBeGreaterThan(0);
    expect(regionDistricts.length).toBeGreaterThan(provinceDistricts.length);
    expect(regionDistricts.some((item) => item.parent_id === 'TR-P-34')).toBe(true);
  });

  it('returns null for unknown lookups', () => {
    expect(findRegionById('TR-R-XXX')).toBeNull();
    expect(findProvinceById('TR-P-99')).toBeNull();
  });

  it('loads region, province and district geometry collections', () => {
    expect(getRegionGeometry().features).toHaveLength(7);
    expect(getProvinceGeometry().features).toHaveLength(81);
    expect(getDistrictGeometry().features).toHaveLength(973);
  });
});
