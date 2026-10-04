import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {loadModule} from './helpers.mjs';

test('Investments SQL preserves canonical ownership, immutable receipts, USD and web revisions',async t=>{
 const db=await PGlite.create();try{
  await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY);INSERT INTO "user" VALUES('a'),('b');CREATE TABLE investment_positions(id text PRIMARY KEY,user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,kind text,asset_id text,symbol text,name text,buy_price numeric(30,12),quantity numeric(30,12),bought_on date,currency text NOT NULL DEFAULT 'USD',manual_price numeric(30,12),manual_price_at timestamp,archived boolean DEFAULT false,created_at timestamp DEFAULT now());`);
  await db.exec(readFileSync('lib/db/0033_mobile_investments.sql','utf8'));
  const rev=async(owner='a')=>Number((await db.query('SELECT revision FROM b1_mobile_investment_versions WHERE user_id=$1',[owner])).rows[0]?.revision??0);
  const save=async(data,revision,operation=randomUUID(),owner='a',fingerprint=`id:${data.id}:${operation}`)=>(await db.query('SELECT b1_mobile_save_investment($1,$2::uuid,$3,$4,$5::jsonb) AS result',[owner,operation,fingerprint,revision,JSON.stringify(data)])).rows[0].result;
  const id=randomUUID(),op=randomUUID(),data={kind:'position',id,create:true,position:{kind:'other',assetId:null,symbol:'TEST',name:'Synthetic asset',buyPrice:'0.10',quantity:'3',boughtOn:'2026-10-04',currency:'USD',manualPrice:'0'}};
  await t.test('exact manual zero, stable create and changed receipt body',async()=>{
   assert.equal((await save(data,0,op)).outcome,'saved');assert.equal((await save(data,0,op)).outcome,'duplicate');assert.equal((await save(data,0,op,'a','changed')).outcome,'operation-reused');const rows=(await db.query('SELECT * FROM investment_positions')).rows;assert.equal(rows.length,1);assert.equal(Number(rows[0].manual_price),0);assert.ok(rows[0].manual_price_at);assert.equal(await rev(),1);
  });
  await t.test('web changes invalidate stale edits; foreign owners cannot edit or archive',async()=>{
   await db.query("UPDATE investment_positions SET name='Web correction' WHERE id=$1",[id]);assert.equal(await rev(),2);assert.equal((await save({...data,create:false},1)).outcome,'conflict');assert.equal((await save({...data,create:false},0,randomUUID(),'b')).outcome,'conflict');assert.equal((await save({kind:'archive',id,archived:true},0,randomUUID(),'b')).outcome,'conflict');assert.equal((await save({...data,create:false},await rev())).outcome,'saved');
  });
  await t.test('legacy currencies cannot be relabelled; new non-USD rejected',async()=>{
   await db.query("UPDATE investment_positions SET currency='EUR' WHERE id=$1",[id]);assert.equal((await save({...data,create:false},await rev())).outcome,'conflict');assert.equal((await save({...data,id:randomUUID(),position:{...data.position,currency:'EUR'}},await rev())).outcome,'invalid');assert.equal((await db.query('SELECT currency FROM investment_positions WHERE id=$1',[id])).rows[0].currency,'EUR');
  });
  await t.test('archive replay keeps history archived; explicit undo uses a new revision',async()=>{
   const revision=await rev(),archive={kind:'archive',id,archived:true},operation=randomUUID();assert.equal((await save(archive,revision,operation)).outcome,'saved');assert.equal((await save(data,0,op)).outcome,'duplicate');assert.equal((await db.query('SELECT archived FROM investment_positions WHERE id=$1',[id])).rows[0].archived,true);assert.equal((await save({...archive,archived:false},revision)).outcome,'conflict');assert.equal((await save({...archive,archived:false},await rev())).outcome,'saved');assert.equal((await save(archive,revision,operation)).outcome,'duplicate');assert.equal((await db.query('SELECT archived FROM investment_positions WHERE id=$1',[id])).rows[0].archived,false);
  });
  await t.test('deleted source replay cannot resurrect or reuse its stable ID',async()=>{
   await db.query('DELETE FROM investment_positions WHERE id=$1',[id]);assert.equal((await save(data,0,op)).outcome,'duplicate');assert.equal((await save(data,await rev())).outcome,'conflict');assert.equal((await db.query('SELECT count(*)::int AS n FROM investment_positions')).rows[0].n,0);
  });
  await t.test('service reads decimal strings in one snapshot; receipts survive source/metadata changes',async()=>{
   const sql=async(parts,...args)=>(await db.query(parts.reduce((text,part,i)=>text+(i?'$'+i:'')+part,''),args)).rows;
   const catalog=JSON.parse(readFileSync('lib/data/crypto-catalog.json'));
   const api=loadModule('lib/mobile/investments.ts',{'node:crypto':await import('node:crypto'),'next/cache':{revalidatePath(){}},'../account/store':{accountSql:sql,accountSettings:async()=>({preferences:{timezone:'UTC'}})},'../investment-market':{investmentMarket:async()=>{},getCryptoMarket:async()=>({assets:catalog.assets})},'../data/crypto-catalog.json':catalog,'./http':{MobileError:class extends Error{constructor(status,code,message){super(message);this.status=status;this.code=code;}}}});
   const body={operationId:randomUUID(),revision:await rev(),data:{...data,id:randomUUID()}};const result=await api.writeMobileInvestment('a',body);const snapshot=await api.readMobileInvestments('a');assert.equal(typeof snapshot.positions[0].buyPrice,'string');assert.equal(snapshot.positions[0].boughtOn,'2026-10-04');assert.equal((await api.readMobileInvestments('b')).positions.length,0);
   await db.query('DELETE FROM investment_positions WHERE id=$1',[body.data.id]);assert.equal((await api.writeMobileInvestment('a',body)).revision,result.revision);await assert.rejects(()=>api.writeMobileInvestment('a',{...body,data:{...body.data,position:{...body.data.position,name:'changed'}}}),/retry ID/);
  });
  await t.test('quote requests only select owned active USD sources, and provider failure preserves existing crypto identity',async()=>{
   const sql=async(parts,...args)=>(await db.query(parts.reduce((text,part,i)=>text+(i?'$'+i:'')+part,''),args)).rows,catalog=JSON.parse(readFileSync('lib/data/crypto-catalog.json'));let selected=[];
   const api=loadModule('lib/mobile/investments.ts',{'node:crypto':await import('node:crypto'),'next/cache':{revalidatePath(){}},'../account/store':{accountSql:sql,accountSettings:async()=>({preferences:{timezone:'UTC'}})},'../investment-market':{investmentMarket:async rows=>{selected=rows;return {quotes:{}};},getCryptoMarket:async()=>{throw Error('Provider unavailable');}},'../data/crypto-catalog.json':catalog,'./http':{MobileError:class extends Error{constructor(status,code,message){super(message);this.status=status;this.code=code;}}}},{process:{env:{}}});
   const ids=Array.from({length:4},()=>randomUUID());for(let i=0;i<4;i++)await db.query('INSERT INTO investment_positions(id,user_id,kind,asset_id,symbol,name,buy_price,quantity,bought_on,currency,archived) VALUES($1,$2,$3,$4,$5,$6,1,1,$7,$8,$9)',[ids[i],i===1?'b':'a','crypto','retired-source','OLD','Original owned asset','2026-10-04',i===2?'EUR':'USD',i===3]);
   await api.readMobileInvestmentMarket('a',{ids:ids.join(',')});assert.deepEqual(selected.map(p=>p.id),[ids[0]]);
   await api.writeMobileInvestment('a',{operationId:randomUUID(),revision:await rev(),data:{...data,id:ids[0],create:false,position:{...data.position,kind:'crypto',assetId:'retired-source',symbol:'FORGED',name:'Forged',manualPrice:'999'}}});const row=(await db.query('SELECT * FROM investment_positions WHERE id=$1',[ids[0]])).rows[0];assert.equal(row.symbol,'OLD');assert.equal(row.name,'Original owned asset');assert.equal(row.manual_price,null);
  });
 }finally{await db.close();}
});
