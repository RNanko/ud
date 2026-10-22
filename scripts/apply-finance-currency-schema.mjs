// Additive function replacement, with an exact predecessor check. No data writes.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const migrationName = '0038_finance_currency_edit.sql';
const normalize = value => value.replace(/\r\n/g, '\n').trim();
const source = sql => normalize(sql.match(/CREATE OR REPLACE FUNCTION b1_mobile_save_finance\([^]*?AS \$\$([^]*?)\$\$;/)?.[1] ?? '');

export async function applyFinanceCurrencySchema(db, { apply = false, expectedDatabase, projectRoot = root } = {}) {
  if (apply && !expectedDatabase) throw Error('Apply requires an explicit expected database.');
  const migration = readFileSync(resolve(projectRoot, 'lib/db', migrationName), 'utf8');
  const predecessor = readFileSync(resolve(projectRoot, 'lib/db/0031_mobile_finance.sql'), 'utf8');
  await db.query(apply ? 'BEGIN' : 'BEGIN READ ONLY');
  try {
    await db.query('SET LOCAL search_path=public');
    await db.query("SET LOCAL lock_timeout='5s'");
    await db.query("SET LOCAL statement_timeout='30s'");
    const { database } = (await db.query('SELECT current_database() AS database')).rows[0];
    if (expectedDatabase !== undefined && database !== expectedDatabase) throw Error('Database identity differs.');
    if (apply) await db.query("SELECT pg_advisory_xact_lock(hashtext('manforth-finance-currency-schema'))");
    const inspect = async () => (await db.query(`SELECT p.prosrc AS source,p.prosecdef AS definer,p.proconfig AS config,
      pg_get_function_result(p.oid) AS result,l.lanname AS language
      FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang
      WHERE p.oid=to_regprocedure('public.b1_mobile_save_finance(text,uuid,text,bigint,jsonb)')`)).rows[0];
    const current = await inspect();
    if (!current || current.definer || current.config !== null || current.result !== 'jsonb' || current.language !== 'plpgsql' || ![source(predecessor), source(migration)].includes(normalize(current.source))) throw Error('Finance function differs; review required.');
    const alreadyApplied = normalize(current.source) === source(migration);
    if (apply && !alreadyApplied) {
      await db.query(migration);
      if (normalize((await inspect()).source) !== source(migration)) throw Error('Finance function verification failed.');
    }
    await db.query('COMMIT');
    return { database, migration: migrationName, applied: apply && !alreadyApplied, alreadyApplied, state: apply || alreadyApplied ? 'ready' : 'pending', recordsUnchanged: true };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--apply' && !arg.startsWith('--expected-database=')) || args.filter(arg => arg.startsWith('--expected-database=')).length > 1) throw Error('Use --apply and --expected-database=<name> only.');
  const { default: nextEnv } = await import('@next/env');
  nextEnv.loadEnvConfig(root, true, { info() {}, error() {} });
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw Error('Database is not configured.');
  const { Pool, neonConfig } = await import('@neondatabase/serverless');
  neonConfig.webSocketConstructor = globalThis.WebSocket;
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10000 });
  let client;
  try {
    client = await pool.connect();
    console.log(JSON.stringify(await applyFinanceCurrencySchema(client, { apply: args.includes('--apply'), expectedDatabase: args.find(arg => arg.startsWith('--expected-database='))?.slice('--expected-database='.length) })));
  } finally { client?.release(); await pool.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(JSON.stringify({ financeCurrencySetupFailed: true, code: /^[A-Z0-9]{5}$/.test(error?.code) ? error.code : null, reason: 'Database identity or Finance function verification failed; no credentials logged.' }));
    process.exitCode = 1;
  });
}
