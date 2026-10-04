import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// Real PostgreSQL WASM semantics in an ephemeral in-memory database. This
// verifies SQL/triggers, not Neon transport, Better Auth or native integration.
test('mobile migration: atomic receipts, web revisions, stale replay, settings and account cascade', async t => {
  const db = await PGlite.create();
  try {
    await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY);
      CREATE TABLE kanban_board(id text PRIMARY KEY,user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,data jsonb NOT NULL,updated_at timestamptz DEFAULT now());
      CREATE TABLE b1_account_settings(user_id text REFERENCES "user"(id) ON DELETE CASCADE,product text,preferences jsonb NOT NULL,notifications jsonb NOT NULL,revision integer NOT NULL,updated_at timestamptz DEFAULT now(),PRIMARY KEY(user_id,product));
      INSERT INTO "user" VALUES('isolated-a'),('isolated-b');`);
    const migration = readFileSync('lib/db/0025_mobile_slice.sql', 'utf8');
    await db.exec(migration); await db.exec(migration);
    const op = '8178468e-875c-4e0a-92fa-8fc2a41870c5';
    const op2 = 'dd2029cf-f879-43eb-afd8-f17c0dfb2b96';
    const board = [{ id: 'todo', items: [{ id: 'one', content: 'Synthetic unit test' }] }];
    const save = async (owner, id, fingerprint, revision, value) => (await db.query('SELECT b1_mobile_save_todo($1,$2::uuid,$3,$4,$5::jsonb) AS outcome', [owner, id, fingerprint, revision, JSON.stringify(value)])).rows[0].outcome;
    const revision = async owner => Number((await db.query('SELECT revision FROM b1_mobile_todo_versions WHERE user_id=$1', [owner])).rows[0]?.revision ?? 0);
    await t.test('save and retry commit one shared board and receipt; operation reuse rejects changed input', async () => {
      assert.equal(await save('isolated-a', op, 'fingerprint-a', 0, board), 'saved');
      assert.equal(await save('isolated-a', op, 'fingerprint-a', 0, board), 'duplicate');
      assert.equal(await revision('isolated-a'), 1);
      assert.equal((await db.query('SELECT * FROM kanban_board')).rows.length, 1);
      assert.equal((await db.query('SELECT * FROM b1_mobile_operations')).rows.length, 1);
      assert.equal(await save('isolated-a', op, 'different-input', 1, []), 'operation-reused');
    });
    await t.test('ordinary web update increments revision and rejects a stale native edit', async () => {
      await db.query('UPDATE kanban_board SET data=$1::jsonb WHERE user_id=$2', [JSON.stringify([]), 'isolated-a']);
      assert.equal(await revision('isolated-a'), 2);
      assert.equal(await save('isolated-a', op2, 'stale', 1, board), 'conflict');
      assert.equal((await db.query('SELECT data FROM kanban_board WHERE user_id=$1', ['isolated-a'])).rows[0].data.length, 0);
    });
    await t.test('deletion tombstone and acknowledged retries cannot resurrect deleted data', async () => {
      await db.query('DELETE FROM kanban_board WHERE user_id=$1', ['isolated-a']);
      assert.equal(await revision('isolated-a'), 3);
      assert.equal(await save('isolated-a', op, 'fingerprint-a', 0, board), 'duplicate');
      assert.equal(await save('isolated-a', op2, 'stale', 0, board), 'conflict');
      assert.equal((await db.query('SELECT * FROM kanban_board WHERE user_id=$1', ['isolated-a'])).rows.length, 0);
    });
    await t.test('operation IDs are scoped to owner and no records cross accounts', async () => {
      assert.equal(await save('isolated-b', op, 'fingerprint-b', 0, board), 'saved');
      assert.equal(await revision('isolated-b'), 1);
      assert.equal((await db.query('SELECT * FROM kanban_board WHERE user_id=$1', ['isolated-a'])).rows.length, 0);
    });
    await t.test('preference CAS preserves independently edited notification values', async () => {
      const prefs = async (id, fingerprint, expected, value) => (await db.query('SELECT b1_mobile_save_preferences($1,$2::uuid,$3,$4,$5::jsonb,$6::jsonb) AS outcome', ['isolated-a', id, fingerprint, expected, JSON.stringify(value), '{"email":false}'])).rows[0].outcome;
      assert.equal(await prefs(op2, 'prefs-1', 0, { timezone: 'Europe/Warsaw' }), 'saved');
      assert.equal(await prefs(op2, 'prefs-1', 0, { timezone: 'Europe/Warsaw' }), 'duplicate');
      await db.query('UPDATE b1_account_settings SET notifications=$1::jsonb,revision=revision+1 WHERE user_id=$2', ['{"email":false,"eventReminders":false}', 'isolated-a']);
      const next = '5e20a687-cf1a-4399-9d03-a4051cead385';
      assert.equal(await prefs(next, 'prefs-2', 1, { timezone: 'UTC' }), 'conflict');
      assert.equal(await prefs(next, 'prefs-2', 2, { timezone: 'UTC' }), 'saved');
      const settings = (await db.query('SELECT * FROM b1_account_settings WHERE user_id=$1', ['isolated-a'])).rows[0];
      assert.equal(settings.revision, 3); assert.equal(settings.notifications.eventReminders, false);
    });
    await t.test('account deletion still cascades without recreating revision/receipt children', async () => {
      await db.query('DELETE FROM "user" WHERE id=$1', ['isolated-b']);
      for (const table of ['kanban_board', 'b1_mobile_todo_versions', 'b1_mobile_operations']) {
        assert.equal((await db.query(`SELECT * FROM ${table} WHERE user_id=$1`, ['isolated-b'])).rows.length, 0);
      }
      assert.equal(await save('isolated-b', op, 'fingerprint-b', 0, board), 'unauthorized');
    });
  } finally { await db.close(); }
});
