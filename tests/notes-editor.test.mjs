import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule,hookHarness,jsxRuntime,findNode,plain} from './helpers.mjs';

const notes=loadModule('lib/notes.ts',{}, {TextEncoder});
const text=(id,value)=>({id,type:'text',text:value});
const item=(id,value,checked=false)=>({id,text:value,checked});
const list=(type,items)=>({id:'list',type,items});
const baseMocks={
 'react/jsx-runtime':jsxRuntime,'@radix-ui/react-dialog':{Root:'Dialog',Portal:'Portal',Overlay:'Overlay',Content:'DialogContent',Title:'DialogTitle',Description:'Description'},
 'lucide-react':{AlignLeft:'TextIcon',List:'ListIcon',ListOrdered:'NumbersIcon',ListTodo:'ChecklistIcon',LoaderCircle:'LoaderIcon',Pencil:'PencilIcon',Plus:'PlusIcon',Trash2:'TrashIcon',X:'CloseIcon'},
 '@/app/components/ui/button':{Button:'Button'},'@/app/components/ui/input':{Input:'Input'},'@/app/components/ui/textarea':{Textarea:'Textarea'},'@/app/components/ui/checkbox':{Checkbox:'Checkbox'},
 '@/lib/notes':notes,'./NoteDrawing':{__esModule:true,default:'Drawing'},'./NoteContent':{__esModule:true,default:'Preview'},
};
function fixture(blocks=[],props={}){
 const hooks=hookHarness(),changes=[],calls=[];
 const Editor=loadModule('app/(main)/account/notes/NoteEditor.tsx',{...baseMocks,react:{...hooks.react,useLayoutEffect:fn=>fn()}}).default;
 let draft={title:'My note',blocks},extra={...props};
 const render=()=>hooks.render(()=>Editor({note:null,draft,onChange:next=>{draft=next;changes.push(plain(next));},onClose:()=>calls.push('close'),createdLabel:'2026-10-08 · 12:34',updatedLabel:'2026-10-08 · 13:45',...extra}));
 const field=label=>findNode(render(),node=>['Input','Textarea','Button','Checkbox'].includes(node.type)&&node.props?.['aria-label']===label);
 const button=label=>{const found=field(label);assert.ok(found,label);return found.props;};
 return {render,field,button,changes,calls,draft:()=>plain(draft),props:value=>{extra={...extra,...value};}};
}
function enter(f,label,{start,end,shift=false,composing=false}={}){
 const field=f.field(label);assert.ok(field,label);let prevented=false;
 field.props.onKeyDown({key:'Enter',shiftKey:shift,nativeEvent:{isComposing:composing},preventDefault(){prevented=true;},currentTarget:{selectionStart:start??field.props.value.length,selectionEnd:end??start??field.props.value.length}});
 return prevented;
}
function all(node,predicate,result=[]){if(!node||typeof node!=='object')return result;if(predicate(node))result.push(node);const c=node.props?.children;for(const child of Array.isArray(c)?c.flat(Infinity):[c])all(child,predicate,result);return result;}

test('toolbar appends mixed blocks with stable unique IDs and controlled edits preserve earlier content',()=>{
 const f=fixture();
 for(const label of ['text','bullets','numbers','checkboxes','draw'])f.button(`Add ${label} block`).onClick();
 assert.deepEqual(f.draft().blocks.map(block=>block.type),['text','bullet','numbered','checklist','drawing']);
 const ids=f.draft().blocks.flatMap(block=>[block.id,...(block.items?.map(value=>value.id)??[])]);
 assert.equal(new Set(ids).size,ids.length);assert.ok(notes.noteDraftSchema.safeParse(f.draft()).success);
 f.field('Text block 1').props.onChange({target:{value:'Paragraph\nwith more text'}});
 f.field('Note title').props.onChange({target:{value:'Changed title'}});
 assert.equal(f.draft().blocks[0].text,'Paragraph\nwith more text');assert.equal(f.draft().title,'Changed title');
 assert.deepEqual(f.draft().blocks.flatMap(block=>[block.id,...(block.items?.map(value=>value.id)??[])]),ids);
 const header=findNode(f.render(),node=>node.type==='header');assert.match(JSON.stringify(header),/Created.*2026-10-08/);assert.match(JSON.stringify(header),/Modified.*13:45/);
});

test('Enter splits a checklist at the caret without losing following text or other items, and focuses its new item',()=>{
 const f=fixture([list('checklist',[item('first','AlphaBeta',true),item('last','Keep me',true)])]);
 assert.equal(enter(f,'Checkboxes item 1',{start:5}),true);
 const values=f.draft().blocks[0].items;
 assert.deepEqual(values.map(value=>[value.text,value.checked]),[['Alpha',true],['Beta',false],['Keep me',true]]);
 assert.equal(values[0].id,'first');assert.equal(values[2].id,'last');
 const focus=[];f.field('Checkboxes item 2').props.ref({value:'Beta',focus:()=>focus.push('focus'),setSelectionRange:(a,b)=>focus.push([a,b])});
 assert.deepEqual(focus,['focus',[0,0]]);
});

