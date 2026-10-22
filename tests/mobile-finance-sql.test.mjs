import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { loadModule } from './helpers.mjs';
import { applyFinanceCurrencySchema } from '../scripts/apply-finance-currency-schema.mjs';
test('Finance SQL uses canonical records, atomic receipts, cross-device revisions and currency isolation',async t=>{
 const db=await PGlite.create();
 try{
  await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY);INSERT INTO "user" VALUES('a'),('b');CREATE TABLE finance_table(id text PRIMARY KEY,user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,date timestamp NOT NULL,amount numeric NOT NULL,currency text,category text,subcategory text,comment text,type text,created_at timestamp DEFAULT now());CREATE TABLE finance_categories(id text PRIMARY KEY,user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,name text NOT NULL,normalized_name text NOT NULL,hidden boolean NOT NULL DEFAULT false,type text NOT NULL,UNIQUE(user_id,type,normalized_name));`);
  await db.exec(readFileSync('lib/db/0031_mobile_finance.sql','utf8'));
  const database=(await db.query('SELECT current_database() AS database')).rows[0].database;
  await assert.rejects(()=>applyFinanceCurrencySchema(db,{apply:true,expectedDatabase:'wrong-database'}),/identity/);
  assert.equal((await applyFinanceCurrencySchema(db,{apply:true,expectedDatabase:database})).applied,true);
  assert.equal((await applyFinanceCurrencySchema(db,{apply:true,expectedDatabase:database})).alreadyApplied,true);
  await db.exec(readFileSync('lib/db/0052_finance_category_icons.sql','utf8'));
  const rev=async(owner='a')=>Number((await db.query('SELECT revision FROM b1_mobile_finance_versions WHERE user_id=$1',[owner])).rows[0]?.revision??0);
  const save=async(command,revision,operation=randomUUID(),owner='a',fingerprint=`id:${command.id??'category'}:${operation}`)=>(await db.query('SELECT b1_mobile_save_finance($1,$2::uuid,$3,$4,$5::jsonb) AS result',[owner,operation,fingerprint,revision,JSON.stringify(command)])).rows[0].result;
  const id=randomUUID(),entry={kind:'entry',id,create:true,entry:{date:'2026-10-04',type:'-',amount:'0.10',currency:'USD',category:'Food',subcategory:'',comment:''}},op=randomUUID();
  await t.test('retry creates one row and receipt, changed request ID body rejects',async()=>{assert.equal((await save(entry,0,op)).outcome,'saved');assert.equal((await save(entry,0,op)).outcome,'duplicate');assert.equal((await save(entry,0,op,'a','changed')).outcome,'operation-reused');assert.equal((await db.query('SELECT count(*)::int AS n FROM finance_table')).rows[0].n,1);});
  await t.test('web edits increment revisions and reject stale/foreign changes',async()=>{const before=await rev();await db.query("UPDATE finance_table SET comment='web' WHERE id=$1",[id]);assert.equal(await rev(),before+1);assert.equal((await save({...entry,create:false},before)).outcome,'conflict');assert.equal((await save({...entry,create:false},0,randomUUID(),'b')).outcome,'conflict');});
  await t.test('edit ignores proposed currency, including legacy null',async()=>{await db.query('UPDATE finance_table SET currency=NULL WHERE id=$1',[id]);assert.equal((await save({...entry,create:false,entry:{...entry.entry,amount:'0.20',currency:'EUR'}},await rev())).outcome,'saved');assert.equal((await db.query('SELECT currency,amount FROM finance_table WHERE id=$1',[id])).rows[0].currency,null);});
  await t.test('explicit currency edits preserve amounts, revision checks and receipt retries',async()=>{
   const before=await rev(),operation=randomUUID(),command={...entry,create:false,changeCurrency:true,entry:{...entry.entry,amount:'0.20',currency:'EUR'}};
   assert.equal((await save(command,before-1)).outcome,'conflict');
   assert.equal((await save(command,await rev('b'),randomUUID(),'b')).outcome,'conflict');
   const saved=await save(command,before,operation);
   assert.equal(saved.outcome,'saved');assert.equal(saved.revision,before+1);
   assert.equal((await save(command,before,operation)).outcome,'duplicate');assert.equal(await rev(),before+1);
   const row=(await db.query('SELECT currency,amount::text AS amount FROM finance_table WHERE id=$1',[id])).rows[0];
   assert.equal(row.currency,'EUR');assert.equal(row.amount,'0.20');
   assert.equal((await save({...command,entry:{...command.entry,currency:'BTC'}},await rev())).outcome,'invalid');
   assert.equal((await save({...command,entry:{...command.entry,currency:null}},await rev())).outcome,'invalid');
   assert.equal(await rev(),before+1);
   assert.equal((await save({...command,entry:{...command.entry,currency:'NONE'}},await rev())).outcome,'saved');
   assert.equal((await db.query('SELECT currency FROM finance_table WHERE id=$1',[id])).rows[0].currency,'NONE');
  });
  await t.test('hiding/restoring normalized categories never rewrites historical labels',async()=>{const category={kind:'category',name:'Food',type:'-',hidden:true};assert.equal((await save(category,await rev())).outcome,'saved');assert.equal((await save({...category,name:'food',hidden:false},await rev())).outcome,'saved');assert.equal((await db.query('SELECT count(*)::int AS n FROM finance_categories')).rows[0].n,1);assert.equal((await db.query('SELECT category FROM finance_table WHERE id=$1',[id])).rows[0].category,'Food');});
  await t.test('delete replay acknowledges without resurrection; new operation cannot reuse deleted ID',async()=>{const revision=await rev();assert.equal((await save({kind:'delete',id},revision)).outcome,'saved');assert.equal((await save(entry,0,op)).outcome,'duplicate');assert.equal((await save(entry,await rev())).outcome,'conflict');assert.equal((await db.query('SELECT count(*)::int AS n FROM finance_table')).rows[0].n,0);});
  await t.test('one statement paginates and sums every filtered row exactly',async()=>{
   for(const [amount,currency,type] of [['0.10','USD','+'],['0.20','USD','+'],['0.05','USD','-'],['999.00','EUR','+'],['7.00',null,'-']])await db.query('INSERT INTO finance_table(id,user_id,date,amount,currency,category,type) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),'a','2026-10-04',amount,currency,'Food',type]);
   const accountSql={query:async(text,args)=>(await db.query(text,args)).rows};const finance=loadModule('lib/mobile/finance.ts',{'node:crypto':await import('node:crypto'),'next/cache':{revalidateTag(){}},'../account/store':{accountSql,accountSettings:async()=>({preferences:{financeDefaultCurrency:'USD'}})},'../finance':loadModule('lib/finance.ts'),'../finance-playground':loadModule('lib/finance-playground.ts'),'./http':{MobileError:class extends Error{constructor(status,code,message){super(message);this.status=status;this.code=code;}}}});
   const snapshot=await finance.readMobileFinance('a',{currency:'USD',size:'1'});assert.equal(snapshot.entries.length,1);assert.equal(typeof snapshot.entries[0].amount,'string');assert.equal(snapshot.entries[0].date,'2026-10-04');assert.equal(snapshot.total,3);assert.equal(snapshot.summary.revenue,'0.30');assert.equal(snapshot.summary.spending,'0.05');assert.equal(snapshot.summary.balance,'0.25');assert.equal((await finance.readMobileFinance('a',{currency:'unassigned'})).summary.spending,'7.00');assert.equal((await finance.readMobileFinance('b',{})).total,0);await assert.rejects(()=>finance.readMobileFinance('a',{expected:'0'}),/changed/);
  });
  await t.test('all supported currencies and numbers-only persist and read separately without changing existing history',async()=>{
   const currencies=loadModule('lib/finance-currencies.ts').financeCurrencies;
   const accountSql=Object.assign(async(strings,...args)=>(await db.query(strings.map((part,index)=>part+(index<args.length?`$${index+1}`:'')).join(''),args)).rows,{query:async(text,args)=>(await db.query(text,args)).rows});
   const finance=loadModule('lib/mobile/finance.ts',{'node:crypto':await import('node:crypto'),'next/cache':{revalidateTag(){}},'../account/store':{accountSql,accountSettings:async()=>({preferences:{financeDefaultCurrency:'USD'}})},'../finance':loadModule('lib/finance.ts'),'./http':{MobileError:class extends Error{constructor(status,code,message){super(message);this.status=status;this.code=code;}}}});
   for(const currency of currencies){
    const payload={operationId:randomUUID(),revision:await rev('b'),data:{kind:'entry',id:randomUUID(),create:true,entry:{date:'2026-10-04',type:'+',amount:'0.10',currency,category:'Salary'}}};
    const result=await finance.writeMobileFinance('b',payload);
    assert.equal(result.acknowledgedOperationId,payload.operationId);
    const snapshot=await finance.readMobileFinance('b',{currency});
    assert.equal(snapshot.total,1,currency);assert.equal(snapshot.entries[0].currency,currency);assert.equal(snapshot.summary.revenue,'0.10');
    const edit={operationId:randomUUID(),revision:await rev('b'),data:{...payload.data,create:false,changeCurrency:true,entry:{...payload.data.entry,currency:'EUR'}}};
    await finance.writeMobileFinance('b',edit);
    const edited=await finance.readMobileFinance('b',{currency:'EUR'});
    assert.equal(edited.entries.find(row=>row.id===payload.data.id).currency,'EUR');
    assert.equal(edited.entries.find(row=>row.id===payload.data.id).amount,'0.10');
    await finance.writeMobileFinance('b',{operationId:randomUUID(),revision:await rev('b'),data:{...edit.data,entry:{...edit.data.entry,currency}}});
   }
   assert.equal((await finance.readMobileFinance('a',{currency:'NONE'})).total,0);
   assert.equal((await finance.readMobileFinance('b',{currency:'unassigned'})).total,0);
  });
 }finally{await db.close();}
});
