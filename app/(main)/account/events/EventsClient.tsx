"use client";

import dynamic from "next/dynamic";
import { EventContainer } from "@/types/types";
import { getCurrentWeekYear } from "@/lib/utils";

const EventsBoard = dynamic(() => import("./EventsBoard"), {
  ssr: false,
});

export default function EventsClient({ data }: { data: EventContainer[] }) {
  const { year, currentWeek } = getCurrentWeekYear();

  const defaultWeek = data.find((week) => week.week === "default")!.days!;

  const filtredData = data.find((data) => data.week === "2026-03");
  if (!filtredData) {
    return <div>No data for this week</div>;
  }

  console.log(filtredData);

  return (
    <section className="flex flex-col justify-center items-center gap-4">
      <h3 className=" font-bold">
        Week {currentWeek}
        <span className="relative -top-2 text-xs ml-3 text-muted-foreground">
          {year}
        </span>
      </h3>
      <div className="w-full ">
        <EventsBoard data={filtredData} defaultWeek={defaultWeek} />
      </div>
    </section>
  );
}
