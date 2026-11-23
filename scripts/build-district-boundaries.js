#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import polygonClipping from 'polygon-clipping';
import { paths, readJson, writeJson } from './lib/pipeline.js';

const districtsPath = path.join(paths.processedDir, 'districts.geometry.geojson');
const mahallePath = path.join(paths.processedDir, 'mahalle-geometrileri.geojson');
const settlementsPath = path.join(paths.processedDir, 'yerlesimler.metadata.json');

function polygons(geometry) {
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  throw new Error(`Desteklenmeyen mahalle geometrisi: ${geometry.type}`);
}

function polygonArea(polygon) {
  let total = 0;
  for (const ring of polygon) {
    let sum = 0;
    for (let i = 0; i < ring.length - 1; i += 1) {
      sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    }
    total += Math.abs(sum) / 2;
  }
  return total;
}

function area(geometry) {
  return polygons(geometry).reduce((sum, polygon) => sum + polygonArea(polygon), 0);
}

function intersectionArea(left, right) {
  const intersection = polygonClipping.intersection(polygons(left), polygons(right));
  return intersection ? intersection.reduce((sum, polygon) => sum + polygonArea(polygon), 0) : 0;
}

function bbox(geometry) {
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  for (const polygon of polygons(geometry)) {
    for (const ring of polygon) {
      for (const point of ring) {
        bounds[0] = Math.min(bounds[0], point[0]);
        bounds[1] = Math.min(bounds[1], point[1]);
        bounds[2] = Math.max(bounds[2], point[0]);
        bounds[3] = Math.max(bounds[3], point[1]);
      }
    }
  }
  return bounds;
}

function bboxesOverlap(a, b) {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

function unionGeometries(geometries) {
  let union = null;
  for (const geometry of geometries) {
    union = union
      ? polygonClipping.union(union, ...polygons(geometry))
      : polygons(geometry);
  }
  if (!union?.length) return null;
  return union.length === 1
    ? { type: 'Polygon', coordinates: union[0] }
    : { type: 'MultiPolygon', coordinates: union };
}

function run() {
  const boundaryCollection = readJson(districtsPath);
  const mahalleCollection = readJson(mahallePath);
  const settlements = readJson(settlementsPath);
  const boundariesById = new Map(boundaryCollection.features.map((feature) => [feature.properties.id, feature]));
  const boundaryBboxes = new Map(boundaryCollection.features.map((feature) => [feature.properties.id, bbox(feature.geometry)]));
  const mahalleByDistrict = new Map();
  for (const feature of mahalleCollection.features) {
    const id = feature.properties.district_id;
    if (!id || !feature.geometry) continue;
    if (!mahalleByDistrict.has(id)) mahalleByDistrict.set(id, []);
    mahalleByDistrict.get(id).push(feature);
  }
  const expectedByDistrict = new Map();
  for (const item of settlements) {
    if (item.type !== 'mahalle' || !item.district_id) continue;
    expectedByDistrict.set(item.district_id, (expectedByDistrict.get(item.district_id) || 0) + 1);
  }

  const reports = [];
  const replacement = new Map();
  for (const [districtId, features] of mahalleByDistrict) {
    const boundary = boundariesById.get(districtId);
    if (!boundary) continue;
    const expected = expectedByDistrict.get(districtId) || 0;
    const componentIssues = [];
    for (const feature of features) {
      const parts = polygons(feature.geometry);
      if (parts.length < 2) continue;
      for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
        const part = { type: 'Polygon', coordinates: parts[partIndex] };
        const partBbox = bbox(part);
        const partArea = area(part);
        if (!partArea) continue;
        const assignedShare = bboxesOverlap(partBbox, boundaryBboxes.get(districtId))
          ? intersectionArea(part, boundary.geometry) / partArea
          : 0;
        if (assignedShare < 0.9) {
          const otherDistricts = [];
          for (const other of boundaryCollection.features) {
            if (other.properties.id === districtId) continue;
            if (!bboxesOverlap(partBbox, boundaryBboxes.get(other.properties.id))) continue;
            const share = intersectionArea(part, other.geometry) / partArea;
            if (share >= 0.05) otherDistricts.push({ district_id: other.properties.id, share: Number(share.toFixed(4)) });
          }
          componentIssues.push({
            mahalle_id: feature.properties.id,
            mahalle_name: feature.properties.name,
            part_index: partIndex + 1,
            part_count: parts.length,
            assigned_district_share: Number(assignedShare.toFixed(4)),
            other_districts: otherDistricts,
          });
        }
      }
    }
    const countDifference = features.length - expected;
    const status = componentIssues.length || countDifference !== 0 ? 'beklemede' : 'qc_gecti';
    reports.push({
      district_id: districtId,
      province_id: boundary.properties.parent_id,
      district_name: features[0].properties.district_name || null,
      mahalle_geometry_count: features.length,
      mulki_idare_mahalle_count: expected,
      count_difference: countDifference,
      multipart_component_issue_count: componentIssues.length,
      multipart_component_issues: componentIssues,
      status,
    });
    if (status === 'qc_gecti') replacement.set(districtId, unionGeometries(features.map((feature) => feature.geometry)));
  }

  const output = {
    ...boundaryCollection,
    features: boundaryCollection.features.map((feature) => {
      const geometry = replacement.get(feature.properties.id);
      return geometry ? { ...feature, geometry } : feature;
    }),
  };
  writeJson(districtsPath, output);
  const report = {
    method: 'QC geçen ilçelerde atanmış mahalle geometrilerinin birleşimi; QC bulgusu olan veya mahalle verisi olmayan ilçelerde mevcut sınır korunur.',
    totals: {
      district_count: boundaryCollection.features.length,
      district_with_mahalle_geometry_count: reports.length,
      qc_passed_count: reports.filter((item) => item.status === 'qc_gecti').length,
      pending_count: reports.filter((item) => item.status === 'beklemede').length,
      hdx_fallback_count: boundaryCollection.features.length - reports.length + reports.filter((item) => item.status === 'beklemede').length,
    },
    districts: reports.sort((a, b) => a.district_id.localeCompare(b.district_id)),
  };
  writeJson(path.join(paths.distJsonDir, 'district-boundary-qc.json'), report);
  writeJson(path.join(paths.processedDir, 'district-boundary-qc.json'), report);
  console.log(JSON.stringify(report.totals, null, 2));
}

run();
