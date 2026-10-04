// Actual provider-free local API -> Better Auth -> restricted Neon QA. This
// checks owned access/configuration, NOT sandbox receipts or native device UI.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import {neon} from '@neondatabase/serverless';
import {qaDatabaseUrl} from './qa-database.mjs';
import {verifyQaConnection} from './mobile-qa-connection.mjs';
import {qaFixturePath} from './mobile-qa-fixtures.mjs';
import {assertNoQaFeatureMail} from './mobile-qa-mail-audit.mjs';
const root=resolve(import.meta.dirname,'..'),origin='http://127.0.0.1:3001';
let stage='configuration';
const sessions=[];
async function main(){
 const qa=dotenv.parse(readFileSync(resolve(root,'.env.mobile-qa.local'))),application=dotenv.parse(readFileSync(resolve(root,'.env')));
 const connection=qaDatabaseUrl({...application,...qa});
 console.log('Verified QA transport',await verifyQaConnection(connection));
 const sql=neon(connection),accounts=JSON.parse(readFileSync(qaFixturePath(root,'fixture-accounts-phase4-inbox-connected.json')));
 assert.ok(accounts.every(a=>/^qa-mobile-[a-f0-9]{16}-(alex|robin|unverified|expired|no-legal)$/.test(a.id)&&a.email.endsWith('@example.invalid')));
 const account=suffix=>{const a=accounts.find(a=>a.id.endsWith('-'+suffix));assert.ok(a);return a;};
 const audit=()=>sql.query('SELECT md5(string_agg(m::text,\'|\' ORDER BY user_id,product)) AS fingerprint FROM b1_memberships m WHERE user_id=ANY($1::text[])',[accounts.map(a=>a.id)]);
 const before=await audit(),groups=[];
 async function login(a){
  const r=await fetch(origin+'/api/auth/sign-in/email',{method:'POST',redirect:'manual',headers:{'content-type':'application/json','expo-origin':'udmobile://'},body:JSON.stringify({email:a.email,password:a.password}),signal:AbortSignal.timeout(60000)});
  assert.equal(r.status,200);assert.equal((await r.json()).user.id,a.id);
  const cookie=r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');assert.ok(cookie);sessions.push(cookie);return cookie;
 }
 async function api(cookie,path,body,headers={}){
  const r=await fetch(origin+'/api/mobile/v1/'+path,{method:body===undefined?'GET':'PUT',redirect:'manual',headers:{...(cookie?{Cookie:cookie}:{}),'expo-origin':'udmobile://',...(body===undefined?{}:{'content-type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(60000)});
  return {status:r.status,json:await r.json()};
 }
 const data=result=>{assert.equal(result.status,200);return result.json.data;};
 stage='shared-identity-membership';const alex=account('alex'),robin=account('robin'),alexCookie=await login(alex),robinCookie=await login(robin);
 const initial=await api(alexCookie,'bootstrap');assert.equal(initial.status,200);assert.equal(initial.json.user.id,alex.id);
 const membership=data(await api(alexCookie,'membership'));assert.equal(membership.nativeConfigured,false);assert.deepEqual(membership.activeProviders,[]);assert.deepEqual(membership.access,initial.json.access);
 groups.push('Actual shared credential identity and canonical account-owned access; native purchasing unavailable.');
 stage='confirmation-preserves-access';const confirmed=data(await api(alexCookie,'membership-refresh',{}));assert.deepEqual(confirmed,membership);
 assert.equal((await api(alexCookie,'membership-refresh')).status,405);assert.equal((await api(alexCookie,'membership-refresh',{paid:true})).status,400);
 assert.equal((await api(alexCookie,'membership-refresh',{}, {origin:'https://foreign.invalid'})).status,403);
 assert.equal((await api(alexCookie,'membership?userId='+robin.id)).status,400);assert.equal((await api('', 'membership')).status,401);
 groups.push('Empty authenticated confirmation preserves access; claims, ownership query, GET refresh and foreign origin fail.');
 stage='expired-unverified';const expiredCookie=await login(account('expired')),unverifiedCookie=await login(account('unverified'));
 const expired=data(await api(expiredCookie,'membership'));assert.equal(expired.access.canWrite,false);assert.equal(data(await api(expiredCookie,'membership-refresh',{})).access.canWrite,false);
 assert.equal(data(await api(unverifiedCookie,'membership')).nativeConfigured,false);assert.equal((await api(unverifiedCookie,'membership-refresh',{})).status,403);
 groups.push('Expired access is not restarted by confirmation; unverified confirmation is rejected.');
 stage='switch-revoke';assert.equal((await api(robinCookie,'bootstrap')).json.user.id,robin.id);assert.equal(data(await api(robinCookie,'membership')).nativeConfigured,false);
 const signout=await fetch(origin+'/api/auth/sign-out',{method:'POST',headers:{Cookie:alexCookie,'content-type':'application/json','expo-origin':'udmobile://'},body:'{}',signal:AbortSignal.timeout(15000)});assert.equal(signout.status,200);
 assert.equal((await api(alexCookie,'membership')).status,401);assert.equal((await api(robinCookie,'membership')).status,200);
 groups.push('Owned second-account membership remains accessible after the first session is revoked.');
 stage='unchanged-history-side-effects';assert.deepEqual(await audit(),before);await assertNoQaFeatureMail(sql,root,accounts);
 groups.push('Finite membership/trial history unchanged; no test-recipient email enqueue or external provider delivery.');
 writeFileSync(resolve(root,'.mobile-dev/phase5-membership-evidence.json'),JSON.stringify({date:new Date().toISOString(),database:'qa_tablename',role:'manforth_mobile_qa',groups,nativeDeviceVerified:false,providerPurchaseVerified:false,migrationsRun:0},null,2),{mode:0o600});
 for(const group of groups)console.log('PASS:',group);
 console.log('5 real provider-free membership integration groups passed.');
}
main().catch(error=>{console.error('Membership QA stopped',{stage,sqlState:error.code??null,reason:'Scoped check failed; no provider/billing setup or migration was run.'});process.exitCode=1;}).finally(async()=>{
 for(const cookie of sessions)try{await fetch(origin+'/api/auth/sign-out',{method:'POST',headers:{Cookie:cookie,'content-type':'application/json','expo-origin':'udmobile://'},body:'{}',signal:AbortSignal.timeout(15000)});}catch{/* Preserve history; never reset an account to retry cleanup. */}
});
