import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { loadModule, plain } from './helpers.mjs';

test('price refresh uses one atomic account cooldown across tabs and server instances', async t => {
  const database = await PGlite.create();
  await database.exec(`CREATE TABLE b1_rate_buckets (
    key text PRIMARY KEY, count integer NOT NULL, started_at timestamp NOT NULL,
    expires_at timestamp NOT NULL
  )`);
  let quotaReads = 0, portfolioReads = 0, providerCalls = 0, quotaFailure = false;
  const accountSql = async (parts, ...values) => {
    quotaReads++;
    if (quotaFailure) throw Error('Private database diagnostics');
    return (await database.query(parts.reduce((query, part, i) => query + (i ? `$${i}` : '') + part, ''), values)).rows;
  };
  const policy = loadModule('lib/account/email/policy.ts', {
    '../store': { accountSql }, './crypto': {},
  });
  const positions = [{ id: 'owned' }];
  const market = { refreshedAt: '2026-10-10T00:00:00Z', quotes: {}, warnings: [] };
  const actionFor = owner => loadModule('lib/actions/investments.actions.ts', {
    'drizzle-orm': { eq: (column, value) => ({ column, value }), and: (...conditions) => conditions, desc: value => value },
    '../db/schema': { investmentPositions: { userId: 'owner', archived: 'archived', boughtOn: 'date' } },
    '../db/drizzle': { select() { portfolioReads++; return {
      from() { return this; }, where(conditions) {
        assert.deepEqual(plain(conditions), [{ column: 'owner', value: owner }, { column: 'archived', value: false }]);
        return this;
      }, async orderBy() { return positions; },
    }; } },
    '../session': { async requireUserId() { if (!owner) throw Error('Unauthorized'); return owner; } },
    '../investments': { ...loadModule('lib/investments.ts'), serializePosition: value => value },
    '../investment-market': { async investmentMarket(rows, options) {
      providerCalls++; assert.deepEqual(rows, positions); assert.equal(options.refresh, true); return market;
    } },
    '../account/email/policy': policy,
  }, { console: { error() {} } }).refreshInvestmentMarket;
  try {
    await t.test('anonymous calls never consume the budget or contact providers', async () => {
      assert.equal((await actionFor(null)()).ok, false);
      assert.equal(quotaReads, 0); assert.equal(portfolioReads, 0); assert.equal(providerCalls, 0);
    });
    await t.test('concurrent calls from separate instances admit exactly one for an owner', async () => {
      const results = await Promise.all([actionFor('alice')(), actionFor('alice')()]);
      assert.equal(results.filter(result => result.ok).length, 1);
      assert.match(results.find(result => !result.ok).error, /once every 2 minutes/);
      assert.equal(portfolioReads, 1); assert.equal(providerCalls, 1);
      assert.equal((await actionFor('alice')()).ok, false);
      assert.equal(providerCalls, 1);
    });
    await t.test('another owner has an independent allowance', async () => {
      assert.equal((await actionFor('bob')()).ok, true); assert.equal(providerCalls, 2);
    });
    await t.test('the window lasts 120 seconds and expiry permits another refresh', async () => {
      const [row] = (await database.query("SELECT extract(epoch FROM expires_at-started_at)::integer AS seconds FROM b1_rate_buckets WHERE key='investment-refresh:alice'")).rows;
      assert.equal(row.seconds, 120);
      await database.query("UPDATE b1_rate_buckets SET expires_at=now()-interval '1 second' WHERE key='investment-refresh:alice'");
      assert.equal((await actionFor('alice')()).ok, true); assert.equal(providerCalls, 3);
    });
    await t.test('database failures fail closed without private diagnostics or provider work', async () => {
      quotaFailure = true;
      const result = await actionFor('carol')();
      assert.equal(result.ok, false); assert.doesNotMatch(result.error, /Private database/);
      assert.equal(portfolioReads, 3); assert.equal(providerCalls, 3);
    });
  } finally { await database.close(); }
});
