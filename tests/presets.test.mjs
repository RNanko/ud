import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, blueprint, dates, events } from './gym-fixture.mjs';
import { plain } from './helpers.mjs';
const today=dates.dateInZone(new Date(),'Europe/Warsaw'),week=events.weekKey(today);
const board=()=>[{id:'monday',day:'Monday',tasks:[{id:crypto.randomUUID(),title:'Fixture event',completed:true,completedAt:new Date().toISOString(),notes:'Keep note',timing:{start:'18:00',duration:30,overnight:false}}]}];
const command=(before,name='Fixture preset',id=crypto.randomUUID())=>({id,name,week,board:board(),before});
test('up to three named week presets, explicit replacement, retries, and stale protection',async()=>{
  const state=fixture();let before=[];
  const first=command(before),initial=await state.planner.saveNamedWeekPreset(first);assert.equal(initial.success,true);
  assert.equal((await state.planner.saveNamedWeekPreset(first)).success,true);assert.equal(state.rows.userEvents.length,1);
  before=initial.data;for(let i=2;i<=3;i++){const result=await state.planner.saveNamedWeekPreset(command(before,`Fixture ${i}`));assert.equal(result.success,true);before=result.data;}
  const overflow=await state.planner.saveNamedWeekPreset(command(before));assert.equal(overflow.success,false);assert.match(overflow.message,/three/);
  const replacement=await state.planner.saveNamedWeekPreset(command(before,'Replaced',before[1].id));assert.equal(replacement.success,true);assert.equal(replacement.data.length,3);assert.equal(replacement.data.find(x=>x.id===before[1].id).name,'Replaced');
  const stale=await state.planner.saveNamedWeekPreset(command(before,'Stale',before[0].id));assert.equal(stale.success,false);assert.match(stale.message,/Newer/);
  const remove={id:before[0].id,before:replacement.data};assert.equal((await state.planner.removeNamedWeekPreset(remove)).success,true);assert.equal((await state.planner.removeNamedWeekPreset(remove)).success,true);assert.equal((await state.planner.getNamedWeekPresets()).length,2);
});
test('legacy week remains intact; new snapshots contain targets and timing without completion or actual logs',async()=>{
  const state=fixture(),legacy=board();state.rows.userEvents.push({id:'legacy',userId:'alice',week:'default-WK',data:legacy});
  const bp=blueprint();bp.exercises[0].targets.loadKg=60;const plan=await state.actions.scheduleGymWorkout({operationId:crypto.randomUUID(),data:bp,dates:[today],timezone:'Europe/Warsaw'});assert.equal(plan.success,true);
  await state.actions.completeGymWorkout({id:crypto.randomUUID(),mutationId:crypto.randomUUID(),sessionId:null,planId:plan.plans[0].id,revision:null,date:today,timezone:'Europe/Warsaw',notes:'Actual note'});
  const before=await state.planner.getNamedWeekPresets();assert.equal(before.length,1);assert.equal(before[0].name,'Saved week');
  const result=await state.planner.saveNamedWeekPreset(command(before));assert.equal(result.success,true);assert.deepEqual(plain(state.rows.userEvents.find(x=>x.id==='legacy').data),plain(legacy));
  const saved=result.data.at(-1).board.flatMap(x=>x.tasks);assert.ok(saved.every(x=>!x.completed && x.completedAt===null));assert.equal(saved.find(x=>x.kind==='training').workout.exercises[0].targets.loadKg,60);assert.ok(!JSON.stringify(saved).includes('Actual note'));
});
test('event preset removal is owner scoped, retry safe, and does not remove scheduled events',async()=>{
  const state=fixture(),item=board()[0].tasks[0];const scheduled=await state.planner.saveEventBoard({week,before:[],data:board(),mutationId:crypto.randomUUID()});assert.equal(scheduled.success,true);
  const saved=await state.planner.saveEventPreset({event:item});assert.equal(saved.success,true);const ownId=saved.data[0].id;
  state.rows.userEvents.push({id:'foreign-presets',userId:'bob',week:'event-presets',data:[{...item,id:'foreign'}]});
  assert.equal((await state.planner.removeEventPreset({id:'foreign'})).success,true);assert.equal(state.rows.userEvents.find(x=>x.userId==='bob').data.length,1);
  assert.equal((await state.planner.removeEventPreset({id:ownId})).success,true);assert.equal((await state.planner.removeEventPreset({id:ownId})).success,true);assert.equal((await state.planner.getEventPresets()).length,0);assert.deepEqual(plain(state.rows.userEvents.find(x=>x.week===week).data),plain(scheduled.data));
  const denied=fixture({owner:null});assert.equal((await denied.planner.removeNamedWeekPreset({id:crypto.randomUUID(),before:[]})).success,false);assert.equal((await denied.planner.removeEventPreset({id:ownId})).success,false);assert.equal(denied.calls.length,0);
});
