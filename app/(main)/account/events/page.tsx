import EventsClient from "./EventsClient";
import { getEventsList } from "@/lib/actions/events.actions";
import { auth } from "@/lib/auth";
import { getCurrentWeekYear } from "@/lib/utils";
import { EventContainer } from "@/types/types";
import { headers } from "next/headers";


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
  return <EventsClient data={mergedData as EventContainer} />;
}
