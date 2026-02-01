import NotesClient from "./NotesClient";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getNotes } from "@/lib/actions/notes.actions";

import Loader from "@/components/shared/loader";
import { Suspense } from "react";

export default function Page() {
  return (
    <Suspense fallback={<Loader />}>
      <Notes />
    </Suspense>
  );
}

async function Notes() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const userId = session!.session.userId;

  const notes = await getNotes(userId);

  return <NotesClient data={notes} />;
}
