import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as crypto from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {loadModule,plain} from './helpers.mjs';

const uuid=()=>crypto.randomUUID();
class MobileError extends Error { constructor(status,code,message){super(message);this.status=status;this.code=code;} }
const entry={date:'2026-10-04',type:'-',amount:'12.50',currency:'USD',category:'Food',subcategory:'Groceries',comment:'Draft note'};
const position={kind:'other',assetId:null,symbol:'TEST',name:'Synthetic asset',buyPrice:'0.10',quantity:'3',boughtOn:'2026-10-04',currency:'USD',manualPrice:'0'};
const financeCreate=(revision=0)=>({operationId:uuid(),revision,data:{kind:'entry',id:uuid(),create:true,entry:{...entry}}});
const investmentCreate=(revision=0)=>({operationId:uuid(),revision,data:{kind:'position',id:uuid(),create:true,position:{...position}}});
async function fixture(){
  const db=await PGlite.create();
  await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY);INSERT INTO "user" VALUES('a'),('b');
    CREATE TABLE finance_table(id text PRIMARY KEY,user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,date timestamp NOT NULL,amount numeric NOT NULL,currency text,category text,subcategory text,comment text,type text,created_at timestamp DEFAULT now());
    CREATE TABLE finance_categories(id text PRIMARY KEY,user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,name text NOT NULL,normalized_name text NOT NULL,hidden boolean NOT NULL DEFAULT false,type text NOT NULL,UNIQUE(user_id,type,normalized_name));
    CREATE TABLE investment_positions(id text PRIMARY KEY,user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,kind text,asset_id text,symbol text,name text,buy_price numeric(30,12),quantity numeric(30,12),bought_on date,currency text NOT NULL DEFAULT 'USD',manual_price numeric(30,12),manual_price_at timestamp,archived boolean DEFAULT false,created_at timestamp DEFAULT now());`);
  await db.exec(readFileSync('lib/db/0031_mobile_finance.sql','utf8'));
  await db.exec(readFileSync('lib/db/0033_mobile_investments.sql','utf8'));
  let owner='a',lost=false,readLost=false;const guards=[],invalidations=[],statements=[];
  const accountSql=Object.assign(async(parts,...args)=>{
    const text=parts.reduce((text,part,i)=>text+(i?'$'+i:'')+part,'');statements.push(text);
    if(readLost&&text.includes('jsonb_agg')){readLost=false;throw Error('Response connection lost');}
    return (await db.query(text,args)).rows;
  },{query:async(text,args)=>(await db.query(text,args)).rows});
  const store={accountSql,accountSettings:async()=>({preferences:{timezone:'UTC',financeDefaultCurrency:'USD'}})};
  const cache={revalidateTag:(...args)=>{invalidations.push(args);if(lost){lost=false;throw Error('Postcommit cache failure');}},revalidatePath:(...args)=>{invalidations.push(args);if(lost){lost=false;throw Error('Postcommit cache failure');}}};
  const market={getCryptoMarket:async()=>{throw Error('Providers disabled in this test');},investmentMarket:async()=>{throw Error('Providers disabled in this test');}};
  const common={'node:crypto':crypto,'next/cache':cache,'../account/store':store,'../finance':loadModule('lib/finance.ts'),'./http':{MobileError},'../investment-market':market,'../data/crypto-catalog.json':JSON.parse(readFileSync('lib/data/crypto-catalog.json','utf8'))};
  const mobileFinance=loadModule('lib/mobile/finance.ts',common),mobileInvestment=loadModule('lib/mobile/investments.ts',common);
  const snapshots=loadModule('lib/money/snapshots.ts',{'../account/store':store});
  const mocks={...common,'drizzle-orm':{},'../db/drizzle':Object.fromEntries(['select','insert','update','delete'].map(name=>[name,()=>{throw Error('Unsafe direct web database writer');}])),'../db/schema':{},'../session':{requireUserId:async(requested,mode)=>{guards.push(mode);if(!owner||requested&&requested!==owner)throw Error('Unauthorized');return owner;}},'../mobile/finance':mobileFinance,'../mobile/investments':mobileInvestment,'../money/snapshots':snapshots};
  const finance=loadModule('lib/actions/finance.actions.ts',mocks),investments=loadModule('lib/actions/investments.actions.ts',mocks);
  return {db,finance,investments,mobileFinance,mobileInvestment,guards,invalidations,statements,setOwner:value=>{owner=value;},loseCache:()=>{lost=true;},loseSnapshot:()=>{readLost=true;}};
}

test('web Finance actions use canonical SQL receipts and reject stale changes',async t=>{
 const f=await fixture();try{
  await t.test('snapshot loads revision and owned values together; guard blocks foreign/anonymous reads and writes',async()=>{
    assert.deepEqual(plain(await f.finance.getFinanceSnapshot()),{revision:0,entries:[],categories:[]});assert.equal(f.statements.length,1);
    await assert.rejects(f.finance.getFinanceSnapshot('b'),/Unauthorized/);f.setOwner(null);
    await assert.rejects(f.finance.commitFinance(financeCreate()),/Unauthorized/);f.setOwner('a');assert.equal(f.statements.length,1);
  });
  await t.test('strict envelopes and every invalid money field reject without a write',async()=>{
    const before=f.statements.length;
    for(const patch of [{amount:'0'},{amount:'-1'},{amount:'NaN'},{amount:'Infinity'},{amount:''},{amount:'1e3'},{amount:'1.001'},{date:'2026-02-30'},{category:' '},{type:'income'},{currency:'FAKE'}]){
      const command=financeCreate();command.data.entry={...entry,...patch};assert.equal((await f.finance.commitFinance(command)).status,'rejected');
    }
    for(const patch of [{userId:'b'},{operationId:'bad'},{revision:-1},{revision:undefined}])assert.equal((await f.finance.commitFinance({...financeCreate(),...patch})).status,'rejected');
    const tampered=financeCreate();tampered.data.entry.userId='b';assert.equal((await f.finance.commitFinance(tampered)).status,'rejected');
    assert.equal(f.statements.length,before);
  });
  const create=financeCreate();
  await t.test('commit then lost response retries one intended create with one receipt',async()=>{
    f.loseCache();assert.equal((await f.finance.commitFinance(create)).status,'unknown');
    const result=await f.finance.commitFinance(create);assert.equal(result.success,true);assert.equal(result.acknowledgedOperationId,create.operationId);assert.equal(result.snapshot.entries.length,1);
    assert.equal(result.snapshot.entries[0].userId,undefined);assert.equal(result.snapshot.entries[0].amount,'12.50');
    assert.equal((await f.db.query('SELECT count(*)::int n FROM b1_mobile_finance_operations')).rows[0].n,1);
    assert.deepEqual(plain(f.invalidations[0]),['finance-data',{expire:0}]);assert.ok(f.guards.includes('write'));
  });
  await t.test('parallel duplicate submissions acknowledge once; same operation changed body conflicts',async()=>{
    const next=financeCreate((await f.finance.getFinanceSnapshot()).revision);
    const results=await Promise.all([f.finance.commitFinance(next),f.finance.commitFinance(next)]);assert.ok(results.every(result=>result.success));
    assert.equal((await f.db.query('SELECT count(*)::int n FROM finance_table WHERE id=$1',[next.data.id])).rows[0].n,1);
    assert.equal((await f.finance.commitFinance({...next,data:{...next.data,entry:{...entry,amount:'99.00'}}})).status,'conflict');
  });
  await t.test('two separate identical creates both persist, with explicit review after a concurrent create',async()=>{
    const revision=(await f.finance.getFinanceSnapshot()).revision,a=financeCreate(revision),b=financeCreate(revision);
    const results=await Promise.all([f.finance.commitFinance(a),f.finance.commitFinance(b)]);assert.equal(results.filter(result=>result.success).length,1);
    const rejected=results[0].success?b:a,latest=results.find(result=>!result.success).snapshot;
    assert.equal((await f.finance.commitFinance({...rejected,operationId:uuid(),revision:latest.revision})).success,true);
    assert.equal((await f.db.query('SELECT count(*)::int n FROM finance_table WHERE id=ANY($1)',[[a.data.id,b.data.id]])).rows[0].n,2);
  });
  await t.test('mobile edit makes an open web edit stale; response contains latest owned snapshot',async()=>{
    const old=await f.finance.getFinanceSnapshot();const stale={operationId:uuid(),revision:old.revision,data:{...create.data,create:false,entry:{...entry,amount:'15.00'}}};
    await f.mobileFinance.writeMobileFinance('a',{...stale,operationId:uuid(),data:{...stale.data,entry:{...entry,amount:'77.00',comment:'Newer mobile edit'}}});
    const result=await f.finance.commitFinance(stale);assert.equal(result.status,'conflict');assert.equal(result.snapshot.entries.find(row=>row.id===create.data.id).amount,'77.00');
    assert.equal(stale.data.entry.amount,'15.00');assert.equal((await f.finance.commitFinance({...stale,operationId:uuid(),revision:result.snapshot.revision})).success,true);
  });
  await t.test('foreign edit/delete returns only caller snapshot and never changes the source',async()=>{
    f.setOwner('b');
    for(const data of [{...create.data,create:false},{kind:'delete',id:create.data.id}]){const result=await f.finance.commitFinance({operationId:uuid(),revision:0,data});assert.equal(result.status,'conflict');assert.equal(result.snapshot.entries.length,0);}
    f.setOwner('a');assert.equal((await f.finance.getFinanceSnapshot()).entries.find(row=>row.id===create.data.id).amount,'15.00');
  });
  await t.test('all editor fields save atomically and existing currencies stay immutable',async()=>{
    for(const currency of ['EUR',null,'NONE']){
      await f.db.query('UPDATE finance_table SET currency=$1,type=NULL WHERE id=$2',[currency,create.data.id]);
      const snapshot=await f.finance.getFinanceSnapshot(),legacy=snapshot.entries.find(row=>row.id===create.data.id);assert.equal(legacy.currency,currency);assert.equal(legacy.type,'-');
      assert.equal((await f.db.query('SELECT type FROM finance_table WHERE id=$1',[create.data.id])).rows[0].type,null);
      const result=await f.finance.commitFinance({operationId:uuid(),revision:snapshot.revision,data:{...create.data,create:false,entry:{...entry,type:'+',date:'2026-10-03',amount:'0.20',currency:'PLN',category:'Salary',subcategory:'Pay',comment:'All fields'}}});assert.equal(result.success,true);
      const row=result.snapshot.entries.find(row=>row.id===create.data.id);assert.equal(row.currency,currency);assert.equal(row.type,'+');assert.equal(row.date,'2026-10-03');assert.equal(row.amount,'0.20');assert.equal(row.category,'Salary');assert.equal(row.subcategory,'Pay');assert.equal(row.comment,'All fields');
    }
  });
  await t.test('category validation/normalization, owner isolation, hide and restore retain transactions',async()=>{
    for(const data of [{kind:'category',name:' ',type:'-',hidden:false},{kind:'category',name:'x'.repeat(61),type:'-',hidden:false}])assert.equal((await f.finance.commitFinance({operationId:uuid(),revision:(await f.finance.getFinanceSnapshot()).revision,data})).status,'rejected');
    for(const [name,hidden] of [[' Coffee ',false],['coffee',true],['COFFEE',false]]){
      const snapshot=await f.finance.getFinanceSnapshot(),result=await f.finance.commitFinance({operationId:uuid(),revision:snapshot.revision,data:{kind:'category',name,type:'-',hidden}});assert.equal(result.success,true);assert.equal(result.snapshot.categories.length,1);assert.equal(result.snapshot.categories[0].hidden,hidden);assert.deepEqual(plain(result.snapshot.entries),plain(snapshot.entries));
    }
    f.setOwner('b');assert.equal((await f.finance.getFinanceSnapshot()).categories.length,0);f.setOwner('a');
  });
  await t.test('stale delete cannot remove an updated record; replay after delete cannot resurrect it',async()=>{
    const old=await f.finance.getFinanceSnapshot();await f.db.query("UPDATE finance_table SET comment='Newer' WHERE id=$1",[create.data.id]);
    const staleDelete={operationId:uuid(),revision:old.revision,data:{kind:'delete',id:create.data.id}},conflict=await f.finance.commitFinance(staleDelete);assert.equal(conflict.status,'conflict');
    assert.equal((await f.finance.commitFinance({...staleDelete,operationId:uuid(),revision:conflict.snapshot.revision})).success,true);
    const replay=await f.finance.commitFinance(create);assert.equal(replay.success,true);assert.equal(replay.snapshot.entries.some(row=>row.id===create.data.id),false);
    assert.equal((await f.finance.commitFinance({...create,operationId:uuid(),revision:replay.snapshot.revision})).status,'conflict');
    assert.equal((await f.finance.commitFinance({...create,operationId:uuid(),revision:replay.snapshot.revision,data:{...create.data,create:false}})).status,'conflict');
  });
  await t.test('lost snapshot after commit remains retryable without inserting another record',async()=>{
    const command=financeCreate((await f.finance.getFinanceSnapshot()).revision);f.loseSnapshot();assert.equal((await f.finance.commitFinance(command)).status,'unknown');const result=await f.finance.commitFinance(command);assert.equal(result.success,true);assert.equal(result.snapshot.entries.filter(row=>row.id===command.data.id).length,1);
  });
 }finally{await f.db.close();}
});

test('web Investments actions share mobile concurrency, receipts and validation',async t=>{
 const f=await fixture();try{
  await t.test('session guard protects initial revision snapshot and mutation',async()=>{
    assert.deepEqual(plain(await f.investments.getInvestmentSnapshot()),{revision:0,positions:[]});assert.equal(f.statements.length,1);f.setOwner(null);
    await assert.rejects(f.investments.getInvestmentSnapshot(),/Unauthorized/);await assert.rejects(f.investments.commitInvestment(investmentCreate()),/Unauthorized/);f.setOwner('a');
  });
  await t.test('invalid exposure, dates, currency, IDs and extra ownership fields reject',async()=>{
    for(const patch of [{quantity:'-1'},{quantity:'NaN'},{buyPrice:'-1'},{buyPrice:'999999999999999999999999'},{boughtOn:'2026-02-30'},{boughtOn:'2099-01-01'},{currency:'EUR'},{manualPrice:'-1'},{symbol:''}]){
      const command=investmentCreate();command.data.position={...position,...patch};assert.equal((await f.investments.commitInvestment(command)).status,'rejected');
    }
    const command=investmentCreate();command.data.position.userId='b';assert.equal((await f.investments.commitInvestment(command)).status,'rejected');assert.equal((await f.investments.commitInvestment({...investmentCreate(),operationId:'bad'})).status,'rejected');
    assert.equal((await f.db.query('SELECT count(*)::int n FROM investment_positions')).rows[0].n,0);
  });
  const create=investmentCreate();
  await t.test('lost response followed by retry returns one manual-zero USD purchase',async()=>{
    f.loseCache();assert.equal((await f.investments.commitInvestment(create)).status,'unknown');const result=await f.investments.commitInvestment(create);assert.equal(result.success,true);assert.equal(result.snapshot.positions.length,1);assert.equal(result.snapshot.positions[0].currency,'USD');assert.equal(Number(result.snapshot.positions[0].manualPrice),0);assert.equal(result.snapshot.positions[0].userId,undefined);
    assert.equal((await f.db.query('SELECT count(*)::int n FROM b1_mobile_investment_operations')).rows[0].n,1);assert.deepEqual(f.invalidations[0],['/account/investments']);
  });
  await t.test('parallel same-operation creates return one row; changed body cannot reuse receipt',async()=>{
    const next=investmentCreate((await f.investments.getInvestmentSnapshot()).revision),results=await Promise.all([f.investments.commitInvestment(next),f.investments.commitInvestment(next)]);assert.ok(results.every(result=>result.success));assert.equal((await f.db.query('SELECT count(*)::int n FROM investment_positions WHERE id=$1',[next.data.id])).rows[0].n,1);
    assert.equal((await f.investments.commitInvestment({...next,data:{...next.data,position:{...position,quantity:'7'}}})).status,'conflict');
  });
  await t.test('two identical but intentional purchases remain separate records',async()=>{
    const a=investmentCreate((await f.investments.getInvestmentSnapshot()).revision),first=await f.investments.commitInvestment(a),b=investmentCreate(first.snapshot.revision),second=await f.investments.commitInvestment(b);assert.equal(second.success,true);assert.notEqual(a.data.id,b.data.id);assert.ok(second.snapshot.positions.some(row=>row.id===a.data.id)&&second.snapshot.positions.some(row=>row.id===b.data.id));
  });
  await t.test('mobile edit rejects stale web editor and exposes latest values for deliberate retry',async()=>{
    const stale={operationId:uuid(),revision:(await f.investments.getInvestmentSnapshot()).revision,data:{...create.data,create:false,position:{...position,quantity:'6'}}};
    await f.mobileInvestment.writeMobileInvestment('a',{...stale,operationId:uuid(),data:{...stale.data,position:{...position,quantity:'9'}}});const result=await f.investments.commitInvestment(stale);assert.equal(result.status,'conflict');assert.equal(Number(result.snapshot.positions.find(row=>row.id===create.data.id).quantity),9);assert.equal(stale.data.position.quantity,'6');
    assert.equal((await f.investments.commitInvestment({...stale,operationId:uuid(),revision:result.snapshot.revision})).success,true);
  });
  await t.test('foreign edits and archives cannot modify or expose the source',async()=>{
    f.setOwner('b');for(const data of [{...create.data,create:false},{kind:'archive',id:create.data.id,archived:true}]){const result=await f.investments.commitInvestment({operationId:uuid(),revision:0,data});assert.equal(result.status,'conflict');assert.equal(result.snapshot.positions.length,0);}f.setOwner('a');
  });
  await t.test('crypto metadata comes from the bundled catalog, with no provider call',async()=>{
    const command=investmentCreate((await f.investments.getInvestmentSnapshot()).revision);command.data.position={...position,kind:'crypto',assetId:'bitcoin',symbol:'FAKE',name:'Fake'};const result=await f.investments.commitInvestment(command);assert.equal(result.success,true);const row=result.snapshot.positions.find(row=>row.id===command.data.id);assert.equal(row.name,'Bitcoin');assert.equal(row.symbol,'BTC');assert.equal(row.manualPrice,null);
  });
  await t.test('legacy currency and kind display normalization do not rewrite stored history',async()=>{
    await f.db.query("UPDATE investment_positions SET currency='EUR',kind='legacy' WHERE id=$1",[create.data.id]);const snapshot=await f.investments.getInvestmentSnapshot(),row=snapshot.positions.find(row=>row.id===create.data.id);assert.equal(row.currency,'EUR');assert.equal(row.kind,'other');assert.equal((await f.db.query('SELECT kind FROM investment_positions WHERE id=$1',[create.data.id])).rows[0].kind,'legacy');
    assert.equal((await f.investments.commitInvestment({...create,operationId:uuid(),revision:snapshot.revision,data:{...create.data,create:false}})).status,'conflict');assert.equal((await f.db.query('SELECT currency FROM investment_positions WHERE id=$1',[create.data.id])).rows[0].currency,'EUR');
    await f.db.query("UPDATE investment_positions SET currency='USD',kind='other' WHERE id=$1",[create.data.id]);
  });
  await t.test('edit/archive races reject stale drafts; create replay never unarchives; explicit undo uses new revision',async()=>{
    const snapshot=await f.investments.getInvestmentSnapshot(),archive={operationId:uuid(),revision:snapshot.revision,data:{kind:'archive',id:create.data.id,archived:true}};assert.equal((await f.investments.commitInvestment(archive)).success,true);
    const edit={...create,operationId:uuid(),revision:snapshot.revision,data:{...create.data,create:false}},conflict=await f.investments.commitInvestment(edit);assert.equal(conflict.status,'conflict');assert.equal(conflict.snapshot.positions.find(row=>row.id===create.data.id).archived,true);
    assert.equal((await f.investments.commitInvestment({...edit,operationId:uuid(),revision:conflict.snapshot.revision})).status,'conflict');
    const replay=await f.investments.commitInvestment(create);assert.equal(replay.success,true);assert.equal(replay.snapshot.positions.find(row=>row.id===create.data.id).archived,true);
    const undo=await f.investments.commitInvestment({operationId:uuid(),revision:replay.snapshot.revision,data:{...archive.data,archived:false}});assert.equal(undo.success,true);
    const repeated=await f.investments.commitInvestment(archive);assert.equal(repeated.success,true);assert.equal(repeated.snapshot.positions.find(row=>row.id===create.data.id).archived,false);
  });
  await t.test('delete then stale edit/create retries neither recreate nor return the old position',async()=>{
    await f.db.query('DELETE FROM investment_positions WHERE id=$1',[create.data.id]);const replay=await f.investments.commitInvestment(create);assert.equal(replay.success,true);assert.equal(replay.snapshot.positions.some(row=>row.id===create.data.id),false);
    for(const createFlag of [true,false])assert.equal((await f.investments.commitInvestment({...create,operationId:uuid(),revision:replay.snapshot.revision,data:{...create.data,create:createFlag}})).status,'conflict');
  });
 }finally{await f.db.close();}
});
