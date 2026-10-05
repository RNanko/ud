import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { loadModule, jsxRuntime, findNode } from './helpers.mjs';

const productionEnv = {
  NODE_ENV: 'production', VERCEL_ENV: 'production', APP_URL: 'https://b1-way-mf.vercel.app',
  B1_BILLING_ENVIRONMENT: 'test', B1_BILLING_SOURCES_ENABLED: 'true', B1_WAY_ENFORCE_MEMBERSHIP: 'true',
};

async function fixture(patch = {}) {
  const db = await PGlite.create();
  await db.exec(`
    CREATE TABLE "user"(id text PRIMARY KEY,name text,email text,email_verified boolean,created_at timestamptz DEFAULT now());
    CREATE TABLE finance_table(id text); CREATE TABLE investment_positions(id text); CREATE TABLE user_events(user_id text,week text);
  `);
  await db.exec(readFileSync('lib/db/0021_account_membership.sql', 'utf8'));
  await db.exec(readFileSync('lib/db/0030_cross_platform_billing.sql', 'utf8'));
  await db.exec(`INSERT INTO "user"(id,name,email,email_verified) VALUES('new-owner','New member','fixture@example.invalid',true),('other-owner','Other member','other@example.invalid',true);`);
  const sql = async (parts, ...values) => (await db.query(parts.reduce((text, part, i) => text + part + (i < values.length ? `$${i + 1}` : ''), ''), values)).rows;
  const globals = { process: { env: { ...productionEnv, ...patch } } };
  const config = loadModule('lib/account/config.ts', {}, globals);
  const database = loadModule('lib/db/http-sql.ts', { '@neondatabase/serverless': { neon: () => sql } }, { process: { env: { DATABASE_URL: 'postgresql://fixture:fixture@database.invalid/fixture' } }, URL });
  const store = loadModule('lib/account/store.ts', { '../db/http-sql': database, './config': config, './preferences': loadModule('lib/account/preferences.ts') }, globals);
  const repository = loadModule('lib/account/billing/sources.ts', { '../store': store, '../config': config }, globals);
  const entitlement = loadModule('lib/account/billing/entitlement.ts');
  const access = loadModule('lib/account/access.ts', {
    './store': store, './config': config, './access-policy': loadModule('lib/account/access-policy.ts'),
    './billing/sources': repository, './billing/entitlement': entitlement,
  }, globals);
  const actions = loadModule('lib/actions/billing.actions.ts', {
    'next/headers': { headers: async () => new Headers() }, '../session': { requireUserId: async () => 'new-owner' },
    '../auth': { auth: { api: { getSession: async () => ({ user: { id: 'new-owner', emailVerified: true } }) } } },
    '../account/store': store, '../account/config': config, '../account/access': access,
    '../account/billing/sources': repository, '../account/billing/entitlement': entitlement,
    '../account/billing/stripe': { stripeClient() { throw Error('Provider calls are forbidden in this check'); } },
    '../account/billing/reconcile': {}, '../legal/store': {}, '../legal/validation': {},
  }, globals);
  const notice = loadModule('app/components/shared/account/AccountNotice.tsx', {
    'next/link': { __esModule: true, default: 'Link' }, 'react/jsx-runtime': jsxRuntime, '@/lib/account/access': access,
  }, globals).default;
  return { db, globals, store, repository, access, actions, notice };
}

test('production scope overrides a copied local billing setting without accepting test evidence', () => {
  for (const [env, origin, expected] of [
    [productionEnv, 'https://b1-way-mf.vercel.app', 'production'],
    [productionEnv, 'http://localhost:3000', 'production'],
    [{ NODE_ENV: 'production', B1_BILLING_ENVIRONMENT: 'test' }, 'https://example.invalid', 'production'],
    [{ NODE_ENV: 'production', B1_BILLING_ENVIRONMENT: 'test' }, 'http://localhost:3000', 'test'],
    [{ NODE_ENV: 'development', B1_BILLING_ENVIRONMENT: 'test' }, 'http://10.0.2.2:3001', 'test'],
    [{ NODE_ENV: 'development', B1_BILLING_ENVIRONMENT: 'production' }, 'http://localhost:3000', 'production'],
  ]) {
    const repository = loadModule('lib/account/billing/sources.ts', { '../store': {}, '../config': { appOrigin: () => origin } }, { process: { env } });
    assert.equal(repository.billingEnvironment(), expected);
  }
});

