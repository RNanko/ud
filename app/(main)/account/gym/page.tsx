import { Suspense } from "react";
import Loader from "@/app/components/shared/loader";
import { getGymData } from "@/lib/actions/gym.actions";
import GymClient from "./GymClient";
import { requireUserId } from "@/lib/session";
import { calendarDay } from "@/lib/gym/validation";
// The private workspace waits for a verified session before rendering this page.
export const instant = false;
async function Gym({ searchParams }: { searchParams: Promise<{date?:string}> }) {
  const userId = await requireUserId();
  const date = calendarDay.safeParse((await searchParams).date);
  return <GymClient userId={userId} initial={await getGymData(date.success ? date.data : undefined)} />;
}
export default function Page({searchParams}: {searchParams: Promise<{date?:string}>}) {
  return <Suspense fallback={<Loader />}>
    <Gym searchParams={searchParams} />
  </Suspense>;
}
