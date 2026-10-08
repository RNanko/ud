import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule,hookHarness,plain,jsxRuntime,findNode} from './helpers.mjs';

test('pending money requests capture immutable input, serialize sends, reject unrelated edits and keep exact retry IDs',async()=>{
 const hooks=hookHarness(),commands=[],applied=[];let complete;
 const {useMoneyMutation}=loadModule('hooks/use-money-mutation.ts',{react:hooks.react});
 const commit=command=>{commands.push(plain(command));return new Promise(resolve=>{complete=resolve;});};
 const render=()=>hooks.render(()=>useMoneyMutation(2,commit,snapshot=>applied.push(plain(snapshot))));
 const data={kind:'entry',id:'stable-intention',entry:{amount:'12.50',comment:'draft'}};
 const first=render().run(data);data.entry.amount='99.00';
 await assert.rejects(render().run(data),/pending/);assert.equal(commands.length,1);
 complete({success:false,status:'unknown',message:'Connection lost'});await assert.rejects(first,/Connection/);
 render().discard();assert.equal(render().pending.status,'unknown');
 const retry=render().retry();assert.deepEqual(commands[1],commands[0]);assert.equal(commands[1].data.entry.amount,'12.50');
 complete({success:true,acknowledgedOperationId:commands[0].operationId,snapshot:{revision:5,entries:[]}});await retry;assert.equal(render().pending,null);assert.equal(applied[0].revision,5);
 const next=render().run(data);assert.notEqual(commands[2].operationId,commands[0].operationId);assert.equal(commands[2].revision,5);
 complete({success:false,status:'rejected',message:'Validation'});await assert.rejects(next,/Validation/);assert.equal(render().pending,null);
});

test('unexpected acknowledgement cannot clear an uncertain money request',async()=>{
 const hooks=hookHarness();const {useMoneyMutation}=loadModule('hooks/use-money-mutation.ts',{react:hooks.react});
 const render=()=>hooks.render(()=>useMoneyMutation(0,async()=>({success:true,acknowledgedOperationId:'wrong',snapshot:{revision:1}}),()=>{throw Error('Must not apply');}));
 await assert.rejects(render().run({kind:'entry'}),/acknowledgement/);assert.equal(render().pending.status,'unknown');
});

test('recovery controls hide unsafe discard for uncertain outcomes and disable retries for deleted records',()=>{
 const Component=loadModule('app/components/shared/MoneyRecovery.tsx',{'react/jsx-runtime':jsxRuntime,'@/app/components/ui/button':{Button:'button'}}).default;
 const props={message:'Review',draft:'My 12.50',latest:'Deleted',onRetry(){},onDiscard(){}};
 const unknown=Component({...props,status:'unknown'});assert.ok(findNode(unknown,n=>n.type==='button'&&n.props.children==='Retry the same change'));assert.equal(findNode(unknown,n=>n.type==='button'&&n.props.children==='Discard my change and use latest'),undefined);
 const deleted=Component({...props,status:'conflict',canRetry:false});assert.equal(findNode(deleted,n=>n.type==='button'&&n.props.children==='Save my change after review'),undefined);assert.ok(findNode(deleted,n=>n.type==='button'&&n.props.children==='Discard my change and use latest'));
});
