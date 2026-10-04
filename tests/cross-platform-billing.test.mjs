import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
import {loadModule,plain} from './helpers.mjs';
const require=createRequire(import.meta.url);
const {sourceEntitlement}=loadModule('lib/account/billing/entitlement.ts');
const now=new Date('2026-10-04T12:00:00Z');
const source=(patch={})=>({provider:'stripe',environment:'production',subscriptionId:'sub-a',status:'active',confirmed:true,paidThrough:'2027-10-04T12:00:00Z',graceUntil:null,renewalOff:false,currency:'EUR',amountMinor:999,...patch});
test('one entitlement chooses the latest confirmed provider period without adding years',()=>{
 const result=sourceEntitlement([source(),source({provider:'apple_app_store',subscriptionId:'apple-a',paidThrough:'2027-11-01T00:00:00Z'})],'production',now);
 assert.equal(result.paidThrough,'2027-11-01T00:00:00Z');assert.equal(result.multipleActiveSources,true);assert.deepEqual(plain(result.activeProviders),['stripe','apple_app_store']);
 assert.equal(sourceEntitlement([source(),source({renewalOff:true,subscriptionId:'sub-b'})],'production',now).renewalOff,false);
});
test('sandbox, unpaid, revoked and expired results cannot grant production membership',()=>{
 for(const patch of [{environment:'test'},{environment:'sandbox'},{status:'revoked'},{confirmed:false},{status:'pending'},{paidThrough:'2026-10-01T00:00:00Z'}]){
  const result=sourceEntitlement([source(patch)],'production',now);assert.equal(result.selected,null);assert.ok(!result.paidThrough||Date.parse(result.paidThrough)<=now.getTime());
 }
 assert.equal(sourceEntitlement([source({environment:'test'})],'test',now).selected.subscriptionId,'sub-a');
 const grace=sourceEntitlement([source({status:'grace',paidThrough:'2026-10-01T00:00:00Z',graceUntil:'2026-10-05T00:00:00Z'})],'production',now);assert.equal(grace.graceUntil,'2026-10-05T00:00:00Z');
});
const {nativeSnapshot}=loadModule('lib/account/billing/native-snapshot.ts');
const rc=(patch={})=>({request_date_ms:now.getTime(),subscriber:{original_app_user_id:'alice',entitlements:{manforth:{product_identifier:'annual-ios',expires_date:'2027-10-04T12:00:00Z'}},subscriptions:{'annual-ios':{store:'app_store',is_sandbox:false,purchase_date:'2026-10-04T12:00:00Z',expires_date:'2027-10-04T12:00:00Z',period_type:'normal',...patch}}}});
test('store confirmation preserves ownership, environments, cancellation and actual store periods',()=>{
 const normal=nativeSnapshot(rc(),'alice','manforth',['annual-ios']).sources[0];assert.equal(normal.provider,'apple_app_store');assert.equal(normal.amountMinor,null);assert.equal(normal.paidThrough,'2027-10-04T12:00:00Z');
 assert.throws(()=>nativeSnapshot(rc(),'bob','manforth',['annual-ios']),/ownership/);
 assert.equal(nativeSnapshot(rc({is_sandbox:true}),'alice','manforth',['annual-ios']).sources[0].environment,'sandbox');
 assert.equal(nativeSnapshot(rc({unsubscribe_detected_at:'2026-10-04T12:00:00Z'}),'alice','manforth',['annual-ios']).sources[0].renewalOff,true);
 assert.equal(nativeSnapshot(rc({refunded_at:'2026-10-04T12:00:00Z'}),'alice','manforth',['annual-ios']).sources[0].status,'revoked');
 assert.equal(nativeSnapshot(rc({period_type:'trial'}),'alice','manforth',['annual-ios']).sources[0].confirmed,false);
 assert.equal(nativeSnapshot(rc(),'alice','manforth',['unrelated-product']).sources.length,0);
 const both=rc();both.subscriber.subscriptions['annual-android']={...both.subscriber.subscriptions['annual-ios'],store:'play_store'};
 assert.equal(nativeSnapshot(both,'alice','manforth',['annual-ios','annual-android']).sources.filter(s=>s.status==='active').length,2);
});
test('native webhook requires constant-time authorization and records no untrusted access claims',async()=>{
 const writes=[];const sql=async(parts,...values)=>{const query=parts.join('?');if(query.startsWith('SELECT id'))return [{id:'alice'}];writes.push({query,values});return [];};
 const native=loadModule('lib/account/billing/native.ts',{'node:crypto':require('node:crypto'),'../store':{accountSql:sql},'../config':{PERSONAL_PRODUCT:'b1-way-personal'},'./native-snapshot':{nativeSnapshot}}, {process:{env:{REVENUECAT_WEBHOOK_AUTH_TOKEN:'x'.repeat(40)}}});
 assert.equal(native.nativeWebhookAuthorized(new Headers()),false);assert.equal(native.nativeWebhookAuthorized(new Headers({authorization:`Bearer ${'x'.repeat(40)}`})),true);
 await native.acceptNativeEvent({api_version:'1.0',event:{id:'e1',type:'INITIAL_PURCHASE',app_user_id:'alice',environment:'SANDBOX',event_timestamp_ms:now.getTime(),paidThrough:'2099-01-01T00:00:00Z'}});
 assert.equal(writes.length,1);assert.ok(writes[0].values.includes('sandbox:e1'));assert.ok(!JSON.stringify(writes).includes('2099'));
});
test('native confirmation endpoint is owned, bounded, available after expiry and rejects claimed entitlements',async()=>{
 const {mobileHandler}=loadModule('lib/mobile/http.ts',{'../todo':{todoBoardSchema:require('zod').z.array(require('zod').z.unknown())},'../account/preferences':loadModule('lib/account/preferences.ts'),'./event-contract':{eventWriteSchema:require('zod').z.object({})},'./gym-contract':{gymWriteSchema:require('zod').z.object({})}}, {TextDecoder});
 let owner;const handler=mobileHandler({enabled:true,webOrigin:'https://example.invalid',authenticate:async()=>({id:'alice',emailVerified:true,expiresAt:'2099-01-01T00:00:00Z'}),quota:async()=>true,bootstrap:async()=>({access:{canWrite:false,state:'expired'},legal:{writable:true,reason:null}}),read:async(resource,id)=>{owner=id;return {activeProviders:[]};},write:async()=>{throw Error('unexpected domain mutation');}});
 const request=body=>new Request('https://example.invalid/api/mobile/v1/membership-refresh',{method:'PUT',headers:{'expo-origin':'udmobile://','content-type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await handler(request({paid:true,userId:'bob'}),'membership-refresh')).status,400);
 assert.equal((await handler(request({}),'membership-refresh')).status,200);assert.equal(owner,'alice');
});
test('an account purchased first on mobile can export its owned billing source without a Stripe membership row',async()=>{
 const sql=async(parts,...values)=>{assert.ok(values.includes('alice'));return [];};sql.query=async(_query,values)=>{assert.deepEqual(plain(values),['alice']);return [];};
 const actions=loadModule('lib/actions/privacy.actions.ts',{'next/headers':{},'../auth':{},'../session':{requireUserId:async()=> 'alice'},'../account/store':{accountSql:sql,membershipFor:async()=>null,accountSettings:async()=>({})},'../account/privacy':{},'../legal/store':{legalAccountHistory:async()=>[]},'../account/billing/sources':{billingSources:async owner=>{assert.equal(owner,'alice');return [source({provider:'google_play',subscriptionId:'owned-mobile'})];},billingEnvironment:()=> 'production'} });
 const result=await actions.exportAccountData();assert.equal(result.ok,true);assert.equal(result.value.membership.sources[0].subscriptionId,'owned-mobile');assert.equal(result.value.membership.trialStartedAt,null);
});
test('real SQL migration and source upserts preserve trials, ownership, retries and newer snapshots',async()=>{
 const db=await PGlite.create();
 try{
  await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY); INSERT INTO "user" VALUES('alice'),('bob'); CREATE TABLE finance_table(id text); CREATE TABLE investment_positions(id text); CREATE TABLE user_events(user_id text,week text);`);
  await db.exec(readFileSync('lib/db/0021_account_membership.sql','utf8'));
  await db.exec(`INSERT INTO b1_memberships(user_id,product,trial_started_at,trial_ends_at,subscription_id,paid_confirmed,paid_through) VALUES('alice','b1-way-personal','2026-10-01','2026-10-15','legacy-stripe',true,'2027-10-01');`);
  const before=JSON.stringify((await db.query('SELECT * FROM b1_memberships')).rows);
  const migration=readFileSync('lib/db/0030_cross_platform_billing.sql','utf8');await db.exec(migration);await db.exec(migration);
  assert.equal(JSON.stringify((await db.query('SELECT * FROM b1_memberships')).rows),before);
  assert.equal((await db.query("SELECT environment FROM b1_billing_sources WHERE subscription_id='legacy-stripe'")).rows[0].environment,'unknown');
  const sql=async(parts,...values)=>(await db.query(parts.reduce((s,p,i)=>s+p+(i<values.length?`$${i+1}`:''),''),values)).rows;
  const repository=loadModule('lib/account/billing/sources.ts',{'../store':{accountSql:sql},'../config':{PERSONAL_PRODUCT:'b1-way-personal',appOrigin:()=> 'http://localhost:3000'}},{process:{env:{B1_BILLING_SOURCES_ENABLED:'true',B1_BILLING_ENVIRONMENT:'test'}}});
  const snapshot={...source({environment:'test'}),owner:'alice',processor:'stripe',providerStatus:'active',productId:'prod-man',priceId:'price-eur',observedAt:'2026-10-04T12:00:00Z'};
  await repository.saveBillingSource(snapshot);await repository.saveBillingSource(snapshot);
  assert.equal((await db.query("SELECT count(*)::int n FROM b1_billing_sources WHERE subscription_id='sub-a'")).rows[0].n,1);
  await repository.saveBillingSource({...snapshot,status:'revoked',observedAt:'2026-10-03T00:00:00Z'});assert.equal((await repository.billingSources('alice')).find(s=>s.subscriptionId==='sub-a').status,'active');
  await assert.rejects(repository.saveBillingSource({...snapshot,owner:'bob'}),/different account/);assert.equal((await repository.billingSources('bob')).length,0);
  await db.exec("INSERT INTO b1_deletions(user_id,product) VALUES('bob','b1-way-personal')");await repository.saveBillingSource({...snapshot,owner:'bob',subscriptionId:'blocked'});assert.equal((await repository.billingSources('bob')).length,0);
  const prod=loadModule('lib/account/billing/sources.ts',{'../store':{accountSql:sql},'../config':{appOrigin:()=> 'https://b1-way-mf.vercel.app'}},{process:{env:{B1_BILLING_ENVIRONMENT:'test',VERCEL_ENV:'production'}}});assert.throws(()=>prod.billingEnvironment(),/production access/);
 }finally{await db.close();}
});
