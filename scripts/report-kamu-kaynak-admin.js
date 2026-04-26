#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { paths, readJson, writeJson } from './lib/pipeline.js';

const kamuKaynakDir = path.join(paths.rootDir, 'source', 'kamu-kaynak');
const provinceReportPath = path.join(kamuKaynakDir, 'il', 'report.json');
const districtDir = path.join(kamuKaynakDir, 'ilce');
const sourceLabels = readJson(paths.sourceLabels);
const PUBLIC_SOURCE_LABEL = sourceLabels.public_sources;

function readDistrictReports() {
  if (!fs.existsSync(districtDir)) {
    return [];
  }

  return fs.readdirSync(districtDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{2}-/.test(entry.name))
    .map((entry) => {
      const reportPath = path.join(districtDir, entry.name, 'report.json');
      if (!fs.existsSync(reportPath)) {
        return {
          dir: entry.name,
          missing_report: true,
          district_count: 0,
          geometry_count: 0,
          error_count: 1,
          errors: [{ error: 'report.json bulunamadi' }],
        };
      }

      const report = readJson(reportPath);
      return {
        dir: entry.name,
        plate_code: entry.name.slice(0, 2),
        province_name: report.province?.ad,
        district_count: report.district_count,
        geometry_count: report.geometry_count,
        error_count: report.error_count,
        errors: report.errors || [],
      };
    })
    .sort((a, b) => a.dir.localeCompare(b.dir, 'tr'));
}

const provinceReport = fs.existsSync(provinceReportPath)
  ? readJson(provinceReportPath)
  : null;
const districtReports = readDistrictReports();
const badDistrictReports = districtReports.filter((report) => (
  report.missing_report
  || report.error_count !== 0
  || report.geometry_count !== report.district_count
));

const report = {
  generated_at: new Date().toISOString(),
  source: 'https://bulutkbs.gov.tr/Rehber/#/app',
  source_name: 'Bulut KBS Rehber',
  source_label: PUBLIC_SOURCE_LABEL,
  province: provinceReport
    ? {
        province_count: provinceReport.province_count,
        geometry_count: provinceReport.geometry_count,
        error_count: provinceReport.error_count,
      }
    : {
        province_count: 0,
        geometry_count: 0,
        error_count: 1,
        errors: [{ error: 'source/kamu-kaynak/il/report.json bulunamadi' }],
      },
  district: {
    province_count: districtReports.length,
    district_count: districtReports.reduce((sum, item) => sum + item.district_count, 0),
    geometry_count: districtReports.reduce((sum, item) => sum + item.geometry_count, 0),
    error_count: districtReports.reduce((sum, item) => sum + item.error_count, 0),
    bad_report_count: badDistrictReports.length,
    bad_reports: badDistrictReports,
  },
  district_reports: districtReports,
};

const outPath = path.join(kamuKaynakDir, 'admin-report.json');
writeJson(outPath, report);
console.log(`Rapor yazildi: ${outPath}`);
console.log(`Il: ${report.province.geometry_count}/${report.province.province_count}, hata ${report.province.error_count}`);
console.log(`Ilce: ${report.district.geometry_count}/${report.district.district_count}, hata ${report.district.error_count}, sorunlu rapor ${report.district.bad_report_count}`);
