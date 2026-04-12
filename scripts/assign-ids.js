#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { merge } from 'topojson-client';
import { topology } from 'topojson-server';
import {
  computeBbox,
  districtCodeFromHdxPcode,
  districtIdFromParts,
  paths,
  plateCodeFromHdxPcode,
  provinceIdFromPlate,
  readJson,
  readOptionalJson,
  runPipelineStep,
  sortedCopy,
  toNameAscii,
  toSlug,
  writeJson,
  logStep,
  rewindGeometry,
} from './lib/pipeline.js';

const scriptPath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;

export function createCrosswalkIndex(rows) {
  const bySourceHdxId = new Map();
  const byId = new Map();

  for (const row of rows) {
    if (row.source_hdx_id) {
      bySourceHdxId.set(row.source_hdx_id, row);
    }
    if (row.id) {
      byId.set(row.id, row);
    }
  }

  return { bySourceHdxId, byId };
}

export function mergeAliases(baseAliases, incomingAliases) {
  return [...new Set([...(baseAliases || []), ...(incomingAliases || [])])];
}

export function createOverrideIndex(payload) {
  return {
    province: new Map((payload?.province_overrides || []).map((row) => [row.source_hdx_id, row])),
    district: new Map((payload?.district_overrides || []).map((row) => [row.source_hdx_id, row])),
  };
}

export function applyDisplayOverride(item, overrideIndex, level) {
  const override = overrideIndex[level].get(item.source_hdx_id);

  if (!override || !override.name) {
    return item;
  }

  return {
    ...item,
    name: override.name,
    name_ascii: toNameAscii(override.name),
  };
}

export function applyProvinceCrosswalk(record, crosswalk) {
  if (!crosswalk) {
    return record;
  }

  return {
    ...record,
    aliases: mergeAliases(record.aliases, crosswalk.aliases),
    iso_3166_2: crosswalk.iso_3166_2 ?? record.iso_3166_2,
    nuts_code: crosswalk.nuts_code ?? record.nuts_code,
    tuik_id: crosswalk.tuik_id ?? record.tuik_id,
    icisleri_id: crosswalk.icisleri_id ?? record.icisleri_id,
    osm_relation_id: crosswalk.osm_relation_id ?? record.osm_relation_id,
  };
}

export function applyDistrictCrosswalk(record, crosswalk) {
  if (!crosswalk) {
    return record;
  }

  return {
    ...record,
    aliases: mergeAliases(record.aliases, crosswalk.aliases),
    lau_code: crosswalk.lau_code ?? record.lau_code,
    tuik_id: crosswalk.tuik_id ?? record.tuik_id,
    icisleri_id: crosswalk.icisleri_id ?? record.icisleri_id,
    osm_relation_id: crosswalk.osm_relation_id ?? record.osm_relation_id,
  };
}

export function findCrosswalk(record, crosswalkIndex) {
  return (
    crosswalkIndex.bySourceHdxId.get(record.source_hdx_id) ||
    crosswalkIndex.byId.get(record.id) ||
    null
  );
}

export function provinceRecord(item) {
  const plateCode = plateCodeFromHdxPcode(item.source_hdx_id);
  return {
    id: provinceIdFromPlate(plateCode),
    level: 'province',
    parent_id: null,
    region_id: null,
    region_name: null,
    name: item.name,
    name_ascii: item.name_ascii,
    slug: toSlug(item.name_ascii),
    aliases: [],
    plate_code: plateCode,
    district_local_code: null,
    iso_3166_2: `TR-${plateCode}`,
    nuts_code: null,
    tuik_id: null,
    icisleri_id: null,
    osm_relation_id: null,
    source_hdx_id: item.source_hdx_id,
    centroid: item.centroid,
    bbox: item.bbox,
  };
}

export function districtRecord(item, provinceMap) {
  const parentProvince = provinceMap.get(item.source_parent_hdx_id);
  if (!parentProvince) {
    throw new Error(`Missing parent province for district ${item.source_hdx_id}`);
  }

  const districtLocalCode = districtCodeFromHdxPcode(item.source_hdx_id);

  return {
    id: districtIdFromParts(parentProvince.plate_code, districtLocalCode),
    level: 'district',
    parent_id: parentProvince.id,
    region_id: parentProvince.region_id,
    region_name: parentProvince.region_name,
    name: item.name,
    name_ascii: item.name_ascii,
    slug: `${toSlug(item.name_ascii)}-${parentProvince.slug}`,
    aliases: [],
    plate_code: parentProvince.plate_code,
    district_local_code: districtLocalCode,
    iso_3166_2: null,
    lau_code: null,
    tuik_id: null,
    icisleri_id: null,
    osm_relation_id: null,
    source_hdx_id: item.source_hdx_id,
    centroid: item.centroid,
    bbox: item.bbox,
  };
}

