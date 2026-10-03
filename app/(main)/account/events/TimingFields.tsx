"use client";

import { Field, NumberField } from "../gym/GymUI";
import { clockTime, timeMinutes, untimed, type EventTiming } from "@/lib/planner-time";
export default function TimingFields({
  value,
  onChange,
  disabled = false
}: {
  value: EventTiming;
  onChange: (value: EventTiming) => void;
  disabled?: boolean;
}) {
  const timed = value.start !== null;
  const end = value.start && value.duration !== null ? clockTime(timeMinutes(value.start) + value.duration) : "";
  return <fieldset disabled={disabled} className="space-y-3 rounded-2xl border border-border p-3">
    <legend className="px-2 text-sm font-medium">Optional schedule</legend>
    <label className="flex min-h-11 items-center gap-3"><input type="checkbox" className="size-5 accent-[var(--gym-blue)]" checked={timed} onChange={event => onChange(event.target.checked ? {
        ...value,
        start: "18:00"
      } : {
        ...untimed(),
        order: value.order
      })} />Set a time</label>
    {timed ? <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start time" type="time" value={value.start || ""} onChange={event => onChange({
          ...value,
          start: event.target.value
        })} />
        <Field label="End time (optional)" type="time" value={end} onChange={event => onChange({
          ...value,
          duration: event.target.value && value.start ? timeMinutes(event.target.value) - timeMinutes(value.start) + (value.overnight ? 1440 : 0) : null
        })} />
        <NumberField label="Duration (minutes, optional)" min={1} max={1440} step={1} value={value.duration} onChange={duration => onChange({
          ...value,
          duration
        })} />
      </div>
      <label className="flex min-h-11 items-center gap-3"><input type="checkbox" className="size-5 accent-[var(--gym-blue)]" checked={value.overnight} onChange={event => onChange({
          ...value,
          overnight: event.target.checked,
          duration: event.target.checked ? Math.min(1440, 1440 - timeMinutes(value.start!) + 60) : value.duration === null ? null : Math.min(value.duration, 1440 - timeMinutes(value.start!))
        })} />Ends on the following day</label>
      <p className="text-xs text-muted-foreground">End time and duration stay synchronized. A time does not create a reminder.</p>
    </> : <p className="text-sm text-muted-foreground">Any time · only the date is scheduled.</p>}
  </fieldset>;
}
