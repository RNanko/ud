"use client";
import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from "react";
import {useAuthSession} from "@/app/components/shared/account/SessionProvider";
import {getNotifications,reconcileNotifications,changeNotificationState,readAllNotifications} from "@/lib/actions/notifications.actions";
import type {InboxMessage,InboxPage} from "@/lib/notifications/types";

type InboxContext={owner:string|null;page:InboxPage|null;loading:boolean;error:string;busy:boolean;refresh:()=>Promise<void>;loadMore:()=>Promise<void>;change:(message:InboxMessage,state:{read?:boolean;archived?:boolean})=>Promise<boolean>;markAll:()=>Promise<boolean>};
const empty:InboxContext={owner:null,page:null,loading:true,error:"",busy:false,async refresh(){},async loadMore(){},async change(){return false;},async markAll(){return false;}};
const Context=createContext<InboxContext>(empty);
export const useInbox=()=>useContext(Context);

// The current provider refreshes directly; only other tabs need a broadcast.
function signal(){if(typeof BroadcastChannel!=="undefined"){const channel=new BroadcastChannel("manforth-inbox");channel.postMessage("changed");channel.close();}}

function AccountInbox({owner,children}:{owner:string;children:ReactNode}){
 const [page,setPage]=useState<InboxPage|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const state=useRef({mounted:false,running:false,writing:false,again:false,epoch:0,failures:0,last:0});
 const load=useCallback(async(cursor:string|null=null)=>{
  const s=state.current;if(!s.mounted)return;
  if(s.running||s.writing){if(!cursor)s.again=true;return;}
  if(document.visibilityState==="hidden")return;
  s.running=true;s.again=false;setLoading(true);const token=++s.epoch;
  try{
   if(!navigator.onLine)throw new Error("Offline");
   if(!cursor){const reconciled=await reconcileNotifications();if(!reconciled.success)throw new Error(reconciled.message);}
   const result=await getNotifications({filter:"unread",cursor});if(!result.success)throw new Error(result.message);
   if(s.mounted&&token===s.epoch){
    setPage(old=>({...result.data,messages:[...new Map([...(cursor&&old?old.messages:[]),...result.data.messages].filter(m=>!m.readAt&&!m.archivedAt).map(m=>[m.id,m])).values()]}));
    setError("");s.failures=0;s.last=Date.now();
   }
  }catch{if(s.mounted&&token===s.epoch){setError(navigator.onLine?"Refresh failed — last-known messages may be stale. Retry.":"Offline — showing last-known messages. Retry when connected.");s.failures++;}}
  finally{s.running=false;if(s.mounted&&token===s.epoch)setLoading(false);if(s.mounted&&s.again&&!s.writing)void load();}
 },[]);
 const refresh=useCallback(()=>load(),[load]);
 const loadMore=useCallback(async()=>{if(page?.nextCursor)await load(page.nextCursor);},[load,page?.nextCursor]);
 const mutate=useCallback(async(operation:()=>Promise<{success:true;data:{saved:boolean;count?:number}}|{success:false;message:string}>,apply:(page:InboxPage,data:{count?:number})=>InboxPage)=>{
  const s=state.current;if(!s.mounted||s.writing)return false;s.writing=true;++s.epoch;setBusy(true);setError("");
  let saved=false;
  try{
   const result=await operation();if(!result.success)throw new Error(result.message);
   if(s.mounted){
    // Patch only after server confirmation. A failed follow-up refresh must not
    // bring a message back or leave the badge counting a confirmed read.
    setPage(old=>old?apply(old,result.data):old);saved=true;
   }
  }catch(error){if(s.mounted)setError(error instanceof Error?`${error.message} No confirmed state change; retry or refresh.`:"Save failed — retry.");}
  finally{s.writing=false;if(s.mounted){setBusy(false);setLoading(false);}}
  if(saved){signal();void refresh();}else if(s.mounted&&s.again)void refresh();
  return saved;
 },[refresh]);
 const change=useCallback((message:InboxMessage,next:{read?:boolean;archived?:boolean})=>mutate(
  ()=>changeNotificationState({id:message.id,revision:message.revision,...next}),
  old=>{
   const remove=next.read===true||next.archived===true;
   return {...old,messages:remove?old.messages.filter(m=>m.id!==message.id):old.messages,unreadCount:Math.max(0,old.unreadCount-(remove&&!message.readAt&&!message.archivedAt?1:0))};
  }
 ),[mutate]);
 const markAll=useCallback(()=>mutate(()=>readAllNotifications(),old=>({...old,messages:[],unreadCount:0})),[mutate]);
 useEffect(()=>{
  const s=state.current;s.mounted=true;void refresh();let timer:ReturnType<typeof setTimeout>;
  const tick=async()=>{if(document.visibilityState==="visible")await refresh();if(s.mounted)timer=setTimeout(tick,Math.min(300000,60000*2**Math.min(s.failures,3)));};
  timer=setTimeout(tick,60000);
  const foreground=()=>{if(document.visibilityState==="visible"&&Date.now()-s.last>3000)void refresh();};
  const change=()=>{void refresh();};
  const storage=(event:StorageEvent)=>{if(event.key==="momentum-signal")foreground();};
  const channel=typeof BroadcastChannel==="undefined"?null:new BroadcastChannel("manforth-inbox");if(channel)channel.onmessage=change;
  const gym=typeof BroadcastChannel==="undefined"?null:new BroadcastChannel("gym-records-changed");if(gym)gym.onmessage=change;
  window.addEventListener("focus",foreground);window.addEventListener("online",change);window.addEventListener("offline",change);window.addEventListener("notifications-changed",change);window.addEventListener("gym-records-changed",change);window.addEventListener("momentum-changed",change);window.addEventListener("storage",storage);document.addEventListener("visibilitychange",foreground);
  return()=>{s.mounted=false;++s.epoch;clearTimeout(timer);channel?.close();gym?.close();window.removeEventListener("focus",foreground);window.removeEventListener("online",change);window.removeEventListener("offline",change);window.removeEventListener("notifications-changed",change);window.removeEventListener("gym-records-changed",change);window.removeEventListener("momentum-changed",change);window.removeEventListener("storage",storage);document.removeEventListener("visibilitychange",foreground);};
 },[refresh]);
 return <Context.Provider value={{owner,page,loading,error,busy,refresh,loadMore,change,markAll}}>{children}</Context.Provider>;
}
export default function InboxProvider({children}:{children:ReactNode}){
 const {data:session,isPending}=useAuthSession();
 // Remounting discards private cache and pending responses on account changes.
 return session&&!isPending?<AccountInbox key={session.user.id} owner={session.user.id}>{children}</AccountInbox>:<Context.Provider value={{...empty,loading:isPending}}>{children}</Context.Provider>;
}
