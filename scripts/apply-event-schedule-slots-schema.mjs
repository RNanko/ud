import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const root = resolve(import.meta.dirname, '..');
export async function applyEventScheduleSlotsSchema(db, options = {}) {
  return applyScheduleMigration(db, options, '0041_event_schedule_slots.sql', "to_regprocedure('public.b1_write_event_schedule_v2(text,uuid,text,uuid,integer,jsonb,date,date,integer,text,boolean)')");
}
export async function applyScheduleMigration(db, { apply = false, expectedDatabase } = {}, name, marker) {
  if (apply && !expectedDatabase) throw Error('Apply requires the exact database name.');
  const sql = readFileSync(resolve(root, 'lib/db', name), 'utf8');
  const checksum = createHash('sha256').update(sql.replaceAll('\r\n', '\n')).digest('hex');
  await db.query(apply ? 'BEGIN' : 'BEGIN READ ONLY');
  try {
    await db.query('SET LOCAL search_path=public');
    await db.query("SET LOCAL lock_timeout='5s'");
    await db.query("SET LOCAL statement_timeout='60s'");
    const { database } = (await db.query('SELECT current_database() AS database')).rows[0];
    if (expectedDatabase && database !== expectedDatabase) throw Error('Database identity differs.');
    if (!(await db.query("SELECT to_regclass('public.b1_event_schedules') AS table")).rows[0].table) throw Error('Apply migration 0040 first.');
    if (apply) await db.query("SELECT pg_advisory_xact_lock(hashtext('manforth-event-schedules-schema'))");
    const installed = !!(await db.query(`SELECT ${marker} AS installation`)).rows[0].installation;
    if (apply) {
      await db.query('CREATE TABLE IF NOT EXISTS b1_schema_installations(name text PRIMARY KEY,checksum text NOT NULL,installed_at timestamptz NOT NULL DEFAULT now())');
      const receipt = (await db.query('SELECT checksum FROM b1_schema_installations WHERE name=$1', [name])).rows[0];
      if (installed && receipt?.checksum !== checksum || !installed && receipt) throw Error('Installed schema checksum differs.');
      if (!installed) {
        if (db.exec) await db.exec(sql); else await db.query(sql);
        await db.query('INSERT INTO b1_schema_installations(name,checksum) VALUES($1,$2)', [name, checksum]);
      }
    }
    await db.query('COMMIT');
    return { database, migration:name, state:installed || apply ? 'ready' : 'pending', installed:apply && !installed };
  } catch (error) { await db.query('ROLLBACK'); throw error; }
}
async function main() {
  const args = process.argv.slice(2);
  if (args.some(a => a !== '--apply' && !a.startsWith('--expected-host=') && !a.startsWith('--expected-database='))) throw Error('Unsupported argument.');
  const { default: nextEnv } = await import('@next/env'); nextEnv.loadEnvConfig(root, true, { info() {}, error() {} });
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw Error('Database is not configured.');
  const host = new URL(connectionString).hostname;
  if (args.includes('--apply') && args.find(a => a.startsWith('--expected-host='))?.slice(16) !== host) throw Error('Apply requires the exact configured host.');
  const { Pool, neonConfig } = await import('@neondatabase/serverless'); neonConfig.webSocketConstructor = globalThis.WebSocket;
  const pool = new Pool({ connectionString, max:1, connectionTimeoutMillis:10000 }); let db;
  try { db = await pool.connect(); console.log(JSON.stringify({ host, ...await applyEventScheduleSlotsSchema(db, { apply:args.includes('--apply'), expectedDatabase:args.find(a => a.startsWith('--expected-database='))?.slice(20) }) })); }
  finally { db?.release(); await pool.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => {
  console.error(/^(Apply|Database identity|Installed schema|Database is not|Unsupported)/.test(error?.message ?? '') ? error.message : 'Event schedule slots schema check failed. No credentials logged.'); process.exitCode = 1;
});
