import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
export const mobileOriginalFiles = ['0025_mobile_slice.sql','0026_mobile_events.sql','0029_mobile_gym.sql','0031_mobile_finance.sql','0033_mobile_investments.sql','0034_mobile_momentum.sql','0035_mobile_momentum_receipt_order.sql'];
export const mobileOriginalTables = ['b1_mobile_todo_versions','b1_mobile_operations','b1_mobile_event_versions','b1_mobile_event_operations','b1_mobile_gym_operations','b1_mobile_finance_versions','b1_mobile_finance_operations','b1_mobile_investment_versions','b1_mobile_investment_operations','b1_mobile_momentum_operations','b1_mobile_momentum_identities'];
const retained = ['user','kanban_board','user_events','b1_account_settings','b1_memberships','gym_entities','gym_plans','gym_sessions','gym_rest_days','finance_table','finance_categories','investment_positions','momentum_state'];
export async function originalMobileMigrations(db, root, { apply = false, expectedDatabase } = {}) {
  if (expectedDatabase !== 'neondb') throw Error('Explicit original database selection required.');
  const identity = (await db.query('SELECT current_database() AS database,current_user AS role')).rows[0];
  if (identity?.database !== expectedDatabase) throw Error('Original database identity differs.');
  const files = mobileOriginalFiles.map(name => { const sql = readFileSync(resolve(root,'lib/db',name),'utf8'); return { name, sql, hash: createHash('sha256').update(sql).digest('hex') }; });
  const functions = [...new Set(files.flatMap(file => [...file.sql.matchAll(/CREATE (?:OR REPLACE )?FUNCTION (b1_mobile_\w+)/g)].map(match => match[1])))];
  const objects = async () => {
    const tables = (await db.query('SELECT n AS name,to_regclass(n) IS NOT NULL AS present FROM unnest($1::text[]) n',[mobileOriginalTables])).rows;
    const existingFunctions = (await db.query("SELECT proname AS name FROM pg_proc WHERE proname LIKE 'b1_mobile_%'")).rows;
    return { missingTables: tables.filter(row=>!row.present).map(row=>row.name), missingFunctions: functions.filter(name=>!existingFunctions.some(row=>row.name===name)) };
  };
  const missing = await objects();
  if (!apply) return { database:identity.database, ...missing, files:files.map(({name,hash})=>({name,hash})), applied:false };
  await db.query('BEGIN');
  try {
    await db.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'; SELECT pg_advisory_xact_lock(hashtext('manforth-mobile-original-schema'))");
    // Canonical data cannot change concurrently during the preservation audit.
    // Readers remain available; lock contention aborts rather than forcing it.
    await db.query(`LOCK TABLE ${retained.map(name=>'"'+name+'"').join(',')} IN SHARE ROW EXCLUSIVE MODE`);
    const ledger = (await db.query("SELECT to_regclass('b1_mobile_deployment_metadata.migrations') IS NOT NULL AS present")).rows[0].present;
    const now = await objects();
    if (ledger) {
      const applied = (await db.query('SELECT name,hash FROM b1_mobile_deployment_metadata.migrations ORDER BY name')).rows;
      if (JSON.stringify(applied)!==JSON.stringify(files.map(({name,hash})=>({name,hash}))) || now.missingTables.length || now.missingFunctions.length) throw Error('Original mobile migration ledger/schema differs; review required.');
      await db.query('COMMIT'); return { database:identity.database,alreadyApplied:true,preserved:true,files:files.map(file=>file.name) };
    }
    if (now.missingTables.length!==mobileOriginalTables.length || now.missingFunctions.length!==functions.length) throw Error('Partial original mobile schema requires review; never drop/reset it.');
    const audit = async () => {
      const values = [];
      for (const name of retained) values.push((await db.query(`SELECT count(*)::text AS count,md5(COALESCE(string_agg(to_jsonb(t)::text,'|' ORDER BY to_jsonb(t)::text),'')) AS fingerprint FROM "${name}" t`)).rows[0]);
      return JSON.stringify(values);
    };
    const before = await audit();
    await db.query('CREATE SCHEMA b1_mobile_deployment_metadata; CREATE TABLE b1_mobile_deployment_metadata.migrations(name text PRIMARY KEY,hash text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
    for (const file of files) {
      await db.query(file.sql);
      await db.query('INSERT INTO b1_mobile_deployment_metadata.migrations(name,hash) VALUES($1,$2)',[file.name,file.hash]);
    }
    if (before!==await audit()) throw Error('Canonical data changed during additive setup; transaction rolled back.');
    const after = await objects();
    if (after.missingTables.length || after.missingFunctions.length) throw Error('Required mobile objects remain missing.');
    await db.query('COMMIT');
    return { database:identity.database,applied:true,preserved:true,files:files.map(file=>file.name) };
  } catch (error) { await db.query('ROLLBACK'); throw error; }
}
