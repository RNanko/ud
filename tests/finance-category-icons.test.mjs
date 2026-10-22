import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {loadModule,plain} from './helpers.mjs';
import {applyFinanceIconsSchema} from '../scripts/apply-finance-icons-schema.mjs';

test('the 130 imported icons are packaged assets and category contracts reject arbitrary paths',()=>{
 const catalog=JSON.parse(readFileSync('lib/finance-category-icons.json','utf8'));
 assert.equal(catalog.filter(i=>i.kind==='spending').length,100);assert.equal(catalog.filter(i=>i.kind==='revenue').length,30);
 assert.equal(new Set(catalog.map(i=>i.id)).size,130);
 for(const icon of catalog){assert.match(icon.src,/^\/finance-icons\/(spending|revenue)\/[a-z0-9_-]+\.svg$/);assert.ok(existsSync('public'+icon.src));assert.doesNotMatch(readFileSync('public'+icon.src,'utf8'),/<script|<foreignObject|\bhref\s*=|\bonload\s*=/i);}
 const schema=loadModule('lib/mobile/finance-contract.ts').financeWriteSchema;
 const value={operationId:randomUUID(),revision:0,data:{kind:'category',name:'Food',type:'-',hidden:false}};
 for(const icon of [undefined,null,catalog[0].id])assert.equal(schema.safeParse({...value,data:{...value.data,icon}}).success,true);
 for(const icon of ['https://example.invalid/icon.svg','../../secret','spending:no-such-icon','javascript:alert(1)'])assert.equal(schema.safeParse({...value,data:{...value.data,icon}}).success,false);
 const categories=loadModule('lib/finance-playground.ts').mergeFinanceCategories([{name:'Food',type:'-',icon:catalog[0].id}],[{category:'Food',type:'-'}]);
 assert.equal(categories.find(c=>c.name==='Food').icon,catalog[0].id);
});

test('category icon migration preserves history, receipts, ownership and icons from older clients',async()=>{
 const db=await PGlite.create();
 try{
  await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY,email text);INSERT INTO "user" VALUES('owner','owner@example.invalid'),('other','other@example.invalid');
   CREATE TABLE finance_table(id text PRIMARY KEY,user_id text,date timestamp,amount numeric,currency text,category text,subcategory text,comment text,type text,created_at timestamp DEFAULT now());
   CREATE TABLE finance_categories(id text PRIMARY KEY,user_id text,name text,normalized_name text,type text,hidden boolean DEFAULT false,UNIQUE(user_id,type,normalized_name));`);
  await db.exec(readFileSync('lib/db/0031_mobile_finance.sql','utf8'));await db.exec(readFileSync('lib/db/0038_finance_currency_edit.sql','utf8'));
  const database=(await db.query('SELECT current_database() AS database')).rows[0].database;
  await db.exec("INSERT INTO finance_table(id,user_id,date,amount,currency,category,type) VALUES('keep','owner','2026-10-01',123.45,'PLN','Food','-')");
  assert.equal((await applyFinanceIconsSchema(db,{expectedDatabase:database})).state,'pending');
  await assert.rejects(()=>applyFinanceIconsSchema(db,{apply:true,expectedDatabase:'wrong'}),/identity/);
  const installed=await applyFinanceIconsSchema(db,{apply:true,expectedDatabase:database});assert.equal(installed.schemaApplied,true);
  assert.equal((await applyFinanceIconsSchema(db,{apply:true,expectedDatabase:database})).schemaApplied,false);
  const history=JSON.stringify((await db.query('SELECT * FROM finance_table')).rows);
  const rev=async owner=>Number((await db.query('SELECT revision FROM b1_mobile_finance_versions WHERE user_id=$1',[owner])).rows[0]?.revision??0);
  const save=async(command,owner='owner',operation=randomUUID(),expected)=>{
   const revision=expected??await rev(owner);
   return (await db.query('SELECT b1_mobile_save_finance($1,$2,$3,$4,$5::jsonb) AS result',[owner,operation,JSON.stringify(command),revision,JSON.stringify(command)])).rows[0].result;
  };
  const value={kind:'category',name:'Food',type:'-',hidden:false,icon:'spending:01_01_groceries'},operation=randomUUID(),revision=await rev('owner');
  assert.equal((await save(value,'owner',operation,revision)).outcome,'saved');assert.equal((await save(value,'owner',operation,revision)).outcome,'duplicate');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM finance_categories')).rows[0].n,1);
  await save({kind:'category',name:'Food',type:'-',hidden:true});
  let saved=(await db.query("SELECT icon,hidden FROM finance_categories WHERE user_id='owner'")).rows[0];assert.equal(saved.icon,value.icon);assert.equal(saved.hidden,true);
  await save({...value,icon:'spending:01_02_restaurants'});await save({...value,icon:null});
  assert.equal((await db.query("SELECT icon FROM finance_categories WHERE user_id='owner'")).rows[0].icon,null);
  await save(value,'other');assert.equal((await db.query("SELECT icon FROM finance_categories WHERE user_id='owner'")).rows[0].icon,null);
  await assert.rejects(()=>save({...value,icon:'unknown'}),/check constraint/);
  assert.equal(JSON.stringify((await db.query('SELECT * FROM finance_table')).rows),history);
  const before=await rev('owner');assert.equal((await save(value,'owner',randomUUID(),before-1)).outcome,'conflict');
  assert.equal((await save(value,'missing')).outcome,'unauthorized');
  assert.equal(plain((await db.query("SELECT name FROM finance_categories WHERE user_id='other'")).rows)[0].name,'Food');
  await save({kind:'category',name:'Salary',type:'+',hidden:true});
  const assigned=await applyFinanceIconsSchema(db,{apply:true,expectedDatabase:database,account:'owner@',expectedOwner:'owner'});
  assert.ok(assigned.assignments.some(c=>c.name==='Food'));assert.equal(assigned.assignments.some(c=>c.name==='Salary'),false);
  assert.equal((await db.query("SELECT hidden FROM finance_categories WHERE user_id='owner' AND name='Salary'")).rows[0].hidden,true);
  assert.equal((await db.query("SELECT icon FROM finance_categories WHERE user_id='other'")).rows[0].icon,value.icon);
  assert.equal(JSON.stringify((await db.query('SELECT * FROM finance_table')).rows),history);
  assert.equal((await applyFinanceIconsSchema(db,{apply:true,expectedDatabase:database,account:'owner@',expectedOwner:'owner'})).updated,0);
 }finally{await db.close();}
});
