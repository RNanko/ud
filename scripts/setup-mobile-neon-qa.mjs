// Explicit, scoped provisioning. Never run as the local API process.
// No production records, passwords or grants are changed. Existing QA data is
// never reset. A single transaction applies the reviewed sequence on an EMPTY
// database; later runs require our exact migration hashes rather than guessing.
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import dotenv from 'dotenv';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { QA_DATABASE, QA_ROLE, verifyQaConnection } from './mobile-qa-connection.mjs';

const root = resolve(import.meta.dirname, '..');
const qaPath = resolve(root, '.env.mobile-qa.local');
const local = existsSync(qaPath) ? dotenv.parse(readFileSync(qaPath)) : {};
const application = dotenv.parse(readFileSync(resolve(root, '.env')));
const connection = process.argv.includes('--provisioning-from-web-env') ? application.DATABASE_URL : process.env.NEON_PROVISIONING_DATABASE_URL || local.NEON_PROVISIONING_DATABASE_URL;
const secretPath = resolve(root, '.mobile-dev', 'qa-provisioning.json');
let phase = 'configuration';
neonConfig.webSocketConstructor = globalThis.WebSocket;
const quote = value => `'${value.replaceAll("'", "''")}'`;
async function main() {
  if (!process.argv.includes('--setup-empty-qa') || !connection || process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') throw Error('Explicit QA setup and provisioning access are required.');
  const source = new URL(connection);
  if (!source.hostname.endsWith('.neon.tech')) throw Error('Unsupported provisioning target.');
  if (decodeURIComponent(new URL(application.DATABASE_URL).pathname.slice(1)) === QA_DATABASE) throw Error('The application must not already target the QA database.');
  const admin = new Pool({ connectionString: connection, connectionTimeoutMillis: 10000, max: 1 });
  let qa;
  try {
    phase = 'catalog inspection';
    const identity = (await admin.query('SELECT current_user AS role,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user')).rows[0];
    if (!identity?.rolcreatedb || !identity.rolcreaterole) throw Error('Provisioning role lacks required privileges.');
    const existing = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [QA_DATABASE])).rows;
    // Check first; do not duplicate, drop, or reset an existing database.
    if (!existing.length) {
      phase = 'empty database creation';
      await admin.query(`CREATE DATABASE ${QA_DATABASE} TEMPLATE template0`);
      console.log('Created separate empty QA database.');
    } else console.log('QA database already exists; preserving it.');
    const qaAdminUrl = new URL(source); qaAdminUrl.pathname = `/${QA_DATABASE}`;
    qa = new Pool({ connectionString: qaAdminUrl.href, connectionTimeoutMillis: 10000, max: 1 });
    if ((await qa.query('SELECT current_database() AS name')).rows[0].name !== QA_DATABASE) throw Error('QA connection identity mismatch.');
    const tables = (await qa.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows;
    const ledger = (await qa.query("SELECT to_regclass('b1_mobile_qa_metadata.migrations') AS table_name")).rows[0].table_name;
    if (tables.length && !ledger) throw Error('Existing QA schema has no reviewed migration ledger. Inspect it; never reset it.');
    phase = 'QA role preparation';
    const role = (await admin.query('SELECT oid FROM pg_roles WHERE rolname=$1', [QA_ROLE])).rows[0];
    let secret;
    if (existsSync(secretPath)) secret = JSON.parse(readFileSync(secretPath));
    if (secret && (secret.endpoint !== source.hostname || secret.role !== QA_ROLE)) throw Error('Stored QA credential belongs to a different target.');
    if (role && !secret) throw Error('QA role already exists without the local provisioning credential. Supply its existing credential; no password reset is performed.');
    if (!secret) {
      secret = { endpoint: source.hostname, role: QA_ROLE, password: randomBytes(48).toString('base64url') };
      mkdirSync(resolve(root, '.mobile-dev'), { recursive: true });
      writeFileSync(secretPath, JSON.stringify(secret), { flag: 'wx', mode: 0o600 });
    }
    if (!role) await admin.query(`CREATE ROLE ${QA_ROLE} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD ${quote(secret.password)}`);
    const flags = (await admin.query('SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,EXISTS(SELECT 1 FROM pg_auth_members WHERE member=pg_roles.oid) AS memberships FROM pg_roles WHERE rolname=$1', [QA_ROLE])).rows[0];
    if (Object.values(flags).some(Boolean)) throw Error('Existing QA role is privileged; refusing to change or use it.');
    // PUBLIC grants can permit unexpected production access even with a new
    // NOINHERIT role. Inspect effective object permissions without reading data.
    phase = 'application object permission inspection';
    const exposed = (await admin.query(`SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' AND c.relkind IN ('r','v','m','p','f')
      AND has_table_privilege($1,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')`, [QA_ROLE])).rows[0].count;
    const elevatedFunctions = (await admin.query(`SELECT count(*)::int AS count FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE p.prosecdef AND n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' AND has_function_privilege($1,p.oid,'EXECUTE')`, [QA_ROLE])).rows[0].count;
    const exposedSequences = (await admin.query(`SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' AND CASE WHEN c.relkind='S' THEN has_sequence_privilege($1,c.oid,'USAGE,SELECT,UPDATE') ELSE false END`, [QA_ROLE])).rows[0].count;
    const exposedDdl = (await admin.query(`SELECT has_database_privilege($1,current_database(),'CREATE') AS database_create,
      EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' AND has_schema_privilege($1,n.oid,'CREATE')) AS schema_create`, [QA_ROLE])).rows[0];
    if (exposed || elevatedFunctions || exposedSequences || exposedDdl.database_create || exposedDdl.schema_create) throw Error('PUBLIC/application grants expose non-QA objects to the QA role. Owner review is required; production grants are not changed.');
    phase = 'QA migrations';
    const momentum=process.argv.includes('--phase4-momentum'),investments=momentum||process.argv.includes('--phase4-investments'),expected=momentum?34:investments?32:30;
    const names = readdirSync(resolve(root, 'lib/db')).filter(name => /^\d{4}_.+\.sql$/.test(name) && Number(name.slice(0,4))<=(momentum?35:investments?33:31) && !['0028_cross_platform_billing.sql','0030_cross_platform_billing.sql'].includes(name)).sort();
    if (names.length !== expected || names[28] !== '0029_mobile_gym.sql' || names[29] !== '0031_mobile_finance.sql' || investments&&(names[30]!=='0032_registration_birth_date.sql'||names[31]!=='0033_mobile_investments.sql') || momentum&&(names[32]!=='0034_mobile_momentum.sql'||names[33]!=='0035_mobile_momentum_receipt_order.sql')) throw Error('Migration sequence changed; review it first.');
    const files = names.map(name => { const sql = readFileSync(resolve(root, 'lib/db', name), 'utf8'); return { name, sql, hash: createHash('sha256').update(sql).digest('hex') }; });
    if (ledger) {
      const applied = (await qa.query('SELECT name,hash FROM b1_mobile_qa_metadata.migrations ORDER BY name')).rows;
      if(investments&&[30,31].includes(applied.length))throw Error('Use apply-mobile-phase4-qa.mjs for the existing QA database. No reset is performed.');
      if(applied.length>32&&!momentum)throw Error('QA has Momentum migrations; use --phase4-momentum for ledger verification.');
      if(momentum&&applied.length<34)throw Error('Use the scoped apply-mobile-momentum-qa.mjs upgrade for existing QA; never reset it.');
      if(!investments&&applied.length>30)throw Error('QA already has later migrations; use --phase4-investments to verify the current reviewed sequence.');
      if (applied.length >= 26 && applied.length < 30) throw Error('Existing QA data must use apply-mobile-phase3-qa.mjs with its explicit scoped-upgrade flags; never reset it.');
      if (JSON.stringify(applied) !== JSON.stringify(files.map(({ name, hash }) => ({ name, hash })))) throw Error('QA migration history differs. Review before further changes.');
    } else {
      await qa.query('BEGIN');
      try {
        await qa.query('CREATE SCHEMA b1_mobile_qa_metadata; CREATE TABLE b1_mobile_qa_metadata.migrations(name text PRIMARY KEY,hash text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
        for (const file of files) {
          await qa.query(file.sql);
          await qa.query('INSERT INTO b1_mobile_qa_metadata.migrations(name,hash) VALUES($1,$2)', [file.name, file.hash]);
        }
      await qa.query('COMMIT');
      } catch (error) { await qa.query('ROLLBACK'); throw error; }
    }
    phase = 'QA grants';
    // These grants exist ONLY in qa_tablename. The runtime never owns objects or
    // gets migration/role privileges. No permission on other DBs is revoked.
    await qa.query(`REVOKE ALL ON DATABASE ${QA_DATABASE} FROM PUBLIC; GRANT CONNECT ON DATABASE ${QA_DATABASE} TO ${QA_ROLE}; REVOKE CREATE ON SCHEMA public FROM PUBLIC; GRANT USAGE ON SCHEMA public TO ${QA_ROLE}`);
    const reads = ['user','account','session','verification','rate_limit','b1_account_settings','b1_memberships','b1_deletions','b1_rate_buckets','kanban_board','b1_mobile_todo_versions','b1_mobile_operations','user_events','gym_entities','gym_plans','gym_sessions','gym_rest_days','momentum_state','b1_inbox_state','b1_notifications','b1_app_messages'];
    const writes = ['session','verification','rate_limit','b1_rate_buckets','b1_account_settings','kanban_board','b1_mobile_todo_versions','b1_mobile_operations','user_events','b1_inbox_state','b1_notifications'];
    const qualified = names => names.map(name => `public."${name}"`).join(',');
    await qa.query(`GRANT SELECT ON ${qualified(reads)} TO ${QA_ROLE}; GRANT INSERT,UPDATE,DELETE ON ${qualified(writes)} TO ${QA_ROLE}; GRANT UPDATE ON public."user",public.account TO ${QA_ROLE}`);
    await qa.query(`GRANT SELECT,INSERT,UPDATE ON public.b1_mobile_event_versions,public.b1_mobile_event_operations TO ${QA_ROLE}; GRANT INSERT,UPDATE ON public.gym_plans TO ${QA_ROLE}`);
    await qa.query(`GRANT SELECT,INSERT,UPDATE ON public.b1_mobile_gym_operations,public.gym_entities,public.gym_plans,public.gym_sessions,public.gym_rest_days TO ${QA_ROLE}; REVOKE DELETE ON public.b1_mobile_gym_operations,public.gym_entities,public.gym_plans,public.gym_sessions,public.gym_rest_days FROM ${QA_ROLE}`);
    await qa.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON public.finance_table TO ${QA_ROLE}; GRANT SELECT,INSERT,UPDATE ON public.finance_categories,public.b1_mobile_finance_versions,public.b1_mobile_finance_operations TO ${QA_ROLE}; REVOKE DELETE ON public.finance_categories,public.b1_mobile_finance_versions,public.b1_mobile_finance_operations FROM ${QA_ROLE}`);
    if(investments)await qa.query(`GRANT SELECT,INSERT,UPDATE ON public.investment_positions,public.b1_mobile_investment_versions,public.b1_mobile_investment_operations TO ${QA_ROLE}`);
    if(momentum)await qa.query(`GRANT SELECT,INSERT,UPDATE ON momentum_state,b1_mobile_momentum_operations,b1_mobile_momentum_identities TO ${QA_ROLE}`);
    const runtime = new URL(qaAdminUrl); runtime.username = QA_ROLE; runtime.password = secret.password;
    phase = 'runtime connection verification';
    console.log('QA connection verified', await verifyQaConnection(runtime.href));
    // Preserve unrelated QA options; never write the provisioning administrator
    // credential into the runtime file or touch the regular application .env.
    const existingLines = existsSync(qaPath) ? readFileSync(qaPath, 'utf8').split(/\r?\n/).filter(line => !/^(QA_DATABASE_URL|QA_DATABASE_ISOLATED|NEON_PROVISIONING_DATABASE_URL)=/.test(line)) : [];
    writeFileSync(qaPath, [...existingLines, `QA_DATABASE_URL=${runtime.href}`, 'QA_DATABASE_ISOLATED=true', ''].join('\n'), { mode: 0o600 });
    console.log(`PASS: ${files.length} migrations present in qa_tablename; restricted runtime configuration saved to ud-1/.env.mobile-qa.local. No production records changed.`);
  } finally { if (qa) await qa.end(); await admin.end(); }
}
main().catch(error => { console.error('QA setup stopped', { phase, code: error.code ?? null, reason: error.code ? 'Database operation rejected; inspect the scoped setup before retrying.' : error.message }); process.exitCode = 1; });
