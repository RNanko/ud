import EventsClient from "./EventsClient";
import { getEventsList } from "@/lib/actions/events.actions";
import { auth } from "@/lib/auth";
import { getCurrentWeekYear } from "@/lib/utils";
import { EventContainer } from "@/types/types";
import { headers } from "next/headers";
import { Suspense } from "react";
import Loader from "@/components/shared/loader";


export default function Page() {
  return (
    <Suspense fallback={<Loader />}>
      <Events />
    </Suspense>
  );
}

async function Events() {
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
