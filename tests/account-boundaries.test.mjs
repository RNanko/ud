import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import { loadModule } from './helpers.mjs';
const native = createRequire(import.meta.url);

test('saved date, clock and timezone format UTC instants across daylight-saving boundaries', () => {
  const { defaultPreferences: p } = loadModule('lib/account/preferences.ts');
  const f = loadModule('lib/account/format.ts');
  assert.equal(f.formatAccountTimestamp('2026-10-24T22:30:00Z', p), '25/10/2026 · 00:30');
  assert.equal(f.formatAccountTimestamp('2026-10-25T01:30:00Z', p), '25/10/2026 · 02:30');
  assert.equal(f.formatAccountTimestamp('2026-10-25T01:30:00Z', {...p, dateFormat:'iso', timeFormat:'12'}), '2026-10-25 · 02:30 am');
  assert.equal(f.formatAccountTimestamp('2026-10-25T01:30:00Z', {...p, timezone:'America/New_York',dateFormat:'month-first'},false), '10/24/2026');
  assert.equal(f.formatAccountTimestamp('bad timestamp',p), 'Date unavailable');
});

test('job endpoints reject absent, short and incorrect bearer secrets', () => {
  const secret = 'test-only-cron-secret-32-characters-long';
  const job = loadModule('lib/account/jobs.ts', {'node:crypto': native('node:crypto')}, {process:{env:{CRON_SECRET:secret}}});
  assert.equal(job.authorizedJob(new Headers()), false);
  assert.equal(job.authorizedJob(new Headers({authorization:`Bearer ${secret.slice(0,-1)}!`})), false);
  assert.equal(job.authorizedJob(new Headers({authorization:`Bearer ${secret}`})), true);
  const missing = loadModule('lib/account/jobs.ts', {'node:crypto': native('node:crypto')}, {process:{env:{CRON_SECRET:'short'}}});
  assert.equal(missing.authorizedJob(new Headers({authorization:'Bearer short'})), false);
});

test('real Stripe SDK signature verification accepts only a signed raw body before durable processing', async () => {
  const Stripe = native('stripe'), stripe = new Stripe('sk_test_never_call'), secret = 'whsec_test_only';
  const body = JSON.stringify({id:'evt_test_boundary',object:'event',type:'invoice.paid',livemode:false,data:{object:{id:'in_test'}}});
  const signature = stripe.webhooks.generateTestHeaderString({payload:body,secret});
  let accepted = 0, processed = 0;
  const route = loadModule('app/api/billing/webhook/route.ts', {
    '@/lib/account/billing/stripe':{stripeClient:()=>stripe},
    '@/lib/account/billing/reconcile':{acceptStripeEvent:async()=>{accepted++;},processStripeQueue:async()=>{processed++;}},
  }, {process:{env:{STRIPE_WEBHOOK_SECRET:secret}}});
  const request = (payload, sig) => new Request('http://localhost/api/billing/webhook',{method:'POST',body:payload,headers:sig?{'stripe-signature':sig}:{}});
  assert.equal((await route.POST(request(body))).status,400);
  assert.equal((await route.POST(request(body+' ',signature))).status,400);
  assert.equal(accepted,0);
  assert.equal((await route.POST(request(body,signature))).status,200);
  assert.equal(accepted,1); assert.equal(processed,1);
});

