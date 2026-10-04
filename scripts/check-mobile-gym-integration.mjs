import {assertNoQaFeatureMail} from './mobile-qa-mail-audit.mjs';
// Real local HTTP + restricted Neon QA, with a separate labelled fixture set.
// Local recovery uses an ignored disk journal here; native SQLite/UI remain unverified.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import {neon} from '@neondatabase/serverless';
import {verifyQaConnection,QA_DATABASE} from './mobile-qa-connection.mjs';
import {qaFixturePath} from './mobile-qa-fixtures.mjs';
import {moduleLoader} from '../../ud-mobile/tests/helpers.mjs';
const root=resolve(import.meta.dirname,'..'),local=dotenv.parse(readFileSync(resolve(root,'.env.mobile-qa.local')));
if(local.QA_DATABASE_ISOLATED!=='true')throw Error('QA isolation assertion required.');
const accounts=JSON.parse(readFileSync(qaFixturePath(root,'fixture-accounts-phase3-gym.json'))),account=suffix=>accounts.find(a=>a.id.endsWith(`-${suffix}`));
const origin='http://localhost:3001',cookies=new Map(),evidence=[],load=moduleLoader();
const {gymDataSchema,apiTransport,ApiError}=load(resolve(root,'../ud-mobile/src/services/mobile-contract.ts'));
const {SessionController}=load(resolve(root,'../ud-mobile/src/services/session-controller.ts'));
const {LiveGymController}=load(resolve(root,'../ud-mobile/src/services/live-gym-controller.ts'));
const {applyWorkoutFields}=load(resolve(root,'../ud-mobile/src/domain/live-workout.ts'));
const {sourceActivities}=load(resolve(root,'lib/momentum/logic.ts'));
let stage='configuration';
function cookie(a){return [...(cookies.get(a.id)??[])].map(([k,v])=>`${k}=${v}`).join('; ');}
async function signIn(a){
 assert.ok(/^qa-mobile-[a-f0-9]{16}-(alex|robin|unverified|expired|no-legal)$/.test(a.id)&&a.email.endsWith('@example.invalid'));
 const response=await fetch(`${origin}/api/auth/sign-in/email`,{method:'POST',headers:{'content-type':'application/json','expo-origin':'udmobile://'},body:JSON.stringify({email:a.email,password:a.password}),signal:AbortSignal.timeout(60000)});
 assert.equal(response.status,200,'Real shared-account credential sign-in');const jar=new Map();for(const line of response.headers.getSetCookie()){const pair=line.split(';')[0],i=pair.indexOf('=');jar.set(pair.slice(0,i),pair.slice(i+1));}cookies.set(a.id,jar);assert.equal((await response.json()).user.id,a.id);
}
async function raw(path,a,body){const response=await fetch(`${origin}/api/mobile/v1/${path}`,{method:body?'PUT':'GET',headers:{Cookie:cookie(a),'expo-origin':'udmobile://',...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)});let json;try{json=await response.json();}catch{json={error:{code:'invalid-response'}};}return {status:response.status,json};}
async function put(a,data,operationId=randomUUID()){const body={operationId,data},response=await raw('gym',a,body);assert.equal(response.status,200,`Gym command ${data.kind}: ${response.json.error?.code??''}`);assert.equal(response.json.data.acknowledgedOperationId,operationId);gymDataSchema.parse(response.json.data.gym);return {body,...response.json.data};}
async function ready(controller){await new Promise((done,reject)=>{const timer=setTimeout(()=>{unsubscribe();reject(Error('Gym restore timeout'));},60000);const check=()=>{const state=controller.snapshot();if(state.journal&&!state.busy&&state.gym){clearTimeout(timer);unsubscribe();done();}};const unsubscribe=controller.subscribe(check);check();});}
async function main(){
 stage='real QA connection';await verifyQaConnection(local.QA_DATABASE_URL);const sql=neon(local.QA_DATABASE_URL),alex=account('alex'),robin=account('robin');await signIn(alex);
 stage='catalogue and plans';const library=await raw('gym-library',alex);assert.equal(library.status,200);assert.ok(library.json.data.exercises.length>26);assert.ok(library.json.data.presets.length);
 const definition=library.json.data.exercises.find(e=>e.tracking==='reps'),date=new Date().toISOString().slice(0,10),run=randomUUID();
 const blueprint={name:`QA Gym ${run}`,notes:'Isolated synthetic training',estimatedMinutes:30,timing:{start:'08:00',duration:30,overnight:false},exercises:[{id:randomUUID(),definition,targets:{sets:1,reps:20,loadKg:null,seconds:null,distanceKm:null,restSeconds:60},notes:''}]};
 const template=await put(alex,{kind:'template',id:randomUUID(),revision:null,data:blueprint});assert.ok(template.gym.templates.some(t=>t.id===template.result.id));
 const planId=randomUUID(),plan=await put(alex,{kind:'plan',id:planId,revision:null,date,timezone:'UTC',data:blueprint});
 const replayPlans=await Promise.all(Array.from({length:4},()=>raw('gym',alex,plan.body)));assert.ok(replayPlans.every(r=>r.status===200));
 assert.equal((await sql.query('SELECT count(*)::int AS n FROM gym_plans WHERE user_id=$1 AND id=$2',[alex.id,planId]))[0].n,1);
 evidence.push('real catalogue/draft presets, reusable template and dated plan; four retries preserve one plan');
 stage='custom exercise and rest day';const customId=randomUUID();
 const custom=await put(alex,{kind:'exercise',id:customId,revision:null,data:{...definition,id:customId,name:`QA custom ${run}`,catalogueId:undefined}});
 const editedCustom=await put(alex,{kind:'exercise',id:customId,revision:0,data:{...custom.gym.customExercises.find(e=>e.id===customId).data,description:'Synthetic custom correction'}});
 assert.equal(editedCustom.gym.customExercises.find(e=>e.id===customId).data.description,'Synthetic custom correction');
 const restDate='2035-11-28',hadRest=editedCustom.gym.restDays.includes(restDate);
 const rest=await put(alex,{kind:'rest',date:restDate,timezone:'UTC',rest:!hadRest,previous:hadRest});
 assert.equal(rest.gym.restDays.includes(restDate),!hadRest);assert.equal((await raw('gym',alex,rest.body)).status,200);
 await put(alex,{kind:'rest',date:restDate,timezone:'UTC',rest:hadRest,previous:!hadRest});
 evidence.push('custom exercise create/edit uses real canonical data; rest-day change and same-ID retry preserve existing state');
 stage='session start and snapshot';const started=await put(alex,{kind:'start',id:randomUUID(),planId,data:null,date,timezone:'UTC',logged:false});const sessionId=started.result.id;
 const second=await put(alex,{kind:'start',id:randomUUID(),planId,data:null,date,timezone:'UTC',logged:false});assert.equal(second.result.id,sessionId);
 const base=started.gym.sessions.find(s=>s.id===sessionId);assert.equal(base.data.exercises[0].sets[0].reps,null);assert.equal(base.data.exercises[0].planned.reps,20);
 const editTemplate=await put(alex,{kind:'template',id:template.result.id,revision:0,data:{...blueprint,name:'Changed reusable template',exercises:blueprint.exercises.map(e=>({...e,targets:{...e.targets,reps:99}}))}});
 assert.equal(editTemplate.gym.sessions.find(s=>s.id===sessionId).data.originalPlan.exercises[0].targets.reps,20);
 evidence.push('two distinct starts produce one session; actuals begin blank; template changes preserve original history');
 stage='local disk recovery and shared session restoration';let current=alex,offline=false;
 const transport=apiTransport(origin,async()=>cookie(current));
 const session=new SessionController({newId:randomUUID,restore:()=>transport('bootstrap'),signIn:async()=>{},signOut:async()=>{const response=await fetch(`${origin}/api/auth/sign-out`,{method:'POST',headers:{Cookie:cookie(current),'expo-origin':'udmobile://','content-type':'application/json'},body:'{}'});assert.equal(response.status,200);cookies.delete(current.id);},request:async(path,options)=>{if(offline&&path==='gym'&&options?.body)throw new ApiError(0,'unavailable','Controlled offline connection');return transport(path,options);}});
 await session.restore();assert.equal(session.snapshot().account.user.id,alex.id);assert.equal(session.snapshot().account.settings.preferences.timezone.length>0,true);
 const journalPath=resolve(root,'.mobile-dev',`gym-recovery-${run}.json`),store={async getItem(key){return existsSync(journalPath)?JSON.parse(readFileSync(journalPath))[key]??null:null;},async setItem(key,value){const map=existsSync(journalPath)?JSON.parse(readFileSync(journalPath)):{};map[key]=value;writeFileSync(journalPath,JSON.stringify(map),{mode:0o600});}};
 let controller=new LiveGymController(session,store,randomUUID);await ready(controller);let draft=await controller.openSession(sessionId);const setId=draft.base.data.exercises[0].sets[0].id;draft.fields[setId].reps='8';await controller.saveDraft(sessionId,draft);controller.dispose();
 controller=new LiveGymController(session,store,randomUUID);await ready(controller);draft=controller.snapshot().journal.drafts[sessionId];assert.equal(draft.fields[setId].reps,'8');
 const actual=applyWorkoutFields(draft,setId);actual.data.status='completed';actual.data.finishedAt=new Date().toISOString();actual.data.completionMode='detailed';
 offline=true;assert.equal(await controller.submit({kind:'session',id:sessionId,revision:actual.revision,data:actual.data}),null);const pending=controller.snapshot().journal.pending;assert.ok(pending);controller.dispose();
 offline=false;controller=new LiveGymController(session,store,randomUUID);await ready(controller);assert.equal(controller.snapshot().journal.pending.operationId,pending.operationId);assert.ok(await controller.retry());assert.equal(controller.snapshot().journal.pending,null);
 const repeated=await Promise.all(Array.from({length:5},()=>raw('gym',alex,pending)));assert.ok(repeated.every(r=>r.status===200));
 let gym=controller.snapshot().gym;const completed=gym.sessions.find(s=>s.id===sessionId);assert.equal(completed.data.status,'completed');assert.equal(completed.data.exercises[0].sets[0].reps,8);assert.equal(completed.data.originalPlan.exercises[0].targets.reps,20);
 assert.equal((await sql.query('SELECT count(*)::int AS n FROM b1_mobile_gym_operations WHERE user_id=$1 AND operation_id=$2',[alex.id,pending.operationId]))[0].n,1);
 evidence.push('real bootstrap restoration; disk draft/retry recovery; controlled offline send then reconnect acknowledges one completed session');
 stage='linked Events, Momentum and authenticated web';const events=await raw(`events?anchor=${date}`,alex);assert.equal(events.status,200);const linked=events.json.data.items.filter(e=>e.plan?.id===planId);assert.equal(linked.length,1);assert.equal(linked[0].completed,true);assert.equal(linked[0].session.id,sessionId);
 const sources={todo:[],weeks:[],gym};assert.equal(sourceActivities(sources,'UTC').filter(a=>a.ref.kind==='workout'&&a.ref.id===planId&&a.status==='completed').length,1);
 const web=await fetch(`${origin}/account/gym?session=${sessionId}`,{headers:{Cookie:cookie(alex)},redirect:'manual',signal:AbortSignal.timeout(60000)});assert.equal(web.status,200);assert.match(await web.text(),new RegExp(run));
 evidence.push('one canonical completed Event and Momentum source; authenticated web renders the same synthetic workout');
 stage='history correction and stale web conflict';const finishedAt=completed.data.finishedAt;const correction=structuredClone(completed.data);correction.notes='Synthetic correction';const corrected=await put(alex,{kind:'session',id:sessionId,revision:completed.revision,data:correction});assert.equal(corrected.gym.sessions.find(s=>s.id===sessionId).data.finishedAt,finishedAt);
 const stale=corrected.gym.sessions.find(s=>s.id===sessionId);await sql.query('UPDATE gym_sessions SET data=jsonb_set(data,\'{notes}\',to_jsonb($1::text)),revision=revision+1,last_mutation=$2 WHERE user_id=$3 AND id=$4 AND revision=$5',['Controlled newer web edit',randomUUID(),alex.id,sessionId,stale.revision]);
 assert.equal((await raw('gym',alex,{operationId:randomUUID(),data:{kind:'session',id:sessionId,revision:stale.revision,data:stale.data}})).status,409);
 assert.equal((await raw('gym',alex,pending)).status,200);const latest=gymDataSchema.parse((await raw('gym',alex)).json.data).sessions.find(s=>s.id===sessionId);assert.equal(latest.data.notes,'Controlled newer web edit');
 evidence.push('history correction retains completion time; stale web revisions reject; old acknowledgment never overwrites newer actual history');
 stage='explicit reopen and finish';const reopened=await put(alex,{kind:'reopen',id:sessionId,revision:latest.revision});const active=reopened.gym.sessions.find(s=>s.id===sessionId);assert.equal(active.data.status,'active');assert.equal(active.data.finishedAt,null);
 const refinish=await put(alex,{kind:'session',id:sessionId,revision:active.revision,data:{...active.data,status:'completed',finishedAt:new Date().toISOString(),completionMode:'detailed'}});
 const finalRecord=refinish.gym.sessions.find(s=>s.id===sessionId);assert.equal(finalRecord.data.originalPlan.exercises[0].targets.reps,20);
 evidence.push('explicit reopen and renewed finish retain original targets and one session/occurrence');
 stage='ownership and access';await signIn(robin);assert.equal((await raw('gym',robin,{operationId:randomUUID(),data:{kind:'session',id:sessionId,revision:latest.revision,data:latest.data}})).status,409);
 for(const [suffix,code] of [['unverified','verification'],['expired','membership']]){const a=account(suffix);await signIn(a);const denied=await raw('gym',a,{operationId:randomUUID(),data:{kind:'plan',id:randomUUID(),revision:null,date,timezone:'UTC',data:blueprint}});assert.equal(denied.status,403);assert.equal(denied.json.error.code,code);}
 await session.logout();assert.equal(controller.snapshot().owner,null);current=robin;await session.restore();await ready(controller);assert.equal(controller.snapshot().gym.sessions.some(s=>s.id===sessionId),false);assert.equal(Object.keys(controller.snapshot().journal.drafts).length,0);controller.dispose();
 evidence.push('direct ownership/verification/member guards hold; real sign-out and Robin restoration expose no Alex journal or records');
 stage='canonical expired active-session completion exception';
 const completionChoice=process.argv.find(arg=>arg.startsWith('--completion-fixture-set='));
 const completionSet=completionChoice?.slice('--completion-fixture-set='.length);
 const expired=completionSet?JSON.parse(readFileSync(qaFixturePath(root,'unused.json',[`--fixture-set=${completionSet}`]))).find(a=>a.id.endsWith('-expired')):account('expired');
 await signIn(expired);
 const membership=(await sql.query("SELECT trial_ends_at FROM b1_memberships WHERE user_id=$1 AND product='b1-way-personal'",[expired.id]))[0];
 const created=new Date(Date.parse(membership.trial_ends_at)-86400000).toISOString(),expiredId=randomUUID();
 const activeFixture={...base.data,name:`QA eligible prior active ${run}`,date:created.slice(0,10),status:'active',startedAt:created,finishedAt:null,originalPlan:null,exercises:base.data.exercises.map(e=>({...e,planned:null,sets:e.sets.map(s=>({...s,completed:false,reps:null,loadKg:null,seconds:null}))}))};
 await sql.query('INSERT INTO gym_sessions(id,user_id,plan_id,data,last_mutation,created_at) VALUES($1,$2,NULL,$3::jsonb,$4,$5::timestamp)',[expiredId,expired.id,JSON.stringify(activeFixture),randomUUID(),created]);
 const actualFixture={...activeFixture,status:'completed',completionMode:'detailed',finishedAt:new Date().toISOString(),exercises:activeFixture.exercises.map(e=>({...e,sets:e.sets.map(s=>({...s,reps:8,completed:true}))}))};
 const withinGrace=Date.now()<Date.parse(membership.trial_ends_at)+86400000;
 if(completionSet){assert.equal(withinGrace,true,'The separate completion fixture must be within the canonical 24-hour window. Seed a fresh named fixture; do not reset the old trial.');const allowed=await put(expired,{kind:'session',id:expiredId,revision:0,data:actualFixture});assert.equal((await raw('gym',expired,allowed.body)).status,200);assert.equal((await raw('gym',expired,{operationId:randomUUID(),data:{kind:'reopen',id:expiredId,revision:1}})).status,403);}
 else assert.equal((await raw('gym',expired,{operationId:randomUUID(),data:{kind:'session',id:expiredId,revision:0,data:actualFixture}})).status,403);
 evidence.push(completionSet?'within 24 hours of finite trial expiry, one prior active session completes/retries; reopening/new activity still rejects':'beyond the canonical 24-hour window, even a prior active session remains read-only');
 stage='deletion replay';await signIn(alex);const archive=await put(alex,{kind:'archive',resource:'session',id:sessionId,revision:finalRecord.revision});assert.equal(archive.gym.sessions.some(s=>s.id===sessionId),false);
 const replay=await raw('gym',alex,pending);assert.equal(replay.status,200);assert.equal(replay.json.data.gym.sessions.some(s=>s.id===sessionId),false);
 assert.equal((await raw('gym',alex,{operationId:randomUUID(),data:{kind:'start',id:randomUUID(),planId,data:null,date,timezone:'UTC',logged:false}})).status,409);
 const application=dotenv.parse(readFileSync(resolve(root,'.env'))),auditUrl=new URL(application.DATABASE_URL);
 assert.equal(auditUrl.hostname,new URL(local.QA_DATABASE_URL).hostname);auditUrl.pathname=`/${QA_DATABASE}`;
 const audit=neon(auditUrl.href);assert.equal((await audit.query('SELECT current_database() AS name'))[0].name,QA_DATABASE);
 await assertNoQaFeatureMail(audit,root,accounts);
 evidence.push('archive tombstone blocks replay/resurrection and new starts of a removed occurrence; this feature queues no fixture mail or external provider delivery');
 for(const message of evidence)console.log('PASS:',message);console.log(`PASS: ${evidence.length} real Gym API/Neon groups; native device/SQLite checks remain pending. Previous fixtures and production are untouched.`);
}
main().catch(error=>{console.error('Gym integration stopped',{stage,code:error.code??null,actualStatus:typeof error.actual==='number'?error.actual:null,expectedStatus:typeof error.expected==='number'?error.expected:null,reason:error.code?'Scoped QA check failed; no production or provider action.':error.message});process.exitCode=1;});
