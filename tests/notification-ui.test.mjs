import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule,jsxRuntime,findNode,plain} from './helpers.mjs';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const defer=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
function fixture(){
 const slots=[],effects=[],cleanups=[],requests=[];let index=0,session={user:{id:'alice'}},online=true,hidden=false,reads=0,failRead=false,failWrite=false,pendingRead=null,pendingWrite=null;
 let saved={messages:[{id:'n',revision:1,readAt:null,archivedAt:null}],unreadCount:1,nextCursor:null,asOf:'2026-10-03T10:00:00Z',timezone:'UTC',locale:'en-US'};
 const memo=(fn,deps)=>{const i=index++,old=slots[i];if(!old||deps.some((d,j)=>d!==old.deps[j]))slots[i]={value:fn(),deps};return slots[i].value;};
 const react={createContext:value=>({Provider:'Provider',value}),useContext:ctx=>ctx.value,useState(initial){const i=index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},useRef(initial){const i=index++;if(!(i in slots))slots[i]={current:initial};return slots[i];},useCallback:(fn,deps)=>memo(()=>fn,deps),useEffect(fn,deps){const i=index++,old=slots[i];if(!old||deps.some((d,j)=>d!==old[j])){slots[i]=deps;effects.push(fn);}}};
 const win=new EventTarget(),doc=new EventTarget();Object.defineProperty(doc,'visibilityState',{get:()=>hidden?'hidden':'visible'});
 const actions={reconcileNotifications:async()=>({success:true}),getNotifications:async input=>{reads++;requests.push(input);if(pendingRead){const d=pendingRead;pendingRead=null;return d.promise;}if(failRead)return {success:false,message:'Unavailable'};const data=structuredClone(saved);data.messages=data.messages.filter(m=>!m.archivedAt&&(input.filter!=='unread'||!m.readAt));return {success:true,data};},changeNotificationState:async input=>{if(pendingWrite){const d=pendingWrite;pendingWrite=null;await d.promise;}if(failWrite)return {success:false,message:'Save failed'};saved.messages=saved.messages.map(m=>m.id===input.id?{...m,...(input.read!==undefined?{readAt:input.read?'2026-10-03T11:00:00Z':null}:{archivedAt:input.archived?'2026-10-03T11:00:00Z':null}),revision:m.revision+1}:m);saved.unreadCount=saved.messages.filter(m=>!m.readAt&&!m.archivedAt).length;return {success:true,data:{saved:true}};},readAllNotifications:async()=>{if(failWrite)return {success:false,message:'Save failed'};const count=saved.unreadCount;saved.messages=saved.messages.map(m=>({...m,readAt:'2026-10-03T11:00:00Z'}));saved.unreadCount=0;return {success:true,data:{saved:true,count}};}};
 const provider=loadModule('app/components/notifications/InboxProvider.tsx',{react,'react/jsx-runtime':jsxRuntime,'@/lib/auth-client':{authClient:{useSession:()=>({data:session,isPending:false})}},'@/lib/actions/notifications.actions':actions},{window:win,document:doc,navigator:{get onLine(){return online;}},setTimeout:()=>1,clearTimeout(){}});
 const root=()=>provider.default({children:null});const mounted=root();
 const render=()=>{index=0;const v=mounted.type(mounted.props);effects.splice(0).forEach(fn=>{const cleanup=fn();if(cleanup)cleanups.push(cleanup);});return v.props.value;};
 return {render,root,reads:()=>reads,requests,saved:()=>saved,replace:data=>saved=data,online:v=>online=v,hidden:v=>hidden=v,failRead:v=>failRead=v,failWrite:v=>failWrite=v,deferRead:()=>pendingRead=defer(),deferWrite:()=>pendingWrite=defer(),switchOwner:id=>session=id?{user:{id}}:null,cleanup:()=>cleanups.forEach(fn=>fn())};
}
test('initial failure retains unknown count; retries load saved content and offline refresh keeps an honest last-known state',async()=>{
 const f=fixture();f.failRead(true);f.render();await flush();let ui=f.render();assert.equal(ui.page,null);assert.match(ui.error,/Refresh failed/);
 f.failRead(false);await ui.refresh();ui=f.render();assert.equal(ui.page.unreadCount,1);assert.equal(ui.error,'');
 f.online(false);await ui.refresh();ui=f.render();assert.equal(ui.page.unreadCount,1);assert.match(ui.error,/Offline.*last-known/);f.cleanup();
});
test('failed saves keep the saved row; repeated taps lock and stale reads cannot overwrite a newer successful read',async()=>{
 const f=fixture();f.render();await flush();let ui=f.render(),message=ui.page.messages[0];f.failWrite(true);assert.equal(await ui.change(message,{read:true}),false);ui=f.render();assert.equal(ui.page.unreadCount,1);assert.match(ui.error,/No confirmed state change/);
 f.failWrite(false);const old=f.deferRead(),refresh=ui.refresh();await flush();const writing=f.deferWrite(),write=ui.change(message,{read:true});assert.equal(await ui.change(message,{read:true}),false);writing.resolve();assert.equal(await write,true);
 old.resolve({success:true,data:{messages:[message],unreadCount:1}});await refresh;await flush();ui=f.render();assert.equal(ui.page.unreadCount,0);assert.equal(ui.page.messages.length,0);assert.ok(f.saved().messages[0].readAt);assert.equal(ui.error,'');f.cleanup();
});

