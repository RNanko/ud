import type {Candidate} from "./types";
import type {AccountPreferences,NotificationPreferences} from "../account/preferences";
import type {ActivitySources} from "../events/activity-types";
import {addCalendarDays} from "../gym/dates";
import {weekDate,weekdays} from "../events";
import {quietNow} from "../account/preferences";

// Evaluate real wall-clock instants. Nonexistent DST times are skipped; folds
// choose the first occurrence. Never manufacture a midnight for untimed items.
export function localTimeInstant(date:string,time:string,zone:string):number|null {
  const nominal=Date.parse(`${date}T${time}:00Z`);
  const format=new Intl.DateTimeFormat("en-CA",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"});
  const wall=(value:number)=>{const parts=format.formatToParts(new Date(value));const p=(key:string)=>parts.find(x=>x.type===key)!.value;return `${p("year")}-${p("month")}-${p("day")}T${p("hour")}:${p("minute")}:${p("second")}Z`;};
  const candidates=[-86400000,0,86400000].map(offset=>{const probe=nominal+offset;return nominal-(Date.parse(wall(probe))-probe);}).filter(value=>wall(value)===`${date}T${time}:00Z`);
  return candidates.length?Math.min(...candidates):null;
}
export type ProducerInput={sources:ActivitySources;preferences:AccountPreferences;notifications:NotificationPreferences;initializedAt:string;first:boolean;known:Set<string>;now:string};
export function produceMessages(input:ProducerInput):Candidate[] {
  const {sources,preferences:p,notifications:n,known,now}=input;
  const ms=Date.parse(now),result:Candidate[]=[];
  const recent=(at:string)=>Date.parse(at)>=Date.parse(input.initializedAt)-60000&&Date.parse(at)>=ms-7*86400000&&Date.parse(at)<=ms;
  const add=(value:Candidate,enabled:boolean)=>result.push({...value,suppressed:value.suppressed||!enabled});
  const remind=(key:string,title:string,date:string,zone:string,timing:import("../planner-time").EventTiming|undefined,target:Candidate["target"])=>{
    if(!timing?.start||!timing.reminderMinutes)return;
    const start=localTimeInstant(date,timing.start,zone);
    // Keep a useful catch-up window when the tab was hidden or a refresh failed.
    // Expiring at the start could discard an unread reminder before the user saw it.
    if(start===null||start+24*3600000<=ms||start>ms+48*3600000)return;
    const due=start-timing.reminderMinutes*60000;
    // Quiet hours suppress this occurrence only when it is due, not tomorrow's.
    const subject=target.kind==="workout"?"workout":"event";
    const body=start<=ms?`The scheduled start of this ${subject} has passed. Open it to review your plan.`:`Your scheduled ${subject} is coming up.`;
    add({key:`reminder:${key}`,category:"event_reminder",sourceKey:key,title:`${title} · ${timing.start}`,body,target,occurredAt:new Date(due).toISOString(),availableAt:new Date(due).toISOString(),expiresAt:new Date(start+24*3600000).toISOString(),suppressed:due<=ms&&quietNow(n,new Date(now),p.timezone)},n.eventReminders);
  };
  for(const week of sources.weeks){let start:string;try{start=weekDate(week.week);}catch{continue;}
    for(const day of week.data)for(const event of day.tasks){if(event.completed||event.kind==="training"||event.workout)continue;
      const date=addCalendarDays(start,weekdays.indexOf(day.day));
      remind(`event:${event.id}`,event.title,date,event.scheduled?.timezone??p.timezone,event.timing,{kind:"event",id:event.id,week:week.week,date});
    }
  }
  for(const plan of sources.gym.plans){if(sources.gym.sessions.some(x=>x.planId===plan.id))continue;remind(`workout:${plan.id}`,plan.data.name,plan.date,plan.timezone,plan.data.timing,{kind:"workout",id:plan.id,date:plan.date,record:"plan"});}
  for(const session of sources.gym.sessions){const key=`completed:${session.id}`,at=session.data.finishedAt;
    if(session.data.status!=="completed"||!at||(!recent(at)&&!known.has(key)))continue;
    add({key,sourceKey:`session:${session.id}`,category:"workout_completed",title:session.data.name,body:session.data.completionMode==="confirmation"?"Workout confirmed complete — no measurements were logged.":"Your completed workout and recorded results have been saved.",target:{kind:"workout",id:session.id,date:session.data.date,record:"session"},occurredAt:at,availableAt:at,expiresAt:null,suppressed:false},n.workoutCompletion);
  }
  return result;
}
