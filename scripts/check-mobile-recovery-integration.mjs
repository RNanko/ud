import {assertNoQaFeatureMail} from './mobile-qa-mail-audit.mjs';
// P3.4: real local HTTP + restricted Neon QA with disk journals and controlled
// interruptions. This is not a native SQLite/SecureStore/device test.
import { readFileSync,writeFileSync,existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { verifyQaConnection,QA_DATABASE } from './mobile-qa-connection.mjs';
import { qaFixturePath } from './mobile-qa-fixtures.mjs';
import { moduleLoader } from '../../ud-mobile/tests/helpers.mjs';
const root=resolve(import.meta.dirname,'..'),local=dotenv.parse(readFileSync(resolve(root,'.env.mobile-qa.local')));
if(local.QA_DATABASE_ISOLATED!=='true')throw Error('QA isolation assertion required.');
const accounts=JSON.parse(readFileSync(qaFixturePath(root,'fixture-accounts-phase3-recovery.json')));
const account=suffix=>accounts.find(a=>a.id.endsWith(`-${suffix}`)),origin='http://127.0.0.1:3001',cookies=new Map(),evidence=[],load=moduleLoader();
const mobile=path=>load(resolve(root,`../ud-mobile/${path}`));
const {SessionController}=mobile('src/services/session-controller.ts'),{LiveGymController}=mobile('src/services/live-gym-controller.ts'),{LiveFinanceController}=mobile('src/services/live-finance-controller.ts');
const {LiveGymJournal}=mobile('src/storage/live-gym-journal.ts'),{LiveFinanceJournal}=mobile('src/storage/live-finance-journal.ts');
const {apiTransport,ApiError}=mobile('src/services/mobile-contract.ts'),{workoutDraft,applyWorkoutFields}=mobile('src/domain/live-workout.ts'),{draftCommand}=mobile('src/domain/live-finance.ts');
const {sourceActivities}=load(resolve(root,'lib/momentum/logic.ts'));
let stage='configuration';
const cookie=a=>[...(cookies.get(a.id)??[])].map(([key,value])=>`${key}=${value}`).join('; ');
async function signIn(a){
 assert.ok(/^qa-mobile-[a-f0-9]{16}-(alex|robin|unverified|expired|no-legal)$/.test(a.id)&&a.email.endsWith('@example.invalid'));
 const r=await fetch(`${origin}/api/auth/sign-in/email`,{method:'POST',headers:{'content-type':'application/json','expo-origin':'udmobile://'},body:JSON.stringify({email:a.email,password:a.password}),signal:AbortSignal.timeout(60000)});
 assert.equal(r.status,200,'Real credential sign-in');const jar=new Map();for(const line of r.headers.getSetCookie()){const pair=line.split(';')[0],i=pair.indexOf('=');jar.set(pair.slice(0,i),pair.slice(i+1));}cookies.set(a.id,jar);assert.equal((await r.json()).user.id,a.id);
}
async function signOut(a){const r=await fetch(`${origin}/api/auth/sign-out`,{method:'POST',headers:{Cookie:cookie(a),'expo-origin':'udmobile://','content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(60000)});assert.equal(r.status,200);cookies.delete(a.id);}
async function raw(path,a,body){const r=await fetch(`${origin}/api/mobile/v1/${path}`,{method:body?'PUT':'GET',headers:{Cookie:cookie(a),'expo-origin':'udmobile://',...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)});return {status:r.status,json:await r.json()};}
async function put(resource,a,data,revision){const r=await raw(resource,a,{operationId:randomUUID(),...(revision===undefined?{}:{revision}),data});assert.equal(r.status,200,`${resource} ${data.kind}: ${r.json.error?.code??''}`);return r.json.data;}
async function until(check){for(let i=0;i<600;i++){if(check())return;await new Promise(done=>setTimeout(done,100));}throw Error('Real client restoration did not finish.');}
async function main(){
 stage='restricted connection and auth';console.log('PASS: QA transport/permissions',await verifyQaConnection(local.QA_DATABASE_URL));
 const sql=neon(local.QA_DATABASE_URL),alex=account('alex'),robin=account('robin'),run=randomUUID(),date=new Date().toISOString().slice(0,10);await signIn(alex);
 const library=await raw('gym-library',alex);assert.equal(library.status,200);const definition=library.json.data.exercises.find(e=>e.tracking==='weight-reps');assert.ok(definition);
 const blueprint={name:`QA recovery ${run}`,notes:'Synthetic P3.4 only',estimatedMinutes:30,timing:{start:'08:00',duration:30,overnight:false},exercises:[{id:randomUUID(),definition,targets:{sets:1,reps:20,loadKg:30,seconds:null,distanceKm:null,restSeconds:60},notes:''}]};
 const planId=randomUUID();await put('gym',alex,{kind:'plan',id:planId,revision:null,date,timezone:'UTC',data:blueprint});
 const started=await put('gym',alex,{kind:'start',id:randomUUID(),planId,data:null,date,timezone:'UTC',logged:false}),sessionId=started.result.id;
 const journalPath=resolve(root,'.mobile-dev',`combined-recovery-${run}.json`),store={async getItem(key){return existsSync(journalPath)?JSON.parse(readFileSync(journalPath))[key]??null:null;},async setItem(key,value){const map=existsSync(journalPath)?JSON.parse(readFileSync(journalPath)):{};map[key]=value;writeFileSync(journalPath,JSON.stringify(map),{mode:0o600});}};
 let current=alex,mode='online',held=[],clock=Date.now();
 const transport=apiTransport(origin,async()=>cookie(current));
 const makeSession=()=>new SessionController({newId:randomUUID,restore:async()=>{if(mode==='offline')throw new ApiError(0,'unavailable','Controlled offline startup');return transport('bootstrap');},signIn:async()=>{},signOut:()=>signOut(current),request:async(path,options)=>{
  if(mode==='offline')throw new ApiError(0,'unavailable','Controlled network interruption');
  const result=await transport(path,options);
  if(options?.body&&['gym','finance'].includes(path)){
   if(mode==='lost-ack')throw new ApiError(0,'unavailable','Controlled response loss after real commit');
   if(mode==='hold')await new Promise(done=>held.push(done));
  }
  return result;
 }},()=>clock);
 let session=makeSession(),gym=new LiveGymController(session,store,randomUUID),finance=new LiveFinanceController(session,store,randomUUID);
 const ready=()=>until(()=>session.snapshot().phase==='ready'&&gym.snapshot().gym&&gym.snapshot().journal&&!gym.snapshot().busy&&finance.snapshot().data&&finance.snapshot().journal&&!finance.snapshot().busy);
 await session.restore();await ready();assert.equal(session.snapshot().account.user.id,alex.id);
 evidence.push('real shared identity/bootstrap restores both account-scoped controllers');
 stage='offline raw values and process recreation';let draft=await gym.openSession(sessionId),setId=draft.base.data.exercises[0].sets[0].id;
 assert.equal(draft.fields[setId].reps,'');assert.equal(draft.fields[setId].load,'');mode='offline';draft.fields[setId].reps='8';draft.fields[setId].load='15';assert.equal(await gym.saveDraft(sessionId,draft),true);
 const entryDraft={id:randomUUID(),create:true,revision:finance.snapshot().data.revision,type:'-',date,amount:'0,10',currency:'USD',category:`QA recovery ${run}`,subcategory:'Synthetic',comment:'Saved raw input'};
 assert.equal(await finance.saveDraft(entryDraft),true);session.suspend();gym.dispose();finance.dispose();session=makeSession();gym=new LiveGymController(session,store,randomUUID);finance=new LiveFinanceController(session,store,randomUUID);
 await session.restore();assert.equal(session.snapshot().phase,'error');assert.equal(gym.snapshot().owner,null);assert.equal(finance.snapshot().data,null);
 assert.equal((await new LiveGymJournal(store).load(alex.id)).drafts[sessionId].fields[setId].reps,'8');assert.equal((await new LiveFinanceJournal(store).load(alex.id)).draft.amount,'0,10');
 mode='online';await session.restore();await ready();draft=gym.snapshot().journal.drafts[sessionId];assert.equal(draft.fields[setId].load,'15');
 evidence.push('offline raw input survives disk/controller recreation; offline startup stays locked until same-account server revalidation');
 stage='lost acknowledgments after two real commits';const actual=applyWorkoutFields(draft,setId);actual.data.status='completed';actual.data.finishedAt=new Date().toISOString();actual.data.completionMode='detailed';await gym.saveDraft(sessionId,workoutDraft(actual,draft.units.load,draft.units.distance));
 mode='lost-ack';await Promise.all([gym.submit({kind:'session',id:sessionId,revision:actual.revision,data:actual.data}),finance.submit(draftCommand(entryDraft),entryDraft.revision)]);
 const gymPending=gym.snapshot().journal.pending,financePending=finance.snapshot().journal.pending;assert.ok(gymPending);assert.ok(financePending);
 assert.equal((await sql.query('SELECT count(*)::int AS n FROM gym_sessions WHERE user_id=$1 AND id=$2',[alex.id,sessionId]))[0].n,1);assert.equal((await sql.query('SELECT count(*)::int AS n FROM finance_table WHERE user_id=$1 AND id=$2',[alex.id,entryDraft.id]))[0].n,1);
 session.suspend();gym.dispose();finance.dispose();session=makeSession();gym=new LiveGymController(session,store,randomUUID);finance=new LiveFinanceController(session,store,randomUUID);mode='online';await session.restore();await ready();
 assert.equal(gym.snapshot().journal.pending.operationId,gymPending.operationId);assert.equal(finance.snapshot().journal.pending.operationId,financePending.operationId);
 assert.ok(await gym.retry());assert.equal(await finance.retry(),true);
 const repeats=await Promise.all(Array.from({length:5},()=>Promise.all([raw('gym',alex,gymPending),raw('finance',alex,financePending)])));assert.ok(repeats.flat().every(r=>r.status===200));
 assert.equal((await sql.query('SELECT count(*)::int AS n FROM b1_mobile_gym_operations WHERE user_id=$1 AND operation_id=$2',[alex.id,gymPending.operationId]))[0].n,1);assert.equal((await sql.query('SELECT count(*)::int AS n FROM b1_mobile_finance_operations WHERE user_id=$1 AND operation_id=$2',[alex.id,financePending.operationId]))[0].n,1);
 evidence.push('lost real commit responses recover unchanged retry envelopes; five concurrent replays keep one receipt/session/transaction');
 stage='one canonical completion and web result';let confirmed=gym.snapshot().gym.sessions.find(s=>s.id===sessionId);assert.equal(confirmed.data.exercises[0].sets[0].reps,8);assert.equal(confirmed.data.exercises[0].sets[0].loadKg,draft.units.load==='lb'?15*0.45359237:15);assert.equal(confirmed.data.originalPlan.exercises[0].targets.loadKg,30);
 const events=await raw(`events?anchor=${date}`,alex),linked=events.json.data.items.filter(e=>e.plan?.id===planId);assert.equal(linked.length,1);assert.equal(linked[0].completed,true);
 assert.equal(sourceActivities({todo:[],weeks:[],gym:gym.snapshot().gym},'UTC').filter(a=>a.ref.kind==='workout'&&a.ref.id===planId&&a.status==='completed').length,1);
 for(const path of ['gym','finance']){const web=await fetch(`${origin}/account/${path}`,{headers:{Cookie:cookie(alex)},redirect:'manual',signal:AbortSignal.timeout(60000)});assert.equal(web.status,200);assert.match(await web.text(),new RegExp(run));}
 evidence.push('one completed linked Event/Momentum source, frozen planned targets and same real Gym/Finance web records');
 stage='cross-device stale writes';const originalFinish=confirmed.data.finishedAt;let localDraft=workoutDraft(confirmed,'kg','km');localDraft.base.data.notes='Retained native correction';await gym.saveDraft(sessionId,localDraft);
 const f=(await raw(`finance?currency=${entryDraft.currency}&category=${encodeURIComponent(entryDraft.category)}`,alex)).json.data,record=f.entries.find(e=>e.id===entryDraft.id);assert.ok(record);
 const localFinance={...entryDraft,create:false,revision:f.revision,comment:'Retained native finance correction'};await finance.saveDraft(localFinance);
 // Controlled writes to only this run's records model another web device.
 await sql.query("UPDATE gym_sessions SET data=jsonb_set(data,'{notes}',to_jsonb($1::text)),revision=revision+1,last_mutation=$2 WHERE user_id=$3 AND id=$4 AND revision=$5",['Web correction',randomUUID(),alex.id,sessionId,confirmed.revision]);
 await sql.query('UPDATE finance_table SET comment=$1 WHERE user_id=$2 AND id=$3',['Web finance correction',alex.id,entryDraft.id]);
 assert.equal(await gym.submit({kind:'session',id:sessionId,revision:confirmed.revision,data:localDraft.base.data}),null);assert.equal(await finance.submit(draftCommand(localFinance),f.revision),false);
 assert.ok(gym.snapshot().journal.pending);assert.ok(finance.snapshot().journal.pending);await gym.reload();await finance.reload();
 assert.equal(gym.snapshot().journal.drafts[sessionId].base.data.notes,'Retained native correction');assert.equal(finance.snapshot().journal.draft.comment,'Retained native finance correction');assert.equal(gym.snapshot().gym.sessions.find(s=>s.id===sessionId).data.finishedAt,originalFinish);
 assert.equal((await raw('gym',alex,gymPending)).json.data.gym.sessions.find(s=>s.id===sessionId).data.notes,'Web correction');assert.equal((await raw('finance',alex,financePending)).status,200);assert.equal((await raw(`finance?currency=${entryDraft.currency}&category=${encodeURIComponent(entryDraft.category)}`,alex)).json.data.entries.find(e=>e.id===entryDraft.id).comment,'Web finance correction');
 await gym.discardPending();await finance.discardPending();await gym.replaceDraftWithServer(sessionId);await finance.saveDraft(null);
 evidence.push('stale web revisions reject without losing both drafts; earlier receipts preserve newer history and completion time');
 stage='background/account switch with delayed responses';confirmed=gym.snapshot().gym.sessions.find(s=>s.id===sessionId);const latestFinance=(await raw(`finance?currency=${entryDraft.currency}&category=${encodeURIComponent(entryDraft.category)}`,alex)).json.data;
 mode='hold';held=[];const delayedGym=gym.submit({kind:'session',id:sessionId,revision:confirmed.revision,data:confirmed.data}),delayedFinance=finance.submit({kind:'entry',id:entryDraft.id,create:false,entry:{...draftCommand(localFinance).entry,comment:'Final synthetic correction'}},latestFinance.revision);
 await until(()=>held.length===2);await session.logout();assert.equal(session.snapshot().phase,'signed-out');assert.equal((await new LiveGymJournal(store).load(alex.id)).pending,null);assert.equal((await new LiveFinanceJournal(store).load(alex.id)).draft,null);
 current=robin;mode='online';await signIn(robin);await session.restore();await ready();held.forEach(done=>done());assert.equal(await delayedGym,null);assert.equal(await delayedFinance,false);assert.equal(gym.snapshot().owner,robin.id);assert.equal(gym.snapshot().gym.sessions.some(s=>s.id===sessionId),false);assert.equal(finance.snapshot().data.entries.some(e=>e.id===entryDraft.id),false);
 evidence.push('real logout clears both owned journals; delayed committed responses cannot expose Alex records to Robin');
 stage='expiry and remote revocation';await session.logout();current=alex;await signIn(alex);await session.restore();await ready();
 const expires=Date.parse(session.snapshot().account.user.expiresAt);clock=expires+1;await assert.rejects(()=>session.read('gym'));assert.equal(session.snapshot().phase,'signed-out');assert.equal(gym.snapshot().gym,null);assert.equal(finance.snapshot().data,null);
 clock=Date.now();await session.restore();await ready();await signOut(alex);await assert.rejects(()=>session.read('finance'));assert.equal(session.snapshot().phase,'signed-out');assert.equal(gym.snapshot().owner,null);assert.equal(finance.snapshot().owner,null);
 evidence.push('controlled session expiry and real remote revocation lock all feature state before rendering another account');
 stage='deletion tombstones and replay';await signIn(alex);const g=(await raw('gym',alex)).json.data,latest=g.sessions.find(s=>s.id===sessionId);await put('gym',alex,{kind:'archive',resource:'session',id:sessionId,revision:latest.revision});
 const fd=(await raw(`finance?currency=${entryDraft.currency}&category=${encodeURIComponent(entryDraft.category)}`,alex)).json.data;await put('finance',alex,{kind:'delete',id:entryDraft.id},fd.revision);
 assert.equal((await raw('gym',alex,gymPending)).json.data.gym.sessions.some(s=>s.id===sessionId),false);assert.equal((await raw('finance',alex,financePending)).status,200);assert.equal((await raw(`finance?currency=${entryDraft.currency}&category=${encodeURIComponent(entryDraft.category)}`,alex)).json.data.entries.some(e=>e.id===entryDraft.id),false);
 assert.equal((await raw('gym',alex,{operationId:randomUUID(),data:{kind:'start',id:randomUUID(),planId,data:null,date,timezone:'UTC',logged:false}})).status,409);
 evidence.push('explicit removal of only new synthetic records preserves tombstones; old receipts cannot resurrect sources');
 stage='provider outbox';const app=dotenv.parse(readFileSync(resolve(root,'.env'))),auditUrl=new URL(app.DATABASE_URL);assert.equal(auditUrl.hostname,new URL(local.QA_DATABASE_URL).hostname);auditUrl.pathname=`/${QA_DATABASE}`;const audit=neon(auditUrl.href);assert.equal((await audit.query('SELECT current_database() AS name'))[0].name,QA_DATABASE);await assertNoQaFeatureMail(audit,root,accounts);
 gym.dispose();finance.dispose();for(const message of evidence)console.log('PASS:',message);console.log(`PASS: ${evidence.length} combined real API/Neon recovery groups. Node disk/controller checks; native process/device acceptance remains pending. No existing fixture reset or production/provider action.`);
}
main().catch(error=>{console.error('Combined recovery stopped',{stage,code:error.code??null,assertionLine:error.code==='ERR_ASSERTION'?error.stack?.match(/check-mobile-recovery-integration\.mjs:(\d+):/)?.[1]??null:null,actualStatus:typeof error.actual==='number'?error.actual:null,expectedStatus:typeof error.expected==='number'?error.expected:null,reason:error.code?'Scoped QA check failed; no production/provider action.':error.message});process.exitCode=1;});
