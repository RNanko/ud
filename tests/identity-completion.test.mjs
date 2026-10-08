import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {betterAuth} from 'better-auth';
import {drizzleAdapter} from 'better-auth/adapters/drizzle';
import {createEmailVerificationToken} from 'better-auth/api';
import {hashPassword,verifyPassword} from 'better-auth/crypto';
import {loadModule} from './helpers.mjs';
import {legalValidation,legalBundle,legalAgreement} from './legal-fixture.mjs';
const native=createRequire(import.meta.url),secret='offline-fixture-secret-at-least-thirty-two-characters';
const schema=loadModule('lib/db/schema.ts',{'drizzle-orm':native('drizzle-orm'),'drizzle-orm/pg-core':native('drizzle-orm/pg-core')});
const migration=readFileSync('lib/db/0036_identity_completions.sql','utf8');
const cryptoModule=loadModule('lib/account/email/crypto.ts',{'node:crypto':native('node:crypto')},{process:{env:{EMAIL_PROTECTION_SECRET:secret}}});
const passwordPolicy=loadModule('lib/account/password.ts');
const sqlFor=db=>async(parts,...values)=>(await db.query(parts.map((part,i)=>part+(i<values.length?`$${i+1}`:'')).join(''),values)).rows;
async function fixture(){
 const db=new PGlite();
 await db.exec(readFileSync(`lib/db/${readdirSync('lib/db').find(name=>name.startsWith('0000')&&name.endsWith('.sql'))}`,'utf8'));
 await db.exec(`ALTER TABLE "user" ADD COLUMN date_of_birth date, ADD COLUMN "groqKey" text;
  CREATE TABLE b1_email_attempts(id text PRIMARY KEY,token_hash text UNIQUE,email text,purpose text,owner_id text,old_email text,user_id text,verified_at timestamptz,consumed_at timestamptz,expires_at timestamptz);
  CREATE TABLE b1_recovery_claims(token_key text PRIMARY KEY,user_id text,purpose text,claimed_at timestamptz,expires_at timestamptz);
  CREATE TABLE b1_rate_buckets(key text PRIMARY KEY,count integer,started_at timestamptz,expires_at timestamptz);`);
 await db.exec(migration);
 const base=drizzle(db,{schema}),boundary=loadModule('lib/db/auth-drizzle.ts',{'@neondatabase/serverless':{Pool:class{},neonConfig:{}},'drizzle-orm/neon-serverless':{drizzle:()=>base},'./schema':schema,'node:async_hooks':native('node:async_hooks')});
 const accountSql=sqlFor(db),config=loadModule('lib/account/config.ts'),policy=loadModule('lib/account/email/policy.ts',{'../store':{accountSql},'./crypto':cryptoModule,'../config':config});
 const completion=loadModule('lib/account/identity-completion.ts',{'../db/auth-drizzle':boundary,'./email/crypto':cryptoModule,'./email/policy':policy});
 const identity=loadModule('lib/account/identity-context.ts',{'node:async_hooks':native('node:async_hooks')});
 const signup=loadModule('lib/account/signup.ts',{'./store':{accountSql},'../db/auth-drizzle':boundary});
 const quota=loadModule('lib/account/password-attempts.ts',{'./email/policy':policy,'./email/crypto':cryptoModule});
 const state={fault:null,hashes:0,verifications:0,updates:0,trialCalls:0,mailCalls:0,cookie:null,headers:new Headers(),token:null};
 const auth=betterAuth({baseURL:'http://localhost:3000',secret,database:drizzleAdapter(boundary.authDb,{provider:'pg',transaction:true}),logger:{disabled:true},
  emailAndPassword:{enabled:true,autoSignIn:false,revokeSessionsOnPasswordReset:true,password:{hash:async password=>{state.hashes++;if(state.fault==='hash')throw Error('Synthetic hash fault after token consumption');return hashPassword(password);},verify:async input=>{state.verifications++;return verifyPassword(input);}},
   sendResetPassword:async({token,user})=>{state.token=token;await db.query('INSERT INTO b1_recovery_claims VALUES($1,$2,$3,NULL,now()+interval \'1 hour\')',[cryptoModule.protectedKey(token),user.id,'recovery']);},
   onPasswordReset:async()=>{state.updates++;if(state.fault==='credential')throw Error('Synthetic fault after credential update');}},
  user:{changeEmail:{enabled:true}},emailVerification:{autoSignInAfterVerification:false},session:{cookieCache:{enabled:false}},rateLimit:{enabled:true,storage:'database',customRules:{'/sign-in/email':{window:60,max:2}}},
  databaseHooks:{user:{create:{before:async user=>{const trusted=identity.identityContext();if(trusted?.purpose==='signup'){await signup.assertVerifiedSignupProof(trusted.userId,user.email);return {data:{...user,id:trusted.userId,emailVerified:true}};}return {data:user};}}},account:{create:{before:async account=>{if(state.fault==='signup-account')throw Error('Synthetic credential creation fault after user insert');return {data:account};}}}},
 });
 const api=new Proxy(auth.api,{get(target,key){const original=target[key];if(key==='verifyEmail')return async input=>{const value=await original(input);if(state.fault==='verified')throw Error('Synthetic fault after email verification');return value;};return original;}});
 const actions=loadModule('lib/actions/identity.actions.ts',{
  'next/headers':{headers:async()=>state.headers,cookies:async()=>({get:()=>state.cookie?{value:state.cookie}:undefined,set(_name,value){state.cookie=value;},delete(){state.cookie=null;}})},
  '../auth':{auth:{...auth,api}},'better-auth/api':{createEmailVerificationToken},'../account/store':{accountSql},'../account/config':config,
  '../account/identity-context':identity,'../account/identity-completion':completion,'../account/password-attempts':quota,
  '../account/email/challenges':{challengeState:async token=>(await db.query('SELECT * FROM b1_email_attempts WHERE token_hash=$1',[cryptoModule.protectedKey(token)])).rows[0]},
  '../account/email/policy':policy,'../account/email/delivery':{enqueueMail:async()=>{state.mailCalls++;return true;},processMailQueue:async()=>[]},'../account/email/templates':{mailTemplate:()=>({})},'../account/email/crypto':cryptoModule,
  '../account/password':{validateNewPassword:async password=>{if(state.fault==='validate')throw Error('Synthetic pre-mutation fault');await passwordPolicy.validateNewPassword(password);}},'../session':{},
  '../legal/validation':legalValidation,'../legal/store':{publishedBundle:async()=>legalBundle},'../account/signup':{...signup,initializeSignupTrial:async()=>{state.trialCalls++;if(state.fault==='trial')throw Error('Synthetic post-commit trial fault');}},
 },{process:{env:{BETTER_AUTH_SECRET:secret}},console:{...console,error(){}}});
 async function seed(id='owner'){
  await db.query('INSERT INTO "user"(id,name,email,email_verified) VALUES($1,$1,$2,false)',[id,`${id}@example.invalid`]);
  await db.query('INSERT INTO account(id,account_id,provider_id,user_id,password,updated_at) VALUES($1,$1,\'credential\',$1,$2,now())',[id,await hashPassword('Old synthetic password 123!')]);
 }
 async function login(id='owner'){
  const response=await auth.api.signInEmail({body:{email:`${id}@example.invalid`,password:'Old synthetic password 123!'},returnHeaders:true});
  state.headers=new Headers({cookie:response.headers.get('set-cookie').split(';')[0]});
 }
 async function email(purpose='signup',id='proof',owner='owner'){
  const token=`${id}-synthetic-capability-with-entropy`,target=purpose==='email-change'?`${id}@example.invalid`:`${purpose==='signup'?id:owner}@example.invalid`;
  await db.query('INSERT INTO b1_email_attempts VALUES($1,$2,$3,$4,$5,$6,$7,now(),NULL,now()+interval \'1 hour\')',[id,cryptoModule.protectedKey(token),target,purpose,purpose==='signup'?null:owner,purpose==='signup'?null:`${owner}@example.invalid`,purpose==='signup'?id:owner]);
  state.cookie=token;return token;
 }
 async function recovery(){await auth.api.requestPasswordReset({body:{email:'owner@example.invalid',redirectTo:'http://localhost:3000/auth/reset-password'}});return state.token;}
 const privacy=loadModule('lib/actions/privacy.actions.ts',{'next/headers':{headers:async()=>state.headers},'../auth':{auth},'../session':{requireUserId:async()=>(await auth.api.getSession({headers:state.headers})).user.id},'../account/store':{accountSql},'../account/privacy':{},'../account/password-attempts':quota,'../legal/store':{}} ,{console:{...console,error(){}}});
 return {db,boundary,completion,state,auth,actions,privacy,seed,login,email,recovery,quota};
}
const nextPassword='New synthetic password 987!',signupInput={name:'Synthetic Person',password:nextPassword,dateOfBirth:'1990-03-25',legal:legalAgreement};
const one=async(db,query,params=[])=>(await db.query(query,params)).rows[0];

