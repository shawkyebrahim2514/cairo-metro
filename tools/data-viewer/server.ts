// Local-only data verification tool. Usage: npm run data:view  -> http://127.0.0.1:5174
import { createServer } from 'node:http';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const PUBLIC_DIR = join(import.meta.dirname, 'public');
const LEAFLET_DIR = join(ROOT, 'node_modules/leaflet/dist');
const VERIFICATION_FILE = join(ROOT, 'data/curated/verification.json');
const PORT = Number(process.env.PORT ?? 5174);

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const readJson = (file: string, fallback: unknown) =>
  existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback;

function serveFile(base: string, rel: string, res: import('node:http').ServerResponse) {
  const file = normalize(join(base, rel));
  if (!file.startsWith(base) || !existsSync(file)) {
    res.writeHead(404).end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
}

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolveBody, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > 1_000_000) reject(new Error('Body too large'));
      chunks.push(c);
    });
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  try {
    if (url.pathname === '/api/data' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': MIME['.json']! });
      res.end(
        JSON.stringify({
          metro: readJson(join(ROOT, 'data/metro.json'), null),
          crosscheck: readJson(join(ROOT, 'data/crosscheck.json'), null),
          verification: readJson(VERIFICATION_FILE, { stations: {} }),
        }),
      );
      return;
    }
    if (url.pathname === '/api/verification' && req.method === 'PUT') {
      const body = JSON.parse(await readBody(req)) as { stations?: Record<string, unknown> };
      if (!body || typeof body.stations !== 'object' || body.stations === null) {
        res.writeHead(400).end('Invalid payload');
        return;
      }
      writeFileSync(VERIFICATION_FILE, JSON.stringify({ stations: body.stations }, null, 2) + '\n');
      res.writeHead(200, { 'Content-Type': MIME['.json']! }).end('{"ok":true}');
      return;
    }
    if (req.method !== 'GET') {
      res.writeHead(405).end('Method not allowed');
      return;
    }
    if (url.pathname.startsWith('/vendor/leaflet/')) {
      serveFile(LEAFLET_DIR, url.pathname.slice('/vendor/leaflet/'.length), res);
      return;
    }
    serveFile(PUBLIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname.slice(1), res);
  } catch (err) {
    res.writeHead(500).end(String(err));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Data viewer running at http://127.0.0.1:${PORT}`);
});