test('a confirmed read or archive leaves the shared list immediately even if the refresh fails',async()=>{
 for(const state of [{read:true},{archived:true}]){
  const f=fixture();f.render();await flush();let ui=f.render();f.failRead(true);
  assert.equal(await ui.change(ui.page.messages[0],state),true);ui=f.render();assert.equal(ui.page.messages.length,0);assert.equal(ui.page.unreadCount,0);
  await flush();ui=f.render();assert.match(ui.error,/Refresh failed/);assert.equal(ui.page.messages.length,0);assert.equal(ui.page.unreadCount,0);f.cleanup();
 }
});

test('only unread requests are made, pagination deduplicates, and mark-all updates the shared count after confirmation',async()=>{
 const f=fixture();f.render();await flush();let ui=f.render();
 f.replace({...f.saved(),messages:[{id:'n',readAt:null,revision:1},{id:'read',readAt:'2026-10-03T11:00:00Z',revision:2}],nextCursor:'next',unreadCount:2});await ui.refresh();ui=f.render();assert.equal(ui.page.messages.length,1);
 f.replace({...f.saved(),messages:[{id:'n',readAt:null,revision:1},{id:'n2',readAt:null,revision:1}],nextCursor:null});await ui.loadMore();ui=f.render();assert.deepEqual(Array.from(ui.page.messages,m=>m.id),['n','n2']);assert.equal(f.requests.at(-1).cursor,'next');assert.ok(f.requests.every(r=>r.filter==='unread'));
 f.failWrite(true);assert.equal(await ui.markAll(),false);assert.equal(f.render().page.messages.length,2);
 f.failWrite(false);f.failRead(true);assert.equal(await ui.markAll(),true);ui=f.render();assert.equal(ui.page.messages.length,0);assert.equal(ui.page.unreadCount,0);await flush();assert.match(f.render().error,/Refresh failed/);f.cleanup();
});

test('a write completing after logout cannot publish old account data or start a refresh',async()=>{
 const f=fixture();f.render();await flush();const ui=f.render(),pending=f.deferWrite(),write=ui.change(ui.page.messages[0],{read:true}),reads=f.reads();f.cleanup();pending.resolve();assert.equal(await write,false);assert.equal(f.reads(),reads);
});

const icons=Object.fromEntries(['ArrowLeft','ArrowUpRight','Archive','Bell','Calendar','Check','Compass','Dumbbell','MailOpen','RefreshCw','Target'].map(name=>[name,name]));
const visualMocks={'react/jsx-runtime':jsxRuntime,'next/link':'Link','lucide-react':icons,'@/app/components/ui/button':{Button:'Button'}};

