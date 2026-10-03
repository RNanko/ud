import test from "node:test";
import assert from "node:assert/strict";
import { plain } from "./helpers.mjs";
import { blueprint, logic as gymLogic } from "./gym-fixture.mjs";
import { types, goalTypes, goalEvaluation as evals, goalReconcile, goalReview, logic, reduce, fixture, emptySources } from "./momentum-fixture.mjs";
const now = '2026-10-03T18:00:00.000Z', zone = 'Europe/Warsaw';
const reminder = () => ({ enabled:false,days:[6],time:'09:00',leadDays:null });
const rule = (metric, patch={}) => ({metric,target:['balance','savings','investment'].includes(metric)?100000:metric==='minutes'?100:3,currency:['balance','savings','investment'].includes(metric)?'PLN':null,period:metric==='balance'?'ongoing':metric==='investment'||metric==='savings'?'monthly':'weekly',start:'2026-10-01',end:null,timezone:zone,scopeId:null,sources:[],journeyId:null,throughout:false,freshnessDays:7,...patch});
const goal = value => ({id:crypto.randomUUID(),name:'Fixture goal',lifecycle:'active',pinned:false,hidden:false,order:0,versions:[{revision:1,effectiveFrom:value.start,rule:value}],reminder:reminder(),createdAt:now,updatedAt:now});
const dataWith = (...goals) => ({...types.emptyMomentum(),tracker:{...goalTypes.emptyTracker(),goals}});
const scope = (kind='cash', currency='PLN') => ({id:crypto.randomUUID(),name:'Fixture source',kind,currency,createdAt:now});
const record = (scopeId,kind,value,at='2026-10-02T10:00:00.000Z',patch={}) => ({id:crypto.randomUUID(),scopeId,kind,value,reference:crypto.randomUUID(),occurredAt:at,date:at.slice(0,10),note:'',linkedFocusId:null,confirmedThrough:null,updatedAt:now,...patch});
const evaluate = (g,d,sources=emptySources(),at=now,date) => evals.evaluateGoal(g,d,{...sources,activities:logic.sourceActivities(sources,zone)},at,date);
const reconcile = (d,sources=emptySources(),at=now) => goalReconcile.reconcileGoals(d,{...sources,activities:logic.sourceActivities(sources,zone)},at);
test('minimum balance uses opening + subsequent settled movements, preserves a negative balance and never calls it saved money',()=>{
  const account=scope(),g=goal(rule('balance',{scopeId:account.id})),d=dataWith(g);d.tracker.scopes.push(account);
  d.tracker.records.push(record(account.id,'snapshot',500000,'2026-10-01T08:00:00.000Z'),record(account.id,'cash-out',250000));
  let result=evaluate(g,d);assert.equal(result.value,250000);assert.equal(result.buffer,150000);assert.equal(result.status,'Above minimum now');
  d.tracker.records.push(record(account.id,'cash-out',180000,'2026-10-03T08:00:00.000Z'));result=evaluate(g,d);assert.equal(result.value,70000);assert.equal(result.remaining,30000);assert.equal(result.status,'Below minimum');
  d.tracker.records.push(record(account.id,'cash-out',90000,'2026-10-03T09:00:00.000Z'));assert.equal(evaluate(g,d).value,-20000);
  assert.equal(reconcile(d).tracker.attainments.length,0);
});
test('stale balances retain truthful amounts without claiming current attainment',()=>{
  const account=scope(),g=goal(rule('balance',{scopeId:account.id,freshnessDays:1})),d=dataWith(g);d.tracker.scopes.push(account);d.tracker.records.push(record(account.id,'snapshot',500000,'2026-09-01T08:00:00.000Z'));
  const result=evaluate(g,d);assert.equal(result.value,500000);assert.equal(result.met,false);assert.match(result.status,/stale/);
});
test('JSONB object key ordering and refresh timestamps do not create false historical corrections',()=>{
  const g=goal(rule('sessions')),d=reconcile(dataWith(g)),reordered=structuredClone(d);reordered.tracker.goals[0].versions[0].rule=Object.fromEntries(Object.entries(g.versions[0].rule).reverse());
  const result=evaluate(reordered.tracker.goals[0],reordered,emptySources(),'2026-10-03T19:00:00.000Z');assert.equal(result.revised,false);assert.equal(result.signature,d.tracker.history[0].signature);
});
test('unused manual scopes can be deleted separately, while referenced history and shared scopes stay protected',()=>{
  const account=scope(),g=goal(rule('balance',{scopeId:account.id})),d=dataWith(g);d.tracker.scopes.push(account);d.tracker.records.push(record(account.id,'snapshot',500000));
  assert.throws(()=>reduce(d,{type:'goal-remove-scope',id:account.id},emptySources(),now),/referencing/);
  const without=reduce(d,{type:'goal-delete',id:g.id},emptySources(),now);assert.equal(without.tracker.records.length,1);
  const clean=reduce(without,{type:'goal-remove-scope',id:account.id},emptySources(),now);assert.equal(clean.tracker.records.length,0);assert.equal(clean.tracker.scopes.length,0);
});
test('authoritative balance snapshots replace included movements and throughout-period attainment requires complete recorded coverage',()=>{
  const account=scope(),g=goal(rule('balance',{scopeId:account.id,period:'monthly',throughout:true})),d=dataWith(g);d.tracker.scopes.push(account);
  d.tracker.records.push(record(account.id,'snapshot',500000,'2026-09-30T20:00:00.000Z'),record(account.id,'cash-out',250000));
  assert.equal(evaluate(g,d).met,false);assert.match(evaluate(g,d).status,/coverage/);
  d.tracker.records[0].confirmedThrough='2026-10-03';assert.equal(evaluate(g,d).met,true);
  d.tracker.records.push(record(account.id,'snapshot',200000,'2026-10-03T10:00:00.000Z',{confirmedThrough:'2026-10-03'}));assert.equal(evaluate(g,d).value,200000);
  d.tracker.records.push(record(account.id,'cash-out',150000,'2026-10-03T11:00:00.000Z'));assert.equal(evaluate(g,d).met,false);
});
test('an opening allocated balance is excluded from savings-period additions; withdrawals and currencies remain exact',()=>{
  const pot={id:crypto.randomUUID(),name:'Fixture pot',currency:'PLN',targetMinor:100000,openingMinor:500000,openingDate:'2026-10-01',targetDate:null,entries:[]};
  const g=goal(rule('savings',{scopeId:pot.id})),d=dataWith(g);d.savings.push(pot);assert.equal(evaluate(g,d).value,0);
  pot.entries.push({id:crypto.randomUUID(),allocationRef:'split-1',date:'2026-10-02',type:'contribution',amountMinor:100000,note:''},{id:crypto.randomUUID(),allocationRef:'withdrawal-1',date:'2026-10-03',type:'withdrawal',amountMinor:12345,note:''});assert.equal(evaluate(g,d).value,87655);
  pot.currency='USD';assert.equal(evaluate(g,d).value,null);
});
test('completed Gym session IDs and actual training dates deduplicate projections while session/day goals differ',()=>{
  const sources=emptySources(),bp=blueprint(['bench-press','stationary-cycling']),planId=crypto.randomUUID();
  sources.gym.plans.push({id:planId,date:'2026-10-02',timezone:zone,data:bp,revision:0});
  for(let i=0;i<2;i++){const session=gymLogic.newSession(bp,'2026-10-02',zone);session.status='completed';session.completionMode='confirmation';session.finishedAt=now;sources.gym.sessions.push({id:crypto.randomUUID(),planId:i===0?planId:null,revision:0,data:session});}
  sources.gym.sessions.push({...sources.gym.sessions[0]}); // repeated source delivery
  const g=goal(rule('sessions')),days=goal(rule('training-days')),d=dataWith(g,days);
  assert.equal(evaluate(g,d,sources).value,2);assert.equal(evaluate(days,d,sources).value,1);assert.match(evaluate(g,d,sources).contributions[0].label,/no details logged/);
  sources.gym.sessions[0].data.status='active';sources.gym.sessions[2].data.status='active';assert.equal(evaluate(g,d,sources).value,1);
});
test('planned events and workout times do not become attendance or measured minutes',()=>{
  const sources=emptySources();sources.weeks.push({week:'2026-WK40',data:[{id:'monday',day:'Monday',tasks:[{id:'event',title:'Practice',completed:false,timing:{start:'18:00',duration:60,overnight:false}}]}]});
  const g=goal(rule('events',{start:'2026-09-28'})),time=goal(rule('minutes',{sources:[{kind:'event',id:'event',week:'2026-WK40'}],start:'2026-09-28'})),d=dataWith(g,time);
  assert.equal(evaluate(g,d,sources).value,0);assert.equal(evaluate(time,d,sources).value,0);
});
function focus(minutes,start,source={kind:'task',id:'practice'}){return{id:crypto.randomUUID(),source,date:start.slice(0,10),timezone:zone,plannedSeconds:minutes*60,intervals:[{start,end:new Date(Date.parse(start)+minutes*60000).toISOString()}],status:'saved',confirmedSeconds:minutes*60,notes:'',savedAt:now};}
test('25+30+20 saved minutes produce 75/100, never task completion or duplicated manual/timer time',()=>{
  const activity=scope('activity',null),g=goal(rule('minutes',{scopeId:activity.id,sources:[{kind:'task',id:'practice'}]})),d=dataWith(g);d.tracker.scopes.push(activity);
  d.focus.push(focus(25,'2026-10-01T08:00:00.000Z'),focus(30,'2026-10-02T08:00:00.000Z'),focus(20,'2026-10-03T08:00:00.000Z'));
  d.tracker.records.push(record(activity.id,'duration',1500,'2026-10-01T08:00:00.000Z',{linkedFocusId:d.focus[0].id}));
  let result=evaluate(g,d);assert.equal(result.value,75);assert.equal(result.remaining,25);
  d.tracker.records.push(record(activity.id,'duration',600,'2026-10-01T08:05:00.000Z'));assert.equal(evaluate(g,d).value,75);
  d.focus.push({...focus(45,'2026-10-03T09:00:00.000Z'),status:'discarded'});assert.equal(evaluate(g,d).value,75);
  d.focus[1].confirmedSeconds=600;assert.equal(evaluate(g,d).value,55);
});
test('timed intervals split across calendar periods and DST days using timezone boundaries without duplicate seconds',()=>{
  const g=goal(rule('minutes',{start:'2026-09-28',period:'monthly',sources:[{kind:'task',id:'practice'}]})),d=dataWith(g);
  d.focus.push(focus(30,'2026-09-30T21:45:00.000Z'));
  assert.equal(evaluate(g,d,emptySources(),now,'2026-09-30').value,15);assert.equal(evaluate(g,d).value,15);
  const a=evals.localDayInstant('2026-03-29',zone),b=evals.localDayInstant('2026-03-30',zone),c=evals.localDayInstant('2026-10-25',zone),e=evals.localDayInstant('2026-10-26',zone);
  assert.equal((b-a)/3600000,23);assert.equal((e-c)/3600000,25);
});
test('40+60 external USD contributions attain once; withdrawals, backdated corrections and new months recalculate without carryover',()=>{
  const account=scope('investment','USD'),g=goal(rule('investment',{scopeId:account.id,currency:'USD',target:10000}));let d=dataWith(g);d.tracker.scopes.push(account);
  d.tracker.records.push(record(account.id,'contribution',4000));assert.equal(evaluate(g,d).remaining,6000);
  d.tracker.records.push(record(account.id,'contribution',6000,'2026-10-03T09:00:00.000Z'));d=reconcile(d);assert.equal(d.tracker.attainments.length,1);assert.equal(evaluate(g,d).status,'Monthly contribution target met');
  d=reconcile(d);assert.equal(d.tracker.attainments.length,1);
  d.tracker.records.push(record(account.id,'withdrawal',3000,'2026-10-03T10:00:00.000Z'));d=reconcile(d);assert.equal(evaluate(g,d).value,7000);assert.equal(d.tracker.attainments.length,1);assert.ok(d.tracker.history[0].revisedAt);
  d.tracker.records.pop();d=reconcile(d);assert.equal(d.tracker.attainments.length,1);
  const november='2026-11-02T12:00:00.000Z';d=reconcile(d,emptySources(),november);assert.equal(evaluate(g,d,emptySources(),november).value,0);assert.equal(d.tracker.history.length,2);assert.equal(d.tracker.history.find(x=>x.start==='2026-10-01').value,10000);
});
test('rule revisions preserve earlier periods and explicitly scheduled next-period targets',()=>{
  const sources=emptySources(),initial=types.emptyMomentum(),id=crypto.randomUUID();let d=reduce(initial,{type:'goal-save',id,name:'Workouts',rule:rule('sessions',{start:'2026-09-28'}),apply:'current',reminder:reminder()},sources,now);
  d=reduce(d,{type:'goal-save',id,name:'Workouts',rule:{...d.tracker.goals[0].versions[0].rule,target:4},apply:'next',reminder:reminder()},sources,now);
  assert.equal(evals.versionFor(d.tracker.goals[0],'2026-10-03').rule.target,3);assert.equal(evals.versionFor(d.tracker.goals[0],'2026-10-05').rule.target,4);
  d=reduce(d,{type:'goal-save',id,name:'Workouts',rule:{...d.tracker.goals[0].versions[0].rule,target:2},apply:'current',reminder:reminder()},sources,now);
  assert.equal(evals.versionFor(d.tracker.goals[0],'2026-10-03').rule.target,2);assert.equal(evals.versionFor(d.tracker.goals[0],'2026-10-05').rule.target,4);
});
test('snoozing/dismissing reminders does not satisfy targets; attainment suppresses just its period',()=>{
  const g=goal(rule('sessions'));g.reminder={enabled:true,days:[6],time:'09:00',leadDays:null};const d=dataWith(g),result=evaluate(g,d),key=evals.reminderDue(g,result,d.tracker,now);assert.ok(key);
  d.tracker.reminders.push({key,goalId:g.id,state:'dismissed',until:null});assert.equal(evals.reminderDue(g,result,d.tracker,now),null);assert.equal(evaluate(g,d).met,false);
  assert.equal(evals.reminderDue(g,{...result,met:true},d.tracker,now),null);
  const next='2026-10-10T18:00:00.000Z';assert.ok(evals.reminderDue(g,evaluate(g,d,emptySources(),next),d.tracker,next));
});
test('manual record validation rejects future records, duplicate allocations and market/internal transactions',()=>{
  const account=scope('investment','USD'),g=goal(rule('investment',{scopeId:account.id,currency:'USD'})),d=dataWith(g);d.tracker.scopes.push(account);
  const manual=record(account.id,'contribution',4000);const {updatedAt,...entry}=manual;
  const saved=reduce(d,{type:'goal-record',value:entry},emptySources(),now);assert.equal(saved.tracker.records.length,1);
  assert.throws(()=>reduce(saved,{type:'goal-record',value:{...entry,id:crypto.randomUUID()}},emptySources(),now),/already used/);
  assert.throws(()=>reduce(d,{type:'goal-record',value:{...entry,kind:'cash-in'}},emptySources(),now),/supported record type/);
  assert.throws(()=>reduce(d,{type:'goal-record',value:{...entry,date:'2026-10-04',occurredAt:'2026-10-04T10:00:00.000Z'}},emptySources(),now),/past date/);
  assert.ok(updatedAt);
});
test('missing source scopes and failed account loads never masquerade as reliable zero data',async()=>{
  const g=goal(rule('balance',{scopeId:crypto.randomUUID()})),d=dataWith(g);assert.equal(evaluate(g,d).value,null);assert.match(evaluate(g,d).status,/insufficient/);
  const app=fixture();app.failNext();await assert.rejects(()=>app.actions.getMomentumBundle({timezone:zone}),/offline/);
});
test('server owner checks, CAS retries, export and deletion cover tracker data while source tools stay unchanged',async()=>{
  const app=fixture(),loaded=await app.actions.getMomentumBundle({timezone:zone}),id=crypto.randomUUID(),command={revision:loaded.record.revision,mutationId:crypto.randomUUID(),timezone:zone,command:{type:'goal-save',id,name:'Private goal',rule:rule('sessions'),apply:'current',reminder:reminder()}};
  const saved=await app.actions.mutateMomentum(command);assert.equal(saved.success,true);assert.equal((await app.actions.mutateMomentum(command)).success,true);assert.equal((await app.actions.exportMomentum()).data.tracker.goals.length,1);
  app.owner('bob');const bob=await app.actions.getMomentumBundle({timezone:zone});assert.equal(bob.goalEvaluations.length,0);
  assert.equal((await app.actions.mutateMomentum({...command,revision:bob.record.revision,mutationId:crypto.randomUUID(),command:{type:'goal-card',id,pinned:true}})).success,false);
  app.owner('alice');const latest=await app.actions.getMomentumBundle({timezone:zone});const cleared=await app.actions.mutateMomentum({revision:latest.record.revision,mutationId:crypto.randomUUID(),timezone:zone,command:{type:'delete-all'}});assert.equal(cleared.success,true);assert.equal(cleared.record.data.tracker,undefined);assert.equal(app.sources.alice.todo[1].items.length,1);
});
test('weekly review keeps monthly windows and snapshot results separate from personal reflections',()=>{
  const account=scope('investment','USD'),g=goal(rule('investment',{scopeId:account.id,currency:'USD',target:10000})),d=dataWith(g);d.preferences.money=true;d.tracker.scopes.push(account);d.tracker.records.push(record(account.id,'contribution',10000));
  const rows=goalReview.goalReview(d,{...emptySources(),activities:[]},'2026-09-28',zone,now);assert.match(rows[0].period,/2026-10.*calendar month/);assert.equal(rows[0].value,10000);assert.equal(rows[0].currency,'USD');
  const snapshot=plain(rows);d.tracker.records=[];assert.equal(snapshot[0].value,10000);
});
