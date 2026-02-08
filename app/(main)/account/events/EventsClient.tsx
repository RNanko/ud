"use client";

import dynamic from "next/dynamic";
import { EventContainer, EventItems } from "@/types/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  getDefaultWeekEvents,
  getUserEventsList,
  setDefaultWeekEvents,
} from "@/lib/actions/events.actions";

import { useMemo } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EventsBoard = dynamic(() => import("./EventsBoard"), {
  ssr: false,
});

export default function EventsClient({
  data,
  listOfWeeks,
}: {
  data: EventContainer;
  listOfWeeks: string[];
}) {
  const defaultWeek = data.days;
  const [week, setWeek] = useState(data.week);
  const [weekData, setWeekData] = useState<EventContainer>(data);

  const [loading, setLoading] = useState(false);

  async function getNewWeekToBoard(nextWeek: string) {
    setLoading(true);
    setWeek(nextWeek);
    const dayData = await getUserEventsList(nextWeek);
    setWeekData({ week: nextWeek, dayData });
    setLoading(false);
  }

  function isWeekCompleted(days: EventItems[]): boolean {
    return days
      .filter((day) => day.tasks.length > 0)
      .every((day) => day.tasks.every((task) => task.completed));
  }

  const weekCompleted = useMemo(
    () => isWeekCompleted(weekData.dayData),
    [weekData.dayData],
  );

  return (
    <section className="flex flex-col justify-center items-center gap-4">
      <div className="flex flex-col sm:flex-row gap-5 items-center">
        <Select
          disabled={loading}
          value={week}
          onValueChange={(value) => getNewWeekToBoard(value)}
        >
          <SelectTrigger
            className={cn(
              "w-full max-w-64 text-xl font-bold text-white transition-all duration-300",
              weekCompleted && "line-through opacity-50",
            )}
          >
            <SelectValue />
          </SelectTrigger>

          <SelectContent>
            {listOfWeeks.map((w) => (
              <SelectItem key={w} value={w} className="text-xl">
                {w}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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
