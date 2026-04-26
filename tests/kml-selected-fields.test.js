import { describe, expect, it } from 'vitest';
import { featureCollectionToKml } from '../download.js';

describe('KML selected fields', () => {
  it('keeps placemarks when selected export fields omit id', () => {
    const items = [{
      id: 'TR-Y-06-001-M-TEST',
      level: 'yerlesim',
      name: 'Test Mahalle',
      parent_name: 'Test Ilce',
      province_name: 'Ankara',
    }];
    const geometryCollection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: { id: 'TR-Y-06-001-M-TEST' },
        geometry: {
          type: 'Polygon',
          coordinates: [[[32, 39], [33, 39], [33, 40], [32, 39]]],
        },
      }],
    };

    const kml = featureCollectionToKml(
      'test',
      items,
      geometryCollection,
      (item) => ({
        parent_name: item.parent_name,
        province_name: item.province_name,
      }),
    );

    expect(kml.match(/<Placemark>/g)).toHaveLength(1);
    expect(kml).toContain('<name>Test Mahalle</name>');
    expect(kml).toContain('İlçe Adı: Test Ilce');
    expect(kml).toContain('İl Adı: Ankara');
    expect(kml).toContain('<displayName>İlçe Adı</displayName>');
    expect(kml).toContain('<displayName>İl Adı</displayName>');
    expect(kml).not.toContain('province_name: Ankara');
  });
});
