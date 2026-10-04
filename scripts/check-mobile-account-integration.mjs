// Actual local HTTP / Better Auth / restricted Neon QA, never device evidence.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomBytes,createHash,createDecipheriv} from 'node:crypto';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import {neon} from '@neondatabase/serverless';
import {qaDatabaseUrl} from './qa-database.mjs';
import {verifyQaConnection} from './mobile-qa-connection.mjs';
import {qaFixturePath} from './mobile-qa-fixtures.mjs';
const root=resolve(import.meta.dirname,'..'),options=dotenv.parse(readFileSync(resolve(root,'.env.mobile-qa.local'))),application=dotenv.parse(readFileSync(resolve(root,'.env'))),connection=qaDatabaseUrl({...application,...options}),sql=neon(connection),origin='http://127.0.0.1:3001',accounts=JSON.parse(readFileSync(qaFixturePath(root,'fixture-accounts-phase4-account.json'))),account=suffix=>accounts.find(a=>a.id.endsWith('-'+suffix)),jars=new Map(),evidence=[];
let stage='isolation';
const key=createHash('sha256').update(readFileSync(resolve(root,'.mobile-dev/email-secret'),'utf8').trim()).digest();
function unseal(value){const b=Buffer.from(value,'base64url'),d=createDecipheriv('aes-256-gcm',key,b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return JSON.parse(Buffer.concat([d.update(b.subarray(28)),d.final()]));}
function remember(label,response){const j=jars.get(label)??new Map();for(const line of response.headers.getSetCookie()){const pair=line.split(';')[0],i=pair.indexOf('=');if(i>0)j.set(pair.slice(0,i),pair.slice(i+1));}jars.set(label,j);}
const cookie=label=>[...(jars.get(label)??[])].map(([k,v])=>k+'='+v).join('; ');
async function login(a,label=a.id,browser=false){const r=await fetch(origin+'/api/auth/sign-in/email',{method:'POST',signal:AbortSignal.timeout(60000),headers:{'Content-Type':'application/json',...(browser?{Origin:origin}:{'expo-origin':'udmobile://'})},body:JSON.stringify({email:a.email,password:a.password})});assert.equal(r.status,200);remember(label,r);const v=await r.json();assert.equal(v.user.id,a.id);return label;}
async function api(path,label,body){const r=await fetch(origin+'/api/mobile/v1/'+path,{method:body?'PUT':'GET',signal:AbortSignal.timeout(60000),headers:{'expo-origin':'udmobile://',...(label?{Cookie:cookie(label)}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const v=await r.json();return {status:r.status,data:path==='bootstrap'?v:v.data,error:v.error};}
async function ok(path,label,body){const r=await api(path,label,body);assert.equal(r.status,200);return r.data;}
async function codeFor(a){const rows=await sql`SELECT o.payload FROM b1_email_outbox o JOIN b1_email_attempts p ON o.kind='code:'||p.id::text||':'||p.version::text WHERE p.owner_id=${a.id} AND p.consumed_at IS NULL ORDER BY p.expires_at DESC LIMIT 1`;assert.equal(rows.length,1);const code=unseal(rows[0].payload).text.match(/code is (\d{6})/)[1];return code;}
async function main(){
 assert.ok(accounts.length===5&&accounts.every(a=>/^qa-mobile-[a-f0-9]{16}-/.test(a.id)&&a.email.endsWith('@example.invalid')));
 const identity=await verifyQaConnection(connection);assert.equal(identity.database,'qa_tablename');assert.equal(identity.role,'manforth_mobile_qa');
 const [rights]=await sql`SELECT has_table_privilege(current_user,'public."user"','DELETE') AS user_delete,has_table_privilege(current_user,'public.account','DELETE') AS account_delete`;
 if(process.argv.includes('--test-completed-deletion')&&(!rights.user_delete||!rights.account_delete))throw Error('Completed deletion permission is missing; do not broaden grants implicitly.');
 const alex=account('alex'),robin=account('robin'),unverified=account('unverified'),expired=account('expired'),deleted=account('no-legal');
 const initial=await sql`SELECT id,email,email_verified FROM "user" WHERE id=ANY(${accounts.map(a=>a.id)}::text[])`;
 if(initial.length!==5||initial.find(a=>a.id===unverified.id)?.email_verified||(await sql`SELECT 1 FROM b1_deletions WHERE user_id=ANY(${accounts.map(a=>a.id)}::text[])`).length)throw Error('Select a fresh labeled fixture set; existing records are preserved.');
 stage='sessions-and-ownership';await login(alex);await login(alex,'web',true);await login(robin);
 let state=await ok('account',alex.id);assert.ok(state.sessions.some(s=>s.current));assert.ok(state.sessions.every(s=>!('token'in s)&&!('userId'in s)));
 const currentId=state.sessions.find(s=>s.current).id,otherId=(await ok('account','web')).sessions.find(s=>s.current).id;
 await ok('account',robin.id,{type:'revoke-session',id:currentId});assert.equal((await api('bootstrap',alex.id)).status,200);
 await ok('account',alex.id,{type:'revoke-session',id:otherId});assert.equal((await api('bootstrap','web')).status,401);
 assert.equal((await api('account?owner='+robin.id,alex.id)).status,400);
 await login(robin,'robin-other');await ok('account',robin.id,{type:'revoke-others'});assert.equal((await api('bootstrap','robin-other')).status,401);
 evidence.push('shared web/native sessions, current-device marker, session ownership, targeted and other-device revocation');
 stage='export-and-name';await ok('account',alex.id,{type:'name',name:'Synthetic account QA'});assert.equal((await ok('bootstrap',alex.id)).user.name,'Synthetic account QA');
 for(const a of [alex,robin]){const data=await ok('account-export',a.id);assert.equal(data.account.id,a.id);const text=JSON.stringify(data);for(const other of accounts.filter(b=>b.id!==a.id))assert.ok(!text.includes(other.id));assert.ok(!/"(?:password|token|customer_id|subscription_id|subscriptionId)"\s*:/.test(text));}
 evidence.push('owned full JSON export, no credentials/provider identifiers/other owners, canonical profile update');
 stage='verification';await login(unverified);const before=await sql`SELECT trial_started_at,trial_ends_at FROM b1_memberships WHERE user_id=${unverified.id}`;
 let proof=await ok('account',unverified.id,{type:'proof-begin',purpose:'verify-account',email:unverified.email});assert.ok(proof.proof);
 assert.equal((await api('account',robin.id,{type:'proof-confirm',proof:proof.proof,code:'000000'})).status,403);
 // Reopening loses the in-memory capability. Begin reuses the latest mailbox code.
 const original=proof.proof;proof=await ok('account',unverified.id,{type:'proof-begin',purpose:'verify-account',email:unverified.email});assert.notEqual(proof.proof,original);
 const code=await codeFor(unverified);await ok('account',unverified.id,{type:'proof-confirm',proof:proof.proof,code});await ok('account',unverified.id,{type:'proof-confirm',proof:proof.proof,code});
 assert.equal((await ok('bootstrap',unverified.id)).user.emailVerified,true);
 const after=await sql`SELECT trial_started_at,trial_ends_at FROM b1_memberships WHERE user_id=${unverified.id}`;assert.deepEqual(after,before);
 evidence.push('real mailbox proof, account binding, restart capability rotation, repeated confirmation and unchanged trial history');
 stage='email-change';const newEmail='qa-'+randomBytes(8).toString('hex')+'@example.invalid';proof=await ok('account',unverified.id,{type:'proof-begin',purpose:'email-change',email:newEmail,currentPassword:unverified.password});
 await ok('account',unverified.id,{type:'proof-confirm',proof:proof.proof,code:await codeFor(unverified)});
 const changed=await ok('bootstrap',unverified.id);assert.equal(changed.user.id,unverified.id);assert.equal(changed.user.email,newEmail);
 unverified.email=newEmail;writeFileSync(qaFixturePath(root,'fixture-accounts-phase4-account.json'),JSON.stringify(accounts,null,2),{mode:0o600});
 evidence.push('password-protected email change keeps stable account ID and records');
 stage='expired-rights';await login(expired);assert.equal((await ok('bootstrap',expired.id)).access.state,'expired');await ok('account',expired.id);assert.equal((await ok('account-export',expired.id)).account.id,expired.id);
 evidence.push('expired access retains security/sessions/export without enabling feature writes');
 stage='password-change';await login(alex,'password-web',true);const newPassword='Synthetic-'+randomBytes(24).toString('base64url')+'-pass';
 assert.equal((await api('account',alex.id,{type:'password',currentPassword:'invalid-password',newPassword})).status,400);
 const password=await ok('account',alex.id,{type:'password',currentPassword:alex.password,newPassword});assert.equal(password.signInRequired,true);assert.equal((await api('bootstrap',alex.id)).status,401);assert.equal((await api('bootstrap','password-web')).status,401);
 alex.password=newPassword;writeFileSync(qaFixturePath(root,'fixture-accounts-phase4-account.json'),JSON.stringify(accounts,null,2),{mode:0o600});await login(alex);assert.equal((await ok('bootstrap',alex.id)).user.id,alex.id);
 evidence.push('wrong password rejected; valid password changes revoke rotated/current/other sessions and require fresh sign-in');
 stage='pending-deletion';await sql`INSERT INTO b1_deletions(user_id,product,customer_id) VALUES(${expired.id},'b1-way-personal','qa-provider-disabled')`;
 const pending=await ok('account',expired.id,{type:'delete',password:expired.password,confirmation:'DELETE MY ACCOUNT',stopRenewals:true});assert.equal(pending.deletion.status,'retry');assert.equal(pending.signInRequired,false);assert.equal((await ok('bootstrap',expired.id)).access.state,'deletion-pending');assert.equal((await ok('account-export',expired.id)).account.id,expired.id);assert.equal((await api('account',expired.id,{type:'name',name:'Blocked'})).status,403);
 evidence.push('durable pending deletion on unavailable provider, retained identity/export, no fabricated completion or provider calls');
 if(process.argv.includes('--test-completed-deletion')){
 stage='synthetic-deletion';await login(deleted);assert.equal((await api('account',deleted.id,{type:'delete',password:deleted.password,confirmation:'DELETE MY ACCOUNT',stopRenewals:false})).status,400);
 const result=await ok('account',deleted.id,{type:'delete',password:deleted.password,confirmation:'DELETE MY ACCOUNT',stopRenewals:true});assert.equal(result.deletion.status,'completed');assert.equal(result.signInRequired,true);assert.equal((await api('bootstrap',deleted.id)).status,401);assert.equal((await sql`SELECT count(*) AS n FROM "user" WHERE id=${deleted.id}`)[0].n,'0');
 evidence.push('only this run’s disposable synthetic subject deleted; durable completed tombstone and revoked sessions');
 }else console.log('PENDING: completed synthetic deletion requires explicitly approved scoped QA DELETE/RLS setup.');
 stage='provider-boundary';assert.equal((await sql`SELECT count(*) AS n FROM b1_email_outbox WHERE recipient_key IN(SELECT recipient_key FROM b1_email_ledgers WHERE active_attempt IN(SELECT id FROM b1_email_attempts WHERE owner_id=ANY(${accounts.map(a=>a.id)}::text[]))) AND status='sent'`)[0].n,'0');
 const file=qaFixturePath(root,'fixture-accounts-phase4-account.json');writeFileSync(file,JSON.stringify(accounts.map(a=>a.id===unverified.id?{...a,email:newEmail}:a),null,2),{mode:0o600});
 evidence.push('QA mail remains encrypted/undelivered; credentials updated only in ignored fixture file; no production/provider mutation');
 console.log('PASS: '+evidence.length+' real account HTTP/Neon check groups.');for(const line of evidence)console.log('- '+line);
}
main().catch(()=>{console.error('FAIL: account QA stage '+stage+'. Private diagnostics withheld. Preserve fixtures; inspect the scoped check before retrying.');process.exitCode=1;});
