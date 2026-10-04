import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule, plain } from './helpers.mjs';
import { createRequire } from 'node:module';
const native = createRequire(import.meta.url);
const preferences = loadModule('lib/account/preferences.ts');
const access = loadModule('lib/account/access-policy.ts');
const decimal = loadModule('lib/account/decimal.ts');

test('loopback auth origins are limited to the guarded local QA development server', () => {
  const env = { NODE_ENV: 'development', APP_URL: 'http://10.0.2.2:3001', MANFORTH_MOBILE_API_ENABLED: 'true', MANFORTH_MOBILE_QA_LOCAL: 'true' };
  const origins = patch => plain(loadModule('lib/account/config.ts', {}, { process: { env: { ...env, ...patch } } }).localQaWebOrigins());
  assert.deepEqual(origins({}), ['http://localhost:3001', 'http://127.0.0.1:3001']);
  for (const patch of [{ NODE_ENV: 'production', APP_URL: 'https://b1-way-mf.vercel.app' }, { MANFORTH_MOBILE_QA_LOCAL: '' }, { MANFORTH_MOBILE_API_ENABLED: '' }, { APP_URL: 'http://public.example:3001' }, { APP_URL: 'https://10.0.2.2:3001' }]) assert.deepEqual(origins(patch), []);
});

