// Inspect by default. Apply only the reviewed Notes migration to an explicitly
// selected database; no fixtures, credentials, or note contents are logged.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const migrationName = '0037_notes.sql';
const tables = ['b1_notes', 'b1_notes_state', 'b1_notes_operations', 'b1_notes_legacy_imports'];
const expectedColumns = {
  b1_notes: ['id:text', 'user_id:text', 'title:text', 'blocks:jsonb', 'revision:bigint=1', 'created_at:timestamp with time zone=now()', 'updated_at:timestamp with time zone=now()', 'pinned:boolean=false', 'position:integer=0'],
  b1_notes_state: ['user_id:text', 'revision:bigint=0'],
  b1_notes_operations: ['user_id:text', 'operation_id:uuid', 'fingerprint:text', 'note_id:text?', 'acknowledged_revision:bigint', 'acknowledged_at:timestamp with time zone=now()'],
  b1_notes_legacy_imports: ['user_id:text', 'source_id:text', 'item_position:bigint', 'note_id:text', 'imported_at:timestamp with time zone=now()'],
};
const indexes = {
  b1_notes_pkey: ['b1_notes', true, 'id'],
  b1_notes_owner_order_idx: ['b1_notes', false, 'user_id,pinned,position,id'],
  b1_notes_state_pkey: ['b1_notes_state', true, 'user_id'],
  b1_notes_operations_pkey: ['b1_notes_operations', true, 'user_id,operation_id'],
  b1_notes_operation_note_idx: ['b1_notes_operations', false, 'user_id,note_id'],
  b1_notes_legacy_imports_pkey: ['b1_notes_legacy_imports', true, 'user_id,source_id,item_position'],
  b1_notes_legacy_imports_note_id_key: ['b1_notes_legacy_imports', true, 'note_id'],
};
const foreignKey = 'FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE';
const constraints = {
  b1_notes: [foreignKey, 'PRIMARY KEY (id)', "CHECK ((jsonb_typeof(blocks) = 'array'::text))", 'CHECK ((revision >= 0))', 'CHECK (("position" >= 0))'],
  b1_notes_state: [foreignKey, 'PRIMARY KEY (user_id)', 'CHECK ((revision >= 0))'],
  b1_notes_operations: [foreignKey, 'PRIMARY KEY (user_id, operation_id)'],
  b1_notes_legacy_imports: [foreignKey, 'PRIMARY KEY (user_id, source_id, item_position)', 'UNIQUE (note_id)'],
};
const normalize = value => value.replace(/\r\n/g, '\n').trim();
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const fail = message => { throw new Error(message); };

async function inspect(db, migration) {
  const relations = (await db.query(`SELECT c.relname AS name,c.relkind AS kind,c.relrowsecurity AS rls,c.relforcerowsecurity AS force_rls
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname LIKE 'b1_notes%' ORDER BY c.relname`)).rows;
  const functions = (await db.query(`SELECT p.proname AS name,oidvectortypes(p.proargtypes) AS arguments,pg_get_function_result(p.oid) AS result,
    l.lanname AS language,p.prosrc AS source,p.prosecdef AS definer,p.proconfig AS config,has_function_privilege(current_user,p.oid,'EXECUTE') AS executable
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
    WHERE n.nspname='public' AND (p.proname LIKE 'b1_notes%' OR p.proname='b1_save_note') ORDER BY p.proname`)).rows;
  if (!relations.length && !functions.length) return { state: 'absent', readable: false };
  const expectedRelations = [...tables.map(name => ({ name, kind: 'r', rls: false, force_rls: false })), ...Object.keys(indexes).map(name => ({ name, kind: 'i', rls: false, force_rls: false }))].sort((a, b) => a.name.localeCompare(b.name));
  if (!same(relations, expectedRelations)) fail('Partial or unexpected Notes relations; review required.');
  const expectedFunctions = [...migration.matchAll(/CREATE OR REPLACE FUNCTION (b1_\w+)\([^]*?\)\s*RETURNS (\w+) LANGUAGE plpgsql AS \$\$([^]*?)\$\$;/g)].map(match => ({ name: match[1], result: match[2], source: normalize(match[3]) }));
  if (functions.length !== 3 || expectedFunctions.length !== 3 || functions.some(row => {
    const expected = expectedFunctions.find(value => value.name === row.name);
    return !expected || row.result !== expected.result || normalize(row.source) !== expected.source || row.language !== 'plpgsql' || row.definer || row.config !== null || !row.executable || row.arguments !== (row.name === 'b1_save_note' ? 'text, uuid, text, bigint, jsonb' : '');
  })) fail('Partial or unexpected Notes functions or execution privileges; review required.');
  const columns = (await db.query(`SELECT c.relname AS name,a.attname AS column,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull AS required,
    pg_get_expr(d.adbin,d.adrelid) AS default_value FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
    WHERE n.nspname='public' AND c.relname=ANY($1::text[]) AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum`, [tables])).rows;
  const checks = (await db.query(`SELECT c.relname AS name,pg_get_constraintdef(k.oid) AS definition,k.convalidated AS valid
    FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname=ANY($1::text[]) AND k.contype<>'n'`, [tables])).rows;
  for (const name of tables) {
    const actualColumns = columns.filter(row => row.name === name).map(row => `${row.column}:${row.type}${row.required ? '' : '?'}${row.default_value === null ? '' : '=' + row.default_value}`);
    if (!same(actualColumns, expectedColumns[name]) || !same(checks.filter(row => row.name === name).map(row => row.definition).sort(), [...constraints[name]].sort()) || checks.some(row => !row.valid)) fail('Unexpected Notes columns or constraints; review required.');
  }
  const actualIndexes = (await db.query(`SELECT c.relname AS name,pg_get_indexdef(i.indexrelid) AS definition,i.indisvalid AS valid,i.indisready AS ready
    FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname LIKE 'b1_notes%' ORDER BY c.relname`)).rows;
  if (actualIndexes.some(row => {
    const [table, unique, keys] = indexes[row.name];
    const expected = `CREATE ${unique ? 'UNIQUE ' : ''}INDEX ${row.name} ON public.${table} USING btree (${keys.split(',').join(', ')})`;
    return !row.valid || !row.ready || row.definition.replaceAll('"', '') !== expected;
  }) || actualIndexes.length !== Object.keys(indexes).length) fail('Unexpected Notes indexes; review required.');
  const triggers = (await db.query(`SELECT t.tgname AS name,t.tgtype AS type,t.tgenabled AS enabled,p.proname AS function,t.tgqual IS NULL AS unconditional,t.tgnargs AS arguments
    FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname=ANY($1::text[]) AND NOT t.tgisinternal ORDER BY t.tgname`, [tables])).rows;
  if (!same(triggers, [{ name: 'b1_notes_prepare', type: 19, enabled: 'O', function: 'b1_notes_prepare_update', unconditional: true, arguments: 0 }, { name: 'b1_notes_revision', type: 29, enabled: 'O', function: 'b1_notes_changed', unconditional: true, arguments: 0 }])) fail('Unexpected Notes triggers; review required.');
  const permissions = (await db.query(`SELECT bool_and(has_table_privilege(current_user,'public.'||name,'SELECT')) AS readable
    FROM unnest($1::text[]) name`, [tables])).rows[0];
  if (!permissions.readable) fail('Notes read privileges are missing; review required.');
  return { state: 'ready', readable: true };
}

