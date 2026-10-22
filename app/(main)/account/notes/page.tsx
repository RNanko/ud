import { Suspense } from "react";
import Loader from "@/app/components/shared/loader";
import { getNotes } from "@/lib/actions/notes.actions";
import NotesClient from "./NotesClient";
import { requireUserId } from "@/lib/session";
import { productAccess } from "@/lib/account/access";
// The private workspace waits for a verified session before rendering this page.
export const instant = false;

export const metadata = { title: "Notes | ManForth", description: "Ideas, lists and sketches in your workspace." };

export default function Page() {
  return <Suspense fallback={<Loader />}><Notes /></Suspense>;
}

async function Notes() {
  const userId = await requireUserId();
  const [initial, access] = await Promise.all([getNotes(), productAccess(userId)]);
  return <NotesClient userId={userId} initial={initial} canWrite={access.canWrite} accessEndsAt={access.end} />;
}
