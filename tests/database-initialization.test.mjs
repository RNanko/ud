import test from 'node:test';
import assert from 'node:assert/strict';
import { drizzle } from 'drizzle-orm/neon-http';
import { pgTable, text } from 'drizzle-orm/pg-core';
import { loadModule } from './helpers.mjs';

const validUrl = 'postgresql://fixture:fixture-password@database.invalid/fixture';
function database(env, neon) {
  return loadModule('lib/db/http-sql.ts', { '@neondatabase/serverless': { neon } }, { process: { env }, URL });
}

test('server stores and Drizzle can be imported without initializing a database client', () => {
  const loaded = database({}, () => assert.fail('Route collection must not initialize Neon'));
  const store = loadModule('lib/account/store.ts', { '../db/http-sql': loaded });
  const adapter = loadModule('lib/db/drizzle.ts', { './http-sql': loaded, 'drizzle-orm/neon-http': { drizzle }, './schema': {} });
  assert.equal(store.accountSql, loaded.databaseSql);
  assert.equal(adapter.default.$client, loaded.databaseSql);
  assert.equal(typeof loaded.databaseSql.query, 'function');
  assert.equal(typeof loaded.databaseSql.transaction, 'function');
});

test('missing and invalid database configuration fails on use without exposing credentials', () => {
  for (const value of [undefined, '', '   ']) {
    const { databaseSql } = database({ DATABASE_URL: value }, () => assert.fail('Missing URL cannot initialize Neon'));
    assert.throws(() => databaseSql`SELECT 1`, /DATABASE_URL is not configured/);
  }
  for (const value of [`DATABASE_URL=${validUrl}`, `'${validUrl}'`, `psql '${validUrl}'`, 'https://fixture:fixture-password@database.invalid/fixture', 'postgresql://database.invalid/fixture']) {
    const { databaseSql } = database({ DATABASE_URL: value }, () => assert.fail('Malformed URL cannot initialize Neon'));
    assert.throws(() => databaseSql.query('SELECT 1'), error => {
      assert.equal(error.message, 'DATABASE_URL must be a valid PostgreSQL connection URL.');
      assert.doesNotMatch(String(error), /fixture-password/);
      return true;
    });
  }
  const { databaseSql } = database({ DATABASE_URL: validUrl }, () => { throw Error(`Provider error containing ${validUrl}`); });
  assert.throws(() => databaseSql.query('SELECT 1'), error => !String(error).includes('fixture-password'));
});

test('lazy SQL preserves parameterized queries, raw fragments and native transaction promises', () => {
  const calls = [], pending = { queryData: { fixture: true } }, fragment = { raw: 'trusted_column' }, batchResult = Promise.resolve([]);
  function client(parts, ...values) { calls.push(['tag', parts, values]); return pending; }
  client.query = function (...args) { assert.equal(this, client); calls.push(['query', args]); return pending; };
  client.unsafe = function (value) { assert.equal(this, client); calls.push(['unsafe', value]); return fragment; };
  client.transaction = function (...args) { assert.equal(this, client); calls.push(['transaction', args]); return batchResult; };
  let initializations = 0;
  const env = {};
  const { databaseSql } = database(env, url => { assert.equal(url, validUrl); initializations++; return client; });
  const query = databaseSql.query;
  assert.equal(initializations, 0);
  env.DATABASE_URL = ` ${validUrl} `;
  assert.equal(databaseSql`SELECT ${'owner'} AS owner`, pending);
  assert.deepEqual(Array.from(calls[0][2]), ['owner']);
  const options = { fullResults: true, arrayMode: true };
  assert.equal(query('SELECT $1', ['owner'], options), pending);
  assert.equal(calls[1][1][2], options);
  assert.equal(databaseSql.unsafe('trusted_column'), fragment);
  const promises = [pending], transactionOptions = { isolationLevel: 'Serializable' };
  assert.equal(databaseSql.transaction(promises, transactionOptions), batchResult);
  assert.equal(calls[3][1][0], promises);
  assert.equal(calls[3][1][1], transactionOptions);
  const callback = sql => [sql`SELECT 1`];
  databaseSql.transaction(callback);
  assert.equal(calls[4][1][0], callback);
  assert.equal(initializations, 1);
});

test('real Drizzle reads through the lazy parameterized query adapter', async () => {
  const table = pgTable('fixture_records', { id: text('id') });
  let initializations = 0;
  const client = () => assert.fail('Drizzle should use parameterized queries');
  client.query = (sql, params, options) => {
    assert.match(sql, /fixture_records/);
    assert.equal(options.fullResults, true);
    assert.equal(options.arrayMode, true);
    assert.deepEqual(Array.from(params), []);
    return Promise.resolve({ rows: [['fixture-owner']] });
  };
  const { databaseSql } = database({ DATABASE_URL: validUrl }, () => { initializations++; return client; });
  const db = drizzle({ client: databaseSql, schema: { table } });
  const query = db.select().from(table);
  assert.equal(initializations, 0);
  assert.deepEqual(await query, [{ id: 'fixture-owner' }]);
  assert.equal(initializations, 1);
});
