"use server";
import { afterNotificationSourceChange } from "../notifications/store";
import z from "zod";
import { createHash } from "node:crypto";
import { accountSql,accountSettings } from "../account/store";
import { requireUserId } from "../session";
import { boardSchema,weekKey,weekdays } from "../events";
import { weekDates } from "../gym/dates";
import type { EventItems } from "@/types/types";
type Stored={id:string;week:string;data:EventItems[]};
function canonical(value:unknown):unknown{return Array.isArray(value)?value.map(canonical):value&&typeof value==="object"?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonical(item)])):value;}
function visible(rows:Stored[],dates:string[]):EventItems[]{return dates.map(date=>{const name=weekdays[(new Date(`${date}T12:00:00Z`).getUTCDay()+6)%7],row=rows.find(row=>row.week===weekKey(date));return {id:name.toLowerCase(),day:name,tasks:row?.data.find(day=>day.day===name)?.tasks??[]};});}
async function windowRows(owner:string,anchor:string,initialize=false){
 const settings=await accountSettings(owner),dates=weekDates(anchor,settings.preferences.weekStart),keys=[...new Set(dates.map(weekKey))];
 if(initialize)for(const week of keys){const id=createHash("sha256").update(`${owner}:calendar:${week}`).digest("hex");await accountSql`INSERT INTO user_events(id,user_id,week,data) SELECT ${id},${owner},${week},'[]'::jsonb WHERE NOT EXISTS(SELECT 1 FROM user_events WHERE user_id=${owner} AND week=${week}) ON CONFLICT DO NOTHING`;}
 const rows=await accountSql`SELECT id,week,data FROM user_events WHERE user_id=${owner} AND week=ANY(${keys})`;
 if(new Set(rows.map(row=>row.week)).size!==rows.length)throw new Error("Calendar has conflicting week records; support must review them without deleting history");
 return {rows:rows as Stored[],dates};
}
export async function getAccountEventWindow(anchor:string){const owner=await requireUserId();const {rows,dates}=await windowRows(owner,z.iso.date().parse(anchor));return visible(rows,dates);}
export async function saveAccountEventWindow(input:unknown){
 try{const owner=await requireUserId(undefined,"write"),payload=z.object({anchor:z.iso.date(),before:boardSchema,data:boardSchema}).strict().parse(input),{rows,dates}=await windowRows(owner,payload.anchor);
 if(JSON.stringify(canonical(visible(rows,dates)))===JSON.stringify(canonical(payload.data)))return {success:true as const,data:payload.data as EventItems[]};
 if(JSON.stringify(canonical(visible(rows,dates)))!==JSON.stringify(canonical(payload.before)))throw new Error("Newer calendar changes exist. Reload this week before saving.");
 const old=new Map(payload.before.flatMap(day=>day.tasks.map(event=>[event.id,event])));
 const data=payload.data.map(day=>({...day,tasks:day.tasks.map(event=>({...event,completedAt:event.completed?(old.get(event.id)?.completed?old.get(event.id)?.completedAt??null:event.completedAt??new Date().toISOString()):null}))}));
 if(data.some(day=>day.tasks.some(event=>event.kind==="training"||event.workout)))throw new Error("Use Gym for workout planning");
 // Initialize only after authorization, validation and the initial stale-write check.
 const initialized=await windowRows(owner,payload.anchor,true);
 if(JSON.stringify(canonical(visible(initialized.rows,dates)))!==JSON.stringify(canonical(payload.before)))throw new Error("Newer calendar changes exist. Reload this week before saving.");
 const patch=initialized.rows.map(row=>{const edited={...row,data:row.data.map(day=>({...day,tasks:[...day.tasks]}))};for(const date of dates.filter(date=>weekKey(date)===row.week)){const name=weekdays[(new Date(`${date}T12:00:00Z`).getUTCDay()+6)%7],day=data.find(day=>day.day===name),index=edited.data.findIndex(day=>day.day===name);const replacement={id:name.toLowerCase(),day:name,tasks:day?.tasks??[]};if(index>=0)edited.data[index]=replacement;else edited.data.push(replacement);}return {id:row.id,before:row.data,data:edited.data};});
 // One statement: a failed compare-and-swap rolls back BOTH weeks at the ISO boundary.
 await accountSql`WITH changed AS(UPDATE user_events u SET data=p.data FROM jsonb_to_recordset(${JSON.stringify(patch)}::jsonb) AS p(id text,before jsonb,data jsonb) WHERE u.id=p.id AND u.user_id=${owner} AND u.data=p.before RETURNING u.id)
 SELECT CASE WHEN count(*)=${patch.length} THEN count(*) ELSE count(*)/(count(*)-count(*)) END AS saved FROM changed`;
 await afterNotificationSourceChange(owner);
 return {success:true as const,data:data as EventItems[]};
 }catch(error){return {success:false as const,message:error instanceof Error&&/^(Membership|Newer|Use)/.test(error.message)?error.message:"Calendar save failed — retry. Both weeks remain protected."};}
}
