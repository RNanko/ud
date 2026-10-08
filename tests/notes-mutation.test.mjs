import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule,hookHarness,plain} from './helpers.mjs';
const editorState=loadModule('lib/notes/editor-state.ts');
const loadHook=react=>loadModule('hooks/use-notes-mutation.ts',{react,'@/lib/notes/editor-state':editorState});

test('note autosave receipts retain exact values and operation after a lost response, and serialize later intentions',async()=>{
 const hooks=hookHarness(),sent=[];let complete;
 const {useNotesMutation}=loadHook(hooks.react);
 const commit=command=>{sent.push(plain(command));return new Promise(resolve=>{complete=resolve;});};
 const render=()=>hooks.render(()=>useNotesMutation({revision:3,notes:[]},commit));
 const data={kind:'save',id:'note-one',expectedRevision:null,title:'Draft',blocks:[{id:'text-one',type:'text',text:'Original'}]};
 const first=render().run(data);data.blocks[0].text='Changed later';
 await assert.rejects(render().run(data),/pending/);
 complete({success:false,status:'unknown',message:'Lost response'});await assert.rejects(first,/Lost/);
 render().discard();assert.equal(render().pending.status,'unknown');
 const retry=render().retry();assert.deepEqual(sent[1],sent[0]);assert.equal(sent[1].data.blocks[0].text,'Original');
 complete({success:true,acknowledgedOperationId:sent[0].operationId,snapshot:{revision:4,notes:[{id:'note-one',revision:1,title:sent[0].data.title,blocks:sent[0].data.blocks}]}});await retry;
 assert.equal(render().pending,null);assert.equal(render().snapshot.revision,4);
 const second=render().run({...data,expectedRevision:1});assert.equal(sent[2].revision,4);assert.notEqual(sent[2].operationId,sent[0].operationId);
 complete({success:false,status:'rejected',message:'Read only'});await assert.rejects(second,/Read only/);
 assert.equal(render().pending.status,'rejected');await assert.rejects(render().run(data),/pending/);
 render().discard();assert.equal(render().pending,null);
});

test('a stale note edit retains its draft and latest saved revision until explicit review creates a new operation',async()=>{
 const hooks=hookHarness(),sent=[];let next={success:false,status:'conflict',message:'Changed elsewhere',snapshot:{revision:6,notes:[{id:'n',revision:4,title:'Latest'}]}};
 const {useNotesMutation}=loadHook(hooks.react);
 const render=()=>hooks.render(()=>useNotesMutation({revision:2,notes:[]},async command=>{sent.push(plain(command));return next.success?{...next,acknowledgedOperationId:command.operationId}:next;}));
 const data={kind:'save',id:'n',expectedRevision:1,title:'My draft',blocks:[]};
 await assert.rejects(render().run(data),/Changed/);assert.equal(render().pending.command.data.title,'My draft');assert.equal(render().snapshot.notes[0].title,'Latest');
 await render().retry();assert.equal(sent.length,1);
 render().discard();next={success:true,snapshot:{revision:7,notes:[{id:'n',revision:5,title:'My draft',blocks:[]}]}};
 await render().run({...data,expectedRevision:4});assert.equal(sent[1].revision,6);assert.equal(sent[1].data.expectedRevision,4);assert.notEqual(sent[1].operationId,sent[0].operationId);
});

test('an unexpected save acknowledgement cannot discard a pending note or apply an unrelated snapshot',async()=>{
 const hooks=hookHarness();const {useNotesMutation}=loadHook(hooks.react);
 const render=()=>hooks.render(()=>useNotesMutation({revision:0,notes:[]},async()=>({success:true,acknowledgedOperationId:'unrelated',snapshot:{revision:99,notes:[]}})));
 await assert.rejects(render().run({kind:'save',id:'n',expectedRevision:null,title:'Original',blocks:[]}),/confirmed/);
 assert.equal(render().pending.status,'unknown');assert.equal(render().snapshot.revision,0);assert.equal(render().pending.command.data.title,'Original');
});

test('an acknowledged save followed by another edit or delete requires explicit review instead of rebasing the next autosave',async()=>{
 for(const notes of [[{id:'n',revision:4,title:'Another tab',blocks:[]}],[]]){
  const hooks=hookHarness(),sent=[];const {useNotesMutation}=loadHook(hooks.react);
  const render=()=>hooks.render(()=>useNotesMutation({revision:0,notes:[]},async command=>{sent.push(plain(command));return {success:true,acknowledgedOperationId:command.operationId,snapshot:{revision:4,notes}};}));
  await assert.rejects(render().run({kind:'save',id:'n',expectedRevision:1,title:'Original draft',blocks:[]}),/elsewhere/);
  assert.equal(render().pending.status,'conflict');assert.equal(render().pending.command.data.title,'Original draft');
  await assert.rejects(render().run({kind:'save',id:'n',expectedRevision:4,title:'More typing',blocks:[]}),/pending/);
  assert.equal(sent.length,1);assert.deepEqual(plain(render().snapshot.notes),notes);
 }
});

test('clearing an existing note remains saveable; new blank notes stay virtual and rejected drafts wait for an actual edit',()=>{
 const empty={title:'',blocks:[],source:null,change:1,saved:0};
 assert.equal(editorState.needsNoteSave(empty),false);
 assert.equal(editorState.needsNoteSave({...empty,source:{id:'n'}}),true);
 const paused={...empty,title:'Rejected draft',paused:1};
 assert.equal(editorState.needsNoteSave(paused),false);
 assert.equal(editorState.needsNoteSave({...paused,change:2}),true);
 assert.equal(editorState.needsNoteSave({...paused,change:2,deleted:true}),false);
 const original={title:'Same',blocks:[{id:'b',type:'text',text:'Content'}]};
 const fromJsonb={title:'Same',blocks:[{text:'Content',type:'text',id:'b'}]};
 assert.equal(editorState.sameNoteContent(original,fromJsonb),true);
});
