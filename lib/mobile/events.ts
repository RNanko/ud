import "server-only";
import { createHash } from "node:crypto";
import { revalidateTag, revalidatePath } from "next/cache";
import { z } from "zod";
import { accountSql, accountSettings } from "../account/store";
import { afterNotificationSourceChange } from "../notifications/store";
import { boardSchema, eventSchema, weekdays, weekKey, resetPreset, placeManual, plannerItems } from "../events";
import { weekDates } from "../gym/dates";
import { getGymData, scheduleGymWorkout, editGymPlanSchedule } from "../actions/gym.actions";
import { getNamedWeekPresets } from "../actions/planner.actions";
import { eventWriteSchema } from "./event-contract";
import { MobileError } from "./http";
import type { EventItem, EventItems } from "@/types/types";

type Row={week:string;data:unknown};
type Patch={week:string;before:unknown;data:unknown};
const stableId=(value:string)=>{const h=createHash("sha256").update(value).digest("hex");return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;};
function canonical(value:unknown):unknown{return Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)])):value;}
const fingerprint=(value:unknown)=>createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
const conflict=()=>new MobileError(409,"conflict","Newer event changes exist. Your entered values are retained; reload and review before saving.");
async function revision(owner:string){const rows=await accountSql`SELECT revision::text FROM b1_mobile_event_versions WHERE user_id=${owner}`;const value=Number(rows[0]?.revision??0);if(!Number.isSafeInteger(value))throw new MobileError(503,"unavailable","Calendar revision requires review.");return value;}
async function rows(owner:string,keys:string[]){return await accountSql`SELECT week,data FROM user_events WHERE user_id=${owner} AND week=ANY(${keys})` as Row[];}
async function existingOccurrence(owner:string,id:string){return (await accountSql`SELECT 1 FROM user_events WHERE user_id=${owner} AND week ~ '^[0-9]{4}-WK[0-9]+$' AND data @> ${JSON.stringify([{tasks:[{id}]}])}::jsonb LIMIT 1`).length>0;}
function boardFor(stored:Row[],dates:string[]):EventItems[]{return dates.map(date=>{const day=weekdays[(new Date(`${date}T12:00:00Z`).getUTCDay()+6)%7],row=stored.find(row=>row.week===weekKey(date));return {id:day.toLowerCase(),day,tasks:row?boardSchema.parse(row.data).find(container=>container.day===day)?.tasks??[]:[]};});}
export async function readMobileEvents(owner:string,anchor:string){
 for(let attempt=0;attempt<3;attempt++){
  const before=await revision(owner),settings=await accountSettings(owner),dates=weekDates(anchor,settings.preferences.weekStart);
  const [stored,gym,presets,eventRows]=await Promise.all([rows(owner,[...new Set(dates.map(weekKey))]),getGymData(),getNamedWeekPresets(),rows(owner,["event-presets"])]);
  const after=await revision(owner);if(before!==after)continue;
  const board=boardFor(stored,dates),eventPresets=z.array(eventSchema).max(100).parse(eventRows[0]?.data??[]);
  return {anchor,revision:after,dates,board,gym,presets,eventPresets,items:plannerItems(board,gym,anchor,settings.preferences.weekStart)};
 }
 throw conflict();
}
export async function writeMobileEvents(owner:string,input:unknown){
 const payload=eventWriteSchema.parse(input),command=payload.data;
 const receipt=await accountSql`SELECT fingerprint FROM b1_mobile_event_operations WHERE user_id=${owner} AND operation_id=${payload.operationId}::uuid`;
 if(receipt.length&&receipt[0].fingerprint!==fingerprint(payload))throw conflict();
 const settings=await accountSettings(owner),dates=weekDates(command.anchor,command.kind==="apply-week-preset"?command.weekStart:settings.preferences.weekStart);
 const training:{date:string;data:NonNullable<EventItem["workout"]>}[]=[];
 if(command.kind==="apply-week-preset")for(const day of command.board)for(const event of day.tasks)if(event.kind==="training"&&event.workout)training.push({date:dates.find(date=>weekdays[(new Date(`${date}T12:00:00Z`).getUTCDay()+6)%7]===day.day)!,data:{...event.workout,timing:event.timing}});
 if(!receipt.length){
  if(await revision(owner)!==payload.revision)throw conflict();
  const keys=new Set(dates.map(weekKey));
  if('sourceDate' in command&&command.sourceDate)keys.add(weekKey(command.sourceDate));
  if('date' in command)keys.add(weekKey(command.date));
  if(command.kind==="save-event-preset")keys.add("event-presets");
  if(command.kind==="save-week-preset")keys.add("week-presets");
  const stored=await rows(owner,[...keys]),patches=new Map<string,Patch>();
  const patch=(week:string)=>{let p=patches.get(week);if(!p){const row=stored.find(row=>row.week===week);p={week,before:row?.data??null,data:structuredClone(row?.data??[])};patches.set(week,p);}return p;};
  const board=(week:string)=>boardSchema.parse(patch(week).data) as EventItems[];
  const find=(date:string,id:string)=>board(weekKey(date)).find(day=>day.day===weekdays[(new Date(`${date}T12:00:00Z`).getUTCDay()+6)%7])?.tasks.find(event=>event.id===id);
  if(command.kind==="upsert"){
   const old=command.sourceDate?find(command.sourceDate,command.event.id):null;
   if(command.sourceDate&&!old)throw conflict();
   if(old&&(old.kind==="training"||old.workout))throw new MobileError(400,"invalid","Use Gym for workout records.");
   if(old&&command.sourceDate&&weekKey(command.sourceDate)!==weekKey(command.date)&&board(weekKey(command.date)).some(day=>day.tasks.some(event=>event.id===command.event.id)))throw conflict();
   if(!old&&await existingOccurrence(owner,command.event.id))throw conflict();
   if(command.sourceDate){const p=patch(weekKey(command.sourceDate));p.data=board(weekKey(command.sourceDate)).map(day=>({...day,tasks:day.tasks.filter(e=>e.id!==command.event.id)}));}
   const event={...command.event,completed:old?.completed??false,completedAt:old?.completedAt??null};
   patch(weekKey(command.date)).data=placeManual(board(weekKey(command.date)),event as EventItem,command.date);
  }else if(command.kind==="complete"){
   const old=find(command.date,command.id);if(!old)throw conflict();
   if(old.kind==="training"||old.workout)throw new MobileError(400,"invalid","Record actual workout completion in Gym.");
   patch(weekKey(command.date)).data=placeManual(board(weekKey(command.date)),{...old,completed:command.completed,completedAt:command.completed?(old.completed?old.completedAt??null:new Date().toISOString()):null},command.date);
  }else if(command.kind==="save-event-preset"){
   const p=patch("event-presets"),preset={...command.event,id:stableId(`${owner}:event-preset:${command.event.id}`),completed:false,completedAt:null};
   const next=[...z.array(eventSchema).parse(p.data).filter(e=>e.id!==preset.id),preset];p.data=z.array(eventSchema).max(100).parse(next);
  }else if(command.kind==="apply-event-preset"){
   if(await existingOccurrence(owner,command.eventId))throw conflict();
   const source=(await rows(owner,["event-presets"]))[0];
   if(!z.array(eventSchema).parse(source?.data??[]).some(event=>JSON.stringify(canonical(event))===JSON.stringify(canonical(command.preset))))throw conflict();
   patch(weekKey(command.date)).data=placeManual(board(weekKey(command.date)),{...command.preset,id:command.eventId,completed:false,completedAt:null} as EventItem,command.date);
  }else if(command.kind==="save-week-preset"){
   const current=await getNamedWeekPresets(),gym=await getGymData(),copy=resetPreset(boardFor(stored,dates),id=>id);
   for(const plan of gym.plans.filter(p=>dates.includes(p.date))){const day=copy.find(day=>day.day===weekdays[(new Date(`${plan.date}T12:00:00Z`).getUTCDay()+6)%7])!;day.tasks.push({id:`preset:${plan.id}`,title:plan.data.name,completed:false,completedAt:null,kind:"training",icon:"workout",tone:"blue",timing:plan.data.timing,workout:plan.data});}
   const next=[...current.filter(p=>p.id!==command.id),{id:command.id,name:command.name,board:boardSchema.parse(copy)}];if(next.length>3)throw new MobileError(400,"invalid","Choose one of the three existing presets to replace.");patch("week-presets").data=next;
  }else if(command.kind==="apply-week-preset"){
   if(!(await getNamedWeekPresets()).some(p=>p.id===command.id&&JSON.stringify(canonical(p.board))===JSON.stringify(canonical(command.board))))throw conflict();
   const copy=resetPreset(command.board as EventItems[],id=>stableId(`${payload.operationId}:${id}`));
   for(const day of copy)for(const event of day.tasks.filter(e=>e.kind!=="training"&&!e.workout)){const date=dates.find(date=>weekdays[(new Date(`${date}T12:00:00Z`).getUTCDay()+6)%7]===day.day)!;patch(weekKey(date)).data=placeManual(board(weekKey(date)),event,date);}
  }
  const outcome=(await accountSql`SELECT b1_mobile_save_events(${owner},${payload.operationId}::uuid,${fingerprint(payload)},${payload.revision},${JSON.stringify([...patches.values()])}::jsonb) AS outcome`)[0]?.outcome;
  if(outcome!=="saved"&&outcome!=="duplicate")throw conflict();
 }
 if(command.kind==="reschedule-workout"){
  const result=await editGymPlanSchedule({id:command.id,revision:command.revision,mutationId:payload.operationId,date:command.date,timezone:command.timezone,timing:command.timing});
  if(!result.success)throw new MobileError(409,"conflict","The workout schedule could not be confirmed. Your values are retained; reload Gym and review its revision.");
 }
 // Canonical preset workout scheduling already uses stable operation IDs.
 // A partial transport failure retains the command; retry finishes missing
 // plans without repeating the acknowledged manual-board transaction.
 for(const [index,plan] of training.entries()){
  const result=await scheduleGymWorkout({operationId:stableId(`${payload.operationId}:training:${index}`),dates:[plan.date],timezone:command.kind==="apply-week-preset"?command.timezone:settings.preferences.timezone,data:plan.data});
  if(!result.success||result.plans.length!==1)throw new MobileError(409,"conflict","The preset's workout plan could not be confirmed. Retain this command and review Gym before retrying.");
 }
 await afterNotificationSourceChange(owner);revalidateTag("events-data",{expire:0});revalidatePath("/account/events");
 return {acknowledgedOperationId:payload.operationId,...await readMobileEvents(owner,command.anchor)};
}
