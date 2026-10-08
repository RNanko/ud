import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { applyNotesSchema } from '../scripts/apply-notes-schema.mjs';

const migration = readFileSync('lib/db/0037_notes.sql', 'utf8');
async function fixture({ legacy = false } = {}) {
  const database = await PGlite.create();
  await database.exec('CREATE TABLE "user"(id text PRIMARY KEY); INSERT INTO "user" VALUES(\'owner\'),(\'other\')');
  if (legacy) {
    await database.exec('CREATE TABLE user_notes(id text PRIMARY KEY,user_id text REFERENCES "user"(id),data jsonb NOT NULL)');
    await database.query('INSERT INTO user_notes VALUES($1,$2,$3::jsonb)', ['source', 'owner', JSON.stringify([{ event: 'Private legacy title', description: 'Private legacy content', createdAt: 1704067200000 }, { malformed: 'retained' }, null])]);
  }
  const expectedDatabase = (await database.query('SELECT current_database() AS name')).rows[0].name;
  const queries = [];
  const client = { query: async (sql, parameters) => {
    queries.push(sql);
    return parameters ? database.query(sql, parameters) : (await database.exec(sql)).at(-1);
  } };
  const absent = async () => assert.equal((await database.query("SELECT to_regclass('public.b1_notes') IS NULL AS absent")).rows[0].absent, true);
  return { database, client, queries, expectedDatabase, absent };
}

test('Notes deployment defaults to a read-only inspection and requires explicit matching apply target', async () => {
  const f = await fixture();
  try {
    await assert.rejects(applyNotesSchema(f.client, { apply: true }), /explicit expected database/);
    assert.equal(f.queries.length, 0);
    const result = await applyNotesSchema(f.client);
    assert.equal(result.applied, false); assert.equal(result.state, 'absent'); assert.equal(result.readable, false);
    assert.equal(f.queries[0], 'BEGIN READ ONLY'); assert.equal(f.queries.at(-1), 'COMMIT');
    assert.ok(!f.queries.some(sql => /^CREATE|^INSERT|^UPDATE|^DELETE|^DROP|^LOCK/.test(sql)));
    await f.absent();
    await assert.rejects(applyNotesSchema(f.client, { apply: true, expectedDatabase: 'different-target' }), /does not match/);
    assert.equal(f.queries.at(-1), 'ROLLBACK'); await f.absent();
  } finally { await f.database.close(); }
});

test('Notes deployment applies actual 0037 once with no synthetic rows, then verifies without replay', async () => {
  const f = await fixture();
  try {
    const applied = await applyNotesSchema(f.client, { apply: true, expectedDatabase: f.expectedDatabase });
    assert.equal(applied.applied, true); assert.equal(applied.preserved, true); assert.equal(applied.readable, true);
    assert.equal(applied.users, '2'); assert.equal(applied.legacyRows, '0'); assert.equal(applied.notes, '0'); assert.equal(applied.imported, '0');
    assert.equal(f.queries.filter(sql => sql === migration).length, 1);
    assert.ok(f.queries.some(sql => sql.includes('pg_advisory_xact_lock')));
    assert.ok(f.queries.some(sql => sql.includes("lock_timeout='5s'") && sql.includes("statement_timeout='30s'")));
    assert.equal(f.queries.at(-1), 'COMMIT');
    const retry = await applyNotesSchema(f.client, { apply: true, expectedDatabase: f.expectedDatabase });
    assert.equal(retry.alreadyApplied, true); assert.equal(retry.applied, false); assert.equal(retry.state, 'ready');
    assert.equal(f.queries.filter(sql => sql === migration).length, 1);
    const inspected = await applyNotesSchema(f.client, { expectedDatabase: f.expectedDatabase });
    assert.equal(inspected.readable, true); assert.equal(inspected.applied, false);
  } finally { await f.database.close(); }
});

