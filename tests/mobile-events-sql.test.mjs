import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
test('additive Events transaction preserves web records, revisions, owners and cross-week retry safety',async t=>{
 const db=await PGlite.create();
 try{
  await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY); CREATE TABLE user_events(id text PRIMARY KEY,user_id text REFERENCES "user"(id) ON DELETE CASCADE,week text,data jsonb,UNIQUE(user_id,week)); INSERT INTO "user" VALUES('a'),('b'); INSERT INTO user_events VALUES('old','a','2026-WK40','[{"id":"monday","day":"Monday","tasks":[{"id":"history","title":"Keep history","completed":true}]}]');`);
  await db.exec(readFileSync('lib/db/0026_mobile_events.sql','utf8'));
  const old=(await db.query("SELECT data FROM user_events WHERE id='old'")).rows[0].data;
  const version=async owner=>Number((await db.query('SELECT revision FROM b1_mobile_event_versions WHERE user_id=$1',[owner])).rows[0]?.revision??0);
  const save=async(owner,op,fp,revision,patches)=>(await db.query('SELECT b1_mobile_save_events($1,$2::uuid,$3,$4,$5::jsonb) AS outcome',[owner,op,fp,revision,JSON.stringify(patches)])).rows[0].outcome;
  const op=randomUUID(),newBoard=[...old,{id:'tuesday',day:'Tuesday',tasks:[{id:'new',title:'Synthetic event',completed:false}]}];
  await t.test('existing history survives migration and an acknowledged request cannot change payload',async()=>{
   assert.deepEqual((await db.query("SELECT data FROM user_events WHERE id='old'")).rows[0].data,old);
   assert.equal(await save('a',op,'first',0,[{week:'2026-WK40',before:old,data:newBoard}]),'saved');
   assert.equal(await save('a',op,'first',0,[{week:'2026-WK40',before:old,data:newBoard}]),'duplicate');
   assert.equal(await save('a',op,'changed',1,[]),'operation-reused');assert.equal(await version('a'),1);
  });
  await t.test('a web edit increments revision; a stale move leaves both weeks and receipts unchanged',async()=>{
   await db.query("UPDATE user_events SET data=$1::jsonb WHERE id='old'",[JSON.stringify(old)]);
   assert.equal(await save('a',randomUUID(),'stale',1,[{week:'2026-WK40',before:newBoard,data:[]},{week:'2026-WK41',before:null,data:newBoard}]),'conflict');
   assert.equal((await db.query("SELECT count(*)::int AS count FROM user_events WHERE week='2026-WK41'")).rows[0].count,0);
  });
  await t.test('preflight rejects a wrong second week before mutating the first',async()=>{
   assert.equal(await save('a',randomUUID(),'bad-second',2,[{week:'2026-WK40',before:old,data:[]},{week:'2026-WK41',before:[],data:newBoard}]),'conflict');
   assert.deepEqual((await db.query("SELECT data FROM user_events WHERE id='old'")).rows[0].data,old);
  });
  await t.test('valid cross-week edits commit together and replay cannot overwrite later web edits',async()=>{
   const move=randomUUID(),patch=[{week:'2026-WK40',before:old,data:old},{week:'2026-WK41',before:null,data:newBoard}];
   assert.equal(await save('a',move,'move',2,patch),'saved');
   await db.query("UPDATE user_events SET data='[]' WHERE user_id='a' AND week='2026-WK41'");
   assert.equal(await save('a',move,'move',2,patch),'duplicate');
   assert.deepEqual((await db.query("SELECT data FROM user_events WHERE user_id='a' AND week='2026-WK41'")).rows[0].data,[]);
  });
  await t.test('operation identities are account-scoped and receipts remain durable',async()=>{
   assert.equal(await save('b',op,'other-account',0,[{week:'2026-WK41',before:null,data:[]}]),'saved');
   assert.equal((await db.query('SELECT count(*)::int AS count FROM b1_mobile_event_operations')).rows[0].count,3);
   assert.equal(await save('missing',randomUUID(),'no-owner',0,[]),'unauthorized');
  });
 }finally{await db.close();}
});
