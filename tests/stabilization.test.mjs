import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {loadModule, plain} from './helpers.mjs';
import {dates, events} from './gym-fixture.mjs';

const todo = loadModule('lib/todo.ts');
const eq = (column, value) => ({column, value});
const and = (...conditions) => ({conditions});
function todoFixture({race = false, readonly = false} = {}) {
  let stored = null; const writes = [], tags = [], operations = [];
  const db = {query:{kanbanBoard:{findFirst:async()=>stored && structuredClone(stored)}}, insert:()=>{
    operations.push('insert');
    let value; const query = {values:v=>{value=v;return query;}, onConflictDoNothing:()=>query,
      returning:async()=>{writes.push(value);if(race){stored={...value,data:todo.emptyTodoBoard()};stored.data[0].items.push({id:'other',content:'Other tab'});return [];}
        if(stored)return [];stored=structuredClone(value);return [{id:value.id}];}};
    return query;
  }};
  const actions = loadModule('lib/actions/todo.actions.ts', {'../db/drizzle':db,'../db/schema':{kanbanBoard:{userId:'userId',id:'id',data:'data'}},
    'drizzle-orm':{eq,and},'next/cache':{cacheLife(){},cacheTag(){},updateTag:tag=>tags.push(tag)},'../todo':todo,
    '../session':{requireUserId:async(requested,intent)=>{if(requested && requested!=='alice')throw Error('Unauthorized');if(readonly&&intent==='write')throw Error('Membership is read-only');return 'alice';}}});
  return {actions,writes,tags,operations,stored:()=>stored};
}
test('empty To-Do reads never persist a board, including read-only accounts', async()=>{
  const f=todoFixture({readonly:true});assert.deepEqual(plain(await f.actions.getToDoList()),plain(todo.emptyTodoBoard()));assert.equal(f.operations.length,0);
  await assert.rejects(f.actions.getToDoList('bob'),/Unauthorized/);
});
test('the first guarded To-Do save persists once and a retry preserves its identity',async()=>{
  const f=todoFixture(),before=todo.emptyTodoBoard(),next=todo.emptyTodoBoard();next[0].items.push({id:'new',content:'First task'});
  assert.equal((await f.actions.updateToDoList(next,before)).success,true);
  assert.equal((await f.actions.updateToDoList(next,before)).success,true);
  assert.equal(f.writes.length,1);assert.equal(f.stored().id,'todo:alice');assert.deepEqual(plain(f.stored().data),plain(next));assert.deepEqual(f.tags,['todo-data']);
});
test('a concurrent first To-Do save reports the other tab instead of replacing it',async()=>{
  const f=todoFixture({race:true}),before=todo.emptyTodoBoard(),next=todo.emptyTodoBoard();next[0].items.push({id:'new',content:'First task'});
  const result=await f.actions.updateToDoList(next,before);assert.equal(result.conflict,true);assert.equal(result.data[0].items[0].id,'other');assert.equal(f.stored().data[0].items[0].id,'other');
});

function calendarFixture(stored=[]) {
  const queries=[];const sql=async(parts,...values)=>{const query=parts.join('?');queries.push({query,values});return query.startsWith('SELECT id,week,data')?stored:[];};
  const actions=loadModule('lib/actions/calendar-window.actions.ts',{'node:crypto':{createHash},'../account/store':{accountSql:sql,accountSettings:async()=>({preferences:{weekStart:'sunday'}})},'../session':{requireUserId:async()=> 'alice'},'../events':events,'../gym/dates':dates});
  return {actions,queries};
}
test('empty Sunday-start calendar reads both ISO weeks without creating rows',async()=>{
  const f=calendarFixture(),result=await f.actions.getAccountEventWindow('2026-10-04');assert.equal(result.length,7);assert.equal(result[0].day,'Sunday');assert.ok(result.every(day=>!day.tasks.length));assert.equal(f.queries.length,1);assert.ok(f.queries[0].query.startsWith('SELECT'));
});
test('duplicate calendar rows fail visibly instead of discarding historical data',async()=>{
  const f=calendarFixture([{id:'a',week:'2026-WK40',data:[]},{id:'b',week:'2026-WK40',data:[]}]);await assert.rejects(f.actions.getAccountEventWindow('2026-10-04'),/conflicting/);assert.equal(f.queries.length,1);
});
test('obsolete Events mutators reject unversioned payloads without touching saved weeks',async()=>{
  const writes=[];const db={query:{userEvents:{findFirst:async()=>null}},insert:()=>({values:async v=>writes.push(v)})};
  const actions=loadModule('lib/actions/events.actions.ts',{'next/headers':{headers:async()=>({})},'../auth':{auth:{api:{getSession:async()=>({session:{userId:'alice'}})}}},'../db/drizzle':db,'../db/schema':{userEvents:{userId:'owner',week:'week'}},'drizzle-orm':{eq,and},'next/cache':{updateTag(){}},'../session':{requireUserId:async()=> 'alice'}});
  assert.equal((await actions.updateEventsList([{invalid:'data',workout:{sessionId:'forged'}}],'2026-WK40')).success,false);
  assert.equal((await actions.setDefaultWeekEvents([{invalid:'data'}])).success,false);assert.equal(writes.length,0);
});

