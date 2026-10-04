import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './helpers.mjs';
const { registrationConfigurationIssues } = loadModule('lib/account/registration.ts');
const configuration = { NODE_ENV: 'development', DATABASE_URL: 'postgresql://manforth_mobile_qa:fixture@qa.neon.tech/qa_tablename', BETTER_AUTH_SECRET: 'x'.repeat(32), EMAIL_PROTECTION_SECRET: 'x'.repeat(32), MANFORTH_MOBILE_QA_LOCAL: 'true', MANFORTH_MOBILE_QA_MAIL: 'true' };

test('public registration recognizes isolated pending-mail adapter without requiring a live provider key', () => {
  assert.equal(registrationConfigurationIssues(configuration).length, 0);
  assert.ok(registrationConfigurationIssues({ ...configuration, EMAIL_PROTECTION_SECRET: '' }).includes('EMAIL_PROTECTION_SECRET'));
  assert.ok(registrationConfigurationIssues({ ...configuration, BETTER_AUTH_SECRET: 'short' }).includes('BETTER_AUTH_SECRET'));
});

test('QA capability cannot relax production, database, role, provider or endpoint boundaries', () => {
  for (const change of [{ NODE_ENV: 'production' }, { MANFORTH_MOBILE_QA_LOCAL: 'false' }, { DATABASE_URL: 'postgresql://admin:fixture@qa.neon.tech/qa_tablename' }, { DATABASE_URL: 'postgresql://manforth_mobile_qa:fixture@qa.neon.tech/application' }, { DATABASE_URL: 'https://manforth_mobile_qa:fixture@qa.neon.tech/qa_tablename' }, { DATABASE_URL: 'postgresql://manforth_mobile_qa:fixture@other.test/qa_tablename' }, { RESEND_API_KEY: 'fixture-provider-key' }]) {
    assert.ok(registrationConfigurationIssues({ ...configuration, ...change }).includes('ISOLATED_MAIL_CONFIGURATION'));
  }
  for (const NODE_ENV of ['development', 'production']) assert.ok(registrationConfigurationIssues({ ...configuration, NODE_ENV, MANFORTH_MOBILE_QA_MAIL: 'false' }).includes('RESEND_API_KEY'));
});
