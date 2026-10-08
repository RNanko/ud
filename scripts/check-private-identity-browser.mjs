// Local-only synthetic browser fixture. Run manually, then stop with Ctrl+C.
// The build is temporary; no configured database or provider is loaded.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

// Use the already-installed tsx bundler; no dependency install is needed.
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('tsx/package.json'))('esbuild');

const directory = await mkdtemp(join(tmpdir(), 'manforth-identity-browser-'));
await build({ entryPoints: ['tests/fixtures/private-identity-browser.tsx'], bundle: true, outfile: join(directory, 'fixture.js'),
  platform: 'browser', jsx: 'automatic', alias: { '@': resolve('.') }, define: { 'process.env.NODE_ENV': '"development"' } });
let owner = 'alice', failure = false, expired = false, hold = false;
const pending = [];
const identity = () => owner ? {
  user: { id: owner, name: owner, email: `${owner}@example.invalid`, emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
  session: { id: `synthetic-${owner}`, userId: owner, token: 'synthetic-not-a-credential', expiresAt: new Date(Date.now() + (expired ? -1000 : 3600000)), createdAt: new Date(), updatedAt: new Date() },
} : null;
const server = createServer(async (request, response) => {
  const send = (value, status = 200) => { response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); response.end(JSON.stringify(value)); };
  if (request.url === '/fixture.js') { response.setHeader('content-type', 'application/javascript'); response.end(await readFile(join(directory, 'fixture.js'))); return; }
  if (request.url?.startsWith('/api/auth/get-session')) {
    const saved = identity();
    if (hold) { hold = false; pending.push(() => send(saved)); return; }
    send(failure ? { message: 'Synthetic network failure' } : saved, failure ? 503 : 200); return;
  }
  if (request.url === '/api/auth/sign-out') { owner = null; send({ success: true }); return; }
  if (request.url === '/api/auth/sign-in/email') { owner = 'bob'; expired = false; send({ ...identity(), redirect: false }); return; }
  if (request.url === '/fixture/state') {
    let text = ''; for await (const chunk of request) text += chunk;
    const value = JSON.parse(text);
    if ('owner' in value) { owner = value.owner; expired = false; }
    if ('failure' in value) failure = value.failure;
    if ('expired' in value) expired = value.expired;
    if ('hold' in value) hold = value.hold;
    if (value.release) pending.splice(0).forEach(release => release());
    send({ ok: true }); return;
  }
  response.setHeader('content-type', 'text/html');
  response.end('<!doctype html><html><head><title>Identity regression fixture</title></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
});
server.listen(0, '127.0.0.1', () => console.log(`Synthetic browser fixture: http://127.0.0.1:${server.address().port}`));
async function stop() {
  server.closeAllConnections(); server.close();
  if (dirname(resolve(directory)) !== resolve(tmpdir()) || !basename(directory).startsWith('manforth-identity-browser-')) throw Error('Unexpected temporary directory');
  await rm(directory, { recursive: true, force: true }); process.exit(0);
}
process.on('SIGINT', stop); process.on('SIGTERM', stop);