test('Shift+Enter and composition are left to textarea multiline input and do not create list items',()=>{
 const f=fixture([list('bullet',[item('first','First')])]);
 assert.equal(enter(f,'Bullets item 1',{shift:true}),false);assert.equal(enter(f,'Bullets item 1',{composing:true}),false);assert.equal(f.changes.length,0);
 f.field('Bullets item 1').props.onChange({target:{value:'First\nSecond line'}});
 assert.equal(f.draft().blocks[0].items.length,1);assert.equal(f.draft().blocks[0].items[0].text,'First\nSecond line');
});

test('empty Enter exits the middle of a list without dropping following checked items or adjacent blocks',()=>{
 const f=fixture([text('before','Before'),list('checklist',[item('one','One'),item('empty',''),item('three','Three',true)]),text('after','After')]);
 assert.equal(enter(f,'Checkboxes item 2'),true);
 assert.deepEqual(f.draft().blocks.map(block=>block.type),['text','checklist','text','checklist','text']);
 assert.equal(f.draft().blocks[1].items[0].id,'one');assert.equal(f.draft().blocks[3].items[0].id,'three');assert.equal(f.draft().blocks[3].items[0].checked,true);
 assert.equal(f.draft().blocks[0].text,'Before');assert.equal(f.draft().blocks[4].text,'After');assert.equal(f.draft().blocks[2].text,'');
 assert.ok(notes.noteDraftSchema.safeParse(f.draft()).success);
});

test('empty Enter at either end preserves list contents and a sole empty item becomes a paragraph',()=>{
 for(const items of [[item('empty',''),item('last','Keep')],[item('first','Keep'),item('empty','')],[item('empty','')]]){
  const f=fixture([list('numbered',items)]),empty=items.findIndex(value=>value.text==='');enter(f,`Numbers item ${empty+1}`);
  assert.equal(f.draft().blocks.filter(block=>block.type==='text').length,1);
  assert.deepEqual(f.draft().blocks.flatMap(block=>block.items??[]).map(value=>value.text),items.filter(value=>value.text).map(value=>value.text));
 }
});

test('nonempty removal asks once, Keep preserves content, and confirming renumbers the surviving list',()=>{
 const f=fixture([list('numbered',[item('one','First'),item('two','Second'),item('three','Third')])]);
 f.button('Remove numbers item 2').onClick();assert.equal(f.changes.length,0);
 findNode(f.render(),node=>node.type==='Button'&&node.props.children==='Keep').props.onClick();assert.equal(f.changes.length,0);
 f.button('Remove numbers item 2').onClick();findNode(f.render(),node=>node.type==='Button'&&node.props.children==='Remove').props.onClick();
 assert.deepEqual(f.draft().blocks[0].items.map(value=>value.id),['one','three']);
 assert.equal(f.field('Numbers item 2').props.value,'Third');assert.equal(f.field('Numbers item 3'),undefined);
 f.button('Remove numbers block 1').onClick();findNode(f.render(),node=>node.type==='Button'&&node.props.children==='Remove').props.onClick();assert.equal(f.draft().blocks.length,0);
});

test('editing remains live while saving and a later metadata acknowledgement never resets the controlled draft',()=>{
 const f=fixture([text('text','Initial')],{status:'saving'});
 assert.equal(f.field('Text block 1').props.disabled,false);f.field('Text block 1').props.onChange({target:{value:'Newer than acknowledgement'}});
 f.props({status:'saved',note:{id:'note',title:'Old server title',blocks:[text('text','Old server body')],revision:2,createdAt:'2026-10-08',updatedAt:'2026-10-08',pinned:false,position:0}});
 assert.equal(f.field('Text block 1').props.value,'Newer than acknowledgement');assert.equal(f.field('Note title').props.value,'My note');
 f.button('Close note').onClick();findNode(f.render(),node=>node.type==='Dialog').props.onOpenChange(false);assert.deepEqual(f.calls,['close','close']);
});

test('blocked drafts cannot mutate and recovery controls delegate without replacing local content',()=>{
 const calls=[],f=fixture([text('text','Preserved')],{blocked:true,status:'conflict',onUseLatest:()=>calls.push('latest'),onKeepDraft:()=>calls.push('keep')});
 assert.equal(f.field('Text block 1').props.disabled,true);f.field('Text block 1').props.onChange({target:{value:'Forbidden'}});assert.equal(f.draft().blocks[0].text,'Preserved');
 findNode(f.render(),node=>node.type==='Button'&&node.props.children==='Use latest version').props.onClick();findNode(f.render(),node=>node.type==='Button'&&node.props.children==='Save my draft').props.onClick();assert.deepEqual(calls,['latest','keep']);
 f.props({status:'error',onRetry:()=>calls.push('retry')});findNode(f.render(),node=>node.type==='Button'&&node.props.children==='Retry saving').props.onClick();assert.equal(calls.at(-1),'retry');assert.equal(f.draft().blocks[0].text,'Preserved');
});

