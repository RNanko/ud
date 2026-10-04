import 'server-only';
import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { accountSettings,accountSql } from '../account/store';
import { assertProductWrite } from '../account/access';
import { afterNotificationSourceChange } from '../notifications/store';
import { getMomentumBundle,getMomentumSources } from '../actions/momentum.actions';
import { addAwards,buildSummary,sourceActivities } from '../momentum/logic';
import { reduceMomentum } from '../momentum/reducer';
import { reconcileGoals } from '../momentum/goals/reconcile';
import { goalReview } from '../momentum/goals/review';
import { trackerFor,reminderDue } from '../momentum/goals/evaluate';
import { validateCollections } from '../momentum/validation';
import { weekStart } from '../calendar';
import { dateInZone } from '../gym/dates';
import { MobileError } from './http';
import { momentumIdentity,momentumQuerySchema,momentumWriteSchema } from './momentum-contract';
import type { MomentumCommand } from '../momentum/validation';
import type { MomentumData } from '../momentum/types';
const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)])):value;
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const completion=(command:MomentumCommand)=>command.type==='focus-save'||command.type==='focus-control'&&['finish','discard'].includes(command.action)?{kind:'focus' as const,id:command.id}:undefined;
const conflict=()=>new MobileError(409,'conflict','Newer Momentum changes exist or this record was removed. Your input is retained. Reload and review before replacing it.');
export async function authorizeMomentumWrite(owner:string,input:unknown){
 const payload=momentumWriteSchema.parse(input),[receipt]=await accountSql`SELECT fingerprint FROM b1_mobile_momentum_operations WHERE user_id=${owner} AND operation_id=${payload.operationId}::uuid`;
 if(receipt?.fingerprint===hash(payload))return;
 try{await assertProductWrite(owner,completion(payload.command));}catch{throw new MobileError(403,'membership','Your current access does not permit this Momentum change. Eligible active focus may be finished; saved records remain available.');}
}
export async function readMobileMomentum(owner:string,query:unknown){
 const {week}=momentumQuerySchema.parse(query??{}),settings=await accountSettings(owner),summaryWeek=week??weekStart(dateInZone(new Date(),settings.preferences.timezone),settings.preferences.weekStart),bundle=await getMomentumBundle({timezone:settings.preferences.timezone,week:summaryWeek});
 validateCollections(bundle.record.data);
 if(bundle.activities.length>5000)throw new MobileError(503,'unavailable','This history requires a larger view. Open Momentum on the website; no partial counts are shown.');
 const serverNow=new Date().toISOString(),focus=bundle.record.data.focus.find(f=>['running','paused','awaiting'].includes(f.status));let canFinishFocus=false;
 if(focus)try{await assertProductWrite(owner,{kind:'focus',id:focus.id});canFinishFocus=true;}catch{/* Server-owned limited completion eligibility. */}
 return {...bundle,summaryWeek,serverNow,canFinishFocus,reminders:trackerFor(bundle.record.data).goals.flatMap(goal=>{const evaluation=bundle.goalEvaluations.find(e=>e.goalId===goal.id);const key=evaluation&&reminderDue(goal,evaluation,trackerFor(bundle.record.data),serverNow);return key?[{goalId:goal.id,key}]:[];})};
}
export async function writeMobileMomentum(owner:string,input:unknown){
 const payload=momentumWriteSchema.parse(input),fingerprint=hash(payload),[receipt]=await accountSql`SELECT fingerprint,acknowledged_revision::text AS revision FROM b1_mobile_momentum_operations WHERE user_id=${owner} AND operation_id=${payload.operationId}::uuid`;
 if(receipt){if(receipt.fingerprint!==fingerprint)throw conflict();return {acknowledgedOperationId:payload.operationId,revision:Number(receipt.revision)};}
 const [row]=await accountSql`SELECT data,revision FROM momentum_state WHERE user_id=${owner}`;
 if(!row||row.revision!==payload.revision)throw conflict();
 const identity=momentumIdentity(payload.command);
 if(identity&&(!payload.intent||payload.intent==='create'&&!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(identity.id)))throw new MobileError(400,'invalid','Choose an explicit create or edit intent with a new stable identifier.');
 if(!identity&&payload.intent)throw new MobileError(400,'invalid','This action does not create a record.');
 const settings=await accountSettings(owner),timezone=settings.preferences.timezone,now=new Date().toISOString(),sources=await getMomentumSources(owner),activities=sourceActivities(sources,timezone);
 let data:MomentumData;
 try{
  data=reduceMomentum(row.data,payload.command,{date:dateInZone(new Date(now),timezone),timezone,now,activities,summaryFor:week=>({...buildSummary(sources,activities,row.data,week,timezone,now),goalResults:goalReview(row.data,{...sources,activities},week,timezone,now)})});
  data=reconcileGoals(addAwards(data,activities,now),{...sources,activities},now);validateCollections(data);
 }catch(error){if(error instanceof Error&&/^(Choose|Source|Finish|This focus|Confirm|Correct|Pause|Create|An allocation|Newer|Retry|Use|Enter)/.test(error.message))throw new MobileError(400,'invalid',error.message);throw error;}
 const [saved]=await accountSql`SELECT b1_mobile_save_momentum(${owner},${payload.operationId}::uuid,${fingerprint},${payload.revision},${JSON.stringify(data)}::jsonb,${identity?.collection??null},${identity?.id??null},${payload.intent==='create'}) AS result`;
 if(['conflict','operation-reused'].includes(saved?.result?.outcome))throw conflict();
 if(saved?.result?.outcome==='unauthorized')throw new MobileError(401,'session','Sign in again.');
 if(!['saved','duplicate'].includes(saved?.result?.outcome))throw Error('Momentum not acknowledged');
 await afterNotificationSourceChange(owner);revalidatePath('/account/momentum');
 return {acknowledgedOperationId:payload.operationId,revision:Number(saved.result.revision)};
}