test('real Resend SDK verifies raw Svix signatures before creating team suppressions', async () => {
  const {Resend} = native('resend'), client = new Resend('re_test_never_call');
  const key = Buffer.from('test-only-svix-secret-32-characters'), secret = `whsec_${key.toString('base64')}`;
  const id = 'msg_fixture', timestamp = String(Math.floor(Date.now()/1000));
  const body = JSON.stringify({type:'email.bounced',created_at:new Date().toISOString(),data:{email_id:'mail_fixture',to:['FIXTURE@example.invalid']}});
  const signature = `v1,${createHmac('sha256',key).update(`${id}.${timestamp}.${body}`).digest('base64')}`;
  const writes = [];
  const sql = (parts,...values)=>{writes.push({query:parts.join('?'),values});return {parts,values};};
  sql.transaction = async queries => queries;
  const route = loadModule('app/api/email/webhook/route.ts', {
    '@/lib/account/email/delivery':{resendClient:()=>client},'@/lib/account/store':{accountSql:sql},
    '@/lib/account/email/crypto':{protectedKey:value=>`protected:${value}`},
  }, {process:{env:{RESEND_WEBHOOK_SECRET:secret,EMAIL_SUPPRESSION_SCOPE:'fixture-team'}}});
  const request = payload => new Request('http://localhost/api/email/webhook',{method:'POST',body:payload,headers:{'svix-id':id,'svix-timestamp':timestamp,'svix-signature':signature}});
  assert.equal((await route.POST(request(body+' '))).status,400);
  assert.equal(writes.length,0);
  assert.equal((await route.POST(request(body))).status,200);
  assert.equal(writes.length,2);
  assert.ok(writes[1].values.includes('fixture-team'));
  assert.ok(writes[1].values.includes('protected:fixture@example.invalid'));
  assert.equal(writes.some(write=>write.values.includes('FIXTURE@example.invalid')),false);
});

test('missing webhook configuration fails closed without invoking provider or storage', async () => {
  const forbidden=()=>{throw Error('Unexpected provider access');};
  for(const [file,mocks] of [
    ['app/api/billing/webhook/route.ts',{'@/lib/account/billing/stripe':{stripeClient:forbidden},'@/lib/account/billing/reconcile':{acceptStripeEvent:forbidden,processStripeQueue:forbidden}}],
    ['app/api/email/webhook/route.ts',{'@/lib/account/email/delivery':{resendClient:forbidden},'@/lib/account/store':{accountSql:forbidden},'@/lib/account/email/crypto':{protectedKey:forbidden}}],
  ]) {
    const route = loadModule(file,mocks,{process:{env:{}}});
    assert.equal((await route.POST(new Request('http://localhost/api/webhook',{method:'POST',body:'{}'}))).status,503);
  }
});

test('settings reject privileged fields and stale revisions without overwriting a concurrent save', async () => {
  const p=loadModule('lib/account/preferences.ts'), writes=[];
  const sql=async(parts,...values)=>{writes.push({query:parts.join('?'),values});return [];};
  const action=loadModule('lib/actions/account.actions.ts',{
    '../db/drizzle':{},'drizzle-orm':{},'../db/schema':{},'next/cache':{revalidatePath(){}},
    '../session':{requireUserId:async()=> 'owner-only'},
    '../account/store':{accountSql:sql,accountSettings:async()=>({preferences:p.defaultPreferences,notifications:p.defaultNotifications,revision:7})},
  });
  await assert.rejects(action.saveAccountName({name:'Fixture',role:'admin'}));
  await assert.rejects(action.saveAccountSettings({section:'preferences',revision:7,value:{...p.defaultPreferences,paidThrough:'2099-01-01'}}));
  assert.equal(writes.length,0);
  await assert.rejects(action.saveAccountSettings({section:'preferences',revision:6,value:p.defaultPreferences}),/another device/);
  assert.equal(writes.length,1);assert.ok(writes[0].values.includes('owner-only'));assert.ok(writes[0].values.includes(6));
});

test('in-app reminders stop for quiet hours or deletion before loading private source records', async () => {
  const p=loadModule('lib/account/preferences.ts'); let calls=0,deleted=false;
  const dates=loadModule('lib/gym/dates.ts',{'../finance':loadModule('lib/finance.ts')});
  const service=loadModule('lib/account/notifications.ts',{
    './store':{accountSettings:async()=>({preferences:p.defaultPreferences,notifications:p.defaultNotifications}),accountSql:async()=>{calls++;return deleted?[{found:true}]:[];}},
    './preferences':p,'../gym/dates':dates,'../momentum/logic':{},'../momentum/goals/evaluate':{},'../momentum/types':{},'../todo':{},'../events':{},'./email/delivery':{},'./email/templates':{},
  });
  assert.equal((await service.dueNotifications('owner-only',new Date('2026-10-03T22:00:00Z'))).length,0);
  assert.equal(calls,0);
  deleted=true;
  assert.equal((await service.dueNotifications('owner-only',new Date('2026-10-03T10:00:00Z'))).length,0);
  assert.equal(calls,1);
});
