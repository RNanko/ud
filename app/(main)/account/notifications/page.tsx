import {Suspense} from "react";
import NotificationHistory from "@/app/components/notifications/NotificationHistory";
import {InboxSkeleton} from "@/app/components/notifications/InboxList";
import {requireUserId} from "@/lib/session";
async function History(){await requireUserId();return <NotificationHistory/>;}
export default function Page(){return <Suspense fallback={<InboxSkeleton/>}><History/></Suspense>;}
