import EventsClient from "./EventsClient";
// import { getToDoList } from "@/lib/actions/todo.actions";
// import { auth } from "@/lib/auth";
// import { headers } from "next/headers";

const data = [
  {
    week: "2026-03",
    dayData: [
      {
        day: "Monday",
        tasks: [
          { title: "Workout", id: "2026-03-userX-monday-1" },
          { title: "Shopping", id: "2026-03-userX-monday-2" },
        ],
        id: "2026-03-userX-1",
      },
      {
        day: "Friday",
        tasks: [
          { title: "Workout", id: "2026-03-userX-friday-1" },
          { title: "Shopping", id: "2026-03-userX-friday-2" },
        ],
        id: "2026-03-userX-2",
      },
    ],
    id: "2026-03-userX",
  },
  {
    week: "2026-02",
    dayData: [
      {
        day: "Friday",
        tasks: [{ title: "Workout", id: "2026-02-userX-friday-1" }],
        id: "2026-02-userX-1",
      },
    ],
    id: "2026-02-userX",
  },
  {
    week: "default",
    dayData: [],
    id: "default-userX",
    days: [
      { day: "Monday", workday: true },
      { day: "Tuesday", workday: true },
      { day: "Wednesday", workday: true },
      { day: "Thursday", workday: true },
      { day: "Friday", workday: true },
      { day: "Saturday", workday: false },
      { day: "Sunday", workday: false },
    ],
  },
];

export default async function Page() {
  // const session = await auth.api.getSession({
  //   headers: await headers(),
  // });

  // const userSessionId = session?.session?.userId;

  // const data = await getEventsData(userSessionId);

  // const sortedDescData = [...data].sort((a, b) => {
  //   const [ayear, aweek] = a.week.split("-").map(Number);
  //   const [byear, bweek] = a.week.split("-").map(Number);

  //   return ayear !== byear ? byear - ayear : bweek - aweek;
  // });

  return <EventsClient data={data} />;
}
