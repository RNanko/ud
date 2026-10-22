// Loopback UI fixture with sample categories. No account or database is loaded.
// Build artifacts stay in the OS temp directory; Ctrl+C removes them.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('tsx/package.json'))('esbuild');
const postcss = require('postcss'), tailwind = require('@tailwindcss/postcss');
const directory = await mkdtemp(join(tmpdir(), 'manforth-finance-browser-'));
const iconAssets = new Set(JSON.parse(await readFile('lib/finance-category-icons.json','utf8')).map(icon=>icon.src));
let server;
async function cleanup() {
  server?.closeAllConnections(); server?.close();
  if (dirname(resolve(directory)) !== resolve(tmpdir()) || !basename(directory).startsWith('manforth-finance-browser-')) throw Error('Unexpected temporary directory');
  await rm(directory, { recursive: true, force: true });
}
try {
  await build({ entryPoints: ['tests/fixtures/finance-playground-browser.tsx'], bundle: true, outfile: join(directory, 'fixture.js'),
    platform: 'browser', jsx: 'automatic', alias: { '@': resolve('.') }, define: { 'process.env.NODE_ENV': '"development"' } });
  const theme = await postcss([tailwind()]).process(await readFile('app/globals.css', 'utf8'), { from: resolve('app/globals.css') });
  server = createServer(async (request, response) => {
    try {
      response.setHeader('cache-control', 'no-store');
      if(iconAssets.has(request.url)) { response.setHeader('content-type','image/svg+xml'); response.end(await readFile(resolve('public'+request.url))); return; }
      if (request.url === '/fixture.js' || request.url === '/fixture.css') {
        response.setHeader('content-type', request.url.endsWith('.js') ? 'application/javascript' : 'text/css');
        response.end(await readFile(join(directory, request.url.slice(1)))); return;
      }
      if (request.url === '/theme.css') { response.setHeader('content-type', 'text/css'); response.end(theme.css); return; }
      response.setHeader('content-type', 'text/html');
      response.end('<!doctype html><html class="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Finance layout verification</title><link rel="stylesheet" href="/theme.css"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
    } catch { response.writeHead(500); response.end('Fixture error'); }
  });
  server.listen(0, '127.0.0.1', () => console.log(`Isolated Finance fixture: http://127.0.0.1:${server.address().port}`));
} catch (error) { await cleanup(); throw error; }
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await cleanup(); process.exit(0); });