test('limits reject overflowing list/block additions without dropping existing data',()=>{
 const f=fixture([list('bullet',Array.from({length:notes.NOTES_LIMITS.items},(_,i)=>item(`item${i}`,`Item ${i}`)))]),before=f.draft();
 enter(f,'Bullets item 1');assert.deepEqual(f.draft(),before);assert.match(findNode(f.render(),node=>node.props?.role==='alert').props.children,/list is full/);
 const full=fixture(Array.from({length:notes.NOTES_LIMITS.blocks},(_,i)=>text(`block${i}`,'Keep')));full.button('Add text block').onClick();assert.equal(full.draft().blocks.length,notes.NOTES_LIMITS.blocks);assert.equal(full.changes.length,0);
});

test('checklist toggles update only their item and drawing budgets subtract other drawing usage',()=>{
 const stroke={id:'stroke',color:'#000000',width:2,tool:'pen',points:[{x:0,y:0},{x:1,y:1}]};
 const f=fixture([list('checklist',[item('one','One'),item('two','Two')]),{id:'drawing-one',type:'drawing',strokes:[stroke]},{id:'drawing-two',type:'drawing',strokes:[]}]);
 f.field('Complete checklist item 2').props.onCheckedChange(true);assert.deepEqual(f.draft().blocks[0].items.map(value=>value.checked),[false,true]);
 const drawings=all(f.render(),node=>node.type==='Drawing');assert.equal(drawings[1].props.maxPoints,notes.NOTES_LIMITS.totalPoints-2);assert.equal(drawings[1].props.maxStrokes,notes.NOTES_LIMITS.strokesPerDrawing);
});

test('preview renders plain structured text, lists and readonly drawings, with optional owned checkbox toggles',()=>{
 const Preview=loadModule('app/(main)/account/notes/NoteContent.tsx',baseMocks).default,calls=[];
 const blocks=[text('text','<script>private()</script>\nPlain text'),list('checklist',[item('one','One',true)]),{id:'draw',type:'drawing',strokes:[]}];
 const tree=Preview({blocks,onToggle:(...args)=>calls.push(args)});
 assert.equal(findNode(tree,node=>node.type==='p').props.children,'<script>private()</script>\nPlain text');assert.equal(all(tree,node=>'dangerouslySetInnerHTML'in node.props).length,0);
 const checkbox=findNode(tree,node=>node.type==='Checkbox');checkbox.props.onCheckedChange(false);assert.deepEqual(calls,[['list','one']]);assert.equal(checkbox.props.checked,true);
 assert.equal(findNode(tree,node=>node.type==='Drawing').props.readOnly,true);
 assert.equal(findNode(Preview({blocks}),node=>node.type==='Checkbox').props.disabled,true);
});

test('conflicts show bounded latest saved content beside the preserved draft and label a deleted-note recovery explicitly',()=>{
 const latestNote={id:'note',title:'Another device title',blocks:[text('latest','Saved elsewhere')],revision:3,createdAt:'2026-10-08',updatedAt:'2026-10-08',pinned:false,position:0};
 const f=fixture([text('draft','My unsaved draft')],{status:'conflict',latestNote,onKeepDraft:()=>{}}),latest=findNode(f.render(),node=>node.props?.['aria-label']==='Latest saved version');
 assert.ok(latest);assert.match(JSON.stringify(latest),/Another device title/);assert.match(JSON.stringify(latest),/max-h-40/);
 assert.deepEqual(plain(findNode(latest,node=>node.type==='Preview').props.blocks),latestNote.blocks);assert.equal(findNode(latest,node=>node.type==='Preview').props.disabled,true);assert.equal(f.field('Text block 1').props.value,'My unsaved draft');
 f.props({latestNote:undefined,keepDraftLabel:'Save as new note'});assert.ok(findNode(f.render(),node=>node.type==='Button'&&node.props.children==='Save as new note'));assert.equal(f.draft().blocks[0].text,'My unsaved draft');
});

test('a known rejected save permits editing the same draft while an uncertain result exposes only its retry',()=>{
 const calls=[],f=fixture([text('draft','Keep this')],{status:'error',onRetry:()=>calls.push('retry')});
 assert.equal(findNode(f.render(),node=>node.type==='Button'&&node.props.children==='Edit my draft'),undefined);
 f.props({onUseLatest:()=>calls.push('edit')});findNode(f.render(),node=>node.type==='Button'&&node.props.children==='Edit my draft').props.onClick();
 assert.deepEqual(calls,['edit']);assert.equal(f.draft().blocks[0].text,'Keep this');
});
