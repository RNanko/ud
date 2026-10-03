"use client";

import { useState } from "react";
import type { EventItems } from "@/types/types";
import { boardSchema, weekdays } from "@/lib/events";
import { weekDates } from "@/lib/gym/dates";
import { untimed } from "@/lib/planner-time";
import { GymButton, GymDialog, GymSelect } from "../gym/GymUI";
import TimingFields from "./TimingFields";
export default function PresetSheet({
  preset,
  selected,
  onApply,
  onClose
}: {
  preset: EventItems[];
  selected: string;
  onApply: (preset: EventItems[], operationId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(preset));
  const [dates, setDates] = useState(() => Object.fromEntries(preset.map(day => [day.day, weekDates(selected)[weekdays.indexOf(day.day)]])));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [pending, setPending] = useState<EventItems[] | null>(null),
    [id] = useState(() => crypto.randomUUID());
  return <GymDialog open full title="Apply week preset" description="Creates fresh plans on selected dates. Completion timestamps and actual workout results are excluded." onClose={() => {
    if (!busy) onClose();
  }}>
    {!draft.some(day => day.tasks.length) && <p>Save a week preset first. It can include manual events and Gym plans.</p>}
    {draft.filter(day => day.tasks.length).map(day => <section className="space-y-3 rounded-2xl border border-border p-4" key={day.day}>
      <GymSelect label={`Destination for ${day.day}`} value={dates[day.day]} options={weekDates(selected)} onChange={value => {
        if (!pending) setDates(current => ({
          ...current,
          [day.day]: value
        }));
      }} />
      {day.tasks.map(item => <div key={item.id} className="space-y-2"><h3 className="font-semibold">{item.title} · {item.workout ? "Workout plan" : item.category || "Event"}</h3><TimingFields disabled={busy || !!pending} value={item.timing || untimed()} onChange={timing => setDraft(current => current.map(row => ({
          ...row,
          tasks: row.tasks.map(event => event.id === item.id ? {
            ...event,
            timing
          } : event)
        })))} /></div>)}
    </section>)}
    {error && <p role="alert" className="gym-error">{error}</p>}
    <GymButton tone="blue" disabled={busy || !draft.some(day => day.tasks.length)} onClick={async () => {
      const copy: EventItems[] = pending || [];
      if (!pending) for (const source of draft) {
        const day = weekdays[new Date(`${dates[source.day]}T12:00:00Z`).getUTCDay() === 0 ? 6 : new Date(`${dates[source.day]}T12:00:00Z`).getUTCDay() - 1],
          target = copy.find(row => row.day === day);
        if (target) target.tasks.push(...source.tasks);else copy.push({
          id: day.toLowerCase(),
          day,
          tasks: source.tasks
        });
      }
      const checked = boardSchema.safeParse(copy);
      if (!checked.success) {
        setError(checked.error.issues[0].message);
        return;
      }
      setPending(copy);
      setBusy(true);
      setError("");
      try {
        await onApply(copy, id);
        onClose();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Save failed — retry");
      } finally {
        setBusy(false);
      }
    }}>{busy ? "Saving…" : pending ? "Retry preset application" : "Create planned events"}</GymButton>
  </GymDialog>;
}
