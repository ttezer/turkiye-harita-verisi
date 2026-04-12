import {
  getRegions,
  findRegionById,
  findProvincesByRegionId,
  getProvinces,
  findProvinceById,
  findDistrictsByProvinceId,
  getProvinceGeometry,
  getRegionGeometry,
} from '../packages/js/index.js';

const regions = getRegions();
console.log('Region count:', regions.length);

const marmara = findRegionById('TR-R-MAR');
console.log('Region:', marmara?.name);

const marmaraProvinces = findProvincesByRegionId('TR-R-MAR');
console.log('Provinces for TR-R-MAR:', marmaraProvinces.map((item) => item.name));

const provinces = getProvinces();
console.log('Province count:', provinces.length);

const istanbul = findProvinceById('TR-P-34');
console.log('Province:', istanbul?.name);

const istanbulDistricts = findDistrictsByProvinceId('TR-P-34');
console.log('Districts for TR-P-34:', istanbulDistricts.map((item) => item.name));

const provinceGeometry = getProvinceGeometry();
console.log('Province geometry feature count:', provinceGeometry.features.length);

const regionGeometry = getRegionGeometry();
console.log('Region geometry feature count:', regionGeometry.features.length);
