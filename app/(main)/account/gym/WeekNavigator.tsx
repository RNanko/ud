"use client";
import { useAccountCalendar } from "@/hooks/use-account-calendar";

import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { addCalendarDays } from "@/lib/gym/dates";
import { GymButton } from "./GymUI";
export default function WeekNavigator({
  selected,
  today,
  onSelect
}: {
  selected: string;
  today: string;
  onSelect: (date: string) => void;
}) {
  const { dateLabel, weekDates, weekStart }=useAccountCalendar();
  const days = weekDates(selected);
  return <section className="space-y-3" aria-label="Week navigation">
    <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
      <GymButton aria-label="Previous week" onClick={() => onSelect(addCalendarDays(selected, -7))}>
        <ChevronLeft />
      </GymButton>
      <h2 className="text-center text-base font-semibold sm:text-xl">{dateLabel(days[0])} – {dateLabel(days[6])}</h2>
      <GymButton aria-label="Next week" onClick={() => onSelect(addCalendarDays(selected, 7))}>
        <ChevronRight />
      </GymButton>
    </div>
    <div className="flex justify-center">
      <GymButton tone={weekStart(selected) === weekStart(today) ? "blue" : "neutral"} onClick={() => onSelect(today)}>
        <CalendarDays />Current week</GymButton>
    </div>
    <div className="grid grid-cols-[repeat(7,minmax(44px,1fr))] gap-1 overflow-x-auto rounded-2xl border border-border bg-card/30 p-1 sm:gap-2 sm:p-2" role="group" aria-label="Select workout day">{days.map(day => <GymButton key={day} className="min-w-0 flex-col gap-1 px-0 py-3" tone={day === selected ? "blue" : "neutral"} aria-pressed={day === selected} aria-label={dateLabel(day, {
        weekday: "long",
        month: "long",
        day: "numeric"
      })} onClick={() => onSelect(day)}>
        <span className="text-xs">{dateLabel(day, {
            weekday: "short"
          })}</span>
        <span className="text-lg font-semibold">{dateLabel(day, {
            day: "numeric"
          })}</span>{day === today && <span className="text-[9px]">Today</span>}</GymButton>)}</div>
  </section>;
}
