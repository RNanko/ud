import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { randomUUID } from 'node:crypto';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import { applyEventSchedulesSchema } from '../scripts/apply-event-schedules-schema.mjs';
import { applyEventScheduleSlotsSchema } from '../scripts/apply-event-schedule-slots-schema.mjs';
import { applyActivityCompletionSchema, applyProjectedWorkoutsSchema, applyActivityMovesSchema } from '../scripts/apply-activity-completion-schema.mjs';
import { blueprint as workoutBlueprint } from './gym-fixture.mjs';
const native = createRequire(import.meta.url);
function loader(overrides = {}) {
  const cache = new Map();
  return function load(file) {
    file = resolve(file);
    const mock = overrides[file]; if (mock) return mock;
    if (cache.has(file)) return cache.get(file);
    const exports = {}; cache.set(file, exports);
    const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    runInNewContext(code, { exports, require: name => {
      if (name === 'server-only') return {};
      if (!name.startsWith('.')) return native(name);
      const path = resolve(dirname(file), name); return load(existsSync(path + '.ts') ? path + '.ts' : path);
    }, Intl, Date, structuredClone, console, crypto:native('node:crypto').webcrypto });
    return exports;
  };
}
const load = loader(), r = load('lib/events/recurrence.ts'), ev = load('lib/events.ts');
const schedule = () => ({ id: randomUUID(), revision: 0, event: { id: randomUUID(), title: 'Read', category: 'Personal', completed: false, completedAt: null, tone: 'green' }, start: '2026-10-12', end: null, days: [0, 2, 4], timezone: 'Europe/Warsaw', stoppedFrom: null });
const plain = value => JSON.parse(JSON.stringify(value));

test('recurrence supports stable same-day slots, counts and distant alternating weeks', () => {
  const timing = load('lib/planner-time.ts').untimed();
  const s = { ...schedule(), days:[0,2], intervalWeeks:2, count:5, slots:[{id:'main',timing:{...timing,start:'08:00'}},{id:'evening',timing:{...timing,start:'18:00'}}] };
  assert.equal(r.eventScheduleSchema.safeParse(s).success,true);
  const rows = r.projectScheduledEvents([s],[],s.start,'2026-11-30');
  assert.equal(rows.length,5);
  assert.equal(rows[0].event.id,r.occurrenceKey(s.id,s.start));
  assert.equal(rows[1].event.id,r.occurrenceKey(s.id,s.start,'evening'));
  assert.equal(rows.at(-1).date,'2026-10-26');
  assert.equal(rows[1].event.timing.start,'18:00');
  const moved={scheduleId:s.id,originalDate:s.start,slotId:'evening',date:'2027-01-01',event:rows[1].event,revision:0};
  assert.equal(r.projectScheduledEvents([s],[moved],s.start,s.start).length,1);
  assert.equal(r.projectScheduledEvents([s],[moved],'2027-01-01','2027-01-01')[0].event.id,rows[1].event.id);
});

test('rule edits preserve past misses and slot identities', () => {
  const s=schedule();
  s.versions=[{effectiveFrom:'2026-10-19',start:s.start,end:null,days:[1],event:{...s.event,title:'New name'}}];
  assert.equal(r.projectScheduledEvents([s],[],'2026-10-12','2026-10-18').length,3);
  const next=r.projectScheduledEvents([s],[],'2026-10-19','2026-10-25');
  assert.equal(next.length,1); assert.equal(next[0].date,'2026-10-20'); assert.equal(next[0].event.title,'New name');
});

test('calendar rank agrees with enumerated eligible days without replaying earlier years', () => {
  const rules=load('lib/events/calendar-rule.ts');
  for(const intervalWeeks of [1,2,3,52]) for(const start of ['2026-10-12','2026-10-14','2026-10-18']) {
    const rule={start,end:null,days:[0,2,6],intervalWeeks};
    let counted=0;
    for(let offset=0;offset<800;offset++) {
      const date=new Date(Date.parse(start)+offset*86400000).toISOString().slice(0,10);
      assert.equal(rules.daysBefore(rule,date),counted);
      if(rules.ruleHasDate(rule,date)) counted++;
    }
  }
});

