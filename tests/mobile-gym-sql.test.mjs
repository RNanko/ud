import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

test('Gym receipts atomically preserve owners, snapshots, CAS and deletion tombstones',async t=>{
 const db=await PGlite.create();
 try {
  await db.exec('CREATE TABLE "user"(id text PRIMARY KEY); INSERT INTO "user" VALUES(\'a\'),(\'b\');');
  await db.exec(readFileSync('lib/db/0019_gym_planner.sql','utf8').replaceAll('--> statement-breakpoint',''));
  await db.exec(readFileSync('lib/db/0029_mobile_gym.sql','utf8'));
  const row=async(kind,id)=>(await db.query(`SELECT to_jsonb(t)-'created_at' AS row FROM gym_${kind} t WHERE id=$1`,[id])).rows[0]?.row??null;
  const save=async(owner,op,fp,kind,id,before,after,dependency=null,start=false)=>(await db.query('SELECT b1_mobile_save_gym($1,$2::uuid,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9) AS result',[owner,op,fp,kind,id,before===null?null:JSON.stringify(before),JSON.stringify(after),dependency===null?null:JSON.stringify(dependency),start])).rows[0].result;
  const id=randomUUID(),op=randomUUID(),plan={date:'2026-10-01',timezone:'UTC',data:{name:'Synthetic plan',targets:10}};
  await t.test('migration is additive and same-ID retry is one plan/receipt',async()=>{
   assert.equal((await save('a',op,'plan','plan',id,null,plan)).outcome,'saved');
   assert.equal((await save('a',op,'plan','plan',id,null,plan)).outcome,'duplicate');
   assert.equal((await save('a',op,'changed','plan',id,null,plan)).outcome,'operation-reused');
   assert.equal((await db.query('SELECT count(*)::int AS n FROM gym_plans')).rows[0].n,1);
  });
  const snapshot=await row('plans',id),session=randomUUID(),startOp=randomUUID();
  await t.test('one canonical session per plan, including concurrent distinct start commands',async()=>{
   const after={plan_id:id,data:{status:'active',originalPlan:plan.data}};
   assert.equal((await save('a',startOp,'start','session',session,null,after,snapshot,true)).id,session);
   assert.equal((await save('a',randomUUID(),'start-again','session',randomUUID(),null,after,snapshot,true)).id,session);
   assert.equal((await db.query('SELECT count(*)::int AS n FROM gym_sessions')).rows[0].n,1);
   assert.equal((await save('a',randomUUID(),'plan-edit','plan',id,snapshot,{...plan,data:{targets:999}})).outcome,'conflict');
  });
  await t.test('stale web changes and foreign ownership reject without receipts',async()=>{
   const before=await row('sessions',session);
   await db.query('UPDATE gym_sessions SET data=$1::jsonb,revision=revision+1 WHERE id=$2',[JSON.stringify({...before.data,notes:'web'}),session]);
   assert.equal((await save('a',randomUUID(),'stale','session',session,before,{...before,data:{status:'completed'}})).outcome,'conflict');
   assert.equal((await save('b',randomUUID(),'foreign','session',session,null,{data:{}})).outcome,'conflict');
  });
  await t.test('completion commits once; replay after archive never resurrects or overwrites history',async()=>{
   const before=await row('sessions',session),finish=randomUUID();
   assert.equal((await save('a',finish,'finish','session',session,before,{...before,data:{...before.data,status:'completed',actual:8}})).outcome,'saved');
   const completed=await row('sessions',session),archive=randomUUID();
   assert.equal((await save('a',archive,'archive','session',session,completed,{...completed,archived:true})).outcome,'saved');
   assert.equal((await save('a',finish,'finish','session',session,before,{...before,data:{status:'completed'}})).outcome,'duplicate');
   assert.equal((await row('sessions',session)).archived,true);
   assert.equal((await save('a',randomUUID(),'resurrect','session',session,await row('sessions',session),{...completed,archived:false})).outcome,'conflict');
   assert.equal((await save('a',randomUUID(),'restart','session',randomUUID(),null,{plan_id:id,data:{}},snapshot,true)).outcome,'conflict');
  });
 } finally {await db.close();}
});
