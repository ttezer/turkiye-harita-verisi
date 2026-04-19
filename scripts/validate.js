#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { paths, readJson, writeJson, logStep, runPipelineStep } from './lib/pipeline.js';

const scriptPath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;

export function validateValue(value, schema, defs, currentPath) {
  if (schema.$ref) {
    const refName = schema.$ref.replace('#/$defs/', '');
    return validateValue(value, defs[refName], defs, currentPath);
  }

  if (schema.const !== undefined && value !== schema.const) {
    throw new Error(`${currentPath} must equal ${schema.const}`);
  }

  if (Array.isArray(schema.type)) {
    const matches = schema.type.some((type) => matchesType(value, type));
    if (!matches) {
      throw new Error(`${currentPath} must be one of types: ${schema.type.join(', ')}`);
    }
  } else if (schema.type && !matchesType(value, schema.type)) {
    throw new Error(`${currentPath} must be type ${schema.type}`);
  }

  if (schema.pattern && typeof value === 'string' && !new RegExp(schema.pattern).test(value)) {
    throw new Error(`${currentPath} does not match pattern ${schema.pattern}`);
  }

  if (schema.minLength && typeof value === 'string' && value.length < schema.minLength) {
    throw new Error(`${currentPath} must have minLength ${schema.minLength}`);
  }

  if (schema.type === 'array' || Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      throw new Error(`${currentPath} must have at least ${schema.minItems} items`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      throw new Error(`${currentPath} must have at most ${schema.maxItems} items`);
    }
    if (schema.uniqueItems) {
      const unique = new Set(value.map((item) => JSON.stringify(item)));
      if (unique.size !== value.length) {
        throw new Error(`${currentPath} must contain unique items`);
      }
    }
    if (schema.items) {
      value.forEach((item, index) => validateValue(item, schema.items, defs, `${currentPath}[${index}]`));
    }
    if (schema.prefixItems) {
      schema.prefixItems.forEach((itemSchema, index) => validateValue(value[index], itemSchema, defs, `${currentPath}[${index}]`));
    }
  }

  if (schema.type === 'object' || (value && typeof value === 'object' && !Array.isArray(value))) {
    if (schema.required) {
      for (const key of schema.required) {
        if (!(key in value)) {
          throw new Error(`${currentPath}.${key} is required`);
        }
      }
    }
    if (schema.additionalProperties === false && schema.properties) {
      for (const key of Object.keys(value)) {
        if (!(key in schema.properties)) {
          throw new Error(`${currentPath}.${key} is not allowed`);
        }
      }
    }
    if (schema.properties) {
      for (const [key, propertySchema] of Object.entries(schema.properties)) {
        if (key in value) {
          validateValue(value[key], propertySchema, defs, `${currentPath}.${key}`);
        }
      }
    }
  }
}