export function withGeometryProperties(collection, metadataMap) {
  return {
    type: 'FeatureCollection',
    name: collection.name.replace('normalized', 'processed'),
    features: collection.features.map((feature) => {
      const metadata = metadataMap.get(feature.properties.source_hdx_id);
      if (!metadata) {
        throw new Error(`Missing metadata for geometry feature ${feature.properties.source_hdx_id}`);
      }

      return {
        type: 'Feature',
        properties: {
          id: metadata.id,
          parent_id: metadata.parent_id,
          region_id: metadata.region_id ?? null,
          level: metadata.level,
        },
        geometry: feature.geometry,
      };
    }),
  };
}

export function aggregateRegionGeometry(features) {
  const polygons = [];

  for (const feature of features) {
    const { geometry } = feature;
    if (!geometry) {
      continue;
    }

    if (geometry.type === 'Polygon') {
      polygons.push(geometry.coordinates);
      continue;
    }

    if (geometry.type === 'MultiPolygon') {
      polygons.push(...geometry.coordinates);
      continue;
    }

    throw new Error(`Unsupported province geometry type for region aggregation: ${geometry.type}`);
  }

  if (polygons.length === 0) {
    throw new Error('Region aggregation produced no polygon geometry');
  }

  if (polygons.length === 1) {
    return {
      type: 'Polygon',
      coordinates: polygons[0],
    };
  }

  return {
    type: 'MultiPolygon',
    coordinates: polygons,
  };
}

export function dissolveRegionGeometry(memberIds, provinceGeometryCollection) {
  const provinceTopology = topology({ provinces: provinceGeometryCollection });
  const geometriesById = new Map(
    provinceTopology.objects.provinces.geometries.map((geometry) => [geometry.properties.id, geometry]),
  );

  const regionGeometries = memberIds.map((id) => {
    const geometry = geometriesById.get(id);
    if (!geometry) {
      throw new Error(`Region geometry missing member province feature ${id}`);
    }
    return geometry;
  });

  return rewindGeometry(merge(provinceTopology, regionGeometries));
}

export function createRegionIndex(reference) {
  const byProvinceId = new Map();
  const byProvinceSourceHdxId = new Map();

  for (const row of reference.province_membership || []) {
    byProvinceId.set(row.id, row);
    byProvinceSourceHdxId.set(row.source_hdx_id, row);
  }

  return { byProvinceId, byProvinceSourceHdxId };
}

export function applyRegionMembershipToProvince(record, regionIndex) {
  const membership = regionIndex.byProvinceId.get(record.id) || regionIndex.byProvinceSourceHdxId.get(record.source_hdx_id);
  if (!membership) {
    throw new Error(`Missing region membership for province ${record.id}`);
  }

  return {
    ...record,
    parent_id: membership.region_id,
    region_id: membership.region_id,
    region_name: membership.region_name,
  };
}

export function createRegionRecords(reference, provinces, provinceGeometryCollection) {
  const provincesById = new Map(provinces.map((item) => [item.id, item]));
  const provinceGeometryById = new Map(
    provinceGeometryCollection.features.map((feature) => [feature.properties.id, feature]),
  );

  return sortedCopy(
    reference.regions.map((region) => {
      const memberProvinces = region.member_ids.map((id) => {
        const province = provincesById.get(id);
        if (!province) {
          throw new Error(`Region ${region.id} references missing province ${id}`);
        }
        return province;
      });

      const memberFeatures = region.member_ids.map((id) => {
        const feature = provinceGeometryById.get(id);
        if (!feature) {
          throw new Error(`Region ${region.id} missing province geometry ${id}`);
        }
        return feature;
      });
      const geometry = dissolveRegionGeometry(region.member_ids, {
        ...provinceGeometryCollection,
        features: memberFeatures,
      });

      const centroid = memberProvinces.reduce((acc, province) => ({
        lat: acc.lat + province.centroid.lat,
        lon: acc.lon + province.centroid.lon,
      }), { lat: 0, lon: 0 });

      return {
        id: region.id,
        level: 'region',
        parent_id: null,
        name: region.name,
        name_ascii: toNameAscii(region.name),
        slug: region.slug || toSlug(toNameAscii(region.name)),
        aliases: [],
        region_kind: region.region_kind,
        member_ids: region.member_ids,
        source_hdx_id: `GEOGRAPHIC7:${region.id}`,
        centroid: {
          lat: centroid.lat / memberProvinces.length,
          lon: centroid.lon / memberProvinces.length,
        },
        bbox: computeBbox(geometry),
      };
    }),
    (a, b) => a.id.localeCompare(b.id),
  );
}

