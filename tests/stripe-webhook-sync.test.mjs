import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { PGlite } from '@electric-sql/pglite';
import { loadModule, plain } from './helpers.mjs';

const require = createRequire(import.meta.url);
const Stripe = require('stripe');
const config = loadModule('lib/account/config.ts');
const { sourceEntitlement } = loadModule('lib/account/billing/entitlement.ts');
const { evaluateAccess } = loadModule('lib/account/access-policy.ts');
const secret = 'whsec_isolated_webhook_fixture';
const iso = seconds => new Date(seconds * 1000).toISOString();

async function fixture(normalized = true) {
  const db = await PGlite.create();
  await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY, email_verified boolean DEFAULT true, created_at timestamptz DEFAULT now()); INSERT INTO "user"(id) VALUES('alice'),('bob');
    CREATE TABLE finance_table(id text); CREATE TABLE investment_positions(id text);
    CREATE TABLE user_events(user_id text,week text);`);
  await db.exec(readFileSync('lib/db/0021_account_membership.sql', 'utf8'));
  await db.exec(readFileSync('lib/db/0030_cross_platform_billing.sql', 'utf8'));
  await db.exec(`INSERT INTO b1_memberships(user_id,product,customer_id,status)
    VALUES('alice','b1-way-personal','cus_alice','eligible'),('bob','b1-way-personal','cus_bob','eligible');`);
  // Match the HTTP driver's ISO timestamp serialization while running real SQL.
  const sql = async (parts, ...values) => plain((await db.query(
    parts.reduce((query, part, index) => query + part + (index < values.length ? '$' + (index + 1) : ''), ''), values,
  )).rows);
  const env = { STRIPE_SECRET_KEY: 'sk_test_isolated', STRIPE_WEBHOOK_SECRET: secret,
    STRIPE_PERSONAL_PRODUCT_ID: 'prod_man', STRIPE_ANNUAL_PRICE_USD: 'price_annual', B1_BILLING_SOURCES_ENABLED: String(normalized), B1_BILLING_ENVIRONMENT: 'test', B1_WAY_ENFORCE_MEMBERSHIP: 'true' };
  const scopedConfig = loadModule('lib/account/config.ts', {}, { process: { env } });
  const store = { accountSql: sql, membershipFor: async owner => (await sql`SELECT * FROM b1_memberships WHERE user_id=${owner} AND product=${config.PERSONAL_PRODUCT}`)[0] };
  const sources = loadModule('lib/account/billing/sources.ts', { '../store': store, '../config': scopedConfig }, { process: { env } });
  const access = loadModule('lib/account/access.ts', {
    './store': store, './config': scopedConfig, './billing/sources': sources,
    './access-policy': loadModule('lib/account/access-policy.ts'),
  }, { process: { env } });
  const signing = new Stripe('sk_test_never_call');
  const start = Date.parse('2026-10-07T12:00:00Z') / 1000, end = Date.parse('2027-10-07T12:00:00Z') / 1000;
  const subscription = { id: 'sub_alice', status: 'active', created: start, livemode: false,
    metadata: { product: config.PERSONAL_PRODUCT, user_id: 'alice' }, trial_start: null, trial_end: null,
    cancel_at_period_end: false, cancel_at: null,
    items: { data: [{ id: 'si_alice', quantity: 1, current_period_start: start, current_period_end: end,
      price: { id: 'price_annual', currency: 'usd', product: 'prod_man', unit_amount: 999,
        recurring: { interval: 'year', interval_count: 1 }, tax_behavior: 'inclusive' } }] },
    latest_invoice: { id: 'in_alice', status: 'paid', amount_paid: 999, currency: 'usd', billing_reason: 'subscription_create',
      parent: { subscription_details: { subscription: 'sub_alice' } },
      lines: { data: [{ quantity: 1, pricing: { price_details: { price: 'price_annual' } },
        parent: { subscription_item_details: { subscription_item: 'si_alice' } }, period: { start, end } }] } },
  };
  let unavailable = false;
  const charge = { customer: 'cus_alice', paid: true, livemode: false, refunded: false, disputed: false, amount_refunded: 0 };
  const provider = {
    webhooks: signing.webhooks,
    customers: { retrieve: async id => {
      if (unavailable) throw Error('provider unavailable');
      assert.equal(id, 'cus_alice');
      return { id, metadata: subscription.metadata };
    } },
    subscriptions: { list: async () => ({ data: [subscription], has_more: false }) },
    invoicePayments: { list: async () => ({ has_more: false,
      data: [{ status: 'paid', amount_paid: 999, payment: { type: 'charge', charge: 'ch_alice' } }] }) },
    charges: { retrieve: async () => charge },
  };
  const reconcile = loadModule('lib/account/billing/reconcile.ts', {
    '../store': store, '../config': config, './sources': sources,
    './stripe': { stripeClient: () => provider, stripeLive: () => false },
  }, { process: { env } });
  const background = [];
  const route = loadModule('app/api/billing/webhook/route.ts', {
    'next/server': { after: callback => background.push(callback) },
    '@/lib/account/billing/stripe': { stripeClient: () => provider },
    '@/lib/account/billing/reconcile': reconcile,
  }, { process: { env } });
  async function deliver(id, type, created = start) {
    const event = { id, type, object: 'event', livemode: false, created,
      data: { object: { id: type.startsWith('invoice.') ? 'in_alice' : 'sub_alice',
        object: type.startsWith('invoice.') ? 'invoice' : 'subscription', customer: 'cus_alice' } } };
    const body = JSON.stringify(event), signature = signing.webhooks.generateTestHeaderString({ payload: body, secret });
    const response = await route.POST(new Request('http://localhost/api/billing/webhook', {
      method: 'POST', body, headers: { 'stripe-signature': signature },
    }));
    assert.equal(response.status, 200);
    await background.shift()();
    return (await sql`SELECT status,attempts,error FROM b1_provider_events WHERE event_id=${'test:' + id}`)[0];
  }
  return { db, sql, store, sources, subscription, charge, access, reconcile, deliver, setUnavailable: value => { unavailable = value; } };
}

test('signed webhook pipeline stores paid renewals, cancellation and expiry without changing another account', async () => {
  const f = await fixture();
  try {
    const bobBefore = plain(await f.store.membershipFor('bob'));
    assert.equal((await f.deliver('evt_paid', 'invoice.paid')).status, 'processed');
    let membership = await f.store.membershipFor('alice');
    assert.equal(membership.status, 'active'); assert.equal(membership.paid_confirmed, true);
    assert.equal(membership.paid_through, '2027-10-07T12:00:00.000Z');
    const item = f.subscription.items.data[0], line = f.subscription.latest_invoice.lines.data[0];
    item.current_period_start = item.current_period_end;
    item.current_period_end = Date.parse('2028-10-07T12:00:00Z') / 1000;
    line.period = { start: item.current_period_start, end: item.current_period_end };
    f.subscription.latest_invoice.billing_reason = 'subscription_cycle';
    assert.equal((await f.deliver('evt_renewed', 'invoice.paid')).status, 'processed');
    membership = await f.store.membershipFor('alice');
    assert.equal(membership.paid_through, iso(item.current_period_end));
    f.subscription.cancel_at_period_end = true;
    assert.equal((await f.deliver('evt_cancel_requested', 'customer.subscription.updated')).status, 'processed');
    membership = await f.store.membershipFor('alice');
    assert.equal(membership.renewal_off, true); assert.equal(membership.status, 'active');
    assert.equal(membership.paid_through, iso(item.current_period_end));
    const active = sourceEntitlement(await f.sources.billingSources('alice'), 'test', new Date('2028-10-06T12:00:00Z'));
    assert.equal(evaluateAccess({ ...active, emailVerified: true }, new Date('2028-10-06T12:00:00Z')).state, 'paid-renewal-off');
    f.subscription.status = 'canceled'; f.subscription.cancel_at_period_end = false;
    assert.equal((await f.deliver('evt_ended', 'customer.subscription.deleted')).status, 'processed');
    membership = await f.store.membershipFor('alice');
    assert.equal(membership.status, 'canceled'); assert.equal(membership.renewal_off, true);
    const afterEnd = new Date((item.current_period_end + 1) * 1000);
    const ended = sourceEntitlement(await f.sources.billingSources('alice'), 'test', afterEnd);
    assert.equal(evaluateAccess({ ...ended, emailVerified: true }, afterEnd).state, 'expired');
    assert.equal(evaluateAccess({ ...ended, emailVerified: true }, afterEnd).canWrite, false);
    const replayed = await f.deliver('evt_paid', 'invoice.paid');
    assert.equal(replayed.attempts, 1);
    assert.equal((await f.store.membershipFor('alice')).status, 'canceled');
    assert.deepEqual(plain(await f.store.membershipFor('bob')), bobBefore);
  } finally { await f.db.close(); }
});

test('provider failure keeps the last paid period and retries the durable webhook successfully', async () => {
  const f = await fixture();
  try {
    await f.deliver('evt_first_payment', 'invoice.paid');
    const paidThrough = (await f.store.membershipFor('alice')).paid_through;
    f.setUnavailable(true);
    const failed = await f.deliver('evt_cancel_retry', 'customer.subscription.updated');
    assert.equal(failed.status, 'retry'); assert.ok(failed.error);
    assert.equal((await f.store.membershipFor('alice')).paid_through, paidThrough);
    f.setUnavailable(false); f.subscription.cancel_at_period_end = true;
    await f.sql`UPDATE b1_provider_events SET next_at=now() WHERE event_id=${'test:evt_cancel_retry'}`;
    const retried = await f.deliver('evt_cancel_retry', 'customer.subscription.updated');
    assert.equal(retried.status, 'processed'); assert.equal(retried.attempts, 2);
    const membership = await f.store.membershipFor('alice');
    assert.equal(membership.renewal_off, true); assert.equal(membership.paid_through, paidThrough);
    assert.equal(membership.sync_error, null);
  } finally { await f.db.close(); }
});

for (const normalized of [false, true]) {
  for (const revocation of ['refunded', 'disputed']) {
    test(`${normalized ? 'normalized' : 'legacy'} already-paid ${revocation} removes access and grace while preserving billing history`, async () => {
      const f = await fixture(normalized);
      try {
        await f.deliver('evt_paid', 'invoice.paid');
        assert.equal((await f.access.productAccess('alice')).canWrite, true);
        const before = await f.store.membershipFor('alice');
        await f.sql`UPDATE b1_memberships SET grace_until='2029-10-07T12:00:00Z' WHERE user_id='alice'`;
        f.charge[revocation] = true;
        const event = await f.deliver('evt_revoked', revocation === 'refunded' ? 'charge.refunded' : 'charge.dispute.created');
        assert.equal(event.status, 'processed');
        const after = await f.store.membershipFor('alice');
        assert.equal(after.paid_confirmed, false);
        assert.equal(after.grace_until, null);
        assert.equal(after.paid_through, before.paid_through);
        assert.equal(after.subscription_id, before.subscription_id);
        assert.equal(after.customer_id, before.customer_id);
        assert.equal((await f.access.productAccess('alice')).canWrite, false);
        // Receipt replay does not reconcile/mutate again. An older distinct event
        // retrieves current provider evidence instead of replaying its old payload.
        assert.equal((await f.deliver('evt_revoked', 'charge.refunded')).attempts, 1);
        await f.deliver('evt_old_paid', 'invoice.paid', 1);
        assert.equal((await f.access.productAccess('alice')).canWrite, false);
        // An unpaid later invoice must not turn revoked payment history into grace.
        f.subscription.status = 'past_due';
        f.subscription.latest_invoice.status = 'open';
        f.subscription.latest_invoice.billing_reason = 'subscription_cycle';
        await f.deliver('evt_unpaid', 'invoice.payment_failed');
        assert.equal((await f.access.productAccess('alice')).canWrite, false);
        assert.equal((await f.store.membershipFor('alice')).grace_until, null);
        if (normalized) assert.equal((await f.sources.billingSources('alice'))[0].status, 'revoked');
      } finally { await f.db.close(); }
    });
  }
  test(`${normalized ? 'normalized' : 'legacy'} partial refund retains the annual entitlement under the existing full-refund policy`, async () => {
    const f = await fixture(normalized);
    try {
      await f.deliver('evt_paid', 'invoice.paid');
      f.charge.amount_refunded = 400; // Stripe refunded=false until the full charge is refunded.
      await f.deliver('evt_partial', 'charge.refunded');
      assert.equal((await f.access.productAccess('alice')).canWrite, true);
      assert.equal((await f.store.membershipFor('alice')).paid_through, '2027-10-07T12:00:00.000Z');
    } finally { await f.db.close(); }
  });
}

test('revoked Stripe and active Apple retain access through Apple; older source observations cannot resurrect Stripe', async () => {
  const f = await fixture();
  try {
    await f.deliver('evt_paid', 'invoice.paid');
    const paid = (await f.sources.billingSources('alice'))[0];
    const apple = { ...paid, owner: 'alice', provider: 'apple_app_store', processor: 'revenuecat', environment: 'sandbox',
      subscriptionId: 'apple_alice', providerStatus: 'active', productId: 'annual', priceId: null, observedAt: new Date().toISOString() };
    await f.sources.saveBillingSource(apple);
    f.charge.refunded = true;
    await f.deliver('evt_refund', 'charge.refunded');
    await f.sources.saveBillingSource({ ...paid, owner: 'alice', processor: 'stripe', providerStatus: 'active',
      productId: 'prod_man', priceId: 'price_annual', observedAt: '2020-01-01T00:00:00Z' });
    const access = await f.access.productAccess('alice');
    assert.equal(access.canWrite, true);
    assert.deepEqual(plain(access.activeProviders), ['apple_app_store']);
    assert.equal((await f.sources.billingSources('alice')).find(source => source.provider === 'stripe').status, 'revoked');
  } finally { await f.db.close(); }
});

test('a legacy reconciliation rereads entitlement after taking its lease instead of reviving a stale paid projection', async () => {
  const f = await fixture(false);
  try {
    await f.deliver('evt_paid', 'invoice.paid');
    const stale = await f.store.membershipFor('alice');
    f.charge.refunded = true;
    await f.deliver('evt_revoked', 'charge.refunded');
    f.subscription.status = 'past_due';
    f.subscription.latest_invoice.status = 'open';
    f.subscription.latest_invoice.billing_reason = 'subscription_cycle';
    const read = f.store.membershipFor;
    let first = true;
    f.store.membershipFor = async owner => { if (first) { first = false; return stale; } return read(owner); };
    await f.reconcile.reconcileMembership('alice');
    const result = await f.store.membershipFor('alice');
    assert.equal(result.paid_confirmed, false);
    assert.equal(result.grace_until, null);
    assert.equal((await f.access.productAccess('alice')).canWrite, false);
  } finally { await f.db.close(); }
});
