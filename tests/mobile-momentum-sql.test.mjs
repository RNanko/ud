import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {types,reduce,emptySources} from './momentum-fixture.mjs';
test('Momentum SQL atomically preserves web revisions, owned stable identities and durable receipts',async t=>{
 const db=await PGlite.create();try{
  await db.exec('CREATE TABLE "user"(id text PRIMARY KEY); INSERT INTO "user" VALUES(\'a\'),(\'b\');CREATE TABLE momentum_state(user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,data jsonb NOT NULL,revision bigint NOT NULL DEFAULT 0,mutations jsonb NOT NULL DEFAULT \'[]\',updated_at timestamptz DEFAULT now());');
  await db.query('INSERT INTO momentum_state(user_id,data) VALUES($1,$2),($3,$2)',['a',JSON.stringify(types.emptyMomentum()),'b']);
  await db.exec(readFileSync('lib/db/0034_mobile_momentum.sql','utf8'));
  await db.exec(readFileSync('lib/db/0035_mobile_momentum_receipt_order.sql','utf8'));
  const get=async(owner='a')=>(await db.query('SELECT * FROM momentum_state WHERE user_id=$1',[owner])).rows[0];
  const save=async(data,revision,op=randomUUID(),collection=null,id=null,create=false,owner='a',hash=op)=>(await db.query('SELECT b1_mobile_save_momentum($1,$2::uuid,$3,$4,$5::jsonb,$6,$7,$8) AS result',[owner,op,hash,revision,JSON.stringify(data),collection,id,create])).rows[0].result;
  let state=types.emptyMomentum();const id=randomUUID(),op=randomUUID();state=reduce(state,{type:'focus-start',id,source:null,minutes:1},emptySources());
  await t.test('retries retain original acknowledgment beyond the bounded web history',async()=>{assert.equal((await save(state,0,op,'focus',id,true)).outcome,'saved');assert.equal((await save(state,0,op,'focus',id,true)).outcome,'duplicate');assert.equal((await save(state,0,op,'focus',id,true,'a','changed')).outcome,'operation-reused');await db.query('UPDATE momentum_state SET mutations=\'[]\' WHERE user_id=\'a\'');assert.equal((await save(state,0,op,'focus',id,true)).revision,1);});
  await t.test('direct web edits advance revision and reject stale replacement',async()=>{await db.query("UPDATE momentum_state SET data=jsonb_set(data,'{preferences,thoughts}','false') WHERE user_id='a'");assert.equal(Number((await get()).revision),2);assert.equal((await save(state,1)).outcome,'conflict');});
  await t.test('deletion is observed; stale and new-request upsert cannot resurrect',async()=>{await db.query("UPDATE momentum_state SET data=jsonb_set(data,'{focus}','[]') WHERE user_id='a'");const rev=Number((await get()).revision);assert.equal((await save(state,rev,randomUUID(),'focus',id,false)).outcome,'conflict');assert.equal((await save(state,rev,randomUUID(),'focus',id,true)).outcome,'conflict');assert.equal((await save(state,0,op,'focus',id,true)).revision,1);assert.equal((await get()).data.focus.length,0);});
  await t.test('owner scopes, concurrent CAS and account deletion are atomic',async()=>{assert.equal((await save(state,0,randomUUID(),'focus',id,false,'b')).outcome,'conflict');const a=await get(),results=await Promise.all([save(a.data,Number(a.revision)),save(a.data,Number(a.revision))]);assert.equal(results.filter(r=>r.outcome==='saved').length,1);assert.equal(results.filter(r=>r.outcome==='conflict').length,1);const first=randomUUID(),second=randomUUID();let latest=await get();await save(latest.data,Number(latest.revision),first);latest=await get();await save(latest.data,Number(latest.revision),second);assert.deepEqual((await get()).mutations.slice(-2),[first,second]);await db.query('DELETE FROM "user" WHERE id=\'a\'');assert.equal((await db.query('SELECT count(*)::int AS n FROM b1_mobile_momentum_operations WHERE user_id=\'a\'')).rows[0].n,0);assert.equal((await save(state,0,randomUUID(),null,null,false,'a')).outcome,'unauthorized');});
 }finally{await db.close();}
});
