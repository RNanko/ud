import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {loadModule} from './helpers.mjs';
import {dates,events} from './gym-fixture.mjs';
import {types,logic,goalEvaluation} from './momentum-fixture.mjs';

// Actual source triggers, producer, snapshot function and repository queries.
// Everything runs in disposable PostgreSQL; application accounts are untouched.
test('scheduled reminders persist once, publish when due, survive a missed start and preserve read state',async()=>{
 const db=await PGlite.create();
 try {
  await db.exec(`
   CREATE TABLE "user"(id text PRIMARY KEY); INSERT INTO "user" VALUES('alice'),('bob');
   CREATE TABLE b1_deletions(user_id text,product text);
   CREATE TABLE b1_email_outbox(id text,kind text,status text,payload text,lease_until timestamptz);
   CREATE TABLE b1_account_settings(user_id text,product text,preferences jsonb,notifications jsonb,revision int);
   CREATE TABLE user_events(id text PRIMARY KEY,user_id text,week text,data jsonb);
   CREATE TABLE gym_plans(id text,user_id text,date text,timezone text,data jsonb,revision int,archived boolean);
   CREATE TABLE gym_sessions(id text,user_id text,plan_id text,data jsonb,revision int,archived boolean);
   CREATE TABLE gym_rest_days(user_id text,date text,rest boolean);
   CREATE TABLE momentum_state(user_id text,data jsonb);
   CREATE TABLE kanban_board(user_id text,data jsonb);
  `);
  await db.exec(readFileSync('lib/db/0024_internal_inbox.sql','utf8').replaceAll('--> statement-breakpoint',''));
  const query=async(sql,params=[])=>(await db.query(sql,params)).rows;
  const accountSql=(parts,...values)=>query(parts.reduce((sql,part,i)=>sql+part+(i<values.length?`$${i+1}`:''),''),values);
  const prefs=loadModule('lib/account/preferences.ts');
  const preferences={...prefs.defaultPreferences,timezone:'UTC'},notifications={...prefs.defaultNotifications,quietHours:false};
  const producer=loadModule('lib/notifications/produce.ts',{'../gym/dates':dates,'../events':events,'../momentum/logic':logic,'../momentum/goals/evaluate':goalEvaluation});
  const store=loadModule('lib/notifications/store.ts',{'../account/store':{accountSql,accountSettings:async()=>({preferences})},'../momentum/types':types,'../todo':loadModule('lib/todo.ts'),'./produce':producer,'./types':loadModule('lib/notifications/types.ts')});
  for(const owner of ['alice','bob'])await query(`INSERT INTO b1_account_settings VALUES($1,'b1-way-personal',$2::jsonb,$3::jsonb,0)`,[owner,JSON.stringify(preferences),JSON.stringify(notifications)]);
  const clock=Date.now();
  const board=offset=>{
   const instant=new Date(clock+offset*60000),date=instant.toISOString().slice(0,10),day=events.weekdays[(instant.getUTCDay()+6)%7];
   return {week:events.weekKey(date),data:events.weekdays.map(d=>({day:d,tasks:d===day?[{id:'event',title:'Reminder fixture',completed:false,timing:{start:instant.toISOString().slice(11,16),duration:null,overnight:false,reminderMinutes:10}}]:[]}))};
  };
  let source=board(20);
  await query('INSERT INTO user_events VALUES($1,$2,$3,$4::jsonb)',['board','alice',source.week,JSON.stringify(source.data)]);
  await store.reconcileInbox('alice');
  assert.equal((await store.listInbox('alice')).unreadCount,0);
  let rows=await query("SELECT published_at FROM b1_notifications WHERE user_id='alice'");
  assert.equal(rows.length,1);assert.equal(rows[0].published_at,null);

  // Move the existing event into its due window; the same row becomes visible.
  source=board(5);
  await query('UPDATE user_events SET week=$1,data=$2::jsonb WHERE id=$3',[source.week,JSON.stringify(source.data),'board']);
  await store.reconcileInbox('alice');
  const visible=(await store.listInbox('alice')).messages[0];assert.ok(visible);assert.equal(visible.category,'event_reminder');
  await store.setInboxState('alice',{id:visible.id,revision:visible.revision,read:true});

  // A later refresh after the start retains identity and the persisted read.
  source=board(-5);
  await query('UPDATE user_events SET week=$1,data=$2::jsonb WHERE id=$3',[source.week,JSON.stringify(source.data),'board']);
  await store.reconcileInbox('alice');
  const read=(await store.inboxDetail('alice',visible.id));assert.ok(read.readAt);assert.match(read.body,/start.*passed/);
  assert.equal((await store.listInbox('alice',{filter:'unread'})).unreadCount,0);
  assert.equal((await query("SELECT count(*)::int AS n FROM b1_notifications WHERE user_id='alice'"))[0].n,1);

  // An unread event first refreshed after its start is delivered instead of lost.
  await query('INSERT INTO user_events VALUES($1,$2,$3,$4::jsonb)',['late','bob',source.week,JSON.stringify(source.data)]);
  await store.reconcileInbox('bob');const late=(await store.listInbox('bob',{filter:'unread'})).messages[0];assert.ok(late);assert.match(late.body,/start.*passed/);
  await assert.rejects(()=>store.inboxDetail('alice',late.id));
  source.data.flatMap(d=>d.tasks)[0].completed=true;
  await query('UPDATE user_events SET data=$1::jsonb WHERE id=$2',[JSON.stringify(source.data),'late']);
  await store.reconcileInbox('bob');assert.equal((await store.listInbox('bob')).unreadCount,0);
  assert.equal((await query('SELECT count(*)::int AS n FROM b1_email_outbox'))[0].n,0);
 } finally {await db.close();}
});
