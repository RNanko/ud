// Synthetic loopback UI fixture backed by actual Notes SQL in disposable PGlite.
// No application database, provider or real identity is contacted. Ctrl+C cleans up.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { loadModule } from '../tests/helpers.mjs';

const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('tsx/package.json'))('esbuild');
const postcss = require('postcss'), tailwind = require('@tailwindcss/postcss');
const directory = await mkdtemp(join(tmpdir(), 'manforth-notes-browser-'));
const database = new PGlite();
await database.exec('CREATE TABLE "user"(id text PRIMARY KEY); CREATE TABLE user_notes(id text PRIMARY KEY,user_id text REFERENCES "user"(id) ON DELETE CASCADE,data jsonb NOT NULL);');
await database.query('INSERT INTO "user"(id) VALUES ($1)', ['notes-browser-owner']);
await database.exec(await readFile('lib/db/0037_notes.sql', 'utf8'));
const sql = async (strings, ...values) => {
  const query = strings.reduce((text, part, index) => text + part + (index < values.length ? `$${index + 1}` : ''), '');
  return (await database.query(query, values)).rows;
};
const domain = loadModule('lib/notes.ts', {}, { TextEncoder });
const store = loadModule('lib/notes/store.ts', { '../account/store': { accountSql: sql }, '../notes': domain, 'node:crypto': require('node:crypto') }, { TextEncoder });
let loggedOut = false, loseNext = false, slowNext = false;
const actions = loadModule('lib/actions/notes.actions.ts', { '../notes/store': store, '../session': { requireUserId: async () => { if (loggedOut) throw Error('Synthetic signed-out session'); return 'notes-browser-owner'; } }, 'next/cache': { revalidatePath() {} } }, { TextEncoder });
const save = async (title, blocks) => actions.commitNotes({ operationId: randomUUID(), revision: 0, data: { kind: 'save', id: randomUUID(), expectedRevision: null, title, blocks } });
await save('Project ideas', [{ id: randomUUID(), type: 'text', text: 'A place for useful thoughts.' }, { id: randomUUID(), type: 'checklist', items: [{ id: randomUUID(), text: 'Prepare an outline', checked: false }, { id: randomUUID(), text: 'Collect references', checked: true }] }]);
await save('Reading list', [{ id: randomUUID(), type: 'numbered', items: [{ id: randomUUID(), text: 'Read a chapter', checked: false }, { id: randomUUID(), text: 'Write one useful takeaway', checked: false }] }]);
await save('A longer note', [{ id: randomUUID(), type: 'text', text: Array.from({ length: 35 }, (_, index) => `Line ${index + 1}: Keep moving towards your goal, one deliberate step at a time.`).join('\n') }]);

await build({ entryPoints: ['tests/fixtures/notes-browser.tsx'], bundle: true, outfile: join(directory, 'fixture.js'), platform: 'browser', jsx: 'automatic', alias: { '@': resolve('.') }, define: { 'process.env.NODE_ENV': '"development"' }, plugins: [{ name: 'synthetic-notes-transport', setup(builder) {
  builder.onResolve({ filter: /(?:^|\/)notes\.actions$/ }, () => ({ path: 'notes-actions', namespace: 'synthetic-notes' }));
  builder.onLoad({ filter: /.*/, namespace: 'synthetic-notes' }, () => ({ contents: 'export async function commitNotes(command){const response=await fetch("/fixture/commit",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(command)});if(!response.ok)throw Error("Synthetic lost response");return response.json();}', loader: 'js' }));
} }] });
const theme = await postcss([tailwind()]).process(await readFile('app/globals.css', 'utf8'), { from: resolve('app/globals.css') });
const body = async request => { let text = ''; for await (const chunk of request) text += chunk; return text ? JSON.parse(text) : {}; };
const server = createServer(async (request, response) => {
  try {
    const send = (value, status = 200) => { response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); response.end(JSON.stringify(value)); };
    if (request.url === '/fixture.js' || request.url === '/fixture.css') { response.setHeader('content-type', request.url.endsWith('.js') ? 'application/javascript' : 'text/css'); response.end(await readFile(join(directory, request.url.slice(1)))); return; }
    if (request.url === '/theme.css') { response.setHeader('content-type', 'text/css'); response.end(theme.css); return; }
    if (request.url?.startsWith('/api/auth/get-session')) {
      const now = new Date().toISOString(); send(loggedOut ? null : { user: { id: 'notes-browser-owner', name: 'Notes QA', email: 'notes@example.invalid', emailVerified: true, createdAt: now, updatedAt: now }, session: { id: 'synthetic-session', userId: 'notes-browser-owner', token: 'synthetic-not-a-credential', expiresAt: new Date(Date.now() + 3600000).toISOString(), createdAt: now, updatedAt: now } }); return;
    }
    if (request.url === '/fixture/notes') { send(await store.readNotes('notes-browser-owner')); return; }
    if (request.url === '/fixture/commit') {
      const command = await body(request), lose = loseNext, slow = slowNext; loseNext = false; slowNext = false;
      const result = await actions.commitNotes(command);
      if (slow) await new Promise(done => setTimeout(done, 2500));
      if (lose) { request.socket.destroy(); return; }
      send(result); return;
    }
    if (request.url === '/fixture/control') {
      const control = await body(request);
      if ('loggedOut' in control) loggedOut = control.loggedOut;
      if ('loseNext' in control) loseNext = control.loseNext;
      if ('slowNext' in control) slowNext = control.slowNext;
      if (control.changeFirst) {
        const snapshot = await store.readNotes('notes-browser-owner'), note = snapshot.notes.find(note => note.title === 'Project ideas') ?? snapshot.notes[0];
        if (note) await store.writeNotes('notes-browser-owner', { operationId: randomUUID(), revision: snapshot.revision, data: { kind: 'save', id: note.id, expectedRevision: note.revision, title: note.title, blocks: [...note.blocks, { id: randomUUID(), type: 'text', text: 'A newer edit from another tab.' }] } });
      }
      send({ ok: true }); return;
    }
    response.setHeader('content-type', 'text/html');
    response.end('<!doctype html><html class="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Notes browser verification</title><link rel="stylesheet" href="/theme.css"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
  } catch { response.writeHead(500, { 'content-type': 'application/json' }); response.end(JSON.stringify({ error: 'Synthetic fixture error' })); }
});
server.listen(0, '127.0.0.1', () => console.log(`Isolated Notes fixture: http://127.0.0.1:${server.address().port}`));
async function stop() {
  server.closeAllConnections(); server.close(); await database.close();
  if (dirname(resolve(directory)) !== resolve(tmpdir()) || !basename(directory).startsWith('manforth-notes-browser-')) throw Error('Unexpected temporary directory');
  await rm(directory, { recursive: true, force: true }); process.exit(0);
}
process.on('SIGINT', stop); process.on('SIGTERM', stop);
