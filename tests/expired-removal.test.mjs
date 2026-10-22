import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule,plain} from './helpers.mjs';
import {fixture} from './gym-fixture.mjs';
const {removesOnlyRecords}=loadModule('lib/account/record-removal.ts');

test('deletion-only boards cannot smuggle edits, additions, moves, duplicates or metadata changes',()=>{
 for(const field of ['items','tasks']){
  const before=[{id:'day',label:'Keep',[field]:[{id:'a',title:'A'},{id:'b',title:'B'},{id:'c',title:'C'}]}];
  const after=structuredClone(before);after[0][field].splice(1,1);assert.equal(removesOnlyRecords(before,after,field),true);
  const clear=structuredClone(before);clear[0][field]=[];assert.equal(removesOnlyRecords(before,clear,field),true);
  for(const mutate of [v=>v[0][field].reverse(),v=>v[0][field][0].title='Edited',v=>v[0][field].push(v[0][field][0]),v=>v[0].label='Changed',v=>v[0][field].push({id:'new',title:'New'})]){
   const invalid=structuredClone(after);mutate(invalid);assert.equal(removesOnlyRecords(before,invalid,field),false);
  }
  assert.equal(removesOnlyRecords(before,before,field),false);
  assert.equal(removesOnlyRecords(before,[],field),false);
 }
});

test('expired Gym can remove owned records but cannot restore or edit them',async()=>{
 const f=fixture({canWrite:false});const id=crypto.randomUUID();
 f.rows.gymPlans.push({id,userId:'alice',archived:false,revision:0,date:'2026-10-20',data:{}});
 assert.equal((await f.actions.archiveGymRecord({id,kind:'plan',archived:true,revision:0})).success,true);
 assert.equal(f.rows.gymPlans[0].archived,true);
 assert.equal((await f.actions.archiveGymRecord({id,kind:'plan',archived:false,revision:0})).success,false);
 const foreign=crypto.randomUUID();f.rows.gymPlans.push({id:foreign,userId:'bob',archived:false,revision:0});
 assert.equal((await f.actions.archiveGymRecord({id:foreign,kind:'plan',archived:true,revision:0})).success,false);
 assert.equal(f.rows.gymPlans[1].archived,false);
});

test('expired Events can remove a record and cannot change a survivor through the same board save',async()=>{
 const f=fixture({canWrite:false}),week='2026-WK43';
 const before=[{id:'monday',day:'Monday',tasks:[{id:'a',title:'A',completed:false,completedAt:null},{id:'b',title:'B',completed:false,completedAt:null}]}];
 f.rows.userEvents.push({id:'owned-week',userId:'alice',week,data:structuredClone(before)});
 const next=structuredClone(before);next[0].tasks.splice(0,1);
 const bad=structuredClone(next);bad[0].tasks[0].title='Smuggled edit';
 assert.equal((await f.planner.saveEventBoard({week,mutationId:crypto.randomUUID(),before,data:bad})).success,false);
 assert.deepEqual(plain(f.rows.userEvents[0].data),before);
 assert.equal((await f.planner.saveEventBoard({week,mutationId:crypto.randomUUID(),before,data:next})).success,true);
 assert.deepEqual(plain(f.rows.userEvents[0].data),next);
});
