"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Check } from "lucide-react";
import { getWorkoutEvents, type LinkedWorkoutEvent } from "@/lib/actions/workout-events.actions";
import { dateLabel } from "@/lib/gym/dates";
import { timeLabel } from "@/lib/planner-time";
import { useAccountCalendar } from "@/hooks/use-account-calendar";
import { GymButton } from "./GymUI";

export default function WorkoutLinkedEvents({ kind, id }: { kind: "plan" | "session"; id: string }) {
  const { hour12 } = useAccountCalendar();
  const [events, setEvents] = useState<LinkedWorkoutEvent[] | null>(null);
  const [error, setError] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true, generation = 0;
    const load = () => {
      const current = ++generation;
      void getWorkoutEvents({ kind, id }).then(value => {
        if (live && current === generation) { setEvents(value); setError(false); }
      }).catch(() => { if (live && current === generation) setError(true); });
    };
    load();
    window.addEventListener("workout-links-changed", load);
    return () => { live = false; window.removeEventListener("workout-links-changed", load); };
  }, [kind, id, retry]);
  if (!events?.length && !error) return null;
  return <section aria-label="Linked events" className="rounded-2xl border border-border bg-card/20 p-4">
    <h3 className="mb-3 flex items-center gap-2 font-semibold"><CalendarDays size={16} />Linked events</h3>
    {error && <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground"><p>Could not load linked events.</p><GymButton onClick={() => setRetry(value => value + 1)}>Retry</GymButton></div>}
    <ul className="space-y-3">{events?.map(({ event, date }) => <li key={event.id} className="flex items-start gap-3">
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border border-[var(--gym-blue)] text-[var(--gym-blue)]">{event.completed && <Check size={14} aria-label="Completed" />}</span>
      <div className="min-w-0"><p className={event.completed ? "text-sm font-medium text-muted-foreground" : "text-sm font-medium"}>{event.title}</p>
        <p className="text-xs text-muted-foreground">{event.category || "Personal"} · {dateLabel(date)}{event.timing?.start && <> · {timeLabel(event.timing, hour12)}</>}</p>
        {event.notes && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{event.notes}</p>}
      </div>
    </li>)}</ul>
  </section>;
}
