// Synthetic fixtures in the authorized qa_tablename only. Uses the existing
// Better Auth password hash and finite trial fixtures; never copies web users,
// credentials, sessions, tasks or payments. No outbound provider calls.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import dotenv from 'dotenv';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { hashPassword } from 'better-auth/crypto';
import { qaFixturePath } from './mobile-qa-fixtures.mjs';
import { qaDatabaseUrl } from './qa-database.mjs';
import { verifyQaConnection, QA_DATABASE } from './mobile-qa-connection.mjs';

const root = resolve(import.meta.dirname, '..');
const local = dotenv.parse(readFileSync(resolve(root, '.env.mobile-qa.local')));
const application = dotenv.parse(readFileSync(resolve(root, '.env')));
const qaUrl = qaDatabaseUrl({ ...application, ...local });
// Phase 3 owns a separate additive set; earlier operators' fixture work stays intact.
const accountsPath = qaFixturePath(root, process.argv.includes('--phase3-additive') ? 'fixture-accounts-phase3.json' : 'fixture-accounts.json');
async function main() {
  if (!process.argv.includes('--seed-synthetic-qa')) throw Error('Explicit synthetic fixture setup is required.');
  if(process.argv.includes('--recent-expiry-fixture')&&!process.argv.some(arg=>arg.startsWith('--fixture-set=')))throw Error('Recent-expiry testing requires a separately named synthetic fixture set; existing trials are never reset.');
  await verifyQaConnection(qaUrl);
  const runtime = new URL(qaUrl);
  // Elevated setup is explicitly scoped to the verified QA database and is not
  // inherited by the running API. Existing production credentials stay intact.
  const setupUrl = new URL(process.env.NEON_PROVISIONING_DATABASE_URL || application.DATABASE_URL);
  if (setupUrl.hostname !== runtime.hostname) throw Error('Fixture provisioning endpoint differs from QA.');
  setupUrl.pathname = `/${QA_DATABASE}`;
  neonConfig.webSocketConstructor = globalThis.WebSocket;
  const pool = new Pool({ connectionString: setupUrl.href, connectionTimeoutMillis: 10000, max: 1 });
  try {
    if ((await pool.query('SELECT current_database() AS name')).rows[0].name !== QA_DATABASE) throw Error('Fixture database identity mismatch.');
    let fixtures;
    if (existsSync(accountsPath)) fixtures = JSON.parse(readFileSync(accountsPath));
    else {
      const run = randomBytes(8).toString('hex');
      fixtures = ['alex','robin','unverified','expired','no-legal'].map(name => ({ id: `qa-mobile-${run}-${name}`, name: `QA ${name}`, email: `qa-mobile-${run}-${name}@example.invalid`, password: randomBytes(24).toString('base64url') }));
      writeFileSync(accountsPath, JSON.stringify(fixtures), { flag: 'wx', mode: 0o600 });
    }
    await pool.query('BEGIN');
    try {
      for (const user of fixtures) {
        if (!/^qa-mobile-[a-f0-9]{16}-(alex|robin|unverified|expired|no-legal)$/.test(user.id) || !user.email.endsWith('@example.invalid')) throw Error('Unexpected fixture identity.');
        const existing = (await pool.query('SELECT id FROM "user" WHERE id=$1', [user.id])).rows;
        if (existing.length) continue; // Never reset passwords, trial clocks, or work.
        await pool.query('INSERT INTO "user"(id,name,email,email_verified) VALUES($1,$2,$3,$4)', [user.id, user.name, user.email, !user.id.endsWith('-unverified')]);
        await pool.query("INSERT INTO account(id,account_id,provider_id,user_id,password,updated_at) VALUES($1,$2,'credential',$2,$3,now())", [`credential:${user.id}`,user.id,await hashPassword(user.password)]);
        // Same finite 14-day trial policy as startMembershipTrial; no paid flag,
        // provider identity, checkout, perpetual grant, or production trial reset.
        await pool.query("INSERT INTO b1_memberships(user_id,product,enrolled_at,trial_started_at,trial_ends_at,status) VALUES($1,'b1-way-personal',now(),now(),now()+interval '14 days','trial')", [user.id]);
        if (user.id.endsWith('-expired')) {
          const recent=process.argv.includes('--recent-expiry-fixture');
          await pool.query("UPDATE b1_memberships SET trial_ends_at=now()-$2::interval,trial_started_at=now()-$2::interval-interval '14 days',status='trial' WHERE user_id=$1",[user.id,recent?'12 hours':'1 day']);
        }
      }
      await pool.query('COMMIT');
    } catch (error) { await pool.query('ROLLBACK'); throw error; }
    console.log('PASS: five synthetic shared identities with credential hashes, finite trial scenarios; no legal history is collected. Credentials are saved only in the ignored fixture file. No provider calls.');
  } finally { await pool.end(); }
}
main().catch(error => { console.error('Synthetic QA fixture setup stopped', { code: error.code ?? null, reason: error.code ? 'QA operation rejected.' : error.message }); process.exitCode = 1; });
