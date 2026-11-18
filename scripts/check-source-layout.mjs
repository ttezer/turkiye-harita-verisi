import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const failures = [];
const notices = [];

function entries(path) {
  return readdirSync(path, { withFileTypes: true });
}

function isProvinceDirectory(name) {
  return /^\d{2}-[a-z0-9-]+$/.test(name);
}

function addFailure(message) {
  failures.push(message);
}

function checkManualSources() {
  const manualRoot = join(root, 'source', 'mahalle-manual');
  for (const entry of entries(manualRoot)) {
    if (!entry.isDirectory() || !isProvinceDirectory(entry.name)) continue;
    const provinceRoot = join(manualRoot, entry.name);
    const rootFiles = entries(provinceRoot).filter((item) => item.isFile() && /\.(kml|kmz|geojson)$/i.test(item.name));
    if (rootFiles.length) {
      addFailure(`Manuel kaynak il klasörünün kökünde ham geometri var: ${relative(root, provinceRoot)}`);
    }

    const rawRoot = join(provinceRoot, 'raw');
    if (!existsSync(rawRoot) || !statSync(rawRoot).isDirectory()) {
      addFailure(`Manuel kaynakta raw klasörü yok: ${relative(root, provinceRoot)}`);
      continue;
    }
    const rawFiles = entries(rawRoot).filter((item) => item.isFile());
    const kmlFiles = rawFiles.filter((item) => /-mahalle\.kml$/i.test(item.name));
    if (kmlFiles.length !== 1) {
      addFailure(`Manuel kaynak tek mahalle KML'i içermiyor: ${relative(root, provinceRoot)} (${kmlFiles.length})`);
    }
    if (rawFiles.some((item) => !/-mahalle\.kml$/i.test(item.name))) {
      addFailure(`Manuel kaynak raw klasöründe standart dışı dosya var: ${relative(root, rawRoot)}`);
    }
  }
}

function checkMunicipalSources() {
  const municipalRoot = join(root, 'source', 'yayinlanabilir', 'municipal');
  for (const province of entries(municipalRoot)) {
    if (!province.isDirectory() || !isProvinceDirectory(province.name)) continue;
    const provinceRoot = join(municipalRoot, province.name);
    const children = entries(provinceRoot).filter((item) => item.isDirectory());
    for (const child of children) {
      if (child.name === 'mahalle') continue;
      const childRoot = join(provinceRoot, child.name);
      const nestedFiles = [];
      const walk = (dir) => {
        for (const item of entries(dir)) {
          const itemPath = join(dir, item.name);
          if (item.isDirectory()) walk(itemPath);
          else nestedFiles.push(itemPath);
        }
      };
      walk(childRoot);
      const nonManifestFiles = nestedFiles.filter((path) => !path.endsWith('manifest.json'));
      if (nonManifestFiles.length) {
        addFailure(`Açık kaynak ilçe alt klasöründe veri kaldı: ${relative(root, childRoot)}`);
      } else if (nestedFiles.length) {
        notices.push(`Manifest klasörü kullanıcı onayı bekliyor: ${relative(root, childRoot)}`);
      }
    }
  }
}

checkManualSources();
checkMunicipalSources();

for (const notice of notices) console.log(`Bilgi: ${notice}`);
if (failures.length) {
  console.error('Kaynak klasörü standardı denetimi başarısız:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Kaynak klasörü standardı denetimi başarılı.');
