import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {loadModule} from './helpers.mjs';

// Execute the real migration and repository queries against a disposable
// PostgreSQL engine. No application account or configured database is touched.
test('notification read state is persisted, owned, retry-safe and excluded from the unread page',async t=>{
 const db=await PGlite.create();
 try{
  await db.exec(`
   CREATE TABLE "user"(id text PRIMARY KEY);
   INSERT INTO "user" VALUES('alice'),('bob');
   CREATE TABLE b1_deletions(user_id text,product text);
   CREATE TABLE b1_email_outbox(id text,kind text,status text,payload text,lease_until timestamptz);
   CREATE TABLE b1_account_settings(user_id text,product text,notifications jsonb);
   CREATE TABLE user_events(id text,user_id text,week text,data jsonb);
   CREATE TABLE gym_plans(id text,user_id text);
   CREATE TABLE gym_sessions(id text,user_id text,plan_id text);
   CREATE TABLE momentum_state(user_id text);
   CREATE TABLE kanban_board(user_id text);
  `);
  await db.exec(readFileSync('lib/db/0024_internal_inbox.sql','utf8').replaceAll('--> statement-breakpoint',''));
  const query=async(sql,params=[])=>(await db.query(sql,params)).rows;
  const accountSql=(parts,...values)=>query(parts.reduce((sql,part,i)=>sql+part+(i<values.length?`$${i+1}`:''),''),values);
  const p=loadModule('lib/account/preferences.ts');
  const store=loadModule('lib/notifications/store.ts',{'../account/store':{accountSql,accountSettings:async()=>({preferences:{...p.defaultPreferences,timezone:'UTC'}})},'../momentum/types':{},'../todo':{},'./produce':{},'./types':loadModule('lib/notifications/types.ts')});
  await query(`INSERT INTO b1_notifications(id,user_id,product,category,dedup_key,source_key,title,body,target,occurred_at,available_at,published_at)
   SELECT 'message-'||i,'alice','b1-way-personal','product_update','message-'||i,'message-'||i,'Saved update','Plain text','{"kind":"account","section":"notifications"}',now(),now(),now() FROM generate_series(1,22) i`);
  const page=()=>store.listInbox('alice',{filter:'unread'});
  let first=await page(),message=first.messages[0];
  await t.test('owned unread pages paginate without losing the full unread count',async()=>{
   assert.equal(first.unreadCount,22);assert.equal(first.messages.length,20);
   const next=await store.listInbox('alice',{filter:'unread',cursor:first.nextCursor});assert.equal(next.messages.length,2);assert.equal(new Set([...first.messages,...next.messages].map(m=>m.id)).size,22);
   assert.equal((await store.listInbox('bob',{filter:'unread'})).unreadCount,0);
   await assert.rejects(()=>store.inboxDetail('bob',message.id));
   await assert.rejects(()=>store.setInboxState('bob',{id:message.id,revision:message.revision,read:true}));
  });
  await t.test('reading updates read_at and revision, removes the unread row and survives a fresh repository read',async()=>{
   await store.setInboxState('alice',{id:message.id,revision:message.revision,read:true});
   const row=(await query('SELECT read_at,revision FROM b1_notifications WHERE id=$1',[message.id]))[0];assert.ok(row.read_at);assert.equal(row.revision,message.revision+1);
   assert.equal((await page()).unreadCount,21);assert.ok(!(await page()).messages.some(m=>m.id===message.id));
   assert.ok((await store.inboxDetail('alice',message.id)).readAt);assert.ok((await store.listInbox('alice')).messages.some(m=>m.id===message.id));
  });
  await t.test('an exact retry preserves the timestamp; a stale opposite action rejects',async()=>{
   const before=(await query('SELECT read_at,revision FROM b1_notifications WHERE id=$1',[message.id]))[0];
   await store.setInboxState('alice',{id:message.id,revision:message.revision,read:true});
   const after=(await query('SELECT read_at,revision FROM b1_notifications WHERE id=$1',[message.id]))[0];assert.deepEqual(after,before);
   await assert.rejects(()=>store.setInboxState('alice',{id:message.id,revision:message.revision,read:false}));assert.equal((await page()).unreadCount,21);
  });
  await t.test('re-evaluating or updating source content never resets the read timestamp',async()=>{
   await query("INSERT INTO b1_inbox_state(user_id,product,lease_id) VALUES('alice','b1-way-personal','lease')");
   const at=new Date().toISOString(),candidate={key:message.id,sourceKey:message.id,category:'product_update',title:'Updated text',body:'Updated body',target:{kind:'account',section:'notifications'},occurredAt:at,availableAt:at,expiresAt:null,suppressed:false};
   const result=await query("SELECT b1_apply_inbox_snapshot('alice','b1-way-personal',0,'lease',$1::jsonb) AS applied",[JSON.stringify([candidate])]);assert.equal(result[0].applied,true);
   const detail=await store.inboxDetail('alice',message.id);assert.ok(detail.readAt);assert.equal(detail.title,'Updated text');assert.equal((await page()).unreadCount,21);
  });
  await t.test('archiving removes a row from both the unread list and count',async()=>{
   const unread=(await page()).messages[0];await store.setInboxState('alice',{id:unread.id,revision:unread.revision,archived:true});
   assert.ok((await store.inboxDetail('alice',unread.id)).archivedAt);assert.equal((await page()).unreadCount,20);assert.ok(!(await page()).messages.some(m=>m.id===unread.id));
  });
  await t.test('mark-all persists available reads without marking future messages or deleting any records',async()=>{
   await query(`INSERT INTO b1_notifications(id,user_id,product,category,dedup_key,source_key,title,body,target,occurred_at,available_at,published_at)
    VALUES('future','alice','b1-way-personal','product_update','future','future','Future','Body','{"kind":"account","section":"notifications"}',now(),now()+interval '1 hour',now()+interval '1 hour')`);
   const result=await store.markAvailableRead('alice');assert.equal(result.count,20);assert.equal((await page()).unreadCount,0);assert.equal((await page()).messages.length,0);
   assert.equal((await query("SELECT read_at FROM b1_notifications WHERE id='future'"))[0].read_at,null);
   assert.equal((await query('SELECT count(*)::int AS n FROM b1_notifications'))[0].n,23);
  });
 }finally{await db.close();}
});
