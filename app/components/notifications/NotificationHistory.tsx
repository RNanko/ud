"use client";
import {useEffect,useState} from "react";
import {useSearchParams} from "next/navigation";
import Link from "next/link";
import {ArrowLeft,ArrowUpRight,Bell,Check,RefreshCw} from "lucide-react";
import {Button} from "@/app/components/ui/button";
import {getNotificationDetail} from "@/lib/actions/notifications.actions";
import {targetHref,type InboxMessage} from "@/lib/notifications/types";
import {useInbox} from "./InboxProvider";
import InboxList,{InboxSkeleton} from "./InboxList";

function MessageDetail({id}:{id:string}){
 const {change,busy}=useInbox();
 const [message,setMessage]=useState<InboxMessage|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[read,setRead]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  let current=true;
  async function open(){
   setLoading(true);setError("");
   try{
    const result=await getNotificationDetail(id);if(!current)return;
    if(!result.success)throw new Error(result.message);
    setMessage(result.data);setRead(Boolean(result.data.readAt));
    if(!result.data.readAt){
     const saved=await change(result.data,{read:true});if(!current)return;
     setRead(saved);if(!saved)setError("Read status could not be saved. Retry.");
    }
   }catch{if(current)setError("This message could not be opened or marked read. Retry.");}
   finally{if(current)setLoading(false);}
  }
  void open();return()=>{current=false;};
 },[id,attempt,change]);
 return <section aria-labelledby="notification-message-title" aria-busy={loading} className="space-y-4 border-b pb-6">
  <Link href="/account/notifications" className="inline-flex min-h-11 items-center gap-2 rounded-xl text-sm text-primary-plus"><ArrowLeft size={16}/>Back to unread messages</Link>
  {message&&<><div className="flex flex-wrap items-center gap-3"><h2 id="notification-message-title" className="min-w-0 break-words text-xl font-semibold">{message.title}</h2><span role="status" className="inline-flex items-center gap-1 text-xs text-primary-plus">{read?<><Check size={14}/>Read</>:loading?'Saving read status…':'Unread'}</span></div><p className="whitespace-pre-wrap break-words text-sm leading-7">{message.body}</p>{message.target.kind!=="announcement"&&<Button asChild variant="outline" className="min-h-11 rounded-2xl"><Link href={targetHref(message.target,message.id)}>Open related {({event:'event',workout:'workout',goal:'goal',journey:'journey',review:'review',account:'settings'} as const)[message.target.kind]}<ArrowUpRight size={16}/></Link></Button>}</>}
  {loading&&!message&&<p role="status" className="text-sm text-muted-foreground">Loading message…</p>}
  {error&&<div role="alert"><p className="text-sm">{error}</p><Button variant="outline" className="mt-2 min-h-11 rounded-xl" disabled={busy||loading} onClick={()=>setAttempt(value=>value+1)}>Retry message</Button></div>}
 </section>;
}

export default function NotificationHistory(){
 const inbox=useInbox(),messageId=useSearchParams().get("message");
 const page=inbox.page;
 return <section className="space-y-5">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-primary-plus"><Bell size={16}/>Your app inbox</p><h1 className="text-3xl font-semibold">Notifications</h1><p className="mt-2 text-sm text-muted-foreground">Unread messages only. Opening a message marks it read and removes it from this list.</p></div><Link className="inline-flex min-h-11 items-center rounded-2xl border px-3 text-sm text-primary-plus" href="/account?section=notifications">Notification preferences</Link></div>
  {messageId&&inbox.owner&&<MessageDetail key={`${inbox.owner}:${messageId}`} id={messageId}/>}
  <div className="flex flex-wrap items-center gap-2"><Button variant="outline" className="min-h-11 rounded-2xl" disabled={inbox.busy||inbox.loading} onClick={()=>void inbox.refresh()}><RefreshCw size={16}/>Refresh</Button><Button variant="outline" className="min-h-11 rounded-2xl" disabled={inbox.busy||!page?.unreadCount} onClick={()=>void inbox.markAll()}><Check size={16}/>Mark all read</Button><p role="status" className="text-sm text-muted-foreground">{page?`${page.unreadCount} unread`:'Unread count not loaded'}</p></div>
  {inbox.error&&<div role="alert" className="rounded-2xl border border-primary-minus/30 bg-primary-minus/5 p-4"><p>{inbox.error}</p><Button variant="outline" className="mt-2 min-h-11 rounded-xl" disabled={inbox.busy||inbox.loading} onClick={()=>void inbox.refresh()}>Retry</Button></div>}
  {inbox.busy&&<p role="status" className="text-xs text-muted-foreground">Saving read status…</p>}
  {inbox.loading&&page&&<p role="status" className="text-xs text-muted-foreground">Refreshing messages…</p>}
  <div aria-busy={inbox.loading} className="overflow-hidden rounded-3xl border bg-card/30">{!page&&inbox.loading?<InboxSkeleton/>:page?<InboxList page={page} busy={inbox.busy} onChange={(message,state)=>void inbox.change(message,state)}/>:null}</div>
  {page?.nextCursor&&<Button variant="outline" disabled={inbox.loading||inbox.busy} className="min-h-11 rounded-2xl" onClick={()=>void inbox.loadMore()}>{inbox.loading?'Loading…':'Load more unread messages'}</Button>}
  <p className="text-xs text-muted-foreground">Read status is saved to your account across devices.</p>
 </section>;
}