import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule,hookHarness,jsxRuntime,findNode,plain} from './helpers.mjs';

const editorState=loadModule('lib/notes/editor-state.ts');
const seed={id:'db614c28-4c1f-4fd4-bac4-21d5df910b70',title:'Existing note',blocks:[{id:'paragraph',type:'text',text:'Original body'}],revision:4,createdAt:'2026-10-08T08:00:00.000Z',updatedAt:'2026-10-08T08:00:00.000Z',pinned:false,position:0};
const icons=Object.fromEntries(['ArrowUp','ArrowDown','Pencil','GripVertical','LoaderCircle','NotebookPen','Pin','PinOff','Plus','CalendarRange','SquareUser','Wallet','CopyCheck','TrendingUp','Dumbbell','Compass'].map(name=>[name,name]));
const sameDeps=(left,right)=>left&&right&&left.length===right.length&&left.every((value,index)=>Object.is(value,right[index]));

// Execute real root component + mutation hook. Only rendering/platform APIs,
// wall clock and the action transport are replaced; effect cleanup is executed.
function fixture(initial={revision:10,notes:[seed]}){
 const base=hookHarness(),effects=[],effectSlots=new Set(),timers=new Map(),listeners=new Map(),requests=[];
 let dirty=true,tree,now=0,nextTimer=1,disposed=false;
 const react={
  ...base.react,
  useState(initialValue){const [value,set]=base.react.useState(initialValue);return [value,next=>set(previous=>{const updated=typeof next==='function'?next(previous):next;if(!Object.is(previous,updated))dirty=true;return updated;})];},
  useCallback(fn,deps){const slot=base.react.useRef({fn,deps});if(!sameDeps(slot.current.deps,deps))slot.current={fn,deps};return slot.current.fn;},
  useEffect(fn,deps){const slot=base.react.useRef({deps:undefined,cleanup:undefined});effectSlots.add(slot);if(!sameDeps(slot.current.deps,deps)){slot.current.deps=deps;effects.push(()=>{slot.current.cleanup?.();slot.current.cleanup=fn();});}},
 };
 const clock={setTimeout(fn,delay=0){const id=nextTimer++;timers.set(id,{at:now+delay,fn});return id;},clearTimeout:id=>timers.delete(id)};
 const globals={...clock,window:{addEventListener:(name,fn)=>{if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);},removeEventListener:(name,fn)=>listeners.get(name)?.delete(fn)}};
 const hook=loadModule('hooks/use-notes-mutation.ts',{react,'@/lib/notes/editor-state':editorState},globals);
 const commit=command=>new Promise((resolve,reject)=>requests.push({command:plain(command),resolve,reject}));
 const Client=loadModule('app/(main)/account/notes/NotesClient.tsx',{
  react,'react/jsx-runtime':jsxRuntime,
  '@dnd-kit/core':{DndContext:'Dnd',DragOverlay:'DragOverlay',MouseSensor:'Mouse',TouchSensor:'Touch',KeyboardSensor:'Keyboard',closestCenter(){},useSensor:(...args)=>args,useSensors:(...args)=>args},
  '@dnd-kit/sortable':{SortableContext:'Sortable',useSortable:()=>({setNodeRef(){},setActivatorNodeRef(){},attributes:{},listeners:{},transform:null,transition:undefined,isDragging:false}),rectSortingStrategy(){},sortableKeyboardCoordinates(){},arrayMove:(array,from,to)=>{const next=[...array];next.splice(to,0,next.splice(from,1)[0]);return next;}},
  '@dnd-kit/utilities':{CSS:{Translate:{toString:()=>''}}},'lucide-react':icons,
  '@/app/components/ui/card':{Card:'Card'},'@/app/components/ui/button':{Button:'Button'},'../finance/HoldDeleteButton':{__esModule:true,default:'HoldDelete'},
  '@/app/components/shared/account/AccountPreferencesProvider':{useAccountPreferences:()=>({settings:{preferences:{timezone:'UTC',dateFormat:'iso',timeFormat:'24'}}})},
  '@/lib/account/format':loadModule('lib/account/format.ts'),'@/lib/actions/notes.actions':{commitNotes:()=>{throw Error('Unexpected default action transport');}},
  '@/hooks/use-notes-mutation':hook,'@/lib/notes/editor-state':editorState,
  './NoteContent':{__esModule:true,default:'Preview'},'./NoteEditor':{__esModule:true,default:'Editor'},'./notes.module.css':{board:'board'},
 },globals).default;
 function flush(){let renders=0;while(dirty){assert.ok(renders++<30,'Unexpected render loop');dirty=false;tree=base.render(()=>Client({initial,commit}));for(const effect of effects.splice(0))effect();}return tree;}
 async function settle(){for(let i=0;i<12;i++){await Promise.resolve();flush();}}
 async function advance(milliseconds){const until=now+milliseconds;let executed=0;flush();while(true){const next=[...timers.entries()].filter(([,timer])=>timer.at<=until).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;assert.ok(executed++<100,'Unexpected timer loop');now=next[1].at;timers.delete(next[0]);next[1].fn();await settle();}now=until;await settle();}
 function editor(){return findNode(flush(),node=>node.type==='Editor')?.props;}
 function card(id=seed.id){return findNode(flush(),node=>typeof node.type==='function'&&node.type.name==='SortableNote'&&node.props.note.id===id)?.props;}
 function cardTree(id=seed.id){const sortable=findNode(flush(),node=>typeof node.type==='function'&&node.type.name==='SortableNote'&&node.props.note.id===id);assert.ok(sortable,`Note card ${id}`);const content=findNode(sortable.type(sortable.props),node=>typeof node.type==='function'&&node.type.name==='NoteCard');assert.ok(content,'Note card content');return content.type(content.props);}
 function holdDelete(id=seed.id){const control=findNode(cardTree(id),node=>node.type==='HoldDelete');assert.ok(control,'Hold-to-delete control');return control.props;}
 function button(label){const node=findNode(flush(),node=>node.type==='Button'&&(node.props.children===label||Array.isArray(node.props.children)&&node.props.children.includes(label)));assert.ok(node,`Button ${label}`);return node.props;}
 function open(){card().onEdit();flush();}
 function change(title,body){editor().onChange({title,blocks:body===null?[]:[{id:'paragraph',type:'text',text:body}]});flush();}
 async function reply(index,result){assert.ok(requests[index],`Request ${index}`);requests[index].resolve(result);await settle();}
 async function success(index,{revision=11,noteRevision=5,notes}={}){const {command}=requests[index];const saved={...seed,id:command.data.id,title:command.data.title,blocks:command.data.blocks,revision:noteRevision};await reply(index,{success:true,acknowledgedOperationId:command.operationId,snapshot:{revision,notes:notes??[saved]}});}
 function dispose(){if(disposed)return;disposed=true;for(const slot of effectSlots)slot.current.cleanup?.();timers.clear();}
 flush();return {tree:flush,editor,card,cardTree,holdDelete,button,open,change,requests,advance,settle,reply,success,dispose,listeners};
}

