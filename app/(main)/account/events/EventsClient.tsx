"use client";

import dynamic from "next/dynamic";
import { EventContainer, EventItems } from "@/types/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  getDefaultWeekEvents,
  setDefaultWeekEvents,
} from "@/lib/actions/events.actions";

const EventsBoard = dynamic(() => import("./EventsBoard"), {
  ssr: false,
});

export default function EventsClient({ data }: { data: EventContainer }) {
  const defaultWeek = data.days;
  const [week, setWeek] = useState(data.week);
  const [weekData, setWeekData] = useState<EventContainer>(data);
  void setWeek;

  function isWeekCompleted(days?: EventItems[]): boolean {
    if (!days || days.length === 0) return false;

    return days.every(
      (day) =>
        day.tasks.length > 0 && day.tasks.every((task) => task.completed),
    );
  }
  const weekCompleted = isWeekCompleted(weekData.dayData);

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
        <div className="flex flex-row gap-2">
          <Button
            variant="secondary"
            className="cursor-pointer"
            onClick={async () => {
              const result = await getDefaultWeekEvents();

              if (!result.success) return;

              setWeekData((prev) => ({
                ...prev,
                dayData: result.data,
              }));
            }}
          >
            Get Default Week
          </Button>

          <Button
            className="cursor-pointer"
            variant={"secondary"}
            onClick={() => setDefaultWeekEvents(weekData.dayData)}
          >
            Set As Default
          </Button>
        </div>
      </div>
      <div className="w-full">
        <EventsBoard
          containers={weekData.dayData}
          defaultWeek={defaultWeek!}
          week={week}
          setContainers={(updater) =>
            setWeekData((prev) => ({
              ...prev,
              dayData:
                typeof updater === "function" ? updater(prev.dayData) : updater,
            }))
          }
        />
      </div>
    </section>
  );
}
