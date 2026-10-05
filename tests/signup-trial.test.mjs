import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {loadModule} from './helpers.mjs';

const production={NODE_ENV:'production',B1_WAY_ENFORCE_MEMBERSHIP:'false',TRIAL_DAYS:'7'};
const config=loadModule('lib/account/config.ts',{}, {process:{env:production}});

async function fixture(){
 const db=await PGlite.create();
 await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY,email text,email_verified boolean,created_at timestamptz DEFAULT now());
   CREATE TABLE account(id text PRIMARY KEY,user_id text,provider_id text,password text);
   CREATE TABLE b1_deletions(user_id text,product text);
   INSERT INTO "user"(id,email,email_verified) VALUES('owner','fixture@example.invalid',true);
   INSERT INTO account VALUES('credential','owner','credential','protected-fixture');`);
 const migration=readFileSync('lib/db/0021_account_membership.sql','utf8');
 await db.exec(migration.match(/CREATE TABLE IF NOT EXISTS b1_memberships [\s\S]*?;/)[0]);
 const sql=async(parts,...values)=>(await db.query(parts.reduce((query,part,i)=>query+part+(i<values.length?`$${i+1}`:''),''),values)).rows;
 const store={accountSql:sql,membershipFor:async owner=>(await db.query('SELECT * FROM b1_memberships WHERE user_id=$1 AND product=$2',[owner,config.PERSONAL_PRODUCT])).rows[0]??null};
 const signup=loadModule('lib/account/signup.ts',{'./store':store,'./config':config});
 const access=loadModule('lib/account/access.ts',{'./store':store,'./config':config,'./access-policy':loadModule('lib/account/access-policy.ts')},{process:{env:production}});
 return {db,signup,access};
}

test('production enforces membership without an approval variable and the trial is always 14 days',()=>{
 for(const env of [{NODE_ENV:'production'},{...production,TRIAL_DAYS:'invalid'}]){
   const policy=loadModule('lib/account/config.ts',{}, {process:{env}}).launchPolicy();
   assert.equal(policy.enforceMembership,true);assert.equal(policy.trialDays,14);
 }
 assert.equal(loadModule('lib/account/config.ts',{}, {process:{env:{NODE_ENV:'development'}}}).launchPolicy().enforceMembership,false);
});

test('verified identity creation starts one 14-day trial before access, including concurrent completion retries',async()=>{
 const f=await fixture();try{
   await Promise.all([f.signup.initializeSignupTrial('owner'),f.signup.initializeSignupTrial('owner')]);
   const rows=(await f.db.query(`SELECT m.trial_started_at=u.created_at AS anchored,
     extract(epoch FROM m.trial_ends_at-m.trial_started_at)/86400 AS days,m.paid_confirmed,m.status
     FROM b1_memberships m JOIN "user" u ON u.id=m.user_id`)).rows;
   assert.equal(rows.length,1);assert.equal(rows[0].anchored,true);assert.equal(Number(rows[0].days),14);
   assert.equal(rows[0].status,'trial');assert.equal(rows[0].paid_confirmed,false);
   const access=await f.access.productAccess('owner');assert.equal(access.state,'trial');assert.equal(access.canWrite,true);
   await f.signup.initializeSignupTrial('owner');assert.equal(new Date((await f.access.productAccess('owner')).end).toISOString(),new Date(access.end).toISOString());
   await f.db.exec("UPDATE b1_memberships SET trial_started_at=now()-interval '15 days',trial_ends_at=now()-interval '1 day'");
   await f.signup.initializeSignupTrial('owner');
   const expired=await f.access.productAccess('owner');assert.equal(expired.state,'expired');assert.equal(expired.readOnly,true);
 }finally{await f.db.close();}
});

test('trial retries use the original account date and preserve an existing paid membership',async()=>{
 const f=await fixture();try{
   await f.db.exec("UPDATE \"user\" SET created_at=now()-interval '15 days'");
   await f.signup.initializeSignupTrial('owner');assert.equal((await f.access.productAccess('owner')).state,'expired');
   await f.db.exec(`DELETE FROM b1_memberships;
     INSERT INTO b1_memberships(user_id,product,paid_confirmed,paid_through,status) VALUES('owner','b1-way-personal',true,now()+interval '1 year','active');`);
   await f.signup.initializeSignupTrial('owner');
   const member=(await f.db.query('SELECT * FROM b1_memberships')).rows[0];
   assert.equal(member.trial_started_at,null);assert.equal(member.status,'active');assert.equal(member.paid_confirmed,true);
   assert.equal((await f.access.productAccess('owner')).state,'paid');
 }finally{await f.db.close();}
});

test('unverified, missing-credential, missing-identity and deleting accounts cannot acquire a signup trial',async()=>{
 const f=await fixture();try{
   await assert.rejects(f.signup.initializeSignupTrial('missing'));
   await f.db.exec('UPDATE "user" SET email_verified=false');await assert.rejects(f.signup.initializeSignupTrial('owner'));
   await f.db.exec('UPDATE "user" SET email_verified=true; UPDATE account SET password=NULL');await assert.rejects(f.signup.initializeSignupTrial('owner'));
   await f.db.exec("UPDATE account SET password='protected-fixture'; INSERT INTO b1_deletions VALUES('owner','b1-way-personal')");
   await assert.rejects(f.signup.initializeSignupTrial('owner'));
   assert.equal((await f.db.query('SELECT count(*)::int AS count FROM b1_memberships')).rows[0].count,0);
 }finally{await f.db.close();}
});
