"use client";
import Link from "next/link";
import {Bell} from "lucide-react";
import {Button} from "@/app/components/ui/button";
import {useInbox} from "./InboxProvider";

export default function NotificationBell(){
 const inbox=useInbox();
 if(!inbox.owner)return null;
 const count=inbox.page?.unreadCount??null;
 return <Button asChild variant="outline" className="relative size-11 shrink-0 rounded-2xl border-border text-primary-plus">
  <Link href="/account/notifications" aria-label={count===null?"Notifications — unread count unavailable":`Notifications — ${count} unread${inbox.error?', last-known count; refresh unavailable':''}`}>
   <Bell size={20}/>
   {count!==null&&count>0&&<span aria-hidden="true" className="absolute -right-1 -top-1 min-w-5 rounded-full bg-primary-plus px-1 text-[10px] font-semibold leading-5 text-background">{count>99?'99+':count}</span>}
   {inbox.error&&<span aria-hidden="true" className="absolute -bottom-1 right-0 rounded-full bg-primary-minus px-1 text-xs leading-4 text-background">!</span>}
  </Link>
 </Button>;
}