test('actual Notes root preserves typing during unresolved save and schedules only the newer generation at the acknowledged revision',async t=>{
 const f=fixture();t.after(f.dispose);f.open();f.change('First title','First body');await f.advance(699);assert.equal(f.requests.length,0);await f.advance(1);
 assert.equal(f.requests.length,1);assert.equal(f.requests[0].command.data.expectedRevision,4);
 f.change('Newer title','Typed while saving');await f.advance(10_000);assert.equal(f.requests.length,1);assert.equal(f.editor().blocked,false);
 await f.success(0);assert.equal(f.editor().draft.title,'Newer title');assert.equal(f.editor().draft.blocks[0].text,'Typed while saving');assert.equal(f.editor().status,'saving');
 await f.advance(699);assert.equal(f.requests.length,1);await f.advance(1);
 assert.equal(f.requests.length,2);assert.equal(f.requests[1].command.data.expectedRevision,5);assert.equal(f.requests[1].command.revision,11);assert.equal(f.requests[1].command.data.blocks[0].text,'Typed while saving');assert.notEqual(f.requests[1].command.operationId,f.requests[0].command.operationId);
 await f.success(1,{revision:12,noteRevision:6});assert.equal(f.editor().status,'saved');f.editor().onClose();await f.settle();assert.equal(f.editor(),undefined);assert.equal(f.requests.length,2);
});