test('financial precision is exact and rejects overprecision, negatives stay available for signed arithmetic', () => {
  assert.equal(decimal.cashMinor('0.10') + decimal.cashMinor('.20'), 30n);
  assert.equal(decimal.cashString(30n), '0.30');
  assert.equal(decimal.preciseProduct('0.000000000001', '0.000000000001'), 1n);
  assert.throws(() => decimal.cashMinor('1.001'), /precision/);
  assert.throws(() => decimal.cashMinor('Infinity'), /Invalid/);
});
test('preferences keep four independent gym units, USD investments and reject forged properties', () => {
  const parsed = preferences.preferenceSchema.parse({ ...preferences.defaultPreferences, bodyWeight: 'lb', exerciseLoad: 'kg', distance: 'mi', measurements: 'cm' });
  assert.equal(parsed.exerciseLoad, 'kg'); assert.equal(parsed.bodyWeight, 'lb');
  assert.equal(loadModule('lib/account/config.ts').INVESTMENT_CURRENCY, 'USD');
  for (const patch of [{ role: 'admin' }, { timezone: 'Bad/Zone' }, { language: 'pl' }, { financeDefaultCurrency: 'BTC' }]) assert.equal(preferences.preferenceSchema.safeParse({ ...parsed, ...patch }).success, false);
});
test('quiet hours honor the IANA zone across daylight saving and support overnight intervals', () => {
  const n = preferences.defaultNotifications;
  assert.equal(preferences.quietNow(n, new Date('2026-10-24T21:00:00Z'), 'Europe/Warsaw'), true);
  assert.equal(preferences.quietNow(n, new Date('2026-10-25T07:00:00Z'), 'Europe/Warsaw'), false);
  assert.equal(preferences.quietNow({ ...n, quietHours: false }, new Date('2026-10-25T02:00:00Z'), 'Europe/Warsaw'), false);
});
test('only confirmed payment, unexpired trial or bounded grace grants access', () => {
  const now = new Date('2026-10-03T12:00:00Z'), base = { emailVerified: true };
  assert.equal(access.evaluateAccess({ ...base, paidThrough: '2027-10-03T00:00:00Z' }, now).canWrite, false);
  assert.equal(access.evaluateAccess({ ...base, paidConfirmed: true, paidThrough: '2027-10-03T00:00:00Z', renewalOff: true }, now).state, 'paid-renewal-off');
  assert.equal(access.evaluateAccess({ ...base, trialStart: '2026-09-01T00:00:00Z', trialEnd: '2026-09-15T00:00:00Z' }, now).state, 'expired');
  assert.equal(access.evaluateAccess({ ...base, paidConfirmed: true, graceUntil: '2026-10-04T00:00:00Z' }, now).state, 'renewal-grace');
  assert.equal(access.evaluateAccess({ ...base, graceUntil: '2026-10-04T00:00:00Z' }, now).canWrite, false);
  assert.equal(access.evaluateAccess({ ...base, deleting: true, transition: true }, now).canWrite, false);
});
test('expiry completion allowance requires a canonical previously active record and ends at exactly 24 hours', () => {
  const end = '2026-10-03T12:00:00Z';
  assert.equal(access.completionAllowed(end, '2026-10-03T11:00:00Z', true, new Date('2026-10-04T11:59:59Z')), true);
  assert.equal(access.completionAllowed(end, '2026-10-03T12:01:00Z', true, new Date('2026-10-03T13:00:00Z')), false);
  assert.equal(access.completionAllowed(end, '2026-10-03T11:00:00Z', true, new Date('2026-10-04T12:00:00Z')), false);
  assert.equal(access.completionAllowed(end, '2026-10-03T11:00:00Z', false, new Date('2026-10-03T13:00:00Z')), false);
});
test('email payload encryption is authenticated, codes are six digits and no credential hash is exposed', () => {
  const lib = loadModule('lib/account/email/crypto.ts', { 'node:crypto': native('node:crypto') }, { process: { env: { EMAIL_PROTECTION_SECRET: 'fixture-protection-secret-long-enough-123' } } });
  for (let i = 0; i < 30; i++) assert.match(lib.numericCode(), /^\d{6}$/);
  const message = { to: 'fixture@example.invalid', code: '000012' }, encrypted = lib.seal(message);
  assert.equal(encrypted.includes(message.code), false); assert.deepEqual(plain(lib.unseal(encrypted)), message);
  const tampered = Buffer.from(encrypted, 'base64url'); tampered[20] ^= 1;
  assert.throws(() => lib.unseal(tampered.toString('base64url')));
});
test('native signup, OTP, linking and reset routes cannot bypass server-owned proof context', async () => {
  let options, context;
  loadModule('lib/auth.ts', { 'better-auth': { betterAuth: input => { options = input; return {}; } }, '@better-auth/expo': { expo: () => ({ id: 'expo' }) }, 'better-auth/adapters/drizzle': { drizzleAdapter: () => ({}) }, 'better-auth/api': { createAuthMiddleware: fn => fn, APIError: class extends Error { constructor(_code, data) { super(data.message); } } }, './db/auth-drizzle': {}, 'better-auth/next-js': { nextCookies: () => ({}) }, './account/identity-context': { identityContext: () => context }, './account/password': { validateNewPassword: async () => {} }, './account/email/recovery': {}, './legal/store': {publishedBundle:async()=>({})}, './legal/validation': {validateAgreement:input=>{assert.equal(input.accepted,true);}}, './account/signup': {assertVerifiedSignupProof:async (id,email)=>{assert.equal(id,'stable-fixture-id');assert.equal(email,'fixture@example.invalid');}} }, { process: { env: { APP_URL: 'http://localhost:3000' } } });
  assert.equal(options.emailAndPassword.minPasswordLength,8);
  assert.equal(options.emailAndPassword.maxPasswordLength,128);
  for (const path of ['/sign-up/email', '/email-otp/sign-in', '/link-social', '/reset-password', '/request-password-reset', '/verify-email', '/delete-user']) await assert.rejects(options.hooks.before({ path, body: {} }));
  context = { purpose: 'signup', email: 'fixture@example.invalid', userId: 'stable-fixture-id', dateOfBirth:'1990-03-25', legal: {accepted:true} };
  const result = await options.databaseHooks.user.create.before({ email: 'fixture@example.invalid', image: 'https://external.invalid/a.png' });
  assert.equal(result.data.id, 'stable-fixture-id'); assert.equal(result.data.emailVerified, true); assert.equal(result.data.image, null);assert.equal(result.data.dateOfBirth,'1990-03-25');assert.equal(options.user.additionalFields.dateOfBirth.input,false);assert.equal(options.user.additionalFields.dateOfBirth.returned,false);
  await assert.rejects(options.databaseHooks.user.create.before({ email: 'other@example.invalid' }));
  await assert.rejects(options.hooks.before({ path: '/update-user', body: { name: 'Fixture', role: 'admin' } }));
});
test('email requests validate the application origin without an external verification provider', () => {
  let requests = 0;
  const policy = loadModule('lib/account/email/policy.ts', { '../store': {}, './crypto': {}, '../config': loadModule('lib/account/config.ts',{}, {process:{env:{APP_URL:'http://localhost:3000'}}}) }, { fetch: () => { requests++; throw Error('Unexpected provider request'); } });
  policy.assertEmailRequestOrigin(new Headers({ origin: 'http://localhost:3000' }));
  policy.assertEmailRequestOrigin(new Headers());
  for (const origin of ['https://other.invalid', 'null', 'http://localhost:3000.other.invalid']) assert.throws(() => policy.assertEmailRequestOrigin(new Headers({ origin })), /origin/);
  assert.equal(requests, 0);
});
