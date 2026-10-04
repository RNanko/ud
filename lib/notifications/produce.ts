import type {Candidate} from "./types";
import type {AccountPreferences,NotificationPreferences} from "../account/preferences";
import type {MomentumData,Sources} from "../momentum/types";
import {dateInZone,addCalendarDays,weekStart} from "../gym/dates";
import {weekDate,weekdays} from "../events";
import {sourceActivities,milestoneKeys} from "../momentum/logic";
import {evaluateGoal,reminderDue,trackerFor} from "../momentum/goals/evaluate";
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
export type ProducerInput={sources:Sources;momentum:MomentumData;preferences:AccountPreferences;notifications:NotificationPreferences;initializedAt:string;first:boolean;known:Set<string>;now:string};
export function produceMessages(input:ProducerInput):Candidate[] {
  const {sources,momentum,preferences:p,notifications:n,known,now}=input;
  const ms=Date.parse(now),today=dateInZone(new Date(now),p.timezone),result:Candidate[]=[];
  const recent=(at:string)=>Date.parse(at)>=Date.parse(input.initializedAt)-60000&&Date.parse(at)>=ms-7*86400000&&Date.parse(at)<=ms;
  const add=(value:Candidate,enabled:boolean)=>result.push({...value,suppressed:value.suppressed||!enabled});
  const remind=(key:string,title:string,date:string,zone:string,timing:import("../planner-time").EventTiming|undefined,target:Candidate["target"])=>{
    if(!timing?.start||!timing.reminderMinutes)return;
    const start=localTimeInstant(date,timing.start,zone);
    if(start===null||start<=ms||start>ms+48*3600000)return;
    const due=start-timing.reminderMinutes*60000;
    // Quiet hours suppress this occurrence only when it is due, not tomorrow's.
    add({key:`reminder:${key}`,category:"event_reminder",sourceKey:key,title:`${title} · ${timing.start}`,body:target.kind==="workout"?"Your scheduled workout is coming up.":"Your scheduled event is coming up.",target,occurredAt:new Date(due).toISOString(),availableAt:new Date(due).toISOString(),expiresAt:new Date(start).toISOString(),suppressed:due<=ms&&quietNow(n,new Date(now),p.timezone)},n.eventReminders);
  };
  for(const week of sources.weeks){let start:string;try{start=weekDate(week.week);}catch{continue;}
    for(const day of week.data)for(const event of day.tasks){if(event.completed||event.kind==="training"||event.workout)continue;
      const date=addCalendarDays(start,weekdays.indexOf(day.day));
      remind(`event:${event.id}`,event.title,date,p.timezone,event.timing,{kind:"event",id:event.id,week:week.week,date});
    }
  }
  for(const plan of sources.gym.plans){if(sources.gym.sessions.some(x=>x.planId===plan.id))continue;remind(`workout:${plan.id}`,plan.data.name,plan.date,plan.timezone,plan.data.timing,{kind:"workout",id:plan.id,date:plan.date,record:"plan"});}
  for(const session of sources.gym.sessions){const key=`completed:${session.id}`,at=session.data.finishedAt;
    if(session.data.status!=="completed"||!at||(!recent(at)&&!known.has(key)))continue;
    add({key,sourceKey:`session:${session.id}`,category:"workout_completed",title:session.data.name,body:session.data.completionMode==="confirmation"?"Workout confirmed complete — no measurements were logged.":"Your completed workout and recorded results have been saved.",target:{kind:"workout",id:session.id,date:session.data.date,record:"session"},occurredAt:at,availableAt:at,expiresAt:null,suppressed:false},n.workoutCompletion);
  }
  const activities=sourceActivities(sources,p.timezone),tracker=trackerFor(momentum);
  for(const goal of tracker.goals.filter(x=>x.lifecycle==="active"&&!x.hidden)){
    const evaluation=evaluateGoal(goal,momentum,{...sources,activities},now),key=`goal:${goal.id}:${evaluation.period.key}`;
    // The destination hides these cards when money tracking is disabled.
    // Withdraw their inbox candidates without deleting the user's goal history.
    if(!momentum.preferences.money&&["balance","savings","investment"].includes(evaluation.rule.metric))continue;
    if(evaluation.met&&evaluation.rule.metric!=="balance"){
      const attained=tracker.attainments.find(x=>x.key===`${goal.id}:${evaluation.period.key}`);
      add({key,sourceKey:`goal:${goal.id}`,category:"goal_milestone",title:`Goal reached · ${goal.name}`,body:`Your recorded target was reached for ${evaluation.period.label}. Open Momentum to review the contributing records.`,target:{kind:"goal",id:goal.id},occurredAt:attained?.at??now,availableAt:attained?.at??now,expiresAt:null,suppressed:input.first&&(!attained||!recent(attained.at))},n.goalReminders);
    }
    const due=reminderDue(goal,evaluation,tracker,now);
    if(due&&!quietNow(n,new Date(now),p.timezone)){
      const date=dateInZone(new Date(now),evaluation.rule.timezone),expires=localTimeInstant(addCalendarDays(date,1),"00:00",evaluation.rule.timezone);
      add({key:`goal-reminder:${goal.id}:${evaluation.period.key}:${date}`,sourceKey:`goal:${goal.id}`,category:"goal_reminder",title:`Next step · ${goal.name}`,body:"Your chosen goal reminder is due. Review your recorded progress and choose the next action.",target:{kind:"goal",id:goal.id},occurredAt:now,availableAt:now,expiresAt:expires?new Date(expires).toISOString():null,suppressed:false},n.goalReminders);
    }
  }
  for(const milestone of milestoneKeys(momentum,activities).filter(x=>!x.startsWith("review:"))){
    const [,journeyId,chapterId]=milestone.split(":"),journey=momentum.journeys.find(x=>x.id===journeyId);
    if(!journey||journey.status!=="active")continue;
    const at=momentum.awards.find(x=>x.key===milestone)?.at;
    add({key:`milestone:${milestone}`,sourceKey:`journey:${journeyId}`,category:"journey_milestone",title:chapterId?"Journey step complete":"Journey complete",body:chapterId?`${journey.chapters.find(x=>x.id===chapterId)?.title} · ${journey.title}`:journey.title,target:{kind:"journey",id:journeyId},occurredAt:at??now,availableAt:at??now,expiresAt:null,suppressed:input.first&&(!at||!recent(at))},n.goalReminders);
  }
  const week=weekStart(today,p.weekStart),reviewDate=addCalendarDays(week,6),available=localTimeInstant(reviewDate,"18:00",p.timezone),expiry=localTimeInstant(addCalendarDays(week,7),"00:00",p.timezone);
  if(available&&expiry&&ms>=available&&ms<expiry&&!momentum.reviews.some(x=>x.week===week&&!x.draft))add({key:`review:${week}`,sourceKey:`review:${week}`,category:"weekly_review",title:"Your weekly review is ready",body:"Review your recorded week and choose one useful adjustment.",target:{kind:"review",week},occurredAt:new Date(available).toISOString(),availableAt:new Date(available).toISOString(),expiresAt:new Date(expiry).toISOString(),suppressed:quietNow(n,new Date(now),p.timezone)},n.weeklyReview);
  return result;
}
