"use client";

import { useState } from "react";
import type { EventItem } from "@/types/types";
import { eventSchema } from "@/lib/events";
import { dateLabel, weekDates } from "@/lib/gym/dates";
import { untimed } from "@/lib/planner-time";
import { Field, GymButton, GymDialog, GymSelect, Notes } from "../gym/GymUI";
import TimingFields from "./TimingFields";
export default function EventEditor({
  event,
  date,
  onClose,
  onSave,
  onComplete,
  onPreset
}: {
  event?: EventItem;
  date: string;
  onClose: () => void;
  onSave: (event: EventItem, date: string) => Promise<void>;
  onComplete?: () => Promise<void>;
  onPreset?: (event: EventItem) => Promise<void>;
}) {
  const [draft, setDraft] = useState<EventItem>(() => event || {
    id: crypto.randomUUID(),
    title: "",
    completed: false,
    completedAt: null,
    notes: "",
    category: "Personal",
    icon: "calendar",
    tone: "blue",
    timing: untimed()
  });
  const [day, setDay] = useState(date),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [pending, setPending] = useState<{
    event: EventItem;
    date: string;
    kind: "save" | "preset";
  } | null>(null);
  const patch = (value: Partial<EventItem>) => setDraft(current => ({
    ...current,
    ...value
  }));
  const save = async () => {
    const checked = eventSchema.safeParse(pending?.event || draft);
    if (!checked.success) {
      setError(checked.error.issues[0].message);
      return;
    }
    const command = pending || {
      event: checked.data as EventItem,
      date: day,
      kind: "save" as const
    };
    setPending(command);
    setBusy(true);
    setError("");
    try {
      if (command.kind === "preset") await onPreset?.(command.event);else await onSave(command.event, command.date);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Save failed — retry");
    } finally {
      setBusy(false);
    }
  };
  return <GymDialog open title={event ? "Event details" : "Create event"} description="The scheduled date stays independent of completion. A specific time is optional." onClose={() => {
    if (!busy) onClose();
  }}>
    <fieldset className="space-y-4" disabled={busy || !!pending}><Field label="Event title" value={draft.title} maxLength={500} disabled={busy} onChange={event => patch({
        title: event.target.value
      })} />
    <GymSelect label="Scheduled date" value={day} options={weekDates(date)} onChange={setDay} />
    <p className="text-xs text-muted-foreground">{dateLabel(day, {
          weekday: "long",
          month: "long",
          day: "numeric"
        })}</p>
    <Field label="Category" value={draft.category || "Personal"} maxLength={80} disabled={busy} onChange={event => patch({
        category: event.target.value
      })} />
    <div className="grid gap-3 sm:grid-cols-2"><GymSelect label="Icon" value={draft.icon || "calendar"} options={["calendar", "book", "work", "coffee", "workout"]} onChange={icon => patch({
          icon: icon as EventItem["icon"]
        })} /><GymSelect label="Appearance" value={draft.tone || "blue"} options={["blue", "orange"]} onChange={tone => patch({
          tone: tone as EventItem["tone"]
        })} /></div>
    <TimingFields value={draft.timing || untimed()} disabled={busy} onChange={timing => patch({
        timing
      })} />
    <Notes label="Event notes (optional)" maxLength={3000} value={draft.notes || ""} disabled={busy} onChange={event => patch({
        notes: event.target.value
      })} />
    </fieldset>
    {event && <p className="text-sm font-medium">{event.completed ? "Completed" : "Planned"}{event.completedAt && ` · ${new Date(event.completedAt).toLocaleString()}`}</p>}
    {error && <p role="alert" className="gym-error">{error}</p>}
    <div className="flex flex-wrap gap-2"><GymButton tone="blue" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : pending ? "Retry save" : "Save event"}</GymButton>
      {event && onComplete && <GymButton tone="orange" disabled={busy || !!pending} onClick={async () => {
        setBusy(true);
        try {
          await onComplete();
          onClose();
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : "Save failed — retry");
        } finally {
          setBusy(false);
        }
      }}>{event.completed ? "Reopen" : "Complete"}</GymButton>}
      {onPreset && <GymButton disabled={busy || !!pending || !draft.title.trim()} onClick={async () => {
        const checked = eventSchema.safeParse(draft);
        if (!checked.success) {
          setError(checked.error.issues[0].message);
          return;
        }
        const command = {
          event: checked.data as EventItem,
          date: day,
          kind: "preset" as const
        };
        setPending(command);
        setBusy(true);
        setError("");
        try {
          await onPreset(command.event);
          onClose();
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : "Save failed — retry");
        } finally {
          setBusy(false);
        }
      }}>Use as event preset</GymButton>}
    </div>
  </GymDialog>;
}