export function createRegionGeometryCollection(regions, reference, provinceGeometryCollection) {
  const referenceByRegionId = new Map(reference.regions.map((item) => [item.id, item]));

  return {
    type: 'FeatureCollection',
    name: 'turkiye_map.processed.regions',
    features: regions.map((region) => {
      const referenceRow = referenceByRegionId.get(region.id);

      return {
        type: 'Feature',
        properties: {
          id: region.id,
          parent_id: null,
          region_id: region.id,
          level: region.level,
        },
        geometry: dissolveRegionGeometry(referenceRow.member_ids, provinceGeometryCollection),
      };
    }),
  };
}

export function main() {
  logStep('Assigning deterministic canonical ids');

  const provincePartial = readJson(path.join(paths.normalizedDir, 'provinces.metadata.partial.json'));
  const districtPartial = readJson(path.join(paths.normalizedDir, 'districts.metadata.partial.json'));
  const provinceGeometry = readJson(path.join(paths.normalizedDir, 'provinces.geometry.geojson'));
  const districtGeometry = readJson(path.join(paths.normalizedDir, 'districts.geometry.geojson'));
  const provinceCrosswalkRows = readOptionalJson(paths.provinceCrosswalk, []);
  const districtCrosswalkRows = readOptionalJson(paths.districtCrosswalk, []);
  const regionReference = readJson(paths.regionsGeographic7);
  const displayNameOverrides = readOptionalJson(paths.displayNameOverrides, null);

  const provinceCrosswalkIndex = createCrosswalkIndex(provinceCrosswalkRows);
  const districtCrosswalkIndex = createCrosswalkIndex(districtCrosswalkRows);
  const regionIndex = createRegionIndex(regionReference);
  const overrideIndex = createOverrideIndex(displayNameOverrides);

  const provinces = sortedCopy(
    provincePartial
      .map((item) => applyDisplayOverride(item, overrideIndex, 'province'))
      .map(provinceRecord)
      .map((record) => applyRegionMembershipToProvince(record, regionIndex))
      .map((record) => applyProvinceCrosswalk(record, findCrosswalk(record, provinceCrosswalkIndex))),
    (a, b) => a.id.localeCompare(b.id),
  );
  const provinceMap = new Map(provinces.map((item) => [item.source_hdx_id, item]));

  const districts = sortedCopy(
    districtPartial
      .map((item) => applyDisplayOverride(item, overrideIndex, 'district'))
      .map((item) => districtRecord(item, provinceMap))
      .map((record) => applyDistrictCrosswalk(record, findCrosswalk(record, districtCrosswalkIndex))),
    (a, b) => a.id.localeCompare(b.id),
  );

  const provinceMetadataMap = new Map(provinces.map((item) => [item.source_hdx_id, item]));
  const districtMetadataMap = new Map(districts.map((item) => [item.source_hdx_id, item]));
  const processedProvinceGeometry = withGeometryProperties(provinceGeometry, provinceMetadataMap);
  const regions = createRegionRecords(regionReference, provinces, processedProvinceGeometry);
  const regionGeometry = createRegionGeometryCollection(regions, regionReference, processedProvinceGeometry);

  writeJson(path.join(paths.processedDir, 'regions.metadata.json'), regions);
  writeJson(path.join(paths.processedDir, 'provinces.metadata.json'), provinces);
  writeJson(path.join(paths.processedDir, 'districts.metadata.json'), districts);
  writeJson(path.join(paths.processedDir, 'regions.geometry.geojson'), regionGeometry);
  writeJson(path.join(paths.processedDir, 'provinces.geometry.geojson'), processedProvinceGeometry);
  writeJson(path.join(paths.processedDir, 'districts.geometry.geojson'), withGeometryProperties(districtGeometry, districtMetadataMap));
  writeJson(path.join(paths.processedDir, 'crosswalk-report.json'), {
    region_rows: regionReference.regions.length,
    province_region_memberships: regionReference.province_membership.length,
    province_crosswalk_rows: provinceCrosswalkRows.length,
    district_crosswalk_rows: districtCrosswalkRows.length,
    province_display_name_overrides: displayNameOverrides?.province_overrides?.length || 0,
    district_display_name_overrides: displayNameOverrides?.district_overrides?.length || 0,
    matched_provinces: provinces.filter((item) => item.tuik_id !== null || item.icisleri_id !== null || item.nuts_code !== null || item.osm_relation_id !== null || item.aliases.length > 0).length,
    matched_districts: districts.filter((item) => item.tuik_id !== null || item.icisleri_id !== null || item.lau_code !== null || item.osm_relation_id !== null || item.aliases.length > 0).length,
  });

  logStep(`Assigned ids for ${regions.length} regions, ${provinces.length} provinces and ${districts.length} districts`);
}

/* v8 ignore next -- CLI entrypoint guard */
if (invokedPath === scriptPath) {
  runPipelineStep('assign-ids', main);
}