test('an existing verified account renders its settings and can claim its unused trial under production scope', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.access.productAccess('new-owner')).state, 'eligible');
    const Page = loadModule('app/(main)/account/page.tsx', {
      'react/jsx-runtime': jsxRuntime, react: { Suspense: 'Suspense' }, '@/app/components/shared/loader': 'Loader',
      '@/lib/session': { requireUserId: async () => 'new-owner' },
      '@/lib/actions/account.actions': { __esModule: true, default: async owner => {
        const result = await f.db.query('SELECT name,email,email_verified AS "emailVerified",created_at AS "createdAt" FROM "user" WHERE id=$1', [owner]);
        return result.rows[0];
      } },
      '@/lib/actions/billing.actions': f.actions, '@/lib/account/billing/stripe': { checkoutConfigurationReady: () => false },
      '@/lib/legal/store': { publishedBundle: async () => null }, './AccountSettingsClient': 'Settings', '@/package.json': { version: '0.1.0' },
    }, f.globals).default;
    const settings = await Page().props.children.type();
    assert.equal(settings.type, 'Settings');
    assert.equal(settings.props.user.emailVerified, true);
    assert.equal(settings.props.initialMembership.access.state, 'eligible');
    assert.equal((await f.store.accountSettings('new-owner')).revision, 0);
    assert.ok(await f.notice({ owner: 'new-owner' }));
    const started = await f.actions.startMembershipTrial();
    assert.equal(started.ok, true);
    const refreshed = await f.actions.membershipStatus();
    assert.equal(refreshed.ok, true);
    assert.equal(refreshed.value.access.state, 'trial');
    assert.equal(refreshed.value.access.canWrite, true);
    assert.equal(refreshed.value.paidThrough, null);
    assert.match(JSON.stringify(await f.notice({ owner: 'new-owner' })), /Your trial is active/);
    assert.equal((await f.actions.startMembershipTrial()).ok, false);
    assert.equal((await f.store.membershipFor('other-owner')), null);
  } finally { await f.db.close(); }
});

test('test/sandbox payments and legacy projections cannot grant production access, while a verified production payment can', async () => {
  const f = await fixture();
  try {
    await f.db.exec(`INSERT INTO b1_memberships(user_id,product,paid_confirmed,paid_through) VALUES('new-owner','b1-way-personal',true,now()+interval '1 year');`);
    for (const environment of ['test', 'sandbox', 'unknown', 'production']) {
      await f.repository.saveBillingSource({
        owner: 'new-owner', provider: 'stripe', processor: 'stripe', environment, subscriptionId: `subscription-${environment}`,
        status: 'active', providerStatus: 'active', confirmed: true, paidThrough: new Date(Date.now() + 365 * 86400000).toISOString(),
        graceUntil: null, renewalOff: false, currency: 'EUR', amountMinor: 999,
        productId: 'fixture-product', priceId: 'fixture-price', observedAt: new Date().toISOString(),
      });
      const status = await f.actions.membershipStatus();
      assert.equal(status.ok, true);
      assert.equal(status.value.access.state, environment === 'production' ? 'paid' : 'eligible');
      assert.equal(status.value.access.canWrite, environment === 'production');
      assert.equal(status.value.paidThrough !== null, environment === 'production');
    }
  } finally { await f.db.close(); }
  const legacy = await fixture({ B1_BILLING_SOURCES_ENABLED: 'false' });
  try {
    await legacy.db.exec(`INSERT INTO b1_memberships(user_id,product,paid_confirmed,paid_through,grace_until) VALUES('new-owner','b1-way-personal',true,now()+interval '1 year',now()+interval '1 year');`);
    const status = await legacy.actions.membershipStatus();
    assert.equal(status.ok, true);
    assert.equal(status.value.access.state, 'eligible');
    assert.equal(status.value.access.canWrite, false);
    assert.equal(status.value.paidThrough, null);
  } finally { await legacy.db.close(); }
});

test('an optional membership notice failure preserves account controls without leaking server diagnostics', async () => {
  const logs = [];
  const Notice = loadModule('app/components/shared/account/AccountNotice.tsx', {
    'next/link': { __esModule: true, default: 'Link' }, 'react/jsx-runtime': jsxRuntime,
    '@/lib/account/access': { productAccess: async () => { throw Error('PRIVATE_PROVIDER_DIAGNOSTIC'); } },
  }, { console: { error: message => logs.push(message) } }).default;
  const tree = await Notice({ owner: 'new-owner' });
  assert.match(JSON.stringify(tree), /Your account controls remain available/);
  assert.equal(findNode(tree, node => node.type === 'Link').props.href, '/account?section=membership');
  assert.doesNotMatch(JSON.stringify({ tree, logs }), /PRIVATE_PROVIDER_DIAGNOSTIC/);
});
