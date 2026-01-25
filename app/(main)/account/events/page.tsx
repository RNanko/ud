import EventsClient from "./EventsClient";
import { getEventsList } from "@/lib/actions/events.actions";
import { auth } from "@/lib/auth";
import { getCurrentWeekYear } from "@/lib/utils";
import { EventContainer } from "@/types/types";
import { headers } from "next/headers";

// const data = [
//   {
//     week: "2026-WK4",
//     dayData: [
//       {
//         day: "Monday",
//         tasks: [
//           { title: "Workout", id: "2026-WK3-userX-monday-1", completed: true },
//           {
//             title: "Shopping",
//             id: "2026-WK3-userX-monday-2",
//             completed: false,
//           },
//         ],
//         id: "2026-WK3-userX-1",
//       },
//       {
//         day: "Friday",
//         tasks: [
//           { title: "Workout", id: "2026-WK3-userX-friday-1", completed: false },
//           {
//             title: "Shopping",
//             id: "2026-WK3-userX-friday-2",
//             completed: false,
//           },
//         ],
//         id: "2026-WK3-userX-2",
//       },
//     ],
//   },
//   {
//     week: "2026-WK3",
//     dayData: [
//       {
//         day: "Friday",
//         tasks: [
//           { title: "Workout", id: "2026-WK2-userX-friday-1", completed: false },
//         ],
//         id: "2026-WK2-userX-1",
//       },
//     ],
//   },
//   {
//     week: "default",
//     dayData: [],
//     id: "default-userX",
//     days: [
//       { day: "Monday", workday: true },
//       { day: "Tuesday", workday: true },
//       { day: "Wednesday", workday: true },
//       { day: "Thursday", workday: true },
//       { day: "Friday", workday: true },
//       { day: "Saturday", workday: false },
//       { day: "Sunday", workday: false },
//     ],
//   },
// ];

export default async function Page() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const userId = session!.session.userId;

  const { year, currentWeek } = getCurrentWeekYear();
  const dbCurrentWeek = `${year}-WK${currentWeek}`;

  const weekData = await getEventsList(userId, dbCurrentWeek);
  const defaultData = await getEventsList(userId, "default");

  if (!weekData || !defaultData) {
    return <div>No data found!</div>;
  }

  const mergedData = {
    week: dbCurrentWeek,
    dayData: weekData, 
    days: defaultData
  };
  console.log(mergedData.dayData);
  return <EventsClient data={mergedData as EventContainer} />;
}