test('the bell is a direct page link; read and archived cards never render or offer Mark unread',()=>{
 const bell=loadModule('app/components/notifications/NotificationBell.tsx',{...visualMocks,'./InboxProvider':{useInbox:()=>({owner:'alice',page:{unreadCount:3}})}}).default();
 const link=findNode(bell,n=>n.type==='Link');assert.equal(link.props.href,'/account/notifications');assert.match(link.props['aria-label'],/3 unread/);assert.equal(link.props.onClick,undefined);
 const calls=[],message={id:'unread id',revision:1,readAt:null,archivedAt:null,category:'product_update',title:'Unread update',body:'Body',availableAt:'2026-10-03T10:00:00Z'};
 const list=loadModule('app/components/notifications/InboxList.tsx',visualMocks).default({page:{messages:[message,{...message,id:'read',readAt:'2026-10-03T11:00:00Z'},{...message,id:'archived',archivedAt:'2026-10-03T11:00:00Z'}],locale:'en-US',timezone:'UTC'},busy:false,onChange:(...args)=>calls.push(args)});
 assert.equal(list.props.children.length,1);assert.equal(findNode(list,n=>n.type==='Link').props.href,'/account/notifications?message=unread%20id');
 findNode(list,n=>n.props?.['aria-label']==='Mark Unread update as read').props.onClick();assert.equal(calls[0][0],message);assert.deepEqual(plain(calls[0][1]),{read:true});assert.equal(findNode(list,n=>/Mark.*unread/.test(n.props?.['aria-label']??'')),undefined);
});

test('the page uses the provider list; inline opening confirms read and retry recovers a failed status without a modal',async()=>{
 const slots=[],effects=[],cleanups=[];let index=0,fail=true,writes=0;
 const change=async(message,state)=>{writes++;assert.equal(message.id,'owned');assert.deepEqual(plain(state),{read:true});return !fail;};
 const react={useState(initial){const i=index++;if(!(i in slots))slots[i]=initial;return [slots[i],next=>slots[i]=typeof next==='function'?next(slots[i]):next];},useEffect(fn,deps){const i=index++,old=slots[i];if(!old||deps.some((d,j)=>d!==old[j])){slots[i]=deps;effects.push(fn);}}};
 const detail={id:'owned',title:'Owned message',body:'Full body',readAt:null,target:{kind:'announcement',id:'a'}};
 const page=loadModule('app/components/notifications/NotificationHistory.tsx',{...visualMocks,react,'next/navigation':{useSearchParams:()=>new URLSearchParams('message=owned')},'./InboxProvider':{useInbox:()=>({owner:'alice',page:{messages:[],unreadCount:0},loading:false,busy:false,change,refresh(){},markAll(){}})},'./InboxList':{__esModule:true,default:'InboxList',InboxSkeleton:'InboxSkeleton'},'@/lib/notifications/types':{targetHref:()=>'/account/events'},'@/lib/actions/notifications.actions':{getNotificationDetail:async()=>({success:true,data:detail})}}).default();
 assert.equal(findNode(page,n=>n.type==='InboxList').props.page.unreadCount,0);
 const child=findNode(page,n=>typeof n.type==='function');assert.ok(child);const render=()=>{index=0;const tree=child.type(child.props);effects.splice(0).forEach(fn=>{const cleanup=fn();if(cleanup)cleanups.push(cleanup);});return tree;};
 render();await flush();let tree=render();assert.equal(writes,1);assert.ok(findNode(tree,n=>n.props?.role==='alert'));assert.equal(findNode(tree,n=>n.props?.role==='dialog'),undefined);
 fail=false;findNode(tree,n=>n.type==='Button'&&n.props.children==='Retry message').props.onClick();render();await flush();tree=render();assert.equal(writes,2);assert.equal(findNode(tree,n=>n.props?.role==='alert'),undefined);assert.ok(findNode(tree,n=>n.props?.role==='status'));cleanups.forEach(fn=>fn());
});
test('hidden pages do not refresh; account switching and logout discard the previous private context',async()=>{
 const f=fixture();f.render();await flush();let ui=f.render(),reads=f.reads();f.hidden(true);await ui.refresh();assert.equal(f.reads(),reads);
 f.switchOwner('bob');assert.equal(f.root().props.owner,'bob');assert.equal(f.root().props.key,undefined); // React key lives outside props in real React.
 f.switchOwner(null);const root=f.root();assert.equal(root.props.value.owner,null);assert.equal(root.props.value.page,null);f.cleanup();
});