test('recovery action rolls back custom claim AND installed Better Auth token, credential, verified state and sessions at each precommit failure',async()=>{
 const f=await fixture();try{
  await f.seed();await f.login();
  for(const fault of ['validate','hash','credential','verified']){
   const token=await f.recovery(),before=await one(f.db,'SELECT password FROM account WHERE user_id=\'owner\'');f.state.fault=fault;
   assert.equal((await f.actions.finishRecovery({token,password:nextPassword})).ok,false,fault);
   assert.equal((await one(f.db,'SELECT claimed_at FROM b1_recovery_claims WHERE token_key=$1',[cryptoModule.protectedKey(token)])).claimed_at,null);
   const receipt=await one(f.db,'SELECT status FROM b1_identity_completions WHERE proof_id=$1',[cryptoModule.protectedKey(token)]);
   assert.equal(receipt?.status,fault==='validate'?undefined:'pending');
   assert.equal((await one(f.db,'SELECT password FROM account WHERE user_id=\'owner\'')).password,before.password);
   assert.equal((await one(f.db,'SELECT count(*)::int n FROM verification WHERE identifier=$1',[`reset-password:${token}`])).n,1);
   assert.equal((await one(f.db,'SELECT email_verified FROM "user" WHERE id=\'owner\'')).email_verified,false);
   assert.equal((await one(f.db,'SELECT count(*)::int n FROM session')).n,1);
   f.state.fault=null;
   assert.equal((await f.actions.finishRecovery({token,password:nextPassword})).ok,true,fault);
   assert.equal((await one(f.db,'SELECT count(*)::int n FROM session')).n,0);
   // Restore only fixture state for another independent reset attempt.
   await f.db.query('UPDATE account SET password=$1 WHERE user_id=\'owner\'',[before.password]);
   await f.db.exec('UPDATE "user" SET email_verified=false');await f.login();
  }
 }finally{await f.db.close();}
});