test('0041 preserves old writes and restores unchecked slots with revision markers, not stale completions', async () => {
  const db=await PGlite.create();
  try {
    await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY); INSERT INTO "user" VALUES('owner'),('other');`);
    const database=(await db.query('SELECT current_database() AS database')).rows[0].database;
    await applyEventSchedulesSchema(db,{apply:true,expectedDatabase:database});
    await applyEventScheduleSlotsSchema(db,{apply:true,expectedDatabase:database});
    assert.equal((await applyEventScheduleSlotsSchema(db,{apply:true,expectedDatabase:database})).installed,false);
    const sql=async(parts,...values)=>(await db.query(parts.reduce((text,p,i)=>text+(i?`$${i}`:'')+p,''),values)).rows;
    const server=loader({[resolve('lib/account/store.ts')]:{accountSql:sql},[resolve('lib/gym/event-link-store.ts')]:{assertWorkoutLinks:async()=>{}}})('lib/events/schedule-store.ts');
    const timing=load('lib/planner-time.ts').untimed();
    const rule={...schedule(),revision:-1,slots:[{id:'main',timing},{id:'second',timing}]};
    await server.createEventSchedule('owner',{operationId:randomUUID(),schedule:rule});
    let rows=await server.readScheduledOccurrences('owner',rule.start,rule.start);
    assert.equal(rows.length,2);
    const before=rows[1].event;
    const check={operationId:randomUUID(),before,event:{...before,completed:true},date:rule.start};
    await server.writeScheduledOccurrence('owner',check);
    rows=await server.readScheduledOccurrences('owner',rule.start,rule.start);
    const checked=rows.find(row=>row.event.id===before.id).event;
    const restored=await server.writeScheduledOccurrence('owner',{operationId:randomUUID(),before:checked,event:{...checked,completed:false,completedAt:null},date:rule.start});
    assert.equal(Object.hasOwn(restored,'event'),false);
    assert.equal(restored.revision,1);
    await server.writeScheduledOccurrence('owner',check);
    await assert.rejects(()=>server.writeScheduledOccurrence('owner',{...check,operationId:randomUUID()}),/Newer/);
    rows=await server.readScheduledOccurrences('owner',rule.start,rule.start);
    assert.equal(rows.find(row=>row.event.id===before.id).event.completed,false);
    assert.equal(rows.find(row=>row.event.id===before.id).event.scheduled.revision,1);
    assert.equal((await server.readEventSchedules('other')).length,0);
  } finally { await db.close(); }
});

test('recurrence validates weekdays, dates and ordinary-event templates', () => {
  const s = schedule();
  assert.equal(r.eventScheduleSchema.safeParse(s).success, true);
  for (const invalid of [{ ...s, days: [] }, { ...s, days: [0, 0] }, { ...s, days: [7] }, { ...s, end: '2026-10-01' }, { ...s, event: { ...s.event, kind: 'training' } }]) assert.equal(r.eventScheduleSchema.safeParse(invalid).success, false);
});

test('shared completion writes actual Events and Gym records, isolates owners, and safely replays receipts', async () => {
  const db=await PGlite.create();
  try {
    await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY); INSERT INTO "user" VALUES('owner'),('other'); CREATE TABLE user_events(id text PRIMARY KEY,user_id text,week text,data jsonb);`);
    await db.exec(readFileSync('lib/db/0019_gym_planner.sql','utf8').replaceAll('--> statement-breakpoint',''));
    const database=(await db.query('SELECT current_database() AS database')).rows[0].database;
    await applyEventSchedulesSchema(db,{apply:true,expectedDatabase:database});
    await applyEventScheduleSlotsSchema(db,{apply:true,expectedDatabase:database});
    await applyActivityCompletionSchema(db,{apply:true,expectedDatabase:database});
    const sql=async(parts,...values)=>(await db.query(parts.reduce((text,p,i)=>text+(i?`$${i}`:'')+p,''),values)).rows;
    const server=loader({[resolve('lib/account/store.ts')]:{accountSql:sql,accountSettings:async()=>({preferences:{timezone:'UTC'}})}})('lib/events/activity-completion.ts');
    const date='2026-01-05', event={id:randomUUID(),title:'Read',completed:false};
    await db.query('INSERT INTO user_events VALUES($1,$2,$3,$4)',[randomUUID(),'owner','2026-WK2',JSON.stringify([{id:'monday',day:'Monday',tasks:[event]}])]);
    const check={operationId:randomUUID(),id:`event:${event.id}`,date,version:JSON.stringify(event),completed:true};
    await assert.rejects(()=>server.completeActivity('other',check),/unavailable/);
    await server.completeActivity('owner',check);
    const checked=(await db.query('SELECT data FROM user_events')).rows[0].data[0].tasks[0];
    assert.equal(checked.completed,true);
    await server.completeActivity('owner',{...check,operationId:randomUUID(),version:JSON.stringify(checked),completed:false});
    await server.completeActivity('owner',check);
    assert.equal((await db.query('SELECT data FROM user_events')).rows[0].data[0].tasks[0].completed,false);
    await assert.rejects(()=>server.completeActivity('owner',{...check,operationId:randomUUID(),version:JSON.stringify(checked)}),/Newer/);
    const plan=randomUUID(), blueprint=workoutBlueprint();
    await db.query('INSERT INTO gym_plans(id,user_id,date,timezone,data,last_mutation) VALUES($1,$2,$3,$4,$5,$6)',[plan,'owner',date,'UTC',JSON.stringify(blueprint),randomUUID()]);
    const gymCheck={operationId:randomUUID(),id:`workout:plan:${plan}`,date,version:'0:none',completed:true};
    await server.completeActivity('owner',gymCheck);
    await server.completeActivity('owner',gymCheck);
    let rows=(await db.query('SELECT * FROM gym_sessions')).rows;
    assert.equal(rows.length,1); assert.equal(rows[0].data.status,'completed'); assert.equal(rows[0].data.exercises[0].sets.some(s=>s.completed||s.reps!==null||s.loadKg!==null),false);
    await db.query("UPDATE gym_sessions SET data=jsonb_set(data,'{notes}','\"Keep my result\"'),revision=revision+1");
    await server.completeActivity('owner',{...gymCheck,operationId:randomUUID(),version:'0:1',completed:false});
    await server.completeActivity('owner',gymCheck);
    rows=(await db.query('SELECT * FROM gym_sessions')).rows;
    assert.equal(rows[0].data.status,'active'); assert.equal(rows[0].data.notes,'Keep my result');
    await assert.rejects(()=>server.completeActivity('owner',{...gymCheck,operationId:randomUUID(),version:'0:1'}),/Newer/);
  } finally { await db.close(); }
});
test('future and historical windows project deterministically without expanding from the start', () => {
  const s = schedule();
  const week = r.projectScheduledEvents([s], [], '2026-10-12', '2026-10-18');
  assert.deepEqual(plain(week.map(o => o.date)), ['2026-10-12', '2026-10-14', '2026-10-16']);
  assert.equal(r.projectScheduledEvents([s], [], '2027-10-11', '2027-10-17').length, 3);
  assert.deepEqual(plain(r.projectScheduledEvents([s], [], '2026-10-12', '2026-10-18')), plain(week));
  assert.equal(r.projectScheduledEvents([{ ...s, end: '2026-10-14' }], [], '2026-10-12', '2026-10-18').length, 2);
});

