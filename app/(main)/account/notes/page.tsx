import NotesClient from "./NotesClient";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getNotes } from "@/lib/actions/notes.actions";

// const events: NoteItem[] = [
//   {
//     id: "1",
//     event: "Monday",
//     date: "01.01.2023",
//     description: "Lorem ipsum dolor sit amet afdadadada afdadadada afdadadada ",
//     createdAt: 123,
//   },
//   {
//     id: "2",
//     event: "Work",
//     createdAt: 123,
//   },
//   {
//     id: "3",
//     event: "Home",
//     createdAt: 123,
//   },
//   {
//     id: "4",
//     event: "Ward",
//     createdAt: 123,
//   },
//   {
//     id: "5",
//     event: "Drink Wodka Fuck Pilotka",
//     createdAt: 123,
//   },
// ];

export default async function Page() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const userId = session!.session.userId;

  const notes = await getNotes(userId);

  return <NotesClient data={notes} />;
}
