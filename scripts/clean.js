#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { paths, logStep, runPipelineStep } from './lib/pipeline.js';

const scriptPath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;

export const targets = [
  path.join(paths.normalizedDir, 'provinces.metadata.partial.json'),
  path.join(paths.normalizedDir, 'districts.metadata.partial.json'),
  path.join(paths.normalizedDir, 'provinces.geometry.geojson'),
  path.join(paths.normalizedDir, 'districts.geometry.geojson'),
  path.join(paths.normalizedDir, 'ingest-report.json'),
  path.join(paths.processedDir, 'regions.metadata.json'),
  path.join(paths.processedDir, 'provinces.metadata.json'),
  path.join(paths.processedDir, 'districts.metadata.json'),
  path.join(paths.processedDir, 'yerlesimler.metadata.json'),
  path.join(paths.processedDir, 'yerlesimler-report.json'),
  path.join(paths.processedDir, 'mahalle-geometrileri.geojson'),
  path.join(paths.processedDir, 'mahalle-geometrileri-report.json'),
  path.join(paths.processedDir, 'regions.geometry.geojson'),
  path.join(paths.processedDir, 'provinces.geometry.geojson'),
  path.join(paths.processedDir, 'districts.geometry.geojson'),
  path.join(paths.processedDir, 'build-report.json'),
  path.join(paths.processedDir, 'crosswalk-report.json'),
  path.join(paths.distJsonDir, 'regions.json'),
  path.join(paths.distJsonDir, 'provinces.json'),
  path.join(paths.distJsonDir, 'districts.json'),
  path.join(paths.distJsonDir, 'yerlesimler.json'),
  path.join(paths.distJsonDir, 'yerlesimler-by-province'),
  path.join(paths.distJsonDir, 'yerlesimler-by-district'),
  path.join(paths.distGeojsonDir, 'regions.geojson'),
  path.join(paths.distGeojsonDir, 'provinces.geojson'),
  path.join(paths.distGeojsonDir, 'districts.geojson'),
  path.join(paths.distGeojsonDir, 'mahalle-geometrileri.geojson'),
  path.join(paths.distGeojsonDir, 'mahalle-geometrileri-by-province'),
  path.join(paths.distGeojsonDir, 'mahalle-geometrileri-by-district'),
  path.join(paths.rootDir, 'dist', 'topojson'),
  path.join(paths.rootDir, 'dist', 'csv'),
  path.join(paths.rootDir, 'dist', 'xlsx'),
  path.join(paths.rootDir, 'dist', 'sql'),
  path.join(paths.rootDir, 'dist', 'wkt'),
  path.join(paths.rootDir, 'dist', 'kml'),
  path.join(paths.rootDir, 'dist', 'kmz'),
];

export function main() {
  for (const target of targets) {
    fs.rmSync(target, { recursive: true, force: true });
  }

  logStep('Cleaned generated build artifacts');
}

/* v8 ignore next -- CLI entrypoint guard */
if (invokedPath === scriptPath) {
  runPipelineStep('clean', main);
}
