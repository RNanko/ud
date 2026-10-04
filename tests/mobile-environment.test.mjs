import test from 'node:test';
import assert from 'node:assert/strict';
import { mobileDevEnvironment } from '../scripts/mobile-dev-environment.mjs';
const secret = 'synthetic-local-secret-used-only-in-unit-tests';
const application = { DATABASE_URL: 'postgres://web:unit@application.neon.tech/app', STRIPE_SECRET_KEY: 'must-not-copy', RESEND_API_KEY: 'must-not-copy', NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'must-not-copy', PATH: 'unit-path' };
const options = { QA_DATABASE_URL: 'postgres://qa:unit@isolated.neon.tech/qa', QA_DATABASE_ISOLATED: 'true' };
test('isolated launcher rejects absent/same/production targets before startup', () => {
  assert.throws(() => mobileDevEnvironment(application, {}, secret));
  assert.throws(() => mobileDevEnvironment(application, { ...options, QA_DATABASE_URL: application.DATABASE_URL }, secret));
  assert.throws(() => mobileDevEnvironment({ ...application, NODE_ENV: 'production' }, options, secret));
  assert.throws(() => mobileDevEnvironment(application, { ...options, MOBILE_DEV_APP_ORIGIN: 'http://public.example:3001' }, secret));
  assert.throws(() => mobileDevEnvironment(application, { ...options, QA_DATABASE_URL: 'postgres://qa:unit@localhost:5432/qa' }, secret));
});
test('local server gets only isolated DB, separate identity secret and provider-free configuration', () => {
  const { env, port } = mobileDevEnvironment(application, options, secret);
  assert.equal(port, 3001); assert.equal(env.DATABASE_URL, options.QA_DATABASE_URL); assert.equal(env.BETTER_AUTH_SECRET, secret);
  assert.equal(env.APP_URL, 'http://localhost:3001'); assert.equal(env.STRIPE_SECRET_KEY, ''); assert.equal(env.RESEND_API_KEY, ''); assert.equal(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY, '');
  assert.equal(env.B1_WAY_ENFORCE_MEMBERSHIP, 'true'); assert.equal(env.MANFORTH_MOBILE_API_ENABLED, 'true'); assert.equal(env.PATH, 'unit-path');
  assert.equal(env.B1_BILLING_SOURCES_ENABLED,'false');assert.equal(env.B1_BILLING_ENVIRONMENT,'test');assert.equal(env.REVENUECAT_SECRET_KEY,'');assert.equal(env.REVENUECAT_WEBHOOK_AUTH_TOKEN,'');
});

test('QA policies receive only named public operator facts while providers and unrelated legal secrets remain blank', () => {
  const configured = { ...application, LEGAL_OPERATOR_NAME:'Synthetic Operator', LEGAL_CONTACT_EMAIL:'fixture@example.invalid', LEGAL_PRIVATE_REVIEW_TOKEN:'must-not-copy' };
  const { env } = mobileDevEnvironment(configured, options, secret);
  assert.equal(env.LEGAL_OPERATOR_NAME, configured.LEGAL_OPERATOR_NAME);assert.equal(env.LEGAL_CONTACT_EMAIL, configured.LEGAL_CONTACT_EMAIL);
  assert.equal(env.LEGAL_PRIVATE_REVIEW_TOKEN,'');assert.equal(env.RESEND_API_KEY,'');assert.equal(env.STRIPE_SECRET_KEY,'');
});