test('clearing an existing note autosaves its empty content and close flushes it before the debounce',async t=>{
 for(const closeImmediately of [false,true]){
  const f=fixture();t.after(f.dispose);f.open();f.change('',null);assert.equal(f.editor().status,'saving');
  if(closeImmediately){f.editor().onClose();await f.settle();}else await f.advance(700);
  assert.equal(f.requests.length,1);assert.equal(f.requests[0].command.data.title,'');assert.deepEqual(f.requests[0].command.data.blocks,[]);assert.ok(f.editor());
  await f.success(0);
  if(!closeImmediately){assert.equal(f.editor().status,'saved');f.editor().onClose();await f.settle();}
  assert.equal(f.editor(),undefined);assert.equal(f.card().note.title,'');assert.deepEqual(plain(f.card().note.blocks),[]);await f.advance(2_000);assert.equal(f.requests.length,1);
 }
});

test('closing an in-flight note retains newer edits and never closes them after an older acknowledgement',async t=>{
 const f=fixture();t.after(f.dispose);f.open();f.change('Close snapshot','Sent now');f.editor().onClose();await f.settle();assert.equal(f.requests.length,1);
 f.change('Do not discard','Newer text while closing');await f.success(0);assert.ok(f.editor());assert.equal(f.editor().draft.title,'Do not discard');assert.equal(f.editor().draft.blocks[0].text,'Newer text while closing');
 await f.advance(700);assert.equal(f.requests.length,2);assert.equal(f.requests[1].command.data.title,'Do not discard');await f.success(1,{revision:12,noteRevision:6});
 f.editor().onClose();await f.settle();assert.equal(f.editor(),undefined);
});

test('rejected save Edit my draft stays paused for wall-clock time until an actual content edit',async t=>{
 const f=fixture();t.after(f.dispose);f.open();f.change('Rejected draft','Too much content');await f.advance(700);
 await f.reply(0,{success:false,status:'rejected',message:'Storage limit reached'});assert.equal(f.editor().status,'error');assert.equal(f.editor().blocked,true);
 f.editor().onUseLatest();await f.settle();assert.equal(f.editor().blocked,false);assert.equal(f.editor().draft.title,'Rejected draft');
 await f.advance(30_000);assert.equal(f.requests.length,1);assert.equal(f.editor().status,'error');
 f.change('Corrected draft','Shorter');await f.advance(700);assert.equal(f.requests.length,2);assert.notEqual(f.requests[1].command.operationId,f.requests[0].command.operationId);assert.equal(f.requests[1].command.data.title,'Corrected draft');
 await f.success(1);assert.equal(f.editor().status,'saved');
});

test('acknowledged current content changed elsewhere exposes review and cannot silently rebase a newer local draft',async t=>{
 const f=fixture();t.after(f.dispose);f.open();f.change('First local','First local text');await f.advance(700);f.change('Newer local','My newer local draft');
 const other={...seed,title:'Other tab title',blocks:[{id:'paragraph',type:'text',text:'Other tab body'}],revision:6};
 await f.success(0,{revision:12,noteRevision:6,notes:[other]});assert.equal(f.editor().status,'conflict');assert.equal(f.editor().blocked,true);assert.equal(f.editor().draft.title,'Newer local');assert.equal(f.editor().latestNote.title,'Other tab title');
 await f.advance(30_000);assert.equal(f.requests.length,1);f.editor().onKeepDraft();await f.settle();await f.advance(700);
 assert.equal(f.requests.length,2);assert.equal(f.requests[1].command.revision,12);assert.equal(f.requests[1].command.data.expectedRevision,6);assert.equal(f.requests[1].command.data.blocks[0].text,'My newer local draft');assert.notEqual(f.requests[1].command.operationId,f.requests[0].command.operationId);
 await f.success(1,{revision:13,noteRevision:7});assert.equal(f.editor().status,'saved');
});

