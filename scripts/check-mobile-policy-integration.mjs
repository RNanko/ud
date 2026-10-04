// Read-only policy checks and rejected raw auth requests against isolated QA.
// No signup completion, email delivery, deletion, migrations or permission changes.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { qaDatabaseUrl } from './qa-database.mjs';
import { verifyQaConnection } from './mobile-qa-connection.mjs';
const root = resolve(import.meta.dirname, '..'), origin = 'http://localhost:3001';
let stage = 'isolation';
async function main() {
  const qa = dotenv.parse(readFileSync(resolve(root, '.env.mobile-qa.local'))), application = dotenv.parse(readFileSync(resolve(root, '.env')));
  const connection = qaDatabaseUrl({ ...application, ...qa });
  console.log('Verified QA transport', await verifyQaConnection(connection));
  const sql = neon(connection);
  const [rights] = await sql`SELECT has_table_privilege(current_user,'public."user"','DELETE') AS user_delete,has_table_privilege(current_user,'public.account','DELETE') AS account_delete,has_table_privilege(current_user,'public."user"','INSERT') AS user_insert`;
  assert.equal(rights.user_delete, false); assert.equal(rights.account_delete, false);
  const [schema] = await sql`SELECT count(*) AS n FROM information_schema.tables WHERE table_schema='public' AND table_name=ANY(ARRAY['b1_legal_documents','b1_legal_active','b1_legal_signup_choices','b1_legal_signup_reservations','b1_legal_acceptances','b1_legal_purchases'])`;
  assert.equal(Number(schema.n), 0);
  console.log('PASS: Restricted QA identity; no legal registry or account DELETE grants. Registration INSERT capability: ' + (rights.user_insert ? 'available' : 'unavailable'));
  const audit = () => sql`SELECT (SELECT count(*) FROM "user") AS users,(SELECT count(*) FROM b1_email_outbox) AS queued,(SELECT count(*) FROM b1_email_outbox WHERE status='sent' OR provider_id IS NOT NULL) AS delivered`;
  const before = await audit();
  const get = path => fetch(origin + path, { redirect: 'manual', signal: AbortSignal.timeout(60000) });
  stage = 'public-pages';
  for (const path of ['/terms', '/privacy', '/help', '/auth/registration', '/auth/forgot-password']) {
    const response = await get(path); assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /text\/html/); await response.arrayBuffer();
  }
  const response = await get('/api/public/legal'), legal = await response.json();
  assert.equal(response.status, 200); assert.equal(legal.registrationAvailable, true); assert.equal(legal.bundle.product, 'b1-way-personal');
  assert.equal(legal.bundle.terms.href, '/terms'); assert.equal(legal.bundle.privacy.href, '/privacy'); assert.match(response.headers.get('cache-control'), /no-store/);
  console.log('PASS: Anonymous existing policy/Q&A and protected auth pages; current agreement references and QA readiness, with no storage-based legal dependency.');
  stage = 'raw-auth-guards';
  const email = 'qa-rejected-' + randomUUID() + '@example.invalid';
  for (const [path, body] of [['sign-up/email', { name: 'Rejected synthetic signup', email, password: randomUUID() }], ['request-password-reset', { email, redirectTo: origin + '/auth/reset-password' }], ['reset-password', { token: randomUUID(), newPassword: randomUUID() }], ['delete-user', { password: randomUUID() }]]) {
    const blocked = await fetch(origin + '/api/auth/' + path, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) });
    assert.equal(blocked.status, 403); await blocked.arrayBuffer();
  }
  assert.equal((await get('/api/mobile/v1/account')).status, 401);
  console.log('PASS: Direct signup/recovery/reset/deletion cannot bypass trusted proof/reauthentication; anonymous account access rejected.');
  stage = 'side-effects'; assert.deepEqual(await audit(), before); assert.equal(Number(before[0].delivered), 0);
  console.log('PASS: No account or email queue created by rejected requests; no provider delivery. Four real HTTP/Neon policy groups passed.');
}
main().catch(() => { console.error('FAIL: Policy QA stage ' + stage + '. Private diagnostics withheld; inspect this scoped check before retrying.'); process.exitCode = 1; });
