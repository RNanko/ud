import "server-only";
import { listInbox, reconcileInboxQueue } from "../notifications/store";
import { targetHref } from "../notifications/types";
// Compatibility for older callers. Pure reads; the protected job creates saved
// internal messages, never reminder emails.
export async function dueNotifications(owner:string) {
 const page=await listInbox(owner);
 return page.messages.map(item=>({key:item.id,title:item.title,href:targetHref(item.target,item.id)}));
}
export async function queueOptionalNotifications(){return reconcileInboxQueue();}
