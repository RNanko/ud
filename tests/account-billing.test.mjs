import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './helpers.mjs';
const config = loadModule('lib/account/config.ts');
const env = { STRIPE_SECRET_KEY: 'sk_test_fixture', STRIPE_PERSONAL_PRODUCT_ID: 'prod_personal', STRIPE_ANNUAL_PRICE_PLN: 'price_pln' };
const validPrice = { id: 'price_pln', active: true, product: 'prod_personal', currency: 'pln', unit_amount: 4000, tax_behavior: 'inclusive', recurring: { interval: 'year', interval_count: 1 }, livemode: false };

test('price verification rejects every inconsistent amount, currency, interval, quantity basis, product or environment', async () => {
  let price = validPrice;
  const Stripe = class { prices = { retrieve: async () => price }; };
  const service = loadModule('lib/account/billing/stripe.ts', { stripe: Stripe, '../config': config }, { process: { env: { ...env } } });
  assert.equal((await service.validatedPrice('PLN')).id, validPrice.id);
  for (const patch of [{ unit_amount: 1 }, { currency: 'usd' }, { recurring: { interval: 'month', interval_count: 1 } }, { product: 'language_product' }, { tax_behavior: 'exclusive' }, { livemode: true }, { active: false }]) {
    price = { ...validPrice, ...patch }; await assert.rejects(service.validatedPrice('PLN'), /configuration/);
  }
  const live = loadModule('lib/account/billing/stripe.ts', { stripe: Stripe, '../config': config }, { process: { env: { ...env, STRIPE_SECRET_KEY: 'sk_live_fixture' } } });
  assert.throws(() => live.assertCheckoutLaunch(), /Live billing is disabled/);
});

function fixture({ paid = true, amount = 4000, wasPaid = false, state = 'active', invoiceReason = 'subscription_create', renewalOff = false } = {}) {
  const start = 1791028800, end = 1822564800, writes = [];
  const invoice = { id: 'in_fixture', status: paid ? 'paid' : 'open', amount_paid: amount, currency: 'pln', billing_reason: invoiceReason, parent: { subscription_details: { subscription: 'sub_fixture' } }, lines: { data: [{ quantity: 1, pricing: { price_details: { price: 'price_pln' } }, parent: { subscription_item_details: { subscription_item: 'si_fixture' } }, period: { start, end } }] } };
  const subscription = { id: 'sub_fixture', status: state, created: start, metadata: { user_id: 'alice', product: config.PERSONAL_PRODUCT }, livemode: false, items: { data: [{ id: 'si_fixture', price: validPrice, quantity: 1, current_period_start: start, current_period_end: end }] }, trial_start: null, trial_end: null, latest_invoice: invoice, cancel_at_period_end: renewalOff, cancel_at: null };
  const member = { customer_id: 'cus_fixture', subscription_id: 'sub_fixture', paid_confirmed: wasPaid, paid_through: wasPaid ? new Date(start * 1000).toISOString() : null };
  const sql = async (parts, ...values) => { const query = parts.join('?'); if (query.startsWith('SELECT 1 FROM b1_deletions')) return []; if (query.includes('RETURNING 1')) return [{ ok: 1 }]; if (query.includes('UPDATE b1_memberships SET subscription_id')) writes.push({ query, values }); return []; };
  const client = { customers: { retrieve: async () => ({ id: 'cus_fixture', metadata: subscription.metadata }) }, subscriptions: { list: async () => ({ data: [subscription] }) } };
  const service = loadModule('lib/account/billing/reconcile.ts', { '../store': { accountSql: sql, membershipFor: async () => member }, '../config': config, './stripe': { stripeClient: () => client, stripeLive: () => false } }, { process: { env } });
  return { service, writes, end, start, subscription };
}
test('paid access comes only from the matching paid annual invoice provider period', async () => {
  const f = fixture(); await f.service.reconcileMembership('alice');
  assert.equal(f.writes.length, 1); assert.ok(f.writes[0].values.includes(new Date(f.end * 1000).toISOString()));
  assert.equal(f.writes[0].values[4], true);
});
test('failed first payment and zero-paid invoices never grant paid access or renewal grace', async () => {
  for (const input of [{ paid: false, state: 'incomplete' }, { amount: 0 }]) {
    const f = fixture(input); await f.service.reconcileMembership('alice');
    assert.equal(f.writes[0].values[4], false); assert.equal(f.writes[0].values.includes(new Date(f.end * 1000).toISOString()), false);
    assert.equal(f.writes[0].values.filter(value => typeof value === 'string' && value.endsWith('Z')).length, 0);
  }
});
test('failed renewal grace is bounded to the known paid period and cancellation retains paid end', async () => {
  const f = fixture({ paid: false, wasPaid: true, state: 'past_due', invoiceReason: 'subscription_cycle' }); await f.service.reconcileMembership('alice');
  assert.ok(f.writes[0].values.includes(new Date((f.start + 3 * 86400) * 1000).toISOString()));
  assert.ok(f.writes[0].query.includes('grace_period_key IS NULL OR grace_period_key<>'));
  const canceled = fixture({ state: 'canceled', renewalOff: true }); await canceled.service.reconcileMembership('alice');
  assert.equal(canceled.writes[0].values[7], true); assert.ok(canceled.writes[0].values.includes(new Date(canceled.end * 1000).toISOString()));
});