test('checkout readiness includes the GBP annual offer',()=>{
  const config=loadModule('lib/account/config.ts'),env={STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_PERSONAL_PRODUCT_ID:'prod_fixture',STRIPE_PORTAL_CONFIGURATION_ID:'bpc_fixture',STRIPE_WEBHOOK_SECRET:'whsec_fixture',STRIPE_ANNUAL_PRICE_PLN:'p1',STRIPE_ANNUAL_PRICE_EUR:'p2',STRIPE_ANNUAL_PRICE_USD:'p3'};
  const ready=value=>loadModule('lib/account/billing/stripe.ts',{stripe:class{},'../config':config},{process:{env:value}}).checkoutConfigurationReady();
  assert.equal(ready(env),false);assert.equal(ready({...env,STRIPE_ANNUAL_PRICE_GBP:'p4'}),true);
});
const frozenDate=instant=>class extends Date{constructor(...args){super(...(args.length?args:[instant]));}static now(){return Date.parse(instant);}};
function investmentFixture(instant,timezone){
  const writes=[],Clock=frozenDate(instant),domain=loadModule('lib/investments.ts',{}, {Date:Clock});
  const db={insert:()=>({values:value=>({returning:async()=>{writes.push(value);return [value];}})})};
  const actions=loadModule('lib/actions/investments.actions.ts',{'drizzle-orm':{eq,and,desc:x=>x},'next/cache':{revalidatePath(){}},'../db/drizzle':db,'../db/schema':{investmentPositions:{}},'../session':{requireUserId:async()=> 'alice'},'../investments':domain,'../investment-market':{},'../data/crypto-catalog.json':{assets:[]},'../account/store':{accountSettings:async()=>({preferences:{timezone}})},'../gym/dates':dates},{Date:Clock});
  return {actions,writes};
}
const position={kind:'other',currency:'USD',assetId:null,symbol:'AAPL',name:'Fixture',buyPrice:'10',quantity:'1',manualPrice:''};
test('investment purchase dates use the account day after Warsaw midnight',async()=>{
  const f=investmentFixture('2026-10-03T22:30:00Z','Europe/Warsaw');assert.equal((await f.actions.saveInvestmentPosition(null,{...position,boughtOn:'2026-10-04'})).success,true);assert.equal(f.writes.length,1);
});
test('investment purchase dates reject tomorrow before New York midnight',async()=>{
  const f=investmentFixture('2026-10-03T02:30:00Z','America/New_York');assert.equal((await f.actions.saveInvestmentPosition(null,{...position,boughtOn:'2026-10-03'})).success,false);assert.equal(f.writes.length,0);
});

test('finance chart query groups and labels months by year without mixing currencies',async()=>{
  const statements=[],sql=(parts,...values)=>({text:parts.join('?'),values});let grouping,where;
  // Only the database boundary is simulated; grouping follows the real query expression.
  const query={from:()=>query,where:condition=>{where=condition;return query;},groupBy:expression=>{grouping=expression;return query;},orderBy:async()=>grouping.text.includes('YYYY-MM')?[{month:'2025-10',income:'100',outcome:'-30'},{month:'2026-10',income:'200',outcome:'-50'}]:[{month:'October',income:'300',outcome:'-80'}]};
  const actions=loadModule('lib/actions/finance.actions.ts',{'next/headers':{headers:async()=>({})},'../auth':{},'../db/drizzle':{select:fields=>{statements.push(fields);return query;}},'../db/schema':{financeTable:{userId:'owner',currency:'currency',date:'date',type:'type',amount:'amount'},financeCategories:{}},'@/types/validators':loadModule('types/validators.ts'),'../finance':loadModule('lib/finance.ts'),'../utils':{},'drizzle-orm':{eq,and,sql,desc:x=>x},'next/cache':{},'../session':{requireUserId:async requested=>{if(requested!=='alice')throw Error('Unauthorized');return 'alice';}},'../account/store':{accountSettings:async()=>({preferences:{financeDefaultCurrency:'PLN',timezone:'Europe/Warsaw'}})}});
  const result=await actions.getChartIncomeOutcomeData('alice');assert.equal(result.length,2);assert.deepEqual(result.map(x=>x.month),['2025-10','2026-10']);assert.match(statements[0].month.text,/YYYY-MM/);assert.ok(where.conditions.some(x=>x.column==='currency'&&x.value==='PLN'));await assert.rejects(actions.getChartIncomeOutcomeData('bob'),/Unauthorized/);
});
