import EventsClient from "./EventsClient";
import { getEventsList, getListOfWeeks } from "@/lib/actions/events.actions";
import { auth } from "@/lib/auth";
import { getCurrentWeekYear } from "@/lib/utils";
import { EventContainer } from "@/types/types";
import { headers } from "next/headers";
import { Suspense } from "react";
import Loader from "@/app/components/shared/loader";
import { getGymData } from "@/lib/actions/gym.actions";
import { getEventPresets } from "@/lib/actions/planner.actions";
import { weekKey } from "@/lib/events";
import { calendarDay } from "@/lib/gym/validation";
export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  return (
    <Suspense fallback={<Loader />}>
      <Events searchParams={searchParams} />
    </Suspense>
  );
}
async function Events({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const userId = session!.session.userId;
  const { year, currentWeek } = getCurrentWeekYear();
  const query = await searchParams,
    linkedDate = calendarDay.safeParse(query.date);
  const dbCurrentWeek = linkedDate.success
    ? weekKey(linkedDate.data)
    : `${year}-WK${currentWeek}`;
  const weekData = await getEventsList(userId, dbCurrentWeek);
  const defaultData = await getEventsList(userId, "default");
  if (!weekData || !defaultData) {
    return <div>No data found!</div>;
  }
  const mergedData = {
    week: dbCurrentWeek,
    dayData: weekData,
    days: defaultData,
  };
  const listOfWeeks = await getListOfWeeks(userId);
  const [gymData, eventPresets] = await Promise.all([
    getGymData(),
    getEventPresets(),
  ]);
  return (
    <EventsClient
      data={mergedData as EventContainer}
      listOfWeeks={listOfWeeks.data}
      gymData={gymData}
      eventPresets={eventPresets}
    />
  );
}