test('committed recovery lost-response retry acknowledges without resetting a subsequently changed credential; changed password is not a new operation',async()=>{
 const f=await fixture();try{
  await f.seed();const token=await f.recovery();assert.equal((await f.actions.finishRecovery({token,password:nextPassword})).ok,true);
  const hashes=f.state.hashes,updates=f.state.updates;
  await f.db.exec("UPDATE account SET password='later-protected-credential'");
  assert.equal((await f.actions.finishRecovery({token,password:nextPassword})).ok,true);
  assert.equal((await f.actions.finishRecovery({token,password:'Different proposed password 456!'})).ok,false);
  assert.equal(f.state.hashes,hashes);assert.equal(f.state.updates,updates);
  assert.equal((await one(f.db,'SELECT password FROM account')).password,'later-protected-credential');
 }finally{await f.db.close();}
});

test('signup actual nested Better Auth transaction rolls proof and identity back; durable reservation binds identity fields and survives postcommit failure',async()=>{
 const f=await fixture();try{
  const token=await f.email();
  for(const fault of ['hash','signup-account']){
   f.state.fault=fault;assert.equal((await f.actions.completeSignup(signupInput)).ok,false);
   assert.equal((await one(f.db,'SELECT consumed_at FROM b1_email_attempts')).consumed_at,null);
   assert.equal((await one(f.db,'SELECT count(*)::int n FROM "user"')).n,0);
   assert.equal((await one(f.db,'SELECT count(*)::int n FROM account')).n,0);
   assert.equal((await one(f.db,'SELECT status FROM b1_identity_completions')).status,'pending');
  }
  assert.equal((await f.actions.completeSignup({...signupInput,name:'Another identity'})).ok,false);
  f.state.fault='trial';assert.equal((await f.actions.completeSignup(signupInput)).ok,false);
  assert.equal((await one(f.db,'SELECT count(*)::int n FROM "user"')).n,1);
  assert.equal((await one(f.db,'SELECT count(*)::int n FROM account')).n,1);
  assert.equal((await one(f.db,'SELECT status FROM b1_identity_completions')).status,'committed');
  const hashes=f.state.hashes;f.state.fault=null;f.state.cookie=token;
  assert.equal((await f.actions.completeSignup(signupInput)).ok,true);assert.equal(f.state.hashes,hashes);
  assert.equal((await one(f.db,'SELECT count(*)::int n FROM "user"')).n,1);
 }finally{await f.db.close();}
});

