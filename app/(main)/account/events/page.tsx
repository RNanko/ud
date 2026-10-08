import EventsClient from "./EventsClient";
import { getEventsList, getListOfWeeks } from "@/lib/actions/events.actions";
import { requireUserId } from "@/lib/session";
import { getCurrentWeekYear } from "@/lib/utils";
import { EventContainer } from "@/types/types";
import { Suspense } from "react";
import Loader from "@/app/components/shared/loader";
import { getGymData } from "@/lib/actions/gym.actions";
import { getEventPresets } from "@/lib/actions/planner.actions";
import { weekKey } from "@/lib/events";
import { calendarDay } from "@/lib/gym/validation";
// The private workspace waits for a verified session before rendering this page.
export const instant = false;
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
  const userId = await requireUserId();
  const { year, currentWeek } = getCurrentWeekYear();
  const query = await searchParams,
    linkedDate = calendarDay.safeParse(query.date);
  const dbCurrentWeek = linkedDate.success
    ? weekKey(linkedDate.data)
    : `${year}-WK${currentWeek}`;
  const [weekData, defaultData, listOfWeeks, gymData, eventPresets] = await Promise.all([
    getEventsList(userId, dbCurrentWeek),
    getEventsList(userId, "default"),
    getListOfWeeks(userId),
    getGymData(),
    getEventPresets(),
  ]);
  if (!weekData || !defaultData) {
    return <div>No data found!</div>;
  }
  const mergedData = {
    week: dbCurrentWeek,
    dayData: weekData,
    days: defaultData,
  };
  return (
    <EventsClient
      data={mergedData as EventContainer}
      listOfWeeks={listOfWeeks.data}
      gymData={gymData}
      eventPresets={eventPresets}
    />
  );
}
