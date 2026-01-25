"use client";

import dynamic from "next/dynamic";
import { EventContainer, EventItems } from "@/types/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const EventsBoard = dynamic(() => import("./EventsBoard"), {
  ssr: false,
});

export default function EventsClient({ data }: { data: EventContainer }) {
  const defaultWeek = data.days;
  const [week, setWeek] = useState(data.week);
  void setWeek
  function isWeekCompleted(days?: EventItems[]): boolean {
    if (!days || days.length === 0) return false;

    return days.every(
      (day) =>
        day.tasks.length > 0 && day.tasks.every((task) => task.completed),
    );
  }
  const weekCompleted = isWeekCompleted(data.dayData);


  return (
    <section className="flex flex-col justify-center items-center gap-4">
      <div className="flex gap-5 items-center">
        <h3
          className={cn(
            "font-bold transition-all duration-300",
            weekCompleted && "line-through opacity-50",
          )}
        >
          {week}
        </h3>
        <div className="flex flex-col gap-2">
          <Button variant={"secondary"}>Reset</Button>
          <Button variant={"secondary"}>Set As Default</Button>
        </div>
      </div>
      <div className="w-full ">
        <EventsBoard data={data} defaultWeek={defaultWeek!} week={week} />
      </div>
    </section>
  );
}