test('account email actual action rollback restores proof/mailbox/sessions; committed retries use receipt after current mailbox changed',async()=>{
 const f=await fixture();try{
  await f.seed();await f.login();const token=await f.email('email-change');f.state.fault='verified';
  assert.equal((await f.actions.completeAccountEmail('email-change')).ok,false);
  assert.equal((await one(f.db,'SELECT email FROM "user"')).email,'owner@example.invalid');
  assert.equal((await one(f.db,'SELECT consumed_at FROM b1_email_attempts')).consumed_at,null);
  assert.equal(await f.completion.emailIdentityCompleted(token,'email-change','owner'),false);
  f.state.fault=null;assert.equal((await f.actions.completeAccountEmail('email-change')).ok,true);
  assert.equal((await one(f.db,'SELECT email FROM "user"')).email,'proof@example.invalid');
  assert.equal(await f.completion.emailIdentityCompleted(token,'email-change','owner'),true);
  assert.equal(await f.completion.emailIdentityCompleted(token,'email-change','other'),false);
  f.state.cookie=token;assert.equal((await f.actions.completeAccountEmail('email-change')).ok,true);
 }finally{await f.db.close();}
});

test('concurrent duplicate completion has one mutation, refuses owner/purpose/input substitution and blocks expired pending reservations',async()=>{
 const f=await fixture();try{
  await f.seed();const token=await f.email('verify-account');let mutations=0;
  const mutate=async()=>{mutations++;await f.boundary.authDb.execute(native('drizzle-orm').sql`UPDATE "user" SET email_verified=true WHERE id='owner'`);};
  await Promise.all([1,2,3].map(()=>f.completion.completeEmailIdentity(token,'verify-account','owner',null,mutate)));
  assert.equal(mutations,1);
  for(const [purpose,owner,input] of [['verify-account','other',null],['email-change','owner',null],['verify-account','owner','changed']])
   await assert.rejects(f.completion.completeEmailIdentity(token,purpose,owner,input,mutate));
  const pending=await f.email('verify-account','pending');
  await assert.rejects(f.completion.completeEmailIdentity(pending,'verify-account','owner',null,async()=>{throw Error('Synthetic after-reservation failure');}));
  await f.db.exec("UPDATE b1_email_attempts SET expires_at=now()-interval '1 second' WHERE id='pending'");
  await assert.rejects(f.completion.completeEmailIdentity(pending,'verify-account','owner',null,mutate));assert.equal(mutations,1);
 }finally{await f.db.close();}
});

test('0036 is additive and repeatable on populated data and deletion removes the completed owner receipts',async()=>{
 const f=await fixture();try{
  await f.seed();const token=await f.email('verify-account');await f.completion.completeEmailIdentity(token,'verify-account','owner',null,async()=>{});
  const before=await one(f.db,'SELECT * FROM b1_identity_completions');await f.db.exec(migration);assert.deepEqual(await one(f.db,'SELECT * FROM b1_identity_completions'),before);
  assert.equal((await one(f.db,'SELECT count(*)::int n FROM "user"')).n,1);assert.equal((await one(f.db,'SELECT count(*)::int n FROM account')).n,1);
  await f.db.exec('DELETE FROM "user"');assert.equal((await one(f.db,'SELECT count(*)::int n FROM b1_identity_completions')).n,0);
 }finally{await f.db.close();}
});

test('receipt commit failure rolls actual signup identity and credential back with proof, then permits original request retry',async()=>{
 const f=await fixture();try{
  await f.email();
  await f.db.exec(`CREATE FUNCTION fail_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic receipt write failure'; END; $$;
   CREATE TRIGGER fault BEFORE UPDATE ON b1_identity_completions FOR EACH ROW EXECUTE FUNCTION fail_receipt();`);
  assert.equal((await f.actions.completeSignup(signupInput)).ok,false);
  assert.equal((await one(f.db,'SELECT count(*)::int n FROM "user"')).n,0);
  assert.equal((await one(f.db,'SELECT count(*)::int n FROM account')).n,0);
  assert.equal((await one(f.db,'SELECT consumed_at FROM b1_email_attempts')).consumed_at,null);
  assert.equal((await one(f.db,'SELECT status FROM b1_identity_completions')).status,'pending');
  await f.db.exec('DROP TRIGGER fault ON b1_identity_completions');
  assert.equal((await f.actions.completeSignup(signupInput)).ok,true);
 }finally{await f.db.close();}
});

