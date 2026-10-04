import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './helpers.mjs';
import { events, validation } from './gym-fixture.mjs';
const todo = loadModule('lib/todo.ts');
const preferences = loadModule('lib/account/preferences.ts');
const eventContract=loadModule('lib/mobile/event-contract.ts',{'../events':events,'../gym/validation':validation,'../planner-time':loadModule('lib/planner-time.ts')});
const { mobileHandler,MobileError } = loadModule('lib/mobile/http.ts', { '../todo': todo, '../account/preferences': preferences,'./event-contract':eventContract }, { TextDecoder });
const operationId = '7d54a3da-3bff-4fd1-ac84-fb01217754c6';
const principal = { id: 'isolated-a', name: 'Synthetic fixture', email: 'a@example.test', emailVerified: true, expiresAt: '2099-01-01T00:00:00Z' };
function harness(overrides = {}) {
  const calls = [];
  const deps = {
    enabled: true, webOrigin: 'http://localhost:3001', authenticate: async () => principal,
    bootstrap: async () => ({ access: { state: 'trial', canWrite: true }, legal: { writable: true, reason: null } }),
    quota: async () => true,
    read: async (resource, owner, anchor) => { calls.push({ resource, owner, anchor }); return { board: todo.emptyTodoBoard(), revision: 0 }; },
    write: async (resource, owner, input) => { calls.push({ resource, owner, input }); return { acknowledgedOperationId: input.operationId }; },
    ...overrides,
  };
  return { calls, handle: mobileHandler(deps) };
}
const request = (path = 'todo', body = undefined, headers = {}) => new Request(`http://localhost:3001/api/mobile/v1/${path}`, { method: body === undefined ? 'GET' : 'PUT', headers: { ...(body === undefined ? {} : { 'content-type': 'application/json', 'expo-origin': 'udmobile://' }), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const write = () => ({ operationId, revision: 0, data: todo.emptyTodoBoard() });

test('inbox owned rights remain available after expiry while native origin/auth/schema/quotas stay enforced',async()=>{
 let calls=0;const h=harness({authenticate:async()=>({...principal,emailVerified:false}),bootstrap:async()=>({access:{state:'expired',canWrite:false},legal:{writable:true}}),inbox:async(owner,input)=>{assert.equal(owner,principal.id);calls++;return {saved:true,input};}});
 assert.equal((await h.handle(request('inbox',{type:'state',change:{id:'message',revision:1,read:true}}),'inbox')).status,200);
 assert.equal((await h.handle(request('inbox',{type:'read-all',userId:'other'}),'inbox')).status,400);
 assert.equal((await h.handle(request('inbox',{type:'reconcile'},{origin:'https://foreign.invalid'}),'inbox')).status,403);
 assert.equal((await h.handle(request('inbox?userId=other'),'inbox')).status,400);
 assert.equal((await h.handle(request('inbox-detail?id=one&id=two'),'inbox-detail')).status,400);
 assert.equal((await h.handle(request('inbox-detail'),'inbox-detail')).status,400);
 assert.equal(calls,1);
 const data={eventReminders:true,goalReminders:true,weeklyReview:true,workoutCompletion:true,productUpdates:true,quietHours:true,quietFrom:'22:00',quietTo:'08:00'},settings={type:'settings',revision:0,data};
 assert.equal((await h.handle(request('inbox',settings),'inbox')).status,403);
 const expired=harness({bootstrap:async()=>({access:{state:'expired',canWrite:false},legal:{writable:true}}),inbox:async()=>({saved:true})});
 assert.equal((await expired.handle(request('inbox',settings),'inbox')).status,200);
 const deletion=harness({bootstrap:async()=>({access:{state:'deletion-pending',canWrite:false},legal:{writable:true}}),inbox:async()=>{throw Error('Must not mutate pending deletion');}});
 assert.equal((await deletion.handle(request('inbox',settings),'inbox')).status,403);
 assert.equal((await harness({authenticate:async()=>null}).handle(request('inbox'),'inbox')).status,401);
 assert.equal((await harness({quota:async()=>false}).handle(request('inbox'),'inbox')).status,429);
});

test('static-policy mobile service never reads retired tables and preserves independent access guards', async () => {
  let verified = true, access = { state: 'trial', canWrite: true };
  const queries = [];
  const service = loadModule('lib/mobile/service.ts', {
    'node:crypto': await import('node:crypto'), 'next/cache': { revalidatePath() {}, revalidateTag() {} },
    '../auth': { auth: { api: { getSession: async () => ({ session: { userId: principal.id, expiresAt: principal.expiresAt }, user: { ...principal, emailVerified: verified } }) } } },
    '../account/access': { productAccess: async owner => { assert.equal(owner, principal.id); return access; } },
    '../account/config': { appOrigin: () => 'http://localhost:3001' },
    '../account/store': { accountSettings: async () => ({ preferences: preferences.defaultPreferences, notifications: preferences.defaultNotifications, revision: 0 }), accountSql: async parts => { const sql = parts.join('?'); queries.push(sql); assert.ok(!sql.includes('b1_legal_')); return sql.includes('b1_mobile_save_todo') ? [{ outcome: 'saved' }] : [{ data: todo.emptyTodoBoard(), revision: '0' }]; } },
    '../account/preferences': preferences, '../account/email/policy': { takeQuota: async () => true },
    '../actions/calendar-window.actions': {}, '../actions/gym.actions': {}, '../todo': todo,
    './http': { mobileHandler, todoWriteSchema: loadModule('lib/mobile/http.ts', { '../todo': todo, '../account/preferences': preferences, './event-contract': eventContract }).todoWriteSchema },
    './events': {}, './gym': {}, './finance': {}, './investments': {}, './momentum': {}, './account': {},
    '../account/billing/reconcile': {}, '../account/billing/native': {},
  }, { process: { env: { MANFORTH_MOBILE_API_ENABLED: 'true' } } });
  const bootstrap = await service.handleMobileRequest(request('bootstrap'), 'bootstrap');
  assert.equal(bootstrap.status, 200); assert.deepEqual((await bootstrap.json()).legal, { writable: true, reason: null }); assert.equal(queries.length, 0);
  assert.equal((await service.handleMobileRequest(request('todo',write()),'todo')).status,200);
  const count=queries.length;
  for (const [state, code] of [['expired','membership'], ['deletion-pending','deletion']]) { access={state,canWrite:false};const response=await service.handleMobileRequest(request('todo',write()),'todo');assert.equal(response.status,403);assert.equal((await response.json()).error.code,code); }
  verified=false;access={state:'trial',canWrite:true};assert.equal((await service.handleMobileRequest(request('todo',write()),'todo')).status,403);assert.equal(queries.length,count);
});

test('Finance validates bounded filters, exact input and independent ownership/access gates',async()=>{
 const payload={operationId,revision:0,data:{kind:'entry',id:operationId,create:true,entry:{type:'-',date:'2026-10-04',amount:'0.10',currency:'USD',category:'Food',subcategory:'',comment:''}}};
 const h=harness();assert.equal((await h.handle(request('finance',payload),'finance')).status,200);assert.equal(h.calls[0].owner,principal.id);assert.equal(h.calls[0].input.data.entry.amount,'0.10');
 for(const amount of ['-1','0','1.001','1e3','1000000000000']){const invalid=structuredClone(payload);invalid.data.entry.amount=amount;assert.equal((await h.handle(request('finance',invalid),'finance')).status,400);}
 for(const suffix of ['?size=101','?page=-1','?owner=b','?currency=USD&currency=EUR','?sort=random','?month=2026-13'])assert.equal((await h.handle(request('finance'+suffix),'finance')).status,400);
 for(const overrides of [{authenticate:async()=>({...principal,emailVerified:false})},{bootstrap:async()=>({access:{canWrite:false,state:'expired'},legal:{writable:true}})},{bootstrap:async()=>({access:{canWrite:false,state:'deletion-pending'},legal:{writable:true}})}]){const guard=harness(overrides);assert.equal((await guard.handle(request('finance',payload),'finance')).status,403);assert.equal(guard.calls.length,0);}
 const legacy=structuredClone(payload);legacy.data.create=false;legacy.data.id='older-web-id';legacy.data.entry.currency=null;assert.equal((await h.handle(request('finance',legacy),'finance')).status,200);
});

test('Investments enforce USD, owned bounded quotes, strict payloads and existing write gates',async()=>{
 const body={operationId,revision:0,data:{kind:'position',id:operationId,create:true,position:{currency:'USD',kind:'other',assetId:null,symbol:'TEST',name:'Synthetic',buyPrice:'0.10',quantity:'2',boughtOn:'2026-10-04',manualPrice:'0'}}};
 const h=harness();assert.equal((await h.handle(request('investments',body),'investments')).status,200);assert.equal(h.calls[0].owner,principal.id);
 for(const change of [{currency:'EUR'},{quantity:'0'},{buyPrice:'1e3'},{userId:'other'}]){const invalid=structuredClone(body);Object.assign(invalid.data.position,change);assert.equal((await h.handle(request('investments',invalid),'investments')).status,400);}
 for(const query of ['?ids=a,a','?ids=a&ids=b','?ids=a&owner=b',`?ids=${Array.from({length:21},(_,i)=>i).join(',')}`])assert.equal((await h.handle(request('investment-market'+query),'investment-market')).status,400);
 assert.equal((await h.handle(request('investment-market?ids=a'),'investment-market')).status,200);assert.equal(h.calls.at(-1).owner,principal.id);assert.equal((await h.handle(request('investment-market?ids=a',body),'investment-market')).status,405);
 for(const overrides of [{authenticate:async()=>({...principal,emailVerified:false})},{bootstrap:async()=>({access:{canWrite:false,state:'expired'},legal:{writable:true}})},{bootstrap:async()=>({access:{canWrite:false,state:'deletion-pending'},legal:{writable:true}})}]){const denied=harness(overrides);assert.equal((await denied.handle(request('investments',body),'investments')).status,403);assert.equal(denied.calls.length,0);}
});
test('private API is disabled by default and unauthenticated/expired requests never read data', async () => {
  for (const overrides of [{ enabled: false }, { authenticate: async () => null }, { authenticate: async () => ({ ...principal, expiresAt: '2000-01-01T00:00:00Z' }) }]) {
    const h = harness(overrides); const response = await h.handle(request(), 'todo');
    assert.ok([401, 404].includes(response.status)); assert.equal(h.calls.length, 0);
  }
});
test('session owner is authoritative and client-selected owner fields are rejected', async () => {
  const h = harness(); const response = await h.handle(request(), 'todo');
  assert.equal(response.status, 200); assert.equal(h.calls[0].owner, 'isolated-a');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal((await h.handle(request('todo?userId=isolated-b'), 'todo')).status, 400);
  assert.equal((await h.handle(request('todo', { ...write(), userId: 'isolated-b' }), 'todo')).status, 400);
  assert.equal(h.calls.length, 1);
});
test('direct writes enforce verification, legacy fail-closed capability, membership and deletion guards', async () => {
  const scenarios = [
    { authenticate: async () => ({ ...principal, emailVerified: false }) },
    { bootstrap: async () => ({ access: { canWrite: true, state: 'trial' }, legal: { writable: false, reason: 'Review legal versions' } }) },
    { bootstrap: async () => ({ access: { canWrite: false, state: 'expired' }, legal: { writable: true } }) },
    { bootstrap: async () => ({ access: { canWrite: false, state: 'deletion-pending' }, legal: { writable: true } }) },
  ];
  for (const overrides of scenarios) { const h = harness(overrides); assert.equal((await h.handle(request('todo', write()), 'todo')).status, 403); assert.equal(h.calls.length, 0); }
});
test('preferences remain available to a verified read-only member without enabling purchases', async () => {
  const h = harness({ bootstrap: async () => ({ access: { canWrite: false, state: 'expired' }, legal: { writable: false } }) });
  const response = await h.handle(request('preferences', { operationId, revision: 1, data: preferences.defaultPreferences }), 'preferences');
  assert.equal(response.status, 200); assert.equal(h.calls[0].resource, 'preferences');
});
test('native fixed scheme and browser same-origin checks protect cookie-authenticated writes', async () => {
  const h = harness();
  for (const headers of [{ origin: 'https://hostile.test' }, { 'expo-origin': 'hostile://' }, { 'sec-fetch-site': 'cross-site' }, { 'content-type': 'text/plain' }]) {
    assert.ok([403, 415].includes((await h.handle(request('todo', write(), headers), 'todo')).status));
  }
  assert.equal(h.calls.length, 0);
  assert.equal((await h.handle(request('todo', write(), { origin: 'http://localhost:3001' }), 'todo')).status, 200);
  assert.equal((await h.handle(request('todo', write()), 'todo')).status, 200);
});
test('invalid, oversized, unsupported and rate-limited requests never mutate', async () => {
  const h = harness();
  assert.equal((await h.handle(request('todo', { ...write(), revision: -1 }), 'todo')).status, 400);
  assert.equal((await h.handle(request('todo', { ...write(), operationId: 'bad' }), 'todo')).status, 400);
  assert.equal((await h.handle(request('todo', write(), { 'content-length': '600000' }), 'todo')).status, 413);
  assert.equal((await h.handle(request('gym', write()), 'gym')).status, 400);
  assert.equal((await h.handle(request('calendar?anchor=bad'), 'calendar')).status, 400);
  assert.equal((await harness({ quota: async () => false }).handle(request('todo', write()), 'todo')).status, 429);
  assert.equal(h.calls.length, 0);
});
test('unknown errors are sanitized without SQL or credential/provider details', async () => {
  const h = harness({ write: async () => { throw Error('secret database SQL details'); } });
  const response = await h.handle(request('todo', write()), 'todo');
  assert.equal(response.status, 503); assert.ok(!JSON.stringify(await response.json()).includes('secret'));
});
test('Events commands use session ownership and the same direct verification/legal/member gates', async () => {
 const command={operationId,revision:0,data:{kind:'upsert',anchor:'2035-01-02',sourceDate:null,date:'2035-01-02',event:{id:operationId,title:'Synthetic Event',completed:false}}};
 const h=harness();assert.equal((await h.handle(request('events',command),'events')).status,200);assert.equal(h.calls[0].owner,principal.id);
 assert.equal((await h.handle(request('events',{...command,userId:'other'}),'events')).status,400);
 assert.equal((await h.handle(request('events?anchor=2035-01-02&userId=other'),'events')).status,400);
 assert.equal((await h.handle(request('events',{...command,data:{...command.data,event:{...command.data.event,kind:'training'}}}),'events')).status,400);
 for(const overrides of [{authenticate:async()=>({...principal,emailVerified:false})},{bootstrap:async()=>({access:{state:'trial',canWrite:true},legal:{writable:false}})},{bootstrap:async()=>({access:{state:'expired',canWrite:false},legal:{writable:true}})}]){
  const denied=harness(overrides);assert.equal((await denied.handle(request('events',command),'events')).status,403);assert.equal(denied.calls.length,0);
 }
});

test('Gym writes require valid commands and canonical authorization; no completion bypass for another resource',async()=>{
 const command={operationId,data:{kind:'rest',date:'2026-10-01',timezone:'UTC',rest:true,previous:false}};
 let authorization=0;
 const h=harness({authorizeGymWrite:async(owner,input)=>{authorization++;assert.equal(owner,principal.id);assert.equal(input.data.kind,'rest');}});
 assert.equal((await h.handle(request('gym',command),'gym')).status,200);assert.equal(authorization,1);assert.equal(h.calls[0].owner,principal.id);
 assert.equal((await h.handle(request('gym',{...command,owner:'another'}),'gym')).status,400);
 for(const overrides of [{authenticate:async()=>({...principal,emailVerified:false})},{bootstrap:async()=>({access:{state:'deletion-pending',canWrite:false},legal:{writable:true}})}]){
  const denied=harness({...overrides,authorizeGymWrite:async()=>{throw Error('Must not reach completion exception');}});assert.equal((await denied.handle(request('gym',command),'gym')).status,403);assert.equal(denied.calls.length,0);
 }
 const expired=harness({bootstrap:async()=>({access:{state:'expired',canWrite:false},legal:{writable:true}})});
 assert.equal((await expired.handle(request('gym',command),'gym')).status,403);
 assert.equal((await h.handle(request('gym-library',command),'gym-library')).status,405);
});

test('Momentum strict contracts preserve verification/deletion and explicit limited-focus authorization',async()=>{
 const body={operationId,revision:0,command:{type:'focus-save',id:operationId,seconds:0,notes:''}};let authorized=0;
 const h=harness({bootstrap:async()=>({access:{state:'expired',canWrite:false},legal:{writable:true}}),authorizeMomentumWrite:async(owner,input)=>{assert.equal(owner,principal.id);authorized++;if(input.command.type!=='focus-save')throw new MobileError(403,'membership','Read-only');}});
 assert.equal((await h.handle(request('momentum',body),'momentum')).status,200);assert.equal(authorized,1);assert.equal((await h.handle(request('momentum',{...body,command:{type:'rest',value:true}}),'momentum')).status,403);
 for(const overrides of [{authenticate:async()=>({...principal,emailVerified:false})},{bootstrap:async()=>({access:{state:'deletion-pending',canWrite:false},legal:{writable:true}})}]){const g=harness({...overrides,authorizeMomentumWrite:async()=>{throw Error('Must not reach limited authorization');}});assert.equal((await g.handle(request('momentum',body),'momentum')).status,403);assert.equal(g.calls.length,0);}
 assert.equal((await h.handle(request('momentum',{...body,command:{type:'delete-all'}}),'momentum')).status,400);for(const suffix of ['?owner=b','?week=invalid','?week=2026-10-04&week=2026-10-05'])assert.equal((await h.handle(request('momentum'+suffix),'momentum')).status,400);
});


test('account rights retain ownership/session/origin/quota gates without requiring verified paid access',async()=>{
 const accountCalls=[],h=harness({authenticate:async()=>({...principal,emailVerified:false}),bootstrap:async()=>({access:{canWrite:false,state:'deletion-pending'},legal:{writable:true}}),account:async(owner,input)=>{accountCalls.push({owner,input});return {message:'ok'};}});
 for(const resource of ['account','account-export'])assert.equal((await h.handle(request(resource),resource)).status,200);
 assert.equal((await h.handle(request('account',{type:'proof-begin',purpose:'verify-account',email:principal.email}),'account')).status,200);assert.equal(accountCalls[0].owner,principal.id);
 for(const body of [{type:'name',name:'Valid',owner:'other'},{type:'signup'},{type:'delete',password:'p',confirmation:'DELETE MY ACCOUNT',stopRenewals:false}])assert.equal((await h.handle(request('account',body),'account')).status,400);
 assert.equal((await h.handle(request('account?owner=other'),'account')).status,400);
 assert.equal((await h.handle(request('account',{type:'name',name:'Valid'},{origin:'https://hostile.invalid'}),'account')).status,403);
 assert.equal((await harness({authenticate:async()=>null}).handle(request('account'),'account')).status,401);
 assert.equal((await harness({quota:async()=>false}).handle(request('account'),'account')).status,429);
 assert.equal(accountCalls.length,1);
});
