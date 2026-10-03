"use client";
import { useAccountCalendar } from "@/hooks/use-account-calendar";

import { CalendarPlus, Coffee, Copy, Plus } from "lucide-react";
import { Card } from "@/app/components/ui/card";
import { dayItems, decimalLabel, distanceDisplay, durationLabel, weeklySummary } from "@/lib/gym/logic";

import type { GymData, PlanRecord, SessionRecord, Units } from "@/lib/gym/types";
import { GymButton } from "./GymUI";
import { PlanCard, SessionCard } from "./WorkoutCard";
import WeekNavigator from "./WeekNavigator";
import { GymReveal } from "./GymMotion";
type Actions = {
  plan: (date: string) => void;
  log: (date: string) => void;
  rest: (date: string, value: boolean) => void;
  start: (plan: PlanRecord) => void;
  edit: (plan: PlanRecord) => void;
  move: (plan: PlanRecord) => void;
  duplicate: (plan: PlanRecord) => void;
  remove: (id: string, kind: "plan" | "session") => void;
  open: (session: SessionRecord) => void;
  copy: () => void;
};
export default function WeeklyPlan({
  data,
  selected,
  today,
  units,
  onSelect,
  actions
}: {
  data: GymData;
  selected: string;
  today: string;
  units: Units;
  onSelect: (date: string) => void;
  actions: Actions;
}) {
  const { dateLabel, weekDates }=useAccountCalendar();
  const days = weekDates(selected),
    summary = weeklySummary(data.sessions, days);
  const day = (date: string) => {
    const items = dayItems(data, date),
      rest = data.restDays.includes(date);
    return <Card key={date} className={`gap-3 rounded-3xl border p-3 ${date === selected ? "border-[var(--gym-blue)]/40" : "border-border"}`}>
      <h3 className="rounded-2xl bg-muted/40 px-3 py-3 font-semibold">{dateLabel(date, {
          weekday: "long",
          day: "numeric",
          month: "short"
        })}{date === today && " · Today"}</h3>
      <div className="flex flex-wrap gap-2">
        <GymButton aria-label={`Plan workout on ${date}`} onClick={() => actions.plan(date)}>
          <CalendarPlus />Plan</GymButton>
        <GymButton aria-label={`Log completed workout on ${date}`} disabled={date > today} onClick={() => actions.log(date)}>
          <Plus />Log completed</GymButton>
        <GymButton aria-label={`${rest ? "Unmark" : "Mark"} rest day ${date}`} tone={rest ? "blue" : "neutral"} onClick={() => actions.rest(date, !rest)}>
          <Coffee />{rest ? "Rest day ✓" : "Rest day"}</GymButton>
      </div>{items.plans.map(plan => <PlanCard key={plan.id} plan={plan} onStart={() => actions.start(plan)} onEdit={() => actions.edit(plan)} onMove={() => actions.move(plan)} onDuplicate={() => actions.duplicate(plan)} onRemove={() => actions.remove(plan.id, "plan")} />)}{items.sessions.map(session => <SessionCard key={session.id} session={session} units={units} plan={data.plans.find(plan => plan.id === session.planId)} onOpen={() => actions.open(session)} onRemove={() => actions.remove(session.id, "session")} onRemovePlan={() => {
        if (session.planId) actions.remove(session.planId, "plan");
      }} />)}{!items.plans.length && !items.sessions.length && <p className="px-3 py-4 text-sm text-muted-foreground">{rest ? "Rest day marked. No workout log is created." : "Open space for training or rest."}</p>}</Card>;
  };
  return <div className="space-y-5">
    <WeekNavigator selected={selected} today={today} onSelect={onSelect} />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold">Weekly plan</h2>
      <GymButton onClick={actions.copy}>
        <Copy />Copy planned week</GymButton>
    </div>
    <div className="grid grid-cols-3 gap-2 rounded-3xl border border-border bg-card/20 p-4">
      <div>
        <p className="text-2xl font-semibold">{summary.workouts}</p>
        <p className="text-xs text-muted-foreground">Completed workouts</p>
      </div>
      <div>
        <p className="text-2xl font-semibold">{summary.sets}</p>
        <p className="text-xs text-muted-foreground">Strength sets</p>
      </div>
      <div>
        <p className="text-2xl font-semibold">{durationLabel(summary.cardioSeconds)}</p>
        <p className="text-xs text-muted-foreground">Cardio time</p>
      </div>{Object.entries(summary.distance).map(([activity, value]) => <p key={activity} className="col-span-3 border-t border-border pt-2 text-sm text-muted-foreground">{activity}: {value.known ? `${decimalLabel(distanceDisplay(value.km, units))} ${units.distance}${value.known < value.count ? " (known entries only)" : ""}` : "Distance unknown"}</p>)}</div>
    <div className="lg:hidden"><GymReveal key={selected}>{day(selected)}</GymReveal></div>
    <div className="hidden gap-4 lg:grid lg:grid-cols-2 2xl:grid-cols-3">{days.map((date, index) => <GymReveal key={date} delay={index * 0.025}>{day(date)}</GymReveal>)}</div>
  </div>;
}
