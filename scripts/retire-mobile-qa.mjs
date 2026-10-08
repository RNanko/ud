// User-requested retirement of the single generated QA database. Original
// connection is explicit provisioning only; no QA-to-original test fallback.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { Pool, neonConfig } from '@neondatabase/serverless';
const root = resolve(import.meta.dirname, '..');
const qaPath = resolve(root, '.env.mobile-qa.local');
let stage = 'configuration';
neonConfig.webSocketConstructor = globalThis.WebSocket;
async function main() {
  if (!process.argv.includes('--apply') || !process.argv.includes('--expected-original=neondb')) throw Error('Explicit scoped retirement arguments required.');
  const app = dotenv.parse(readFileSync(resolve(root, '.env'))), local = dotenv.parse(readFileSync(qaPath));
  const original = new URL(app.DATABASE_URL), runtime = new URL(local.QA_DATABASE_URL);
  const host = u => u.hostname.replace(/-pooler(?=\.)/, '') + ':' + (u.port || '5432');
  if (!original.hostname.endsWith('.neon.tech') || host(original) !== host(runtime)
    || decodeURIComponent(original.pathname.slice(1)) !== 'neondb'
    || decodeURIComponent(runtime.pathname.slice(1)) !== 'qa_tablename'
    || decodeURIComponent(runtime.username) !== 'manforth_mobile_qa') throw Error('Exact original/QA identity or branch differs.');
  const db = new Pool({ connectionString: original.href, max: 1, connectionTimeoutMillis: 10000 });
  try {
    stage = 'original catalog verification';
    const identity = (await db.query('SELECT current_database() AS database,current_user AS role')).rows[0];
    if (identity.database !== 'neondb') throw Error('Original connection identity differs.');
    const existing = (await db.query("SELECT pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname='qa_tablename'")).rows[0];
    if (existing) {
      if (existing.owner !== identity.role) throw Error('QA owner differs from the reviewed provisioning role.');
      const qaUrl = new URL(original); qaUrl.pathname = '/qa_tablename';
      const qa = new Pool({ connectionString: qaUrl.href, max: 1, connectionTimeoutMillis: 10000 });
      try {
        stage = 'generated QA verification';
        const row = (await qa.query("SELECT current_database() AS database,to_regclass('b1_mobile_qa_metadata.migrations') IS NOT NULL AS generated")).rows[0];
        if (row.database !== 'qa_tablename' || !row.generated) throw Error('QA metadata identity missing.');
        const accounts = (await qa.query('SELECT count(*) FILTER (WHERE email NOT LIKE \'%@example.invalid\')::int AS nonsynthetic FROM "user"')).rows[0];
        if (accounts.nonsynthetic) throw Error('QA contains non-synthetic accounts; retirement requires review.');
      } finally { await qa.end(); }
      stage = 'exact QA retirement';
      // Standalone, fixed identifier. FORCE affects only this verified QA DB's
      // remaining pooled sessions, never any original database connection.
      await db.query('DROP DATABASE "qa_tablename" WITH (FORCE)');
    }
    stage = 'post-retirement verification';
    const result = (await db.query("SELECT current_database() AS original,EXISTS(SELECT 1 FROM pg_database WHERE datname='qa_tablename') AS qa_exists,to_regclass('public.\"user\"') IS NOT NULL AS original_users_exist")).rows[0];
    if (result.original !== 'neondb' || result.qa_exists || !result.original_users_exist) throw Error('Retirement verification failed.');
    // Invalidate only obsolete QA connection settings. Leave unrelated ignored
    // settings/fixtures and all roles/production grants untouched.
    const kept = readFileSync(qaPath, 'utf8').split(/\r?\n/).filter(line => !/^(QA_DATABASE_URL|QA_DATABASE_ISOLATED|MOBILE_DEV_APP_ORIGIN)=/.test(line));
    writeFileSync(qaPath, [...kept, '# QA database retired by owner request. No original-database fallback for test scripts.', 'QA_DATABASE_ISOLATED=false', ''].join('\n'), { mode: 0o600 });
    console.log('PASS: qa_tablename is absent; original neondb remains; obsolete QA connection disabled. No original rows or role grants changed.');
  } finally { await db.end(); }
}
main().catch(error => { console.error('QA retirement stopped', { stage, code: error.code ?? null, reason: 'Scoped target/verification failed; credentials not logged.' }); process.exitCode = 1; });