test('failed recovery cannot be repurposed after mailbox changes or proof expiry; migration creates exactly one credential',async()=>{
 const f=await fixture();try{
  await f.seed();let token=await f.recovery();f.state.fault='hash';assert.equal((await f.actions.finishRecovery({token,password:nextPassword})).ok,false);
  f.state.fault=null;await f.db.exec("UPDATE \"user\" SET email='changed@example.invalid'");
  assert.equal((await f.actions.finishRecovery({token,password:nextPassword})).ok,false);
  await f.db.exec("UPDATE \"user\" SET email='owner@example.invalid';UPDATE b1_recovery_claims SET expires_at=now()-interval '1 second'");
  assert.equal((await f.actions.finishRecovery({token,password:nextPassword})).ok,false);
  await f.db.exec('DELETE FROM account');token=await f.recovery();
  await f.db.query("UPDATE b1_recovery_claims SET purpose='migration' WHERE token_key=$1",[cryptoModule.protectedKey(token)]);
  assert.equal((await f.actions.finishRecovery({token,password:nextPassword})).ok,true);
  assert.equal((await f.actions.finishRecovery({token,password:nextPassword})).ok,true);
  assert.equal((await one(f.db,'SELECT count(*)::int n FROM account')).n,1);
 }finally{await f.db.close();}
});

test('actual sensitive actions share atomic owner password attempt quota, isolate owners, recover at expiry and leave HTTP limiter enforced',async()=>{
 const f=await fixture();try{
  await f.seed();await f.seed('other');await f.login();const verifications=f.state.verifications;
  const attempts=[
   ()=>f.actions.beginEmailProof({email:'changed@example.invalid',purpose:'email-change',currentPassword:'Wrong password'}),
   ()=>f.actions.changeAccountPassword({currentPassword:'Wrong password',newPassword:nextPassword}),
   ()=>f.privacy.deletePersonalAccount({password:'Wrong password',confirmation:'DELETE MY ACCOUNT',stopRenewals:true}),
  ];
  for(let i=0;i<5;i++)assert.equal((await attempts[i%3]()).ok,false);
  assert.equal(f.state.verifications-verifications,5);
  for(const attempt of attempts){const result=await attempt();assert.equal(result.ok,false);assert.match(result.error,/Too many password attempts/);}
  assert.equal(f.state.verifications-verifications,5);assert.equal(f.state.mailCalls,0);
  assert.equal((await one(f.db,'SELECT count FROM b1_rate_buckets WHERE key=$1',[`sensitive-password:${cryptoModule.protectedKey('owner')}`])).count,5);
  await f.login('other');assert.doesNotMatch((await attempts[1]()).error,/Too many/);
  await f.login();await f.db.exec("UPDATE b1_rate_buckets SET expires_at=now()-interval '1 second'");
  assert.doesNotMatch((await attempts[0]()).error,/Too many/);
  const concurrent=await Promise.all(Array.from({length:8},()=>attempts[1]()));
  assert.equal(concurrent.filter(result=>/Too many/.test(result.error)).length,4);
  const statuses=[];
  for(let i=0;i<3;i++)statuses.push((await f.auth.handler(new Request('http://localhost:3000/api/auth/sign-in/email',{method:'POST',headers:{'content-type':'application/json','x-forwarded-for':'192.0.2.1'},body:JSON.stringify({email:'owner@example.invalid',password:'Wrong password'})}))).status);
  assert.deepEqual(statuses,[401,401,429]);
 }finally{await f.db.close();}
});