test('projected workouts stay rule-sized, share completion, and preserve actual results on reopening', async () => {
  const db=await PGlite.create();
  try {
    await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY); INSERT INTO "user" VALUES('owner'),('other');
      CREATE TABLE user_events(id text PRIMARY KEY,user_id text,week text,data jsonb);`);
    await db.exec(readFileSync('lib/db/0019_gym_planner.sql','utf8').replaceAll('--> statement-breakpoint',''));
    const database=(await db.query('SELECT current_database() AS database')).rows[0].database;
    for(const install of [applyEventSchedulesSchema,applyEventScheduleSlotsSchema,applyActivityCompletionSchema,applyProjectedWorkoutsSchema,applyActivityMovesSchema])
      await install(db,{apply:true,expectedDatabase:database});
    const sql=async(parts,...values)=>(await db.query(parts.reduce((text,p,i)=>text+(i?`$${i}`:'')+p,''),values)).rows;
    const modules=loader({[resolve('lib/account/store.ts')]:{accountSql:sql,accountSettings:async()=>({preferences:{timezone:'UTC'}})}});
    const server=modules('lib/events/activity-completion.ts'), workouts=modules('lib/events/scheduled-workouts.ts');
    const id=randomUUID(),date='2026-01-05';
    const series={...schedule(),id,start:date,days:[0,2,4],timezone:'UTC',event:{...schedule().event,title:'Training',kind:'training',workout:workoutBlueprint()}};
    await db.query('INSERT INTO b1_event_schedules(user_id,id,data) VALUES($1,$2,$3)',['owner',id,JSON.stringify(series)]);
    for(const from of [date,'2027-10-11','2035-10-08']) assert.equal((await workouts.projectedWorkoutPlans('owner',from,from)).length,1);
    for(const table of ['gym_plans','gym_sessions','b1_event_occurrences']) assert.equal((await db.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n,0);
    const plan=(await workouts.projectedWorkoutPlans('owner',date,date))[0];
    const check={operationId:randomUUID(),id:`workout:plan:${plan.id}`,date,version:'virtual:0:-1',completed:true};
    await assert.rejects(()=>server.completeActivity('other',check),/unavailable/);
    await server.completeActivity('owner',check);
    await server.completeActivity('owner',check);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM gym_sessions')).rows[0].n,1);
    assert.equal((await workouts.projectedWorkoutPlans('owner',date,date)).length,0);
    await server.completeActivity('owner',{...check,operationId:randomUUID(),version:'0:0',completed:false});
    assert.equal((await db.query('SELECT count(*)::int AS n FROM gym_sessions')).rows[0].n,1);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM gym_plans')).rows[0].n,1);
    assert.equal((await workouts.projectedWorkoutPlans('owner',date,date)).length,0);
    await server.completeActivity('owner',check); // Old retry cannot re-complete an active session.
    assert.equal((await db.query('SELECT data FROM gym_sessions')).rows[0].data.status,'active');
    await assert.rejects(()=>server.completeActivity('owner',{...check,operationId:randomUUID()}),/Newer/);
    await server.completeActivity('owner',{...check,operationId:randomUUID(),version:'0:1'});
    await db.query("UPDATE gym_sessions SET data=jsonb_set(data,'{exercises,0,sets,0,reps}','4'),revision=revision+1");
    await server.completeActivity('owner',{...check,operationId:randomUUID(),version:'0:3',completed:false});
    const saved=(await db.query('SELECT data FROM gym_sessions')).rows[0].data;
    assert.equal(saved.status,'active'); assert.equal(saved.exercises[0].sets[0].reps,4);
    const move=modules('lib/events/workout-move.ts').moveWorkoutPlan;
    const reader=modules('lib/events/activity-record.ts').readActivityRecord;
    const moveCommand={id:plan.id,mutationId:randomUUID(),revision:0,from:date,date:'2026-02-03',timezone:'UTC'};
    await assert.rejects(()=>move('other',moveCommand),/Newer/);
    await move('owner',moveCommand); await move('owner',moveCommand);
    const moved=await reader('owner',check.id,'2026-02-03');
    assert.equal(moved.occurrence.date,'2026-02-03'); assert.equal(moved.session.data.date,date);
    assert.equal(moved.session.data.exercises[0].sets[0].reps,4);
    assert.equal((await workouts.projectedWorkoutPlans('owner',date,date)).length,0);
    await server.completeActivity('owner',{...check,date:'2026-02-03',operationId:randomUUID(),version:'1:4'});
    const checkedMove=await reader('owner',check.id,'2026-02-03');
    assert.equal(checkedMove.occurrence.completedDate,'2026-02-03');
    assert.equal(checkedMove.session.data.exercises[0].sets[0].reps,4);
    const virtual=(await workouts.projectedWorkoutPlans('owner','2026-01-09','2026-01-09'))[0];
    const virtualMove={id:virtual.id,mutationId:randomUUID(),revision:-1,from:virtual.date,date:'2026-02-04',timezone:'UTC'};
    await move('owner',virtualMove); await move('owner',virtualMove);
    assert.equal((await workouts.projectedWorkoutPlans('owner',virtual.date,virtual.date)).length,0);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM gym_sessions')).rows[0].n,1);
    const cancelled=(await workouts.projectedWorkoutPlans('owner','2026-01-12','2026-01-12'))[0];
    const cancellation={id:cancelled.id,date:cancelled.date,mutationId:randomUUID()};
    const cancel=modules('lib/events/workout-move.ts').cancelScheduledWorkout;
    await cancel('owner',cancellation); await cancel('owner',cancellation);
    assert.equal((await workouts.projectedWorkoutPlans('owner',cancelled.date,cancelled.date)).length,0);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM gym_plans WHERE id=$1',[cancelled.id])).rows[0].n,0);
    await assert.rejects(()=>server.completeActivity('owner',{...check,id:`workout:plan:${cancelled.id}`,date:cancelled.date,operationId:randomUUID()}),/unavailable/);
    const readRange=modules('lib/events/activity-range.ts').readCanonicalActivityRange;
    const originalWindow=await readRange('owner',{from:date,to:'2026-01-11'},'UTC');
    assert.equal(originalWindow.length,1); assert.equal(originalWindow[0].date,'2026-01-07');
    const destinationWindow=await readRange('owner',{from:'2026-02-03',to:'2026-02-04'},'UTC');
    assert.equal(destinationWindow.filter(row=>row.id===check.id).length,1);
    assert.equal(destinationWindow.find(row=>row.id===check.id).completed,true);
    assert.equal((await readRange('other',{from:date,to:'2026-01-11'},'UTC')).length,0);
    await assert.rejects(()=>readRange('owner',{from:'2026-01-11',to:date},'UTC'),/ordered/);
    await modules('lib/events/schedule-store.ts').stopEventSchedule('owner',{operationId:randomUUID(),id,revision:0,from:'2026-02-05'});
    assert.equal((await workouts.projectedWorkoutPlans('owner','2035-10-08','2035-10-14')).length,0);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM gym_sessions')).rows[0].n,1);
    assert.equal((await workouts.projectedWorkoutPlans('owner','2026-01-07','2026-01-07')).length,1);
  } finally { await db.close(); }
});

test('copied workout blueprints keep exercises but lose schedule identity', () => {
  const original={...workoutBlueprint(),momentumSeriesId:'series',scheduled:{scheduleId:'series',originalDate:'2026-01-05'}};
  const copy=load('lib/gym/independent-blueprint.ts').independentBlueprint(original);
  assert.equal(copy.scheduled,undefined); assert.equal(copy.momentumSeriesId,undefined);
  assert.deepEqual(plain(copy.exercises),original.exercises); assert.ok(original.scheduled);
});

test('moved and deleted exceptions suppress their original slot; moved-in records survive outside rule range', () => {
  const s = { ...schedule(), end: '2026-10-16' }, originalDate = '2026-10-12';
  const moved = { scheduleId: s.id, originalDate, date: '2027-01-04', revision: 0, event: { ...s.event, completed: true } };
  assert.equal(r.projectScheduledEvents([s], [moved], '2026-10-12', '2026-10-18').length, 2);
  const destination = r.projectScheduledEvents([s], [moved], '2027-01-04', '2027-01-10');
  assert.equal(destination.length, 1); assert.equal(destination[0].event.id, r.occurrenceKey(s.id, originalDate));
  assert.equal(destination[0].event.completed, true);
  assert.equal(r.projectScheduledEvents([s], [{ ...moved, event: null }], '2027-01-04', '2027-01-10').length, 0);
});
test('stopping retains past misses and saved exceptions but hides untouched future slots', () => {
  const s = { ...schedule(), stoppedFrom: '2026-10-15' };
  assert.equal(r.projectScheduledEvents([s], [], '2026-10-12', '2026-10-18').length, 2);
  const override = { scheduleId: s.id, originalDate: '2026-10-16', date: '2026-10-16', revision: 0, event: { ...s.event, completed: true } };
  assert.equal(r.projectScheduledEvents([s], [override], '2026-10-12', '2026-10-18').length, 3);
});
test('Sunday view, ordinary board writes, and presets keep recurrence identity separate', () => {
  const s = schedule(), dates = ['2026-10-11','2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16','2026-10-17'];
  const board = r.mergeScheduledBoard([], dates, r.projectScheduledEvents([s], [], dates[0], dates.at(-1)));
  assert.equal(board.find(d => d.day === 'Monday').tasks.length, 1);
  assert.equal(r.withoutScheduled(board).flatMap(d => d.tasks).length, 0);
  assert.throws(() => r.assertUnchangedSchedules(board, []), /individually/);
  const preset = ev.resetPreset(board, () => randomUUID());
  assert.equal(preset[0].tasks[0].scheduled, undefined); assert.equal(preset[0].tasks[0].momentumSeriesId, undefined);
});
test('real schedule store: durable retries, CAS, ownership, lazy reads, completion, deletion and stopping', async t => {
  const db = await PGlite.create();
  try {
    await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY); INSERT INTO "user" VALUES('owner'),('other');`);
    const database = (await db.query('SELECT current_database() AS database')).rows[0].database;
    assert.equal((await applyEventSchedulesSchema(db)).state, 'pending');
    await assert.rejects(() => applyEventSchedulesSchema(db, {apply:true,expectedDatabase:'wrong'}), /identity/);
    assert.equal((await applyEventSchedulesSchema(db, {apply:true,expectedDatabase:database})).installed, true);
    assert.equal((await applyEventSchedulesSchema(db, {apply:true,expectedDatabase:database})).installed, false);
    const sql = async (parts,...values) => (await db.query(parts.reduce((text,p,i)=>text+(i?`$${i}`:'')+p,''),values)).rows;
    const server = loader({
      [resolve('lib/account/store.ts')]: { accountSql:sql },
      [resolve('lib/gym/event-link-store.ts')]: { assertWorkoutLinks:async()=>{} },
    })('lib/events/schedule-store.ts');
    const initial = {...schedule(),revision:-1}, create = {operationId:randomUUID(),schedule:initial};
    const saved = await server.createEventSchedule('owner',create);
    assert.equal(saved.revision,0); assert.deepEqual(plain(await server.createEventSchedule('owner',create)),plain(saved));
    await assert.rejects(()=>server.createEventSchedule('owner',{...create,schedule:{...initial,days:[1]}}),/already used/);
    assert.equal((await server.readEventSchedules('other')).length,0);
    for (const from of ['2026-10-12','2027-10-11','2030-10-07']) assert.equal((await server.readScheduledOccurrences('owner',from,from)).length,1);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM b1_event_occurrences')).rows[0].n,0);
    const first = (await server.readScheduledOccurrences('owner','2026-10-12','2026-10-18'))[0];
    const command = {operationId:randomUUID(),before:first.event,event:{...first.event,completed:true,completedAt:'2026-10-12T12:00:00.000Z'},date:first.date};
    await assert.rejects(()=>server.writeScheduledOccurrence('other',command),/unavailable/);
    const completed = await server.writeScheduledOccurrence('owner',command);
    assert.equal(completed.revision,0);
    assert.deepEqual(plain(await server.writeScheduledOccurrence('owner',command)),plain(completed));
    await assert.rejects(()=>server.writeScheduledOccurrence('owner',{...command,operationId:randomUUID()}),/Newer/);
    const checked = (await server.readScheduledOccurrences('owner','2026-10-12','2026-10-18'))[0];
    // Projection ordering is intentionally not identity; locate by original slot.
    const record = (await server.readScheduledOccurrences('owner','2026-10-12','2026-10-18')).find(o=>o.event.id===first.event.id);
    const reopen = {operationId:randomUUID(),before:record.event,event:{...record.event,completed:false,completedAt:null},date:'2026-10-13'};
    await server.writeScheduledOccurrence('owner',reopen);
    await server.writeScheduledOccurrence('owner',command); // Old retry cannot resurrect a completion.
    const moved = (await server.readScheduledOccurrences('owner','2026-10-12','2026-10-18')).find(o=>o.event.id===first.event.id);
    assert.equal(moved.date,'2026-10-13'); assert.equal(moved.event.completed,false);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM b1_event_occurrences')).rows[0].n,1);
    await server.writeScheduledOccurrence('owner',{operationId:randomUUID(),before:moved.event,event:null,date:moved.date});
    assert.equal((await server.readScheduledOccurrences('owner','2026-10-12','2026-10-18')).some(o=>o.event.id===first.event.id),false);
    await server.stopEventSchedule('owner',{operationId:randomUUID(),id:saved.id,revision:0,from:'2026-10-15'});
    assert.equal((await server.readScheduledOccurrences('owner','2026-10-19','2026-10-25')).length,0);
    assert.equal((await server.readScheduledOccurrences('owner','2026-10-12','2026-10-18')).length,1);
    await db.exec(`DELETE FROM "user" WHERE id='owner'`);
    for (const table of ['b1_event_schedules','b1_event_occurrences','b1_event_schedule_operations']) assert.equal((await db.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n,0);
  } finally { await db.close(); }
});