export function matchesType(value, type) {
  if (type === 'null') {
    return value === null;
  }
  if (type === 'array') {
    return Array.isArray(value);
  }
  if (type === 'integer') {
    return Number.isInteger(value);
  }
  if (type === 'object') {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
  return typeof value === type;
}

export function validateCollection(metadataItems, geometryCollection, schema, label) {
  validateMetadataCollection(metadataItems, schema, label);

  if (geometryCollection.features.length !== metadataItems.length) {
    throw new Error(`${label} metadata and geometry counts differ`);
  }

  const ids = new Set(metadataItems.map((item) => item.id));
  const geometryIds = new Set();
  for (const feature of geometryCollection.features) {
    const id = feature.properties.id;
    geometryIds.add(id);
    if (!ids.has(id)) {
      throw new Error(`${label} geometry id missing in metadata: ${id}`);
    }
  }

  if (geometryIds.size !== ids.size) {
    throw new Error(`${label} geometry ids are not unique`);
  }
}

export function validateMetadataCollection(metadataItems, schema, label) {
  const ids = new Set();
  const slugs = new Set();
  const sourceIds = new Set();

  for (const item of metadataItems) {
    validateValue(item, schema, schema.$defs || {}, label);
    if (ids.has(item.id)) {
      throw new Error(`${label} duplicate id ${item.id}`);
    }
    if (slugs.has(item.slug)) {
      throw new Error(`${label} duplicate slug ${item.slug}`);
    }
    if (item.source_hdx_id !== null && item.source_hdx_id !== undefined && sourceIds.has(item.source_hdx_id)) {
      throw new Error(`${label} duplicate source_hdx_id ${item.source_hdx_id}`);
    }
    ids.add(item.id);
    slugs.add(item.slug);
    if (item.source_hdx_id !== null && item.source_hdx_id !== undefined) {
      sourceIds.add(item.source_hdx_id);
    }
  }
}

export function validateRelationships(regions, provinces, districts, settlements = []) {
  const regionIdSet = new Set(regions.map((item) => item.id));
  const provinceIdSet = new Set(provinces.map((item) => item.id));
  const districtIdSet = new Set(districts.map((item) => item.id));
  const provinceSourceMap = new Map(provinces.map((item) => [item.source_hdx_id, item]));
  const provinceMap = new Map(provinces.map((item) => [item.id, item]));
  const seenDistrictLocalCodes = new Map();
  const regionMembershipCoverage = new Set();

  for (const region of regions) {
    for (const memberId of region.member_ids) {
      if (!provinceIdSet.has(memberId)) {
        throw new Error(`Region ${region.id} references missing province ${memberId}`);
      }
      regionMembershipCoverage.add(memberId);
    }
  }

  for (const province of provinces) {
    if (!regionIdSet.has(province.parent_id)) {
      throw new Error(`Province ${province.id} has missing parent region ${province.parent_id}`);
    }
    if (province.region_id !== province.parent_id) {
      throw new Error(`Province ${province.id} region_id and parent_id diverge`);
    }
    if (!regionMembershipCoverage.has(province.id)) {
      throw new Error(`Province ${province.id} is missing from region membership coverage`);
    }
  }

  for (const district of districts) {
    if (!provinceIdSet.has(district.parent_id)) {
      throw new Error(`District ${district.id} has missing parent_id ${district.parent_id}`);
    }

    const parentSourceId = `TUR${district.plate_code.padStart(3, '0')}`;
    const parentProvince = provinceSourceMap.get(parentSourceId);
    if (!parentProvince) {
      throw new Error(`District ${district.id} cannot resolve parent source_hdx_id ${parentSourceId}`);
    }
    if (!district.source_hdx_id.startsWith(parentProvince.source_hdx_id)) {
      throw new Error(`District ${district.id} source_hdx_id does not match parent prefix`);
    }
    if (district.region_id !== parentProvince.region_id) {
      throw new Error(`District ${district.id} region_id does not match parent province`);
    }

    const key = district.parent_id;
    const list = seenDistrictLocalCodes.get(key) || [];
    list.push(Number.parseInt(district.district_local_code, 10));
    seenDistrictLocalCodes.set(key, list);
  }

  for (const [parentId, codes] of seenDistrictLocalCodes.entries()) {
    const sorted = [...codes].sort((a, b) => a - b);
    sorted.forEach((value, index) => {
      if (value !== index + 1) {
        throw new Error(`District codes for ${parentId} are not gap-free at ${value}`);
      }
    });
  }

  for (const settlement of settlements) {
    if (!provinceIdSet.has(settlement.province_id)) {
      throw new Error(`Yerlesim ${settlement.id} has missing province_id ${settlement.province_id}`);
    }
    if (!districtIdSet.has(settlement.district_id)) {
      throw new Error(`Yerlesim ${settlement.id} has missing district_id ${settlement.district_id}`);
    }
    if (settlement.parent_id !== settlement.district_id) {
      throw new Error(`Yerlesim ${settlement.id} parent_id and district_id diverge`);
    }
    const district = districts.find((item) => item.id === settlement.district_id);
    if (district.parent_id !== settlement.province_id) {
      throw new Error(`Yerlesim ${settlement.id} province_id does not match parent district`);
    }
  }
}

export function main() {
  logStep('Validating processed datasets');

  const provinceSchema = readJson(paths.provinceSchema);
  const districtSchema = readJson(paths.districtSchema);
  const regionSchema = readJson(paths.regionSchema);
  const settlementSchema = readJson(paths.settlementSchema);
  const regions = readJson(path.join(paths.processedDir, 'regions.metadata.json'));
  const provinces = readJson(path.join(paths.processedDir, 'provinces.metadata.json'));
  const districts = readJson(path.join(paths.processedDir, 'districts.metadata.json'));
  const settlements = readJson(path.join(paths.processedDir, 'yerlesimler.metadata.json'));
  const regionGeometry = readJson(path.join(paths.processedDir, 'regions.geometry.geojson'));
  const provinceGeometry = readJson(path.join(paths.processedDir, 'provinces.geometry.geojson'));
  const districtGeometry = readJson(path.join(paths.processedDir, 'districts.geometry.geojson'));
  const crosswalkReport = readJson(path.join(paths.processedDir, 'crosswalk-report.json'));
  const settlementsReport = readJson(path.join(paths.processedDir, 'yerlesimler-report.json'));

  validateCollection(regions, regionGeometry, regionSchema, 'region');
  validateCollection(provinces, provinceGeometry, provinceSchema, 'province');
  validateCollection(districts, districtGeometry, districtSchema, 'district');
  validateMetadataCollection(settlements, settlementSchema, 'yerlesim');
  validateRelationships(regions, provinces, districts, settlements);

  writeJson(path.join(paths.processedDir, 'build-report.json'), {
    validated_at: new Date().toISOString(),
    region_count: regions.length,
    province_count: provinces.length,
    district_count: districts.length,
    settlement_count: settlements.length,
    crosswalk_report: crosswalkReport,
    settlements_report: settlementsReport,
    status: 'ok',
  });

  logStep(`Validated ${regions.length} regions, ${provinces.length} provinces, ${districts.length} districts and ${settlements.length} yerlesimler`);
}

/* v8 ignore next -- CLI entrypoint guard */
if (invokedPath === scriptPath) {
  runPipelineStep('validate', main);
}