test('unknown outcome retains exact retry values, hides discard and saves later typing only after receipt acknowledgement',async t=>{
 const f=fixture();t.after(f.dispose);f.open();f.change('Captured','Captured body');await f.advance(700);f.change('New typing','More text');
 await f.reply(0,{success:false,status:'unknown',message:'Response lost'});assert.equal(f.editor().status,'error');assert.equal(f.editor().onUseLatest,undefined);assert.equal(f.editor().blocked,true);
 f.editor().onClose();await f.settle();assert.ok(f.editor());await f.advance(5_000);assert.equal(f.requests.length,1);
 f.editor().onRetry();await f.settle();assert.deepEqual(f.requests[1].command,f.requests[0].command);await f.success(1);
 assert.equal(f.editor().draft.title,'New typing');await f.advance(700);assert.equal(f.requests.length,3);assert.equal(f.requests[2].command.data.title,'New typing');assert.equal(f.requests[2].command.data.expectedRevision,5);
 await f.success(2,{revision:12,noteRevision:6});
});

test('deleted-after-save acknowledgement retains the draft and explicit recovery creates a different note instead of resurrecting the old ID',async t=>{
 const f=fixture();t.after(f.dispose);f.open();f.change('Keep my work','Local draft');await f.advance(700);
 await f.success(0,{revision:12,notes:[]});assert.equal(f.editor().status,'conflict');assert.equal(f.editor().keepDraftLabel,'Save as new note');assert.equal(f.card(),undefined);
 await f.advance(5_000);assert.equal(f.requests.length,1);f.editor().onKeepDraft();await f.settle();await f.advance(700);
 assert.equal(f.requests.length,2);assert.notEqual(f.requests[1].command.data.id,seed.id);assert.equal(f.requests[1].command.data.expectedRevision,null);assert.equal(f.requests[1].command.data.title,'Keep my work');await f.success(1,{revision:13,noteRevision:1});
});

test('new empty note stays virtual and a new saved draft retains its note ID for subsequent autosaves',async t=>{
 const f=fixture({revision:0,notes:[]});t.after(f.dispose);f.button('New note').onClick();await f.settle();await f.advance(5_000);assert.equal(f.requests.length,0);f.editor().onClose();await f.settle();assert.equal(f.editor(),undefined);
 f.button('New note').onClick();await f.settle();f.change('A new note','First text');await f.advance(700);const id=f.requests[0].command.data.id;assert.equal(f.requests[0].command.data.expectedRevision,null);
 f.change('A new note','Second text');await f.success(0,{revision:1,noteRevision:1});await f.advance(700);assert.equal(f.requests[1].command.data.id,id);assert.equal(f.requests[1].command.data.expectedRevision,1);assert.notEqual(f.requests[1].command.operationId,f.requests[0].command.operationId);await f.success(1,{revision:2,noteRevision:2});
});

test('note cards expose compact hold-to-delete and direct edit/move controls without opening an action menu',async t=>{
 const second={...seed,id:'bc04c145-7fc4-4d15-9444-f63c653dc5a0',title:'Second note',position:1};
 const f=fixture({revision:10,notes:[seed,second]});t.after(f.dispose);
 const hold=f.holdDelete();assert.equal(hold.compact,true);assert.equal(hold.label,seed.title);assert.equal(hold.disabled,false);assert.equal(typeof hold.onConfirm,'function');
 const edit=findNode(f.cardTree(),node=>node.type==='Button'&&node.props['aria-label']===`Edit ${seed.title}`);assert.ok(edit,'Direct Edit button');
 const earlier=findNode(f.cardTree(),node=>node.type==='Button'&&node.props['aria-label']===`Move ${seed.title} earlier`);const later=findNode(f.cardTree(),node=>node.type==='Button'&&node.props['aria-label']===`Move ${seed.title} later`);
 assert.ok(earlier);assert.ok(later);assert.equal(earlier.props.disabled,true);assert.equal(later.props.disabled,false);
 assert.equal(f.requests.length,0);edit.props.onClick();await f.settle();assert.equal(f.editor().draft.title,seed.title);assert.equal(f.requests.length,0);f.editor().onClose();await f.settle();
 later.props.onClick();await f.settle();assert.equal(f.requests.length,1);assert.equal(f.requests[0].command.data.kind,'reorder');assert.deepEqual(f.requests[0].command.data.ids,[second.id,seed.id]);assert.equal(f.holdDelete().disabled,true);
 await f.reply(0,{success:true,acknowledgedOperationId:f.requests[0].command.operationId,snapshot:{revision:11,notes:[{...seed,position:1},{...second,position:0}]}});assert.equal(f.holdDelete().disabled,false);
});

