import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as crypto from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {loadModule,plain} from './helpers.mjs';

const migration=readFileSync('lib/db/0037_notes.sql','utf8');
const uuid=()=>crypto.randomUUID();
const domain=loadModule('lib/notes.ts');
const text=(value='Draft text')=>({id:uuid(),type:'text',text:value});
const drawing=()=>({id:uuid(),type:'drawing',strokes:[{id:uuid(),color:'#123abc',width:2.5,tool:'pen',points:[{x:0,y:0},{x:1,y:1}]}]});
const create=(title='My note',blocks=[text()],revision=0)=>({operationId:uuid(),revision,data:{kind:'save',id:uuid(),expectedRevision:null,title,blocks}});
async function fixture({legacy=[],migrate=true}={}){
 const db=await PGlite.create();
 await db.exec('CREATE TABLE "user"(id text PRIMARY KEY);INSERT INTO "user" VALUES(\'a\'),(\'b\');CREATE TABLE user_notes(id text PRIMARY KEY,user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,data jsonb NOT NULL);');
 for(const row of legacy)await db.query('INSERT INTO user_notes VALUES($1,$2,$3::jsonb)',[row.id,row.owner,JSON.stringify(row.data)]);
 if(migrate)await db.exec(migration);
 let owner='a',writeAllowed=true,loseResponse=false,loseSnapshot=false;const queries=[],guards=[],invalidations=[];
 const accountSql=Object.assign(async(parts,...args)=>{
  const sql=parts.reduce((result,part,index)=>result+(index?'$'+index:'')+part,'');queries.push(sql);
  if(loseSnapshot&&sql.includes('jsonb_agg')){loseSnapshot=false;throw Error('Synthetic lost read response');}
  return (await db.query(sql,args)).rows;
 },{query:async(sql,args)=>(await db.query(sql,args)).rows});
 const store=loadModule('lib/notes/store.ts',{'node:crypto':crypto,'../account/store':{accountSql},'../notes':domain});
 const actions=loadModule('lib/actions/notes.actions.ts',{
  '../notes/store':store,'../session':{requireUserId:async(requested,intent)=>{guards.push(intent??'read');if(!owner||requested&&requested!==owner)throw Error('Unauthorized');if(intent==='write'&&!writeAllowed)throw Error('Read only');return owner;}},
  'next/cache':{revalidatePath:path=>{invalidations.push(path);if(loseResponse){loseResponse=false;throw Error('Synthetic postcommit failure');}}},
 });
 return {db,actions,store,queries,guards,invalidations,setOwner:value=>{owner=value;},setWrite:value=>{writeAllowed=value;},loseResponse:()=>{loseResponse=true;},loseSnapshot:()=>{loseSnapshot=true;}};
}

