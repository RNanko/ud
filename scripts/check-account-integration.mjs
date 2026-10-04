import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { randomBytes } from 'node:crypto';
import * as cryptoModule from 'node:crypto';
import assert from 'node:assert/strict';
import { loadModule } from '../tests/helpers.mjs';
import { qaDatabaseUrl } from './qa-database.mjs';

if (!process.argv.includes('--isolated')) throw Error('Use --isolated to create and remove only a temporary QA schema. No providers are called.');
const raw = neon(qaDatabaseUrl());
const schema = `b1_qa_${randomBytes(8).toString('hex')}`;
if (!/^b1_qa_[a-f0-9]{16}$/.test(schema)) throw Error('Invalid QA schema');
const tables = ['user', 'b1_memberships', 'b1_email_attempts', 'b1_email_ledgers', 'b1_email_outbox', 'b1_rate_buckets', 'b1_email_suppressions'];
const accountSql = async (parts, ...values) => {
  let text = parts.map((part, index) => part + (index < values.length ? `$${index + 1}` : '')).join('');
  text = text.replace(/"user"/g, `"${schema}"."user"`);
  for (const table of tables.filter(table => table !== 'user')) text = text.replace(new RegExp(String.raw`\b${table}\b`, 'g'), `"${schema}".${table}`);
  if(/(?<![.])\bb1_(?:memberships|email_\w+|rate_buckets)\b/.test(text.replaceAll(`"${schema}".`, "qa."))) throw Error("Unscoped integration query");
  return raw.query(text, values);
};
process.env.EMAIL_PROTECTION_SECRET = randomBytes(48).toString('hex');
process.env.RESEND_API_KEY = 'fixture-never-deliver';
process.env.EMAIL_GLOBAL_DAILY_BUDGET = '200';
const config = loadModule('lib/account/config.ts');
const protection = loadModule('lib/account/email/crypto.ts', { 'node:crypto': cryptoModule });
const policy = loadModule('lib/account/email/policy.ts', { '../store': { accountSql }, '../config': config, './crypto': protection });
const templates = loadModule('lib/account/email/templates.ts');
const delivery = loadModule('lib/account/email/delivery.ts', { resend: { Resend: class { constructor() { this.emails={send:()=>{throw Error('Delivery is forbidden in this integration check');}}; } } }, '../store': { accountSql }, '../config': config, './crypto': protection, './policy': policy });
const challenge = loadModule('lib/account/email/challenges.ts', { '../store': { accountSql }, '../config': config, './crypto': protection, './policy': policy, './templates': templates, './delivery': { resendClient: () => ({}) } });
let checks = 0;
try {
  await raw.query(`CREATE SCHEMA "${schema}"`);
  for (const table of tables) await raw.query(`CREATE TABLE "${schema}"."${table}" (LIKE public."${table}" INCLUDING ALL)`);
  const result = await challenge.createChallenge('proof@example.invalid', 'signup', new Headers());
  let state = await challenge.challengeState(result.token);
  assert.ok(state); assert.equal((await accountSql`SELECT count(*) AS n FROM "user"`)[0].n, '0'); checks++;
  const first = (await accountSql`SELECT payload FROM b1_email_outbox WHERE id=${`code/${state.id}/1`}`)[0];
  const oldCode = protection.unseal(first.payload).text.match(/code is (\d{6})/)[1];
  await accountSql`UPDATE b1_email_ledgers SET last_at=now()-interval '61 seconds' WHERE active_attempt=${state.id}`;
  await Promise.all(Array.from({ length: 16 }, () => challenge.resendChallenge(result.token)));
  state = await challenge.challengeState(result.token);
  assert.equal(state.sends, 2); assert.equal(state.version, 2);
  assert.ok(Date.parse(state.blocked_until) > Date.now() + 23.9 * 3600000);
  assert.equal((await accountSql`SELECT count(*) AS n FROM b1_email_outbox`)[0].n, '2'); checks++;
  const latest = (await accountSql`SELECT payload FROM b1_email_outbox WHERE id=${`code/${state.id}/2`}`)[0];
  const code = protection.unseal(latest.payload).text.match(/code is (\d{6})/)[1];
  if (oldCode !== code) await assert.rejects(challenge.verifyChallenge(result.token, oldCode));
  await challenge.verifyChallenge(result.token, code); await challenge.verifyChallenge(result.token, code); checks++;
  const consumption = await Promise.allSettled(Array.from({ length: 16 }, () => challenge.consumeChallenge(result.token, 'signup')));
  assert.equal(consumption.filter(value => value.status === 'fulfilled').length, 1); checks++;
  const locked = await challenge.createChallenge('locked@example.invalid', 'signup', new Headers());
  const attempt = await challenge.challengeState(locked.token);
  for (let i = 0; i < 7; i++) await assert.rejects(challenge.verifyChallenge(locked.token, '999999'));
  const exhausted = (await accountSql`SELECT wrong_attempts FROM b1_email_attempts WHERE id=${attempt.id}`)[0];
  assert.equal(exhausted.wrong_attempts, 5); checks++;
  const quotas = await Promise.all(Array.from({ length: 40 }, () => policy.takeQuota('qa-atomic-limit', 10, 86400)));
  assert.equal(quotas.filter(Boolean).length, 10); checks++;
  await accountSql`INSERT INTO "user"(id,name,email,email_verified) VALUES('qa-owner','QA','owner@example.invalid',true)`;
  await accountSql`INSERT INTO b1_memberships(user_id,product) VALUES('qa-owner',${config.PERSONAL_PRODUCT})`;
  const starts = await Promise.all(Array.from({ length: 20 }, () => accountSql`UPDATE b1_memberships SET trial_started_at=now(),trial_ends_at=now()+interval '14 days' WHERE user_id='qa-owner' AND product=${config.PERSONAL_PRODUCT} AND trial_started_at IS NULL RETURNING trial_started_at,trial_ends_at`));
  assert.equal(starts.filter(rows => rows.length).length, 1);
  const trial = (await accountSql`SELECT trial_started_at,trial_ends_at FROM b1_memberships WHERE user_id='qa-owner'`)[0];
  assert.equal(Date.parse(trial.trial_ends_at) - Date.parse(trial.trial_started_at), 14 * 86400000); checks++;
  // Every failed recipient proof remains proof-only: no fabricated credentials or user.
  assert.equal((await accountSql`SELECT count(*) AS n FROM "user"`)[0].n, '1'); checks++;
  await Promise.all(Array.from({length:16},()=>delivery.enqueueMail('qa-idempotent-outbox','security',templates.mailTemplate('outbox@example.invalid','QA',['Never sent']))));
  assert.equal((await accountSql`SELECT count(*) AS n FROM b1_email_outbox WHERE id='qa-idempotent-outbox'`)[0].n,'1'); assert.equal((await accountSql`SELECT count FROM b1_rate_buckets WHERE key='email-global'`)[0].count,4); checks++;
  // Compile the real outbox implementation above; no accidental provider invocation.
  assert.equal(typeof delivery.enqueueMail, 'function');
  console.log(`PASS: ${checks} isolated database checks: code rotation, second-send 24h block, concurrent proof consumption, five guesses, atomic quotas and one immutable trial. No email or Stripe calls.`);
} finally {
  // Exact schema created by this run; never a computed production schema.
  await raw.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
}
