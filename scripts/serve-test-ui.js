import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const host = '127.0.0.1';
const port = Number(process.env.PORT || 4173);

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.geojson', 'application/geo+json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

function send(res, statusCode, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, { 'Content-Type': contentType });
  res.end(body);
}

function safeResolve(urlPathname) {
  const normalized = decodeURIComponent(urlPathname.split('?')[0]);
  const relativePath = normalized === '/' ? '/index.html' : normalized;
  const candidatePath = path.resolve(repoRoot, `.${relativePath}`);
  const relativeCandidate = path.relative(repoRoot, candidatePath);

  if (
    relativeCandidate.startsWith('..') ||
    path.isAbsolute(relativeCandidate)
  ) {
    return null;
  }

  return candidatePath;
}

const server = http.createServer((req, res) => {
  const filePath = safeResolve(req.url || '/');

  if (!filePath) {
    send(res, 403, 'Forbidden');
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      send(res, 404, 'Not found');
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes.get(extension) || 'application/octet-stream';
    const stream = fs.createReadStream(filePath);

    res.writeHead(200, {
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    });
    stream.pipe(res);
    stream.on('error', () => send(res, 500, 'Read error'));
  });
});

server.listen(port, host, () => {
  console.log(`Test UI available at http://${host}:${port}`);
});
