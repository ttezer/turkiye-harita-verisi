import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const forbidden = ['bulut' + 'kbs', 'parsel' + 'sorgu'];
const mode = process.argv.includes('--all') ? 'all' : 'staged';

function runGit(args) {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr || `git ${args.join(' ')} başarısız oldu`);
  }
  return result.stdout;
}

function nulSeparated(value) {
  return value.split('\0').filter(Boolean);
}

function hasForbiddenPath(path) {
  const normalized = path.toLocaleLowerCase('tr-TR');
  return forbidden.some((term) => normalized.includes(term));
}

function filesystemPaths(directory, relative = '') {
  const result = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = relative ? `${relative}/${entry.name}` : entry.name;
    if (entryPath === '.git' || entryPath.startsWith('.git/')) continue;
    result.push(entryPath);
    if (entry.isDirectory()) result.push(...filesystemPaths(join(directory, entry.name), entryPath));
  }
  return result;
}

const paths = nulSeparated(runGit(
  mode === 'all'
    ? ['ls-files', '-z']
    : ['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR'],
));

const pathFindings = paths.filter(hasForbiddenPath);
if (mode === 'all') {
  pathFindings.push(...filesystemPaths(root).filter(hasForbiddenPath));
}

const grepArgs = ['grep', '-I', '-n', '-i'];
for (const term of forbidden) grepArgs.push('-e', term);
if (mode === 'staged') grepArgs.push('--cached');
grepArgs.push('--');

const grep = spawnSync('git', grepArgs, {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024,
});
if (grep.error) throw grep.error;
if (grep.status !== 0 && grep.status !== 1) {
  throw new Error(grep.stderr || 'İçerik denetimi başarısız oldu');
}

const contentFindings = grep.status === 0 ? grep.stdout.trim().split('\n').filter(Boolean) : [];

if (pathFindings.length || contentFindings.length) {
  console.error('Depo politikası denetimi başarısız: yasaklı kaynak adı veya ifadesi bulundu.');
  for (const path of pathFindings) console.error(`Dosya yolu: ${path}`);
  for (const finding of contentFindings) console.error(`İçerik: ${finding}`);
  process.exit(1);
}

console.log(`Depo politikası denetimi başarılı (${mode === 'staged' ? 'staged alan' : 'çalışma ağacı'}).`);