test('Notes command schema bounds every editor/drawing input and preserves text literally',()=>{
 const valid=create('  Title  ',[text(' <script>literal</script>\n  spaces'),{id:uuid(),type:'checklist',items:[{id:uuid(),text:'Task',checked:true}]},drawing()]);
 assert.deepEqual(plain(domain.notesCommandSchema.parse(valid)),valid);
 for(const value of [NaN,Infinity,-0.01,1.01]){const candidate=structuredClone(valid);candidate.data.blocks[2].strokes[0].points[0].x=value;assert.equal(domain.notesCommandSchema.safeParse(candidate).success,false);}
 for(const patch of [{width:0},{width:41},{color:'url(javascript:bad)'},{tool:'image'},{points:[]},{points:Array.from({length:2001},()=>({x:0,y:0}))}]){const candidate=structuredClone(valid);Object.assign(candidate.data.blocks[2].strokes[0],patch);assert.equal(domain.notesCommandSchema.safeParse(candidate).success,false);}
 const badBlocks=[Array.from({length:101},()=>text()),[text('x'.repeat(20001))],[{id:uuid(),type:'bullet',items:Array.from({length:201},()=>({id:uuid(),text:'x',checked:false}))}],[{id:uuid(),type:'checklist',items:[{id:uuid(),text:'x'.repeat(4001),checked:false}]}]];
 for(const blocks of badBlocks)assert.equal(domain.notesCommandSchema.safeParse(create('',blocks)).success,false);
 for(const patch of [{title:'x'.repeat(201)},{owner:'b'},{id:'old-id'},{expectedRevision:-1}])assert.equal(domain.notesCommandSchema.safeParse({...valid,data:{...valid.data,...patch}}).success,false);
 assert.equal(domain.notesCommandSchema.safeParse({...valid,operationId:'bad'}).success,false);
 const duplicate=text();assert.equal(domain.notesCommandSchema.safeParse(create('',[duplicate,duplicate])).success,false);
 assert.equal(domain.noteDraftSchema.safeParse({title:'',blocks:Array.from({length:6},()=>text('x'.repeat(20000)))}).success,false);
 const dense=drawing();dense.strokes=Array.from({length:7},()=>({...drawing().strokes[0],points:Array.from({length:2000},()=>({x:0.1234567890123456,y:0.1234567890123456}))}));assert.equal(domain.noteDraftSchema.safeParse({title:'',blocks:[dense]}).success,false);
 const tooManyStrokes=Array.from({length:3},()=>({id:uuid(),type:'drawing',strokes:Array.from({length:201},()=>({...drawing().strokes[0],points:[{x:0,y:0}]}))}));assert.equal(domain.noteDraftSchema.safeParse({title:'',blocks:tooManyStrokes}).success,false);
 const tooManyItems=Array.from({length:6},()=>({id:uuid(),type:'bullet',items:Array.from({length:200},()=>({id:uuid(),text:'',checked:false}))}));assert.equal(domain.noteDraftSchema.safeParse({title:'',blocks:tooManyItems}).success,false);
 const byteBound=drawing();byteBound.strokes=Array.from({length:6},()=>({...drawing().strokes[0],points:Array.from({length:2000},()=>({x:0.12345678901234568,y:0.12345678901234568}))}));
 const byteBoundDraft={title:'',blocks:[byteBound,...Array.from({length:5},()=>text('汉'.repeat(20000)))]};assert.equal(domain.noteUsage(byteBoundDraft.blocks).points,12000);assert.equal(domain.noteUsage(byteBoundDraft.blocks).text,100000);assert.ok(new TextEncoder().encode(JSON.stringify(byteBoundDraft)).byteLength>domain.NOTES_LIMITS.payloadBytes);assert.equal(domain.noteDraftSchema.safeParse(byteBoundDraft).success,false);
 const duplicateOrder={operationId:uuid(),revision:0,data:{kind:'reorder',pinned:false,ids:[valid.data.id,valid.data.id]}};assert.equal(domain.notesCommandSchema.safeParse(duplicateOrder).success,false);
 assert.match(domain.notePlainText(valid.data),/literal/);assert.match(domain.notePlainText(valid.data),/Task/);assert.doesNotMatch(domain.notePlainText(valid.data),/#123abc/);
});

test('actual Notes actions and SQL preserve owner, per-note CAS, retry receipts and ordering',async t=>{
 const f=await fixture();try{
  await t.test('empty reads never create rows and return one consistent owned snapshot',async()=>{
   assert.deepEqual(plain(await f.actions.getNotes()),{revision:0,notes:[]});assert.equal(f.queries.length,1);
   assert.equal((await f.db.query('SELECT count(*)::int n FROM b1_notes_state')).rows[0].n,0);
   f.setOwner(null);await assert.rejects(f.actions.getNotes(),/Unauthorized/);assert.equal((await f.actions.commitNotes(create())).status,'rejected');f.setOwner('a');
   f.setWrite(false);assert.equal((await f.actions.commitNotes(create())).status,'rejected');assert.deepEqual(plain(await f.actions.getNotes()),{revision:0,notes:[]});f.setWrite(true);
  });
  const first=create('First',[text(),drawing()]),second=create('Second');
  await t.test('a committed response lost before acknowledgment retries one note and receipt',async()=>{
   f.loseResponse();assert.equal((await f.actions.commitNotes(first)).status,'unknown');const result=await f.actions.commitNotes(first);assert.equal(result.success,true);assert.equal(result.acknowledgedOperationId,first.operationId);assert.equal(result.snapshot.notes.length,1);assert.deepEqual(plain(result.snapshot.notes[0].blocks),first.data.blocks);
   assert.equal(result.snapshot.notes[0].revision,1);assert.equal(result.snapshot.notes[0].userId,undefined);assert.equal((await f.db.query('SELECT count(*)::int n FROM b1_notes_operations')).rows[0].n,1);assert.deepEqual(f.invalidations,['/account/notes','/account/notes']);assert.ok(f.guards.includes('write'));
  });
  await t.test('parallel duplicate creates share one identity and distinct creates ignore stale board revisions',async()=>{
   const results=await Promise.all([f.actions.commitNotes(second),f.actions.commitNotes(second)]);assert.ok(results.every(result=>result.success));assert.equal((await f.actions.getNotes()).notes.length,2);
   const distinct=create(second.data.title,second.data.blocks);assert.equal((await f.actions.commitNotes(distinct)).success,true);assert.equal((await f.actions.getNotes()).notes.length,3);
   assert.equal((await f.actions.commitNotes({...second,data:{...second.data,title:'Changed retry'}})).status,'conflict');
  });
  await t.test('editing another note does not stale this note; concurrent same-note edit conflicts',async()=>{
   const snapshot=await f.actions.getNotes(),a=snapshot.notes.find(note=>note.id===first.data.id),b=snapshot.notes.find(note=>note.id===second.data.id);
   const editA={operationId:uuid(),revision:snapshot.revision,data:{...first.data,expectedRevision:a.revision,title:'A updated'}},editB={operationId:uuid(),revision:snapshot.revision,data:{...second.data,expectedRevision:b.revision,title:'B updated'}};
   assert.equal((await f.actions.commitNotes(editA)).success,true);assert.equal((await f.actions.commitNotes(editB)).success,true);
   const conflict=await f.actions.commitNotes({...editA,operationId:uuid(),data:{...editA.data,title:'Stale A'}});assert.equal(conflict.status,'conflict');assert.equal(conflict.snapshot.notes.find(note=>note.id===a.id).title,'A updated');
   assert.equal(conflict.snapshot.notes.find(note=>note.id===b.id).title,'B updated');
  });
  await t.test('foreign saves, deletes and pins never reveal or change the source',async()=>{
   f.setOwner('b');for(const data of [{...first.data,expectedRevision:2},{kind:'delete',id:first.data.id,expectedRevision:2},{kind:'pin',id:first.data.id,expectedRevision:2,pinned:true}]){
    const result=await f.actions.commitNotes({operationId:uuid(),revision:0,data});assert.equal(result.status,'conflict');assert.equal(result.snapshot.notes.length,0);
   }assert.equal((await f.actions.getNotes()).notes.length,0);f.setOwner('a');
  });
  await t.test('pin changes note revision/order but preserves content and content timestamps',async()=>{
   const snapshot=await f.actions.getNotes(),note=snapshot.notes.find(note=>note.id===first.data.id);
   const result=await f.actions.commitNotes({operationId:uuid(),revision:0,data:{kind:'pin',id:note.id,expectedRevision:note.revision,pinned:true}});assert.equal(result.success,true);
   const after=result.snapshot.notes.find(row=>row.id===note.id);assert.equal(after.pinned,true);assert.equal(after.revision,note.revision+1);assert.equal(after.createdAt,note.createdAt);assert.equal(after.updatedAt,note.updatedAt);assert.deepEqual(plain(after.blocks),plain(note.blocks));
   assert.equal((await f.actions.commitNotes({operationId:uuid(),revision:result.snapshot.revision,data:{kind:'pin',id:note.id,expectedRevision:note.revision,pinned:false}})).status,'conflict');
  });
  await t.test('reorder requires complete owned section and current board; content/revisions stay unchanged',async()=>{
   const snapshot=await f.actions.getNotes(),section=snapshot.notes.filter(note=>!note.pinned),ids=section.map(note=>note.id).reverse();
   const invalids=[ids.slice(0,1),[...ids,first.data.id],[uuid(),ids[0]]];
   for(const values of invalids)assert.equal((await f.actions.commitNotes({operationId:uuid(),revision:snapshot.revision,data:{kind:'reorder',pinned:false,ids:values}})).status,'conflict');
   assert.equal((await f.actions.commitNotes({operationId:uuid(),revision:0,data:{kind:'reorder',pinned:false,ids}})).status,'conflict');
   const command={operationId:uuid(),revision:snapshot.revision,data:{kind:'reorder',pinned:false,ids}},result=await f.actions.commitNotes(command);assert.equal(result.success,true);assert.deepEqual(plain(result.snapshot.notes.filter(note=>!note.pinned).map(note=>note.id)),ids);
   for(const before of snapshot.notes){const after=result.snapshot.notes.find(note=>note.id===before.id);assert.equal(after.revision,before.revision);assert.equal(after.updatedAt,before.updatedAt);assert.equal(after.title,before.title);}
   assert.equal((await f.actions.commitNotes(command)).success,true);
   // Reordering alone must not invalidate a separately opened content editor.
   const old=section[0];assert.equal((await f.actions.commitNotes({operationId:uuid(),revision:snapshot.revision,data:{kind:'save',id:old.id,expectedRevision:old.revision,title:'After reorder',blocks:old.blocks}})).success,true);
  });
  await t.test('pinning moves to end of destination section and stale reorder cannot erase a newly pinned note',async()=>{
   const snapshot=await f.actions.getNotes(),note=snapshot.notes.find(note=>note.id===second.data.id);
   const result=await f.actions.commitNotes({operationId:uuid(),revision:0,data:{kind:'pin',id:note.id,expectedRevision:note.revision,pinned:true}});assert.equal(result.success,true);
   assert.deepEqual(plain(result.snapshot.notes.filter(note=>note.pinned).map(note=>note.id)),[first.data.id,second.data.id]);
   assert.equal((await f.actions.commitNotes({operationId:uuid(),revision:snapshot.revision,data:{kind:'reorder',pinned:true,ids:[first.data.id]}})).status,'conflict');
  });
  await t.test('direct canonical content update advances revision and rejects stale deletion',async()=>{
   const snapshot=await f.actions.getNotes(),note=snapshot.notes.find(note=>note.id===first.data.id);
   await f.db.query('UPDATE b1_notes SET title=$1 WHERE id=$2',['Other writer',note.id]);
   const result=await f.actions.commitNotes({operationId:uuid(),revision:snapshot.revision,data:{kind:'delete',id:note.id,expectedRevision:note.revision}});assert.equal(result.status,'conflict');const after=result.snapshot.notes.find(row=>row.id===note.id);assert.equal(after.revision,note.revision+1);assert.notEqual(after.updatedAt,note.updatedAt);
  });
  await t.test('delete and replay old create never resurrect; deleted IDs cannot be reused with new operations',async()=>{
   const snapshot=await f.actions.getNotes(),note=snapshot.notes.find(note=>note.id===first.data.id),command={operationId:uuid(),revision:snapshot.revision,data:{kind:'delete',id:note.id,expectedRevision:note.revision}};
   f.loseSnapshot();assert.equal((await f.actions.commitNotes(command)).status,'unknown');assert.equal((await f.actions.commitNotes(command)).success,true);
   const replay=await f.actions.commitNotes(first);assert.equal(replay.success,true);assert.equal(replay.snapshot.notes.some(row=>row.id===note.id),false);
   assert.equal((await f.actions.commitNotes({...first,operationId:uuid(),revision:replay.snapshot.revision})).status,'conflict');
  });
  await t.test('receipt insert failure rolls back the source mutation atomically',async()=>{
   await f.db.exec("CREATE FUNCTION fixture_fail_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected receipt failure'; END $$;CREATE TRIGGER fixture_fail_receipt BEFORE INSERT ON b1_notes_operations FOR EACH ROW EXECUTE FUNCTION fixture_fail_receipt();");
   const command=create('Rollback');assert.equal((await f.actions.commitNotes(command)).status,'unknown');assert.equal((await f.db.query('SELECT count(*)::int n FROM b1_notes WHERE id=$1',[command.data.id])).rows[0].n,0);
   await f.db.exec('DROP TRIGGER fixture_fail_receipt ON b1_notes_operations');assert.equal((await f.actions.commitNotes(command)).success,true);
  });
  await t.test('user deletion cascades Notes, state, receipts and import ledger',async()=>{
   await f.db.query('DELETE FROM "user" WHERE id=$1',['a']);for(const table of ['b1_notes','b1_notes_state','b1_notes_operations','b1_notes_legacy_imports'])assert.equal((await f.db.query(`SELECT count(*)::int n FROM ${table} WHERE user_id=$1`,['a'])).rows[0].n,0);
  });
 }finally{await f.db.close();}
});

test('Notes migration preserves populated legacy rows and is repeatable without resurrection',async()=>{
 const legacy=[
  {id:'source-a',owner:'a',data:[{id:'same',event:'Legacy title',description:'Exact legacy body',date:'2024-01-01',createdAt:1704067200000},{id:'same',event:'Repeated legacy ID',createdAt:1704153600000},{event:'Bad timestamp',createdAt:'bad'},{event:'Oversized',description:'x'.repeat(20001),createdAt:1704067200000},null]},
  {id:'source-a-2',owner:'a',data:[{id:'same',event:'Other source row',createdAt:1704067200000}]},
  {id:'source-b',owner:'b',data:[{id:'same',event:'B private',createdAt:1704067200000}]},
  {id:'invalid-container',owner:'a',data:{untouched:true}},
 ];
 const f=await fixture({legacy});try{
  const original=(await f.db.query('SELECT * FROM user_notes ORDER BY id')).rows;
  const snapshot=await f.actions.getNotes();assert.equal(snapshot.notes.length,3);assert.equal(new Set(snapshot.notes.map(note=>note.id)).size,3);
  const exportSql=async(parts)=>parts.join('').includes('FROM "user"')?[{id:'a'}]:[];
  exportSql.query=async(sql,args)=>/FROM "(?:b1_notes|user_notes)"/.test(sql)?(await f.db.query(sql,args)).rows:[];
  const privacy=loadModule('lib/actions/privacy.actions.ts',{
   'next/headers':{headers:async()=>new Headers()},'../auth':{auth:{}},'../session':{requireUserId:async()=> 'a'},
   '../account/store':{accountSql:exportSql,accountSettings:async()=>({}),membershipFor:async()=>null},
   '../account/privacy':{},'../legal/store':{legalAccountHistory:async()=>[]},'../account/result':loadModule('lib/account/result.ts'),
  });
  const exported=await privacy.exportAccountData();assert.equal(exported.ok,true);assert.equal(exported.value.data.b1_notes.length,3);assert.equal(exported.value.data.user_notes.length,3);assert.ok(exported.value.data.b1_notes.every(note=>note.user_id==='a'));assert.ok(exported.value.data.user_notes.some(row=>row.id==='invalid-container'));assert.equal(exported.value.data.b1_notes_operations,undefined);
  const imported=snapshot.notes.find(note=>note.title==='Legacy title');assert.equal(imported.createdAt,'2024-01-01T00:00:00.000Z');assert.equal(imported.updatedAt,imported.createdAt);assert.equal(imported.blocks[0].text,'Date: 2024-01-01\n\nExact legacy body');assert.ok(domain.notesCommandSchema.safeParse({operationId:uuid(),revision:snapshot.revision,data:{kind:'save',id:imported.id,expectedRevision:imported.revision,title:imported.title,blocks:imported.blocks}}).success);
  await f.db.exec(migration);assert.deepEqual(plain(await f.actions.getNotes()),plain(snapshot));assert.deepEqual((await f.db.query('SELECT * FROM user_notes ORDER BY id')).rows,original);
  const deletion={operationId:uuid(),revision:snapshot.revision,data:{kind:'delete',id:imported.id,expectedRevision:imported.revision}};
  f.setOwner('b');assert.equal((await f.actions.commitNotes(deletion)).status,'conflict');f.setOwner('a');
  assert.equal((await f.actions.commitNotes({...deletion,operationId:uuid(),data:{...deletion.data,expectedRevision:0}})).status,'conflict');
  assert.deepEqual((await f.db.query('SELECT * FROM user_notes ORDER BY id')).rows,original);
  await f.db.exec("CREATE FUNCTION fixture_fail_import_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected receipt failure'; END $$;CREATE TRIGGER fixture_fail_import_delete BEFORE INSERT ON b1_notes_operations FOR EACH ROW EXECUTE FUNCTION fixture_fail_import_delete();");
  assert.equal((await f.actions.commitNotes(deletion)).status,'unknown');assert.deepEqual(plain(await f.actions.getNotes()),plain(snapshot));
  assert.deepEqual((await f.db.query('SELECT * FROM user_notes ORDER BY id')).rows,original);
  await f.db.exec('DROP TRIGGER fixture_fail_import_delete ON b1_notes_operations');
  f.loseResponse();assert.equal((await f.actions.commitNotes(deletion)).status,'unknown');assert.equal((await f.actions.commitNotes(deletion)).success,true);
  const afterDeletion=structuredClone(original);afterDeletion.find(row=>row.id==='source-a').data[0]=null;
  assert.deepEqual((await f.db.query('SELECT * FROM user_notes ORDER BY id')).rows,afterDeletion);
  const deletedExport=await privacy.exportAccountData();assert.equal(deletedExport.ok,true);assert.equal(deletedExport.value.data.b1_notes.length,2);
  assert.doesNotMatch(JSON.stringify(deletedExport.value.data),/Legacy title|Exact legacy body/);
  assert.deepEqual(plain(deletedExport.value.data.user_notes).sort((a,b)=>a.id.localeCompare(b.id)),afterDeletion.filter(row=>row.user_id==='a').sort((a,b)=>a.id.localeCompare(b.id)));
  await f.db.exec(migration);const remaining=await f.actions.getNotes();assert.equal(remaining.notes.length,2);assert.equal(remaining.notes.some(note=>note.id===imported.id),false);assert.equal((await f.db.query('SELECT count(*)::int n FROM b1_notes_legacy_imports')).rows[0].n,4);
  assert.equal((await f.actions.commitNotes({operationId:uuid(),revision:remaining.revision,data:{kind:'save',id:imported.id,expectedRevision:null,title:'Resurrection',blocks:[]}})).status,'conflict');
  assert.deepEqual((await f.db.query('SELECT * FROM user_notes ORDER BY id')).rows,afterDeletion);f.setOwner('b');assert.equal((await f.actions.getNotes()).notes[0].title,'B private');
 }finally{await f.db.close();}
});

test('Notes deletion tolerates an absent legacy table and preserves malformed legacy containers',async()=>{
 const f=await fixture({legacy:[{id:'source',owner:'a',data:[{event:'Imported',createdAt:1704067200000}]}]});try{
  const snapshot=await f.actions.getNotes(),imported=snapshot.notes[0];
  await f.db.query('UPDATE user_notes SET data=$1::jsonb WHERE id=$2',[JSON.stringify({malformed:'Preserve this container'}),'source']);
  assert.equal((await f.actions.commitNotes({operationId:uuid(),revision:snapshot.revision,data:{kind:'delete',id:imported.id,expectedRevision:imported.revision}})).success,true);
  assert.deepEqual((await f.db.query('SELECT data FROM user_notes WHERE id=$1',['source'])).rows[0].data,{malformed:'Preserve this container'});
  await f.db.exec('DROP TABLE user_notes');await f.db.exec(migration);
  const saved=await f.actions.commitNotes(create('No legacy table'));assert.equal(saved.success,true);
  assert.equal((await f.actions.commitNotes({operationId:uuid(),revision:saved.snapshot.revision,data:{kind:'delete',id:saved.snapshot.notes[0].id,expectedRevision:saved.snapshot.notes[0].revision}})).success,true);
  assert.equal((await f.actions.getNotes()).notes.length,0);
 }finally{await f.db.close();}
});

test('missing Notes migration fails safely without creating fallback records or exposing SQL',async()=>{
 const f=await fixture({migrate:false});try{
  await assert.rejects(f.actions.getNotes(),/Notes are unavailable/);const result=await f.actions.commitNotes(create());assert.equal(result.status,'unknown');assert.doesNotMatch(result.message,/relation|b1_notes|SQL|DATABASE/);assert.equal((await f.db.query('SELECT count(*)::int n FROM user_notes')).rows[0].n,0);
 }finally{await f.db.close();}
});

test('Notes SQL limits total owner storage atomically while allowing reductions and protecting other owners',async()=>{
 const f=await fixture();try{
  // Valid 100k-text notes model existing imported history already above budget.
  const blocks=Array.from({length:5},()=>text('x'.repeat(20000)));
  await f.db.query(`INSERT INTO b1_notes(id,user_id,title,blocks)
   SELECT 'fixture-'||i,'a','Existing content',$1::jsonb FROM generate_series(1,105) i`,[JSON.stringify(blocks)]);
  const before=(await f.db.query('SELECT sum(octet_length(title)+octet_length(blocks::text))::bigint AS bytes FROM b1_notes WHERE user_id=$1',['a'])).rows[0];assert.ok(Number(before.bytes)>domain.NOTES_LIMITS.storageBytes);
  const rejected=await f.actions.commitNotes(create('Extra'));assert.equal(rejected.status,'rejected');assert.match(rejected.message,/10 MB storage/);assert.doesNotMatch(rejected.message,/1,000/);assert.equal((await f.db.query('SELECT count(*)::int n FROM b1_notes_operations')).rows[0].n,0);
  const id=uuid();
  // Use a valid UUID identity for the existing note to test the public action.
  await f.db.query('INSERT INTO b1_notes(id,user_id,title,blocks) VALUES($1,$2,$3,$4::jsonb)',[id,'a','Existing small',[text('Old')]]);
  const increased=await f.actions.commitNotes({operationId:uuid(),revision:0,data:{kind:'save',id,expectedRevision:1,title:'More content',blocks:[text('x'.repeat(1000))]}});assert.equal(increased.status,'rejected');assert.match(increased.message,/10 MB storage/);assert.equal((await f.db.query('SELECT title,revision FROM b1_notes WHERE id=$1',[id])).rows[0].title,'Existing small');
  assert.equal((await f.actions.commitNotes({operationId:uuid(),revision:0,data:{kind:'save',id,expectedRevision:1,title:'Reduced',blocks:[]}})).success,true);
  f.setOwner('b');assert.equal((await f.actions.commitNotes(create('Other owner'))).success,true);
  await f.db.exec("INSERT INTO b1_notes(id,user_id,title,blocks) SELECT 'count-fixture-'||i,'b','Small','[]'::jsonb FROM generate_series(1,999) i");
  const countLimit=await f.actions.commitNotes(create('One too many'));assert.equal(countLimit.status,'rejected');assert.match(countLimit.message,/1,000 notes/);assert.doesNotMatch(countLimit.message,/storage/);
 }finally{await f.db.close();}
});
