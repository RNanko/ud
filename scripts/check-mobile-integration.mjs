import {assertNoQaFeatureMail} from './mobile-qa-mail-audit.mjs';
// Real local HTTP -> Better Auth -> restricted Neon QA database. These are
// backend/client-contract checks, not SecureStore or native device evidence.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { qaDatabaseUrl } from './qa-database.mjs';
import { verifyQaConnection, QA_DATABASE } from './mobile-qa-connection.mjs';
import { moduleLoader } from '../../ud-mobile/tests/helpers.mjs';
import { qaFixturePath } from './mobile-qa-fixtures.mjs';

const root = resolve(import.meta.dirname, '..');
const options = dotenv.parse(readFileSync(resolve(root, '.env.mobile-qa.local')));
const application = dotenv.parse(readFileSync(resolve(root, '.env')));
const connection = qaDatabaseUrl({ ...application, ...options });
// The Windows test process uses loopback; bootstrap links use the separately
// configured emulator/LAN origin. Never infer a production request target.
const origin = 'http://localhost:3001';
const target = new URL(origin);
if (!['localhost','127.0.0.1','10.0.2.2'].includes(target.hostname) || target.protocol !== 'http:' || target.port !== '3001') throw Error('Integration checks target only the isolated local API on port 3001.');
const accounts = JSON.parse(readFileSync(qaFixturePath(root, 'fixture-accounts.json')));
const load = moduleLoader();
const mobile = load(resolve(root, '../ud-mobile/src/services/mobile-contract.ts'));
const { SessionController } = load(resolve(root, '../ud-mobile/src/services/session-controller.ts'));
const todo = load(resolve(root, '../ud-mobile/src/domain/todo.ts'));
// The TS test harness runs in a VM realm. Compare JSON DTOs, not VM prototypes.
const emptyTodoBoard = () => JSON.parse(JSON.stringify(todo.emptyTodoBoard()));
const user = suffix => accounts.find(user => user.id.endsWith(`-${suffix}`));
const evidence = [];
let stage = 'connection';
const cookies = new Map();
function jar(account, response) {
  const entries = cookies.get(account.id) ?? new Map();
  for (const line of response.headers.getSetCookie()) {
    const pair = line.split(';')[0], equals = pair.indexOf('=');
    if (equals > 0) entries.set(pair.slice(0, equals), pair.slice(equals + 1));
  }
  cookies.set(account.id, entries);
}
const cookie = account => [...(cookies.get(account.id) ?? [])].map(([key,value]) => `${key}=${value}`).join('; ');
async function request(path, account, body, extra = {}) {
  const response = await fetch(`${origin}${path}`, { method: body ? 'PUT' : 'GET', redirect: 'manual', signal: AbortSignal.timeout(60000), headers: { Accept: 'application/json', 'expo-origin': 'udmobile://', ...(account ? { Cookie: cookie(account) } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...extra }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { response, json: await response.json() };
}
async function signIn(account) {
  const response = await fetch(`${origin}/api/auth/sign-in/email`, { method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(60000), headers: { 'Content-Type': 'application/json', 'expo-origin': 'udmobile://' }, body: JSON.stringify({ email: account.email, password: account.password }) });
  assert.equal(response.status, 200, 'Actual email/password sign-in must succeed');
  jar(account, response); const value = await response.json();
  assert.equal(value.user.id, account.id); assert.ok(cookie(account));
}
async function signOut(account) {
  const response = await fetch(`${origin}/api/auth/sign-out`, { method: 'POST', signal: AbortSignal.timeout(15000), headers: { Cookie: cookie(account), 'Content-Type': 'application/json', 'expo-origin': 'udmobile://' }, body: '{}' });
  assert.equal(response.status, 200); // Keep old cookie to prove server revocation.
}
async function api(resource, account, body) {
  const result = await request(`/api/mobile/v1/${resource}`, account, body);
  assert.equal(result.response.status, 200, `Successful ${resource} response required`);
  assert.equal(result.response.headers.get('cache-control'), 'private, no-store');
  assert.equal(result.json.version, 1);
  return resource === 'bootstrap' ? mobile.bootstrapSchema.parse(result.json) : result.json.data;
}
async function main() {
  await verifyQaConnection(connection);
  const sql = neon(connection), alex = user('alex'), robin = user('robin');
  assert.ok(alex && robin && accounts.every(a => /^qa-mobile-[a-f0-9]{16}-/.test(a.id) && a.email.endsWith('@example.invalid')));
  stage = 'anonymous/auth/restore';
  assert.equal((await request('/api/mobile/v1/bootstrap')).response.status, 401);
  await signIn(alex);
  const session = await request('/api/auth/get-session', alex);
  assert.equal(session.response.status, 200); assert.equal(session.json.user.id, alex.id);
  const first = await api('bootstrap', alex);
  assert.equal(first.user.id, alex.id); assert.equal(first.access.state, 'trial'); assert.equal(first.access.canWrite, true); assert.equal(first.legal.writable, true);
  assert.equal(first.webOrigin, options.MOBILE_DEV_APP_ORIGIN || origin, 'External native links must use the configured reachable origin');
  const webLogin = await fetch(`${origin}/api/auth/sign-in/email`, { method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(60000), headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ email: alex.email, password: alex.password }) });
  assert.equal(webLogin.status, 200, 'Loopback browser credential sign-in remains supported on the local QA API');
  jar(alex, webLogin);
  evidence.push('real credential sign-in and session restoration preserve the shared user ID; authoritative trial/legal/preferences');
  stage = 'ownership/origin/validation';
  assert.equal((await request(`/api/mobile/v1/todo?userId=${robin.id}`, alex)).response.status, 400);
  const denied = { operationId: randomUUID(), revision: 0, data: emptyTodoBoard() };
  assert.equal((await request('/api/mobile/v1/todo', alex, denied, { Origin: 'https://outside.example.invalid' })).response.status, 403);
  assert.equal((await request('/api/mobile/v1/todo', alex, { ...denied, owner: robin.id })).response.status, 400);
  evidence.push('direct ownership parameters, forged body and foreign browser origin rejected');
  stage = 'task create/retry';
  let snapshot = await api('todo', alex);
  // Never reset fixture work from a previous operator/run. Use an additive new
  // fixture set for this test's create/delete flow if any tasks already exist.
  if (snapshot.board.some(group => group.items.length)) throw Error('Fixture tasks already exist; preserve them and select a fresh --fixture-set.');
  const board = emptyTodoBoard(), task = { id: randomUUID(), content: `QA mobile task ${randomUUID()}`, completedAt: null };
  board[1].items.push(task);
  const create = { operationId: randomUUID(), revision: snapshot.revision, data: board };
  snapshot = await api('todo', alex, create);
  const retries = await Promise.all(Array.from({ length: 6 }, () => api('todo', alex, create)));
  assert.ok(retries.every(r => r.acknowledgedOperationId === create.operationId && r.revision === snapshot.revision));
  assert.equal((await sql.query('SELECT count(*)::int AS count FROM b1_mobile_operations WHERE user_id=$1 AND operation_id=$2', [alex.id, create.operationId]))[0].count, 1);
  assert.equal(snapshot.board.flatMap(group => group.items).length, 1);
  evidence.push('To-Do create and six concurrent same-ID retries produce one durable receipt and one task');
  stage = 'edit/web read';
  snapshot.board[1].items[0].content += ' edited';
  snapshot = await api('todo', alex, { operationId: randomUUID(), revision: snapshot.revision, data: snapshot.board });
  const web = await fetch(`${origin}/account/to-do`, { headers: { Cookie: cookie(alex) }, redirect: 'manual', signal: AbortSignal.timeout(60000) });
  assert.equal(web.status, 200); assert.ok((await web.text()).includes(snapshot.board[1].items[0].content), 'The actual web page must read the mobile-confirmed task');
  assert.deepEqual((await sql.query('SELECT data FROM kanban_board WHERE user_id=$1', [alex.id]))[0].data, snapshot.board);
  evidence.push('edit is stored in the original shared board and rendered by the actual authenticated web page');
  stage = 'concurrent CAS/stale web edit';
  const before = structuredClone(snapshot), left = structuredClone(snapshot.board), right = structuredClone(snapshot.board);
  left[1].items[0].content += ' left'; right[1].items[0].content += ' right';
  const competing = await Promise.all([left,right].map(data => request('/api/mobile/v1/todo', alex, { operationId: randomUUID(), revision: before.revision, data })));
  assert.deepEqual(competing.map(r => r.response.status).sort(), [200,409]);
  snapshot = await api('todo', alex);
  const stale = structuredClone(snapshot);
  const webEdit = structuredClone(snapshot.board); webEdit[1].items[0].content += ' web-source';
  // Actual shared SQL write, matching the web source's CAS. This exercises the
  // web-write trigger, not a fabricated mobile response or browser action ID.
  const changed = await sql.query('UPDATE kanban_board SET data=$1::jsonb WHERE user_id=$2 AND data=$3::jsonb RETURNING id', [JSON.stringify(webEdit),alex.id,JSON.stringify(snapshot.board)]);
  assert.equal(changed.length, 1);
  assert.equal((await request('/api/mobile/v1/todo', alex, { operationId: randomUUID(), revision: stale.revision, data: stale.board })).response.status, 409);
  snapshot = await api('todo', alex); assert.deepEqual(snapshot.board, webEdit); assert.equal(snapshot.revision, stale.revision + 1);
  evidence.push('multi-connection competing writes have one winner; shared web-style CAS increments revision and stale native writes fail');
  stage = 'complete/delete/deletion replay';
  const completed = structuredClone(snapshot.board), actual = completed[1].items.pop(); actual.completedAt = new Date().toISOString(); completed[3].items.push(actual);
  snapshot = await api('todo', alex, { operationId: randomUUID(), revision: snapshot.revision, data: completed });
  assert.equal(snapshot.board[3].items[0].id, task.id); assert.ok(snapshot.board[3].items[0].completedAt);
  snapshot = await api('todo', alex, { operationId: randomUUID(), revision: snapshot.revision, data: emptyTodoBoard() });
  const replay = await api('todo', alex, create); assert.deepEqual(replay.board, emptyTodoBoard()); assert.equal(replay.revision, snapshot.revision);
  assert.equal((await request('/api/mobile/v1/todo', alex, { ...create, operationId: randomUUID() })).response.status, 409);
  evidence.push('complete/delete preserve identity; old acknowledged replay returns the current empty board; stale fresh replay cannot resurrect it');
  stage = 'preferences/calendar/Gym';
  const settings = (await api('bootstrap', alex)).settings;
  const preferences = { ...settings.preferences, financeDefaultCurrency: 'EUR', exerciseLoad: 'lb', bodyWeight: 'kg', distance: 'mi', weekStart: 'sunday' };
  const preferenceWrite = { operationId: randomUUID(), revision: settings.revision, data: preferences };
  const saved = await api('preferences', alex, preferenceWrite);
  const duplicate = await api('preferences', alex, preferenceWrite);
  assert.deepEqual(saved.settings.preferences, preferences); assert.equal(duplicate.settings.revision, saved.settings.revision); assert.deepEqual(saved.settings.notifications, settings.notifications);
  assert.equal((await request('/api/mobile/v1/preferences', alex, { ...preferenceWrite, operationId: randomUUID() })).response.status, 409);
  await api('calendar?anchor=2026-10-04', alex);
  mobile.gymDataSchema.parse(await api('gym', alex));
  evidence.push('preferences persist independently with notification state preserved; duplicate/stale checks and canonical calendar/Gym reads pass');
  stage = 'verification/membership guards';
  for (const [name, code] of [['unverified','verification'], ['expired','membership']]) {
    const fixture = user(name); await signIn(fixture);
    const board = await api('todo', fixture);
    const failure = await request('/api/mobile/v1/todo', fixture, { operationId: randomUUID(), revision: board.revision, data: emptyTodoBoard() });
    assert.equal(failure.response.status, 403); assert.equal(failure.json.error.code, code);
    await signOut(fixture);
  }
  evidence.push('real direct writes fail for unverified identity and expired trial; policies no longer collect acceptance history');
  stage = 'actual client controller/logout/account switch';
  let active = alex;
  const transport = mobile.apiTransport(origin, async () => cookie(active));
  const adapter = { newId: randomUUID, request: transport, restore: async () => { const response = await request('/api/auth/get-session', active); return response.json ? transport('bootstrap') : null; }, signIn: async () => signIn(active), signOut: async () => signOut(active) };
  const controller = new SessionController(adapter); await controller.restore();
  assert.equal(controller.state.phase, 'ready'); assert.equal(controller.state.account.user.id, alex.id);
  await controller.logout(); assert.equal(controller.state.account, null); assert.equal(controller.state.todo, null);
  assert.equal((await request('/api/mobile/v1/bootstrap', alex)).response.status, 401);
  active = robin; await controller.signIn(robin.email, robin.password);
  assert.equal(controller.state.phase, 'ready'); assert.equal(controller.state.account.user.id, robin.id); assert.deepEqual(controller.state.todo.board, emptyTodoBoard());
  controller.suspend(); assert.equal(controller.state.account, null); await controller.restore(); assert.equal(controller.state.account.user.id, robin.id);
  await sql.query("UPDATE session SET expires_at=now()-interval '1 second' WHERE user_id=$1", [robin.id]);
  await controller.restore(); assert.equal(controller.state.account, null); assert.equal(controller.state.todo, null); assert.equal(controller.state.phase, 'signed-out');
  evidence.push('actual mobile controller over real HTTP restores/resumes, revokes logout, switches owned accounts and hides data after server session expiry');
  stage = 'provider safety';
  // Keep any provisioning read outside the running restricted API environment.
  const auditUrl = new URL(application.DATABASE_URL);
  assert.equal(auditUrl.hostname, new URL(connection).hostname);
  auditUrl.pathname = `/${QA_DATABASE}`;
  const audit = neon(auditUrl.href);
  assert.equal((await audit.query('SELECT current_database() AS name'))[0].name, QA_DATABASE);
  await assertNoQaFeatureMail(audit,root,accounts);
  evidence.push('To-Do fixtures queue no mail; QA has no accepted external provider delivery');
  for (const item of evidence) console.log(`PASS: ${item}`);
  console.log(`PASS: ${evidence.length} backend/client integration groups on real Neon QA. No native device or SecureStore validation is implied.`);
}
main().catch(error => { console.error(`FAIL: real mobile integration stopped at ${stage}.`, { type: error.name, ...(typeof error.actual === 'number' ? { actualStatus: error.actual, expectedStatus: error.expected } : {}) }); process.exitCode = 1; });
