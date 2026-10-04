// Real local API + restricted Neon QA. Additive synthetic Events only; no reset,
// cleanup, production queries, provider sends or native UI claims.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { verifyQaConnection } from './mobile-qa-connection.mjs';
import { moduleLoader } from '../../ud-mobile/tests/helpers.mjs';
import { qaFixturePath } from './mobile-qa-fixtures.mjs';
const root=resolve(import.meta.dirname,'..'),local=dotenv.parse(readFileSync(resolve(root,'.env.mobile-qa.local')));
if(local.QA_DATABASE_ISOLATED!=='true')throw Error('QA isolation assertion required.');
const accounts=JSON.parse(readFileSync(qaFixturePath(root,'fixture-accounts-phase3.json')));
const account=suffix=>accounts.find(a=>a.id.endsWith(`-${suffix}`));
const origin='http://localhost:3001',cookies=new Map(),evidence=[];
const load=moduleLoader(),{eventSnapshotSchema}=load(resolve(root,'../ud-mobile/src/domain/live-events.ts'));
let stage='configuration',observedStatuses=[];
function cookie(a){return [...(cookies.get(a.id)??[])].map(([k,v])=>`${k}=${v}`).join('; ');}
async function signIn(a){
 assert.ok(/^qa-mobile-[a-f0-9]{16}-(alex|robin|unverified|expired|no-legal)$/.test(a.id)&&a.email.endsWith('@example.invalid'));
 const r=await fetch(`${origin}/api/auth/sign-in/email`,{method:'POST',headers:{'content-type':'application/json','expo-origin':'udmobile://'},body:JSON.stringify({email:a.email,password:a.password}),signal:AbortSignal.timeout(60000)});
 assert.equal(r.status,200,'Real credential sign-in required');const jar=new Map();for(const line of r.headers.getSetCookie()){const pair=line.split(';')[0],i=pair.indexOf('=');jar.set(pair.slice(0,i),pair.slice(i+1));}cookies.set(a.id,jar);
 assert.equal((await r.json()).user.id,a.id);
}
async function raw(resource,a,body){const r=await fetch(`${origin}/api/mobile/v1/${resource}`,{method:body?'PUT':'GET',headers:{Cookie:cookie(a),'expo-origin':'udmobile://',...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)});let json;try{json=await r.json();}catch{json={error:{code:'invalid-response'}};}return {status:r.status,json};}
async function read(a,anchor){const r=await raw(`events?anchor=${anchor}`,a);assert.equal(r.status,200,`Events read: ${r.json.error?.code??''}`);return eventSnapshotSchema.parse(r.json.data);}
async function put(a,data,revision,operationId=randomUUID()){const body={operationId,revision,data},r=await raw('events',a,body);assert.equal(r.status,200,`Events write: ${r.json.error?.code??''}`);assert.equal(r.json.data.acknowledgedOperationId,operationId);return {snapshot:eventSnapshotSchema.parse(r.json.data),body};}
async function main(){
 stage='restricted connection';await verifyQaConnection(local.QA_DATABASE_URL);const sql=neon(local.QA_DATABASE_URL),alex=account('alex'),robin=account('robin');
 await signIn(alex);const run=randomUUID(),anchor='2035-01-02',destination='2035-01-16';let s=await read(alex,anchor);
 stage='manual event + durable retry';const event={id:randomUUID(),title:`QA Events ${run}`,completed:false,kind:'manual',timing:{start:'23:30',duration:90,overnight:true,reminderMinutes:30},notes:'Synthetic Phase 3 validation'};
 const body={operationId:randomUUID(),revision:s.revision,data:{kind:'upsert',anchor,sourceDate:null,date:anchor,event}};
 const concurrent=await Promise.all(Array.from({length:6},()=>raw('events',alex,body)));
 observedStatuses=concurrent.map(r=>({status:r.status,code:r.json.error?.code??null}));
 assert.ok(concurrent.some(r=>r.status===200));assert.ok(concurrent.every(r=>r.status===200||r.status===409));
 const created={body,snapshot:await read(alex,anchor)};s=created.snapshot;
 const retries=await Promise.all(Array.from({length:6},()=>raw('events',alex,created.body)));assert.ok(retries.every(r=>r.status===200));
 assert.equal((await sql.query('SELECT count(*)::int AS n FROM b1_mobile_event_operations WHERE user_id=$1 AND operation_id=$2',[alex.id,created.body.operationId]))[0].n,1);
 assert.equal((await read(alex,anchor)).items.filter(e=>e.id===event.id).length,1);evidence.push('real credential login; six competing creates plus six retries produce one event/receipt');
 stage='completion + cross-week move';s=(await put(alex,{kind:'complete',anchor,date:anchor,id:event.id,completed:true},s.revision)).snapshot;
 const completed=s.items.find(e=>e.id===event.id).manual;assert.ok(completed.completedAt);
 s=(await put(alex,{kind:'upsert',anchor,sourceDate:anchor,date:destination,event:{...completed,title:`${event.title} rescheduled`}},s.revision)).snapshot;
 assert.ok(!s.items.some(e=>e.id===event.id));let moved=await read(alex,destination);assert.equal(moved.items.find(e=>e.id===event.id).manual.completedAt,completed.completedAt);
 const stored=await sql.query('SELECT week,data FROM user_events WHERE user_id=$1',[alex.id]);assert.equal(stored.filter(row=>Array.isArray(row.data)&&row.data.some(d=>Array.isArray(d.tasks)&&d.tasks.some(e=>e.id===event.id))).length,1);
 const web=await fetch(`${origin}/account/events`,{headers:{Cookie:cookie(alex)},redirect:'manual',signal:AbortSignal.timeout(60000)});assert.equal(web.status,200);
 evidence.push('completion timestamp survives cross-week rescheduling; one shared canonical record and authenticated web page');
 stage='stale web edit + immutable receipts';const row=stored.find(row=>Array.isArray(row.data)&&row.data.some(d=>d.tasks?.some(e=>e.id===event.id))),webBoard=structuredClone(row.data);
 webBoard.flatMap(d=>d.tasks).find(e=>e.id===event.id).notes='Newer web-side synthetic edit';
 assert.equal((await sql.query('UPDATE user_events SET data=$1::jsonb WHERE user_id=$2 AND week=$3 AND data=$4::jsonb RETURNING id',[JSON.stringify(webBoard),alex.id,row.week,JSON.stringify(row.data)])).length,1);
 const stale=await raw('events',alex,{operationId:randomUUID(),revision:moved.revision,data:{kind:'complete',anchor:destination,date:destination,id:event.id,completed:false}});assert.equal(stale.status,409);
 assert.equal((await raw('events',alex,created.body)).status,200);assert.ok(!(await read(alex,anchor)).items.some(e=>e.id===event.id));
 moved=await read(alex,destination);assert.equal(moved.items.find(e=>e.id===event.id).manual.notes,'Newer web-side synthetic edit');
 assert.equal((await raw('events',alex,{...created.body,data:{...created.body.data,event:{...event,title:'Changed same-ID body'}}})).status,409);
 evidence.push('web-style CAS advances revision; stale writes reject; acknowledged replay never restores the old date/body');
 stage='event preset';moved=(await put(alex,{kind:'save-event-preset',anchor:destination,event:moved.items.find(e=>e.id===event.id).manual},moved.revision)).snapshot;
 const preset=moved.eventPresets.find(e=>e.title===`${event.title} rescheduled`);assert.equal(preset.completed,false);assert.equal(preset.completedAt,null);
 const cloneId=randomUUID();moved=(await put(alex,{kind:'apply-event-preset',anchor:destination,date:destination,preset,eventId:cloneId},moved.revision)).snapshot;
 assert.equal(moved.items.find(e=>e.id===cloneId).completed,false);evidence.push('event presets preserve timing/notes and reset actual attendance');
 stage='linked Gym schedule';const {exerciseLibrary}=load(resolve(root,'lib/gym/library.ts')),definition=exerciseLibrary.find(e=>e.id==='push-up');
 const planId=randomUUID(),blueprint={name:`QA linked Gym ${run}`,notes:'Synthetic plan',estimatedMinutes:null,exercises:[{id:randomUUID(),definition,targets:{sets:1,reps:8,loadKg:null,seconds:null,distanceKm:null,restSeconds:null},notes:''}]};
 await sql.query('INSERT INTO gym_plans(id,user_id,date,timezone,data,last_mutation) VALUES($1,$2,$3,$4,$5::jsonb,$6)',[planId,alex.id,destination,'UTC',JSON.stringify(blueprint),randomUUID()]);
 moved=await read(alex,destination);assert.equal(moved.items.filter(e=>e.plan?.id===planId).length,1);
 const rescheduled=await put(alex,{kind:'reschedule-workout',anchor:destination,id:planId,revision:0,date:'2035-01-18',timezone:'UTC',timing:{start:'08:00',duration:45,overnight:false}},moved.revision);
 assert.equal(rescheduled.snapshot.gym.plans.find(p=>p.id===planId).date,'2035-01-18');assert.equal((await raw('events',alex,rescheduled.body)).status,200);
 assert.equal((await sql.query('SELECT revision FROM gym_plans WHERE id=$1 AND user_id=$2',[planId,alex.id]))[0].revision,1);
 assert.equal((await raw('events',alex,{operationId:randomUUID(),revision:rescheduled.snapshot.revision,data:{...rescheduled.body.data,date:'2035-01-19'}})).status,409);
 moved=await read(alex,destination);evidence.push('linked Gym rescheduling uses canonical plan revision/timezone; retry saves once and stale plan changes reject');
 stage='week preset';if(moved.presets.length>=3)throw Error('Existing Phase 3 preset slots are full; preserve them and use a new synthetic fixture set.');
 moved=(await put(alex,{kind:'save-week-preset',anchor:destination,id:randomUUID(),name:`QA ${run}`},moved.revision)).snapshot;
 const week=moved.presets.find(p=>p.name===`QA ${run}`),bootstrap=await raw('bootstrap',alex),prefs=bootstrap.json.settings.preferences;
 const applied=await put(alex,{kind:'apply-week-preset',anchor:'2035-02-06',id:week.id,board:week.board,weekStart:prefs.weekStart,timezone:prefs.timezone},moved.revision);
 assert.ok(applied.snapshot.items.length>=2);assert.ok(applied.snapshot.items.every(e=>!e.completed));
 const copiedPlans=applied.snapshot.gym.plans.filter(p=>p.date>='2035-02-05'&&p.date<='2035-02-11'&&p.data.name===blueprint.name);assert.equal(copiedPlans.length,1);assert.deepEqual(JSON.parse(JSON.stringify(copiedPlans[0].data.exercises)),JSON.parse(JSON.stringify(blueprint.exercises)));
 assert.equal((await raw('events',alex,applied.body)).status,200);assert.equal((await read(alex,'2035-02-06')).items.length,applied.snapshot.items.length);
 evidence.push('named week presets append manual and canonical Gym occurrences; replay preserves count and planned targets');
 stage='direct guards + account isolation';await signIn(robin);assert.ok(!(await read(robin,destination)).items.some(e=>e.id===event.id));assert.equal((await raw(`events?anchor=${destination}&userId=${alex.id}`,robin)).status,400);
 for(const [suffix,code]of[['unverified','verification'],['expired','membership']]){const a=account(suffix);await signIn(a);const denied=await raw('events',a,{operationId:randomUUID(),revision:0,data:{kind:'upsert',anchor,sourceDate:null,date:anchor,event}});assert.equal(denied.status,403);assert.equal(denied.json.error.code,code);}
 const ordinary=account('no-legal');await signIn(ordinary);const ordinaryState=await read(ordinary,anchor);
 await put(ordinary,{kind:'upsert',anchor,sourceDate:null,date:anchor,event:{...event,id:randomUUID()}},ordinaryState.revision);
 for(const page of ['terms','privacy']){const response=await fetch(`${origin}/${page}`,{signal:AbortSignal.timeout(60000)});assert.equal(response.status,200);assert.match(await response.text(),/ManForth/);}
 evidence.push('ownership, verification and membership guards hold; verified trial account needs no acceptance history; public policies render');
 for(const message of evidence)console.log('PASS:',message);console.log(`PASS: ${evidence.length} real Events API/Neon groups. Native device acceptance is pending; earlier fixtures preserved.`);
}
main().catch(error=>{console.error('Events integration stopped',{stage,code:error.code??null,observedStatuses,reason:error.code?'Scoped QA check failed; no guard or fixture was reset.':error.message});process.exitCode=1;});