test('weak first password is rejected before reservation; corrected password can complete the same verified signup or recovery proof',async()=>{
 const f=await fixture();try{
  await f.email();assert.equal((await f.actions.completeSignup({...signupInput,password:'aaaaaaaa'})).ok,false);
  assert.equal((await one(f.db,'SELECT count(*)::int n FROM b1_identity_completions')).n,0);
  assert.equal((await one(f.db,'SELECT consumed_at FROM b1_email_attempts')).consumed_at,null);
  assert.equal((await f.actions.completeSignup(signupInput)).ok,true);
  await f.seed();const token=await f.recovery();assert.equal((await f.actions.finishRecovery({token,password:'aaaaaaaa'})).ok,false);
  assert.equal(await one(f.db,"SELECT * FROM b1_identity_completions WHERE proof_kind='recovery'"),undefined);
  assert.equal((await one(f.db,'SELECT claimed_at FROM b1_recovery_claims')).claimed_at,null);
  assert.equal((await f.actions.finishRecovery({token,password:nextPassword})).ok,true);
 }finally{await f.db.close();}
});

test('concurrent actual signup and recovery actions commit one identity/credential operation and replay bound results',async()=>{
 const f=await fixture();try{
  await f.email();const signedUp=await Promise.all([1,2,3].map(()=>f.actions.completeSignup(signupInput)));
  assert.ok(signedUp.every(result=>result.ok));assert.equal(f.state.hashes,1);
  assert.equal((await one(f.db,'SELECT count(*)::int n FROM "user"')).n,1);assert.equal((await one(f.db,'SELECT count(*)::int n FROM account')).n,1);
  await f.seed();const token=await f.recovery(),before=f.state.hashes;
  const recovered=await Promise.all([1,2,3].map(()=>f.actions.finishRecovery({token,password:nextPassword})));
  assert.ok(recovered.every(result=>result.ok));assert.equal(f.state.hashes,before+1);assert.equal(f.state.updates,1);
 }finally{await f.db.close();}
});

test('pending distinct email proofs retain owner mailbox binding and hold the canonical owner lock through the mutation',async()=>{
 const f=await fixture();try{
  await f.seed();await f.seed('other');const first=await f.email('verify-account','first'),second=await f.email('email-change','second');
  await assert.rejects(f.completion.completeEmailIdentity(first,'verify-account','owner',null,async()=>{throw Error('Synthetic reserved failure');}));
  await assert.rejects(f.completion.completeEmailIdentity(second,'email-change','owner',null,async()=>{throw Error('Synthetic reserved failure');}));
  // Simulate another completed operation moving the owner's address, followed
  // by an unrelated account acquiring the old address before these retries.
  await f.db.exec(`UPDATE "user" SET email='moved@example.invalid' WHERE id='owner'; UPDATE "user" SET email='owner@example.invalid' WHERE id='other';`);
  let mutations=0;
  await assert.rejects(f.completion.completeEmailIdentity(first,'verify-account','owner',null,async()=>{mutations++;}));
  await assert.rejects(f.completion.completeEmailIdentity(second,'email-change','owner',null,async()=>{mutations++;}));
  assert.equal(mutations,0);assert.equal((await one(f.db,'SELECT count(*)::int n FROM b1_email_attempts WHERE consumed_at IS NOT NULL')).n,0);
  assert.equal((await one(f.db,"SELECT email_verified FROM \"user\" WHERE id='other'")).email_verified,false);
  await f.db.exec(`UPDATE "user" SET email='other@example.invalid' WHERE id='other';UPDATE "user" SET email='owner@example.invalid' WHERE id='owner';`);
  await f.completion.completeEmailIdentity(first,'verify-account','owner',null,async()=>{
   const locks=await f.boundary.authDb.execute(native('drizzle-orm').sql`SELECT mode FROM pg_locks WHERE relation='"user"'::regclass`);
   assert.ok(locks.rows.some(row=>row.mode==='RowShareLock'));
  });
 }finally{await f.db.close();}
});

test('Better Auth synthetic duplicate-mailbox success cannot consume signup proof or create a false committed receipt',async()=>{
 const f=await fixture();try{
  await f.seed('existing');await f.email();
  await f.db.exec("UPDATE b1_email_attempts SET email='existing@example.invalid'");
  assert.equal((await f.actions.completeSignup(signupInput)).ok,false);
  assert.equal((await one(f.db,'SELECT status FROM b1_identity_completions')).status,'pending');
  assert.equal((await one(f.db,'SELECT consumed_at FROM b1_email_attempts')).consumed_at,null);
  assert.equal((await one(f.db,'SELECT count(*)::int n FROM "user"')).n,1);
  assert.equal((await one(f.db,'SELECT count(*)::int n FROM account')).n,1);
  assert.equal(f.state.trialCalls,0);
 }finally{await f.db.close();}
});