test('a held deletion conflict preserves the latest note and requires a fresh hold at its reviewed revision',async t=>{
 const f=fixture();t.after(f.dispose);const deletion=assert.rejects(f.holdDelete().onConfirm(),/Changed elsewhere/);await f.settle();assert.equal(f.requests.length,1);assert.deepEqual(f.requests[0].command.data,{kind:'delete',id:seed.id,expectedRevision:4});assert.equal(f.holdDelete().disabled,true);
 const other={...seed,title:'New important title',revision:5};await f.reply(0,{success:false,status:'conflict',message:'Changed elsewhere',snapshot:{revision:11,notes:[other]}});await deletion;
 assert.equal(f.card().note.title,'New important title');assert.equal(f.holdDelete().disabled,true);
 f.button('Review latest note').onClick();await f.settle();assert.equal(f.requests.length,1);assert.equal(f.holdDelete().disabled,false);assert.equal(f.card().note.title,'New important title');
 await f.advance(30_000);assert.equal(f.requests.length,1);
 const confirmed=f.holdDelete().onConfirm();await f.settle();assert.equal(f.requests.length,2);assert.deepEqual(f.requests[1].command.data,{kind:'delete',id:seed.id,expectedRevision:5});assert.equal(f.requests[1].command.revision,11);assert.notEqual(f.requests[1].command.operationId,f.requests[0].command.operationId);
 await f.success(1,{revision:12,notes:[]});await confirmed;assert.equal(f.card(),undefined);
});

test('lost deletion response blocks new actions and board retry replays the exact held-delete envelope',async t=>{
 const f=fixture();t.after(f.dispose);const deletion=assert.rejects(f.holdDelete().onConfirm(),/couldn't confirm/);await f.settle();assert.equal(f.requests.length,1);
 f.requests[0].reject(Error('Response lost after commit'));await f.settle();await deletion;
 assert.ok(f.card(),'Unknown deletion must retain the last confirmed snapshot');assert.equal(f.holdDelete().disabled,true);assert.equal(f.button('New note').disabled,true);
 assert.equal(findNode(f.tree(),node=>node.type==='Button'&&node.props.children==='Use latest saved notes'),undefined);assert.equal(findNode(f.tree(),node=>node.type==='Button'&&node.props.children==='Review latest note'),undefined);
 await f.advance(30_000);assert.equal(f.requests.length,1);f.button('Retry the same change').onClick();await f.settle();assert.equal(f.requests.length,2);assert.deepEqual(f.requests[1].command,f.requests[0].command);assert.equal(f.holdDelete().disabled,true);
 await f.success(1,{revision:11,notes:[]});assert.equal(f.card(),undefined);assert.equal(f.button('New note').disabled,false);assert.equal(findNode(f.tree(),node=>node.props?.['aria-label']==='Note save status'),undefined);
 await f.advance(30_000);assert.equal(f.requests.length,2);
});

test('actual account sidebar places Notes between Investments and To-Do and highlights the Notes route',()=>{
 const Sidebar=loadModule('app/components/shared/account/acc-sidebar.tsx',{'react/jsx-runtime':jsxRuntime,'next/link':{__esModule:true,default:'Link'},'next/navigation':{usePathname:()=>'/account/notes'},'framer-motion':{motion:{div:'MotionDiv'}},'lucide-react':icons,'@/app/components/ui/badge':{Badge:'Badge'}}).default;
 const tree=Sidebar(),links=tree.props.children;assert.deepEqual(plain(links.map(link=>link.props['aria-label'])),['Settings','Finance','Investments','Notes','To-Do','Events','Gym','Momentum']);
 const notes=links[3];assert.equal(notes.props.href,'/account/notes');assert.equal(findNode(notes,node=>node.type==='Badge').props.variant,'default');
});