test('Notes deployment preserves populated valid and malformed legacy source records byte-for-byte', async () => {
  const f = await fixture({ legacy: true });
  try {
    const original = (await f.database.query('SELECT to_jsonb(n)::text AS value FROM user_notes n ORDER BY id')).rows;
    const result = await applyNotesSchema(f.client, { apply: true, expectedDatabase: f.expectedDatabase });
    assert.equal(result.preserved, true); assert.equal(result.legacyRows, '1'); assert.equal(result.notes, '1'); assert.equal(result.imported, '1');
    assert.deepEqual((await f.database.query('SELECT to_jsonb(n)::text AS value FROM user_notes n ORDER BY id')).rows, original);
    assert.doesNotMatch(JSON.stringify(result), /Private legacy|retained/);
    await applyNotesSchema(f.client, { apply: true, expectedDatabase: f.expectedDatabase });
    assert.deepEqual((await f.database.query('SELECT to_jsonb(n)::text AS value FROM user_notes n ORDER BY id')).rows, original);
    assert.equal((await f.database.query('SELECT count(*)::int AS count FROM b1_notes')).rows[0].count, 1);
  } finally { await f.database.close(); }
});

test('Notes deployment rolls back all DDL when preservation or postflight validation fails', async () => {
  const f = await fixture({ legacy: true });
  try {
    for (const mutation of ["UPDATE user_notes SET data='[]'::jsonb", "DELETE FROM \"user\" WHERE id='other'", 'DROP TRIGGER b1_notes_revision ON b1_notes']) {
      const client = { query: async (sql, parameters) => {
        const result = await f.client.query(sql, parameters);
        if (sql === migration) await f.database.exec(mutation);
        return result;
      } };
      await assert.rejects(applyNotesSchema(client, { apply: true, expectedDatabase: f.expectedDatabase }), /preservation|triggers/);
      assert.equal(f.queries.at(-1), 'ROLLBACK'); await f.absent();
      assert.equal((await f.database.query('SELECT count(*)::int AS count FROM "user"')).rows[0].count, 2);
      assert.equal((await f.database.query('SELECT jsonb_array_length(data) AS count FROM user_notes')).rows[0].count, 3);
    }
  } finally { await f.database.close(); }
});

test('Notes deployment refuses partial or drifted installations and missing read permissions', async () => {
  const f = await fixture();
  try {
    await f.database.exec('CREATE TABLE b1_notes(id text)');
    await assert.rejects(applyNotesSchema(f.client, { apply: true, expectedDatabase: f.expectedDatabase }), /Partial or unexpected/);
    assert.equal((await f.database.query("SELECT count(*)::int AS count FROM information_schema.columns WHERE table_name='b1_notes'")).rows[0].count, 1);
    await f.database.exec('DROP TABLE b1_notes');
    await applyNotesSchema(f.client, { apply: true, expectedDatabase: f.expectedDatabase });
    for (const mutation of ['ALTER TABLE b1_notes ADD COLUMN unexpected text', 'ALTER TABLE b1_notes DISABLE TRIGGER b1_notes_revision', 'ALTER TABLE b1_notes DROP CONSTRAINT b1_notes_user_id_fkey', "CREATE OR REPLACE FUNCTION b1_notes_changed() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$"]) {
      await f.database.exec('BEGIN'); await f.database.exec(mutation); await f.database.exec('COMMIT');
      await assert.rejects(applyNotesSchema(f.client, { apply: true, expectedDatabase: f.expectedDatabase }), /Unexpected|unexpected/);
      // Reset this disposable fixture only, never an application database.
      if (mutation.includes('ADD COLUMN')) await f.database.exec('ALTER TABLE b1_notes DROP COLUMN unexpected');
      else if (mutation.includes('DISABLE')) await f.database.exec('ALTER TABLE b1_notes ENABLE TRIGGER b1_notes_revision');
      else if (mutation.includes('DROP CONSTRAINT')) await f.database.exec('ALTER TABLE b1_notes ADD CONSTRAINT b1_notes_user_id_fkey FOREIGN KEY(user_id) REFERENCES "user"(id) ON DELETE CASCADE');
      else await f.database.exec(migration);
    }
    await f.database.exec('CREATE ROLE notes_read_denied; SET ROLE notes_read_denied');
    await assert.rejects(applyNotesSchema(f.client, { expectedDatabase: f.expectedDatabase }), /read privileges/);
    await f.database.exec('RESET ROLE');
    assert.equal(f.queries.filter(sql => sql === migration).length, 1);
  } finally { await f.database.close(); }
});
