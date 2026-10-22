import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { applyScheduleMigration } from './apply-event-schedule-slots-schema.mjs';

export async function applyActivityCompletionSchema(db, options = {}) {
  if (!(await db.query("SELECT to_regprocedure('public.b1_write_event_schedule_v2(text,uuid,text,uuid,integer,jsonb,date,date,integer,text,boolean)') AS function")).rows[0].function) throw Error('Apply migration 0041 first.');
  return applyScheduleMigration(db, options, '0042_activity_completion.sql', "to_regclass('public.b1_activity_operations')");
}
export async function applyProjectedWorkoutsSchema(db, options = {}) {
  const ready=(await db.query("SELECT to_regclass('public.b1_activity_operations') AS activities")).rows[0];
  if(!ready.activities) throw Error('Apply migration 0042 first.');
  return applyScheduleMigration(db,options,'0043_projected_workout_schedules.sql',"to_regclass('public.b1_scheduled_workouts')");
}
export async function applyActivityMovesSchema(db, options = {}) {
  if (!(await db.query("SELECT to_regclass('public.b1_scheduled_workouts') AS table")).rows[0].table) throw Error('Apply migration 0043 first.');
  return applyScheduleMigration(db,options,'0044_activity_moves.sql',"to_regprocedure('public.b1_move_workout_activity(text,uuid,text,text,jsonb,date,text,jsonb)')");
}
async function main() {
  const args=process.argv.slice(2), root=resolve(import.meta.dirname,'..');
  if(args.some(a=>!['--apply','--projected','--moves'].includes(a)&&!a.startsWith('--expected-host=')&&!a.startsWith('--expected-database='))) throw Error('Unsupported argument.');
  const {default:nextEnv}=await import('@next/env'); nextEnv.loadEnvConfig(root,true,{info(){},error(){}});
  const connectionString=process.env.DATABASE_URL?.trim();
  if(!connectionString) throw Error('Database is not configured.');
  const host=new URL(connectionString).hostname;
  if(args.includes('--apply')&&args.find(a=>a.startsWith('--expected-host='))?.slice(16)!==host) throw Error('Apply requires the exact configured host.');
  const {Pool,neonConfig}=await import('@neondatabase/serverless'); neonConfig.webSocketConstructor=globalThis.WebSocket;
  const pool=new Pool({connectionString,max:1,connectionTimeoutMillis:10000}); let db;
  try { db=await pool.connect(); const install=args.includes('--moves')?applyActivityMovesSchema:args.includes('--projected')?applyProjectedWorkoutsSchema:applyActivityCompletionSchema; console.log(JSON.stringify({host,...await install(db,{apply:args.includes('--apply'),expectedDatabase:args.find(a=>a.startsWith('--expected-database='))?.slice(20)})})); }
  finally { db?.release(); await pool.end(); }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) main().catch(error=>{console.error(/^(Apply|Database identity|Installed schema|Database is not|Unsupported)/.test(error?.message??'')?error.message:'Activity schema check failed. No credentials logged.');process.exitCode=1;});