async function preservation(db, legacy) {
  const users = (await db.query('SELECT count(*)::text AS count FROM public."user"')).rows[0].count;
  const source = legacy ? (await db.query(`SELECT count(*)::text AS count,md5(COALESCE(string_agg(md5(to_jsonb(n)::text),'' ORDER BY id),'')) AS fingerprint FROM public.user_notes n`)).rows[0] : null;
  return { users, source };
}

// The caller must supply one checked-out connection, not a multiplexing Pool.
export async function applyNotesSchema(db, { apply = false, expectedDatabase, projectRoot = root } = {}) {
  if (apply && (!expectedDatabase || typeof expectedDatabase !== 'string')) fail('Apply requires an explicit expected database.');
  const migration = readFileSync(resolve(projectRoot, 'lib/db', migrationName), 'utf8');
  const hash = createHash('sha256').update(migration).digest('hex');
  await db.query(apply ? 'BEGIN' : 'BEGIN READ ONLY');
  try {
    await db.query("SET LOCAL search_path=public; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'");
    const identity = (await db.query(`SELECT current_database() AS database,to_regclass('public."user"') IS NOT NULL AS users_present,to_regclass('public.user_notes') IS NOT NULL AS legacy_present`)).rows[0];
    if (expectedDatabase !== undefined && identity.database !== expectedDatabase) fail('Configured database does not match the expected database.');
    if (!identity.users_present) fail('The existing account table is missing; review required.');
    if (apply) await db.query("SELECT pg_advisory_xact_lock(hashtext('manforth-notes-schema'))");
    const beforeSchema = await inspect(db, migration);
    const report = { database: identity.database, migration: migrationName, hash, applied: false, ...beforeSchema };
    if (!apply || beforeSchema.state === 'ready') {
      await db.query('COMMIT');
      return { ...report, alreadyApplied: beforeSchema.state === 'ready' };
    }
    await db.query(`LOCK TABLE public."user"${identity.legacy_present ? ',public.user_notes' : ''} IN SHARE ROW EXCLUSIVE MODE`);
    const before = await preservation(db, identity.legacy_present);
    await db.query(migration);
    const after = await preservation(db, identity.legacy_present);
    if (!same(before, after)) fail('Existing account or legacy Notes preservation check failed.');
    const afterSchema = await inspect(db, migration);
    if (afterSchema.state !== 'ready') fail('Notes installation verification failed.');
    const counts = (await db.query(`SELECT (SELECT count(*)::text FROM public.b1_notes) AS notes,(SELECT count(*)::text FROM public.b1_notes_legacy_imports) AS imported`)).rows[0];
    await db.query('COMMIT');
    return { ...report, ...afterSchema, applied: true, preserved: true, users: after.users, legacyRows: after.source?.count ?? '0', ...counts };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--apply' && !arg.startsWith('--expected-database=')) || args.filter(arg => arg.startsWith('--expected-database=')).length > 1) fail('Use --apply and --expected-database=<name> only.');
  const apply = args.includes('--apply'), expectedDatabase = args.find(arg => arg.startsWith('--expected-database='))?.slice('--expected-database='.length);
  if (apply && !expectedDatabase) fail('Apply requires --expected-database=<name>.');
  const { default: nextEnv } = await import('@next/env');
  nextEnv.loadEnvConfig(root, true, { info() {}, error() {} });
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) fail('The application database is not configured.');
  const { Pool, neonConfig } = await import('@neondatabase/serverless');
  neonConfig.webSocketConstructor = globalThis.WebSocket;
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10000 });
  let client;
  try {
    client = await pool.connect();
    console.log(JSON.stringify(await applyNotesSchema(client, { apply, expectedDatabase }), null, 2));
  } finally {
    client?.release();
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    // Provider exceptions may contain SQL/data/URLs. Only expose an SQLSTATE.
    console.error(JSON.stringify({ notesSetupFailed: true, code: /^[A-Z0-9]{5}$/.test(error?.code) ? error.code : null, reason: 'Notes target, schema, permissions or preservation verification failed; no credentials logged.' }));
    process.exitCode = 1;
  });
}
