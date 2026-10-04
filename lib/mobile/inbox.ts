import 'server-only';
import {listInbox,inboxDetail,setInboxState,markAvailableRead,reconcileInbox} from '../notifications/store';
import {accountSql,accountSettings} from '../account/store';
import {saveAccountSettingsResult} from '../actions/account.actions';
import {inboxQuerySchema,inboxDetailQuery,inboxCommandSchema} from './inbox-contract';
import { MobileError } from './http';
import {weekDate,weekdays} from '../events';
import {addCalendarDays} from '../calendar';
import type {MomentumData} from '../momentum/types';
async function safe<T>(run:()=>Promise<T>){try{return await run();}catch(error){
 const message=error instanceof Error?error.message:'';
 if(message.startsWith('This message'))throw new MobileError(409,'conflict','This message changed or is no longer available. Refresh before retrying.');
 if(message.startsWith('Choose a valid notification'))throw new MobileError(400,'invalid','Choose a valid notification page.');
 if(message.startsWith('Notification'))throw new MobileError(503,'unavailable','Notifications could not refresh. Retry shortly.');
 throw error;
}}
export async function readMobileInbox(owner:string,query:unknown){return safe(()=>listInbox(owner,{filter:'unread',cursor:inboxQuerySchema.parse(query??{}).cursor??null}));}
export async function readMobileInboxDetail(owner:string,query:unknown){return safe(()=>inboxDetail(owner,inboxDetailQuery.parse(query).id));}
export async function writeMobileInbox(owner:string,input:unknown){const command=inboxCommandSchema.parse(input);return safe(async()=>{
 if(command.type==='settings'){
  const current=await accountSettings(owner);
  const result=await saveAccountSettingsResult({section:'notifications',revision:command.revision,value:{...current.notifications,...command.data}});
  if(!result.ok)throw new MobileError(result.error.startsWith('Settings changed')?409:400,result.error.startsWith('Settings changed')?'conflict':'invalid',result.error);
  return {saved:true,settings:result.value};
 }
 if(command.type==='state')return setInboxState(owner,command.change);
 if(command.type==='read-all')return markAvailableRead(owner);
 await reconcileInbox(owner);return {reconciled:true};
});}
/** Resolve the owned stored target, never a client URL or arbitrary source ID. */
export async function readMobileInboxTarget(owner:string,query:unknown){
 const target=(await readMobileInboxDetail(owner,query)).target;
 let available=true;
 if(target.kind==='workout'){
  const rows=target.record==='plan'?await accountSql`SELECT date FROM gym_plans WHERE user_id=${owner} AND id=${target.id} AND NOT archived`:
   await accountSql`SELECT data->>'date' AS date FROM gym_sessions WHERE user_id=${owner} AND id=${target.id} AND NOT archived`;
  available=rows[0]?.date===target.date;
 }else if(target.kind==='event'){
  const [row]=await accountSql`SELECT data FROM user_events WHERE user_id=${owner} AND week=${target.week}`;
  const start=weekDate(target.week);
  available=!!row?.data?.some((day:{day:string;tasks:{id:string}[]})=>addCalendarDays(start,weekdays.indexOf(day.day as typeof weekdays[number]))===target.date&&day.tasks.some(event=>event.id===target.id));
 }else if(target.kind==='goal'||target.kind==='journey'){
  const [row]=await accountSql`SELECT data FROM momentum_state WHERE user_id=${owner}`;const data=row?.data as MomentumData|undefined;
  available=target.kind==='goal'?!!data?.tracker?.goals.some(goal=>goal.id===target.id):!!data?.journeys.some(journey=>journey.id===target.id);
 }
 if(!available)throw new MobileError(409,'conflict','The linked record changed or is no longer available. Refresh the inbox.');
 return {target};
}
