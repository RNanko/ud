"use client";

import { useState } from "react";
import type { EventItem } from "@/types/types";
import { eventSchema } from "@/lib/events";
import { dateLabel, weekDates } from "@/lib/gym/dates";
import { calendarDay } from "@/lib/gym/validation";
import { untimed } from "@/lib/planner-time";
import { Field, GymButton, GymDialog, GymSelect, Notes } from "../gym/GymUI";
import TimingFields from "./TimingFields";
import EventDatePicker from "./EventDatePicker";
import EventColorPicker from "./EventColorPicker";
import { EventLoadingSpinner } from "./EventCompletionCheckbox";
import { WeekdaySelector } from "./WeekdaySelector";
import ChartDatePicker from "@/app/components/shared/charts/ChartDatePicker";
import { useAccountCalendar } from "@/hooks/use-account-calendar";
import { eventScheduleSchema, weekdayIndex, type EventSchedule } from "@/lib/events/recurrence";
export default function EventEditor({
  event,
  date,
  dates,
  onClose,
  onSave,
  onComplete,
  onPreset,
  onSchedule,
  initialRepeat = false,
}: {
  event?: EventItem;
  date: string;
  dates?: string[];
  onClose: () => void;
  onSave: (event: EventItem, date: string) => Promise<void>;
  onComplete?: () => Promise<void>;
  onPreset?: (event: EventItem) => Promise<void>;
  onSchedule?: (schedule: EventSchedule, operationId: string) => Promise<void>;
  initialRepeat?: boolean;
}) {
  const calendar = useAccountCalendar();
  const [repeat, setRepeat] = useState(initialRepeat), [days, setDays] = useState([weekdayIndex(date)]), [end, setEnd] = useState("");
  const [intervalWeeks, setIntervalWeeks] = useState("1"), [count, setCount] = useState("");
  const [extraSlots, setExtraSlots] = useState<NonNullable<EventSchedule["slots"]>>([]);
  const [scheduleIds] = useState(() => ({ id: crypto.randomUUID(), operation: crypto.randomUUID() }));
  const [draft, setDraft] = useState<EventItem>(
    () =>
      event || {
        id: crypto.randomUUID(),
        title: "",
        completed: false,
        completedAt: null,
        notes: "",
        category: "Personal",
        icon: "calendar",
        tone: "blue",
        timing: untimed(),
      },
  );
  const [day, setDay] = useState(date),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [pending, setPending] = useState<{
    event: EventItem;
    date: string;
    kind: "save" | "preset";
  } | null>(null);
  const patch = (value: Partial<EventItem>) =>
    setDraft((current) => ({
      ...current,
      ...value,
    }));
  const save = async () => {
    const checked = eventSchema.safeParse(pending?.event || draft);
    if (!checked.success) {
      setError(checked.error.issues[0].message);
      return;
    }
    const checkedDate = calendarDay.safeParse(pending?.date || day);
    if (!checkedDate.success) {
      setError("Choose a valid scheduled date.");
      return;
    }
    const command = pending || {
      event: checked.data as EventItem,
      date: checkedDate.data,
      kind: "save" as const,
    };
    if (repeat && onSchedule && !event) {
      const result = eventScheduleSchema.safeParse({ id: scheduleIds.id, revision: -1, event: command.event, start: command.date, end: end || null, days, timezone: calendar.timezone, stoppedFrom: null, intervalWeeks: Number(intervalWeeks), count: count ? Number(count) : null, ...(extraSlots.length ? { slots: [{ id: "main", timing: command.event.timing ?? untimed() }, ...extraSlots] } : {}) });
      if (!result.success) { setError(result.error.issues[0].message); return; }
    }
    setPending(command);
    setBusy(true);
    setError("");
    try {
      if (command.kind === "preset") await onPreset?.(command.event);
      else if (repeat && onSchedule && !event) {
        const schedule = eventScheduleSchema.parse({ id: scheduleIds.id, revision: -1, event: command.event, start: command.date, end: end || null, days, timezone: calendar.timezone, stoppedFrom: null, intervalWeeks: Number(intervalWeeks), count: count ? Number(count) : null, ...(extraSlots.length ? { slots: [{ id: "main", timing: command.event.timing ?? untimed() }, ...extraSlots] } : {}) });
        await onSchedule(schedule, scheduleIds.operation);
      } else await onSave(command.event, command.date);
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Save failed — retry",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <GymDialog
      open
      className="event-editor"
      data-event-tone={pending?.event.tone || draft.tone || "blue"}
      title={event ? event.scheduled ? "Scheduled event details" : "Event details" : repeat ? "Create event schedule" : "Create event"}
      description={event?.scheduled ? "Changes apply to this occurrence. Other dates in the schedule stay the same." : repeat ? "Choose weekdays once. Your events appear automatically in each matching week." : "The scheduled date stays independent of completion. A specific time is optional."}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <fieldset className="space-y-4" disabled={busy || !!pending}>
        {!event && onSchedule && <div className="grid grid-cols-2 gap-2" role="group" aria-label="Event frequency">
          {[false, true].map(value => <GymButton key={String(value)} tone={repeat === value ? "blue" : "neutral"} aria-pressed={repeat === value} onClick={() => setRepeat(value)}>{value ? "Repeat weekly" : "One event"}</GymButton>)}
        </div>}
        <Field
          label="Event title"
          value={draft.title}
          maxLength={500}
          disabled={busy}
          onChange={(event) =>
            patch({
              title: event.target.value,
            })
          }
        />
        {event ? (
          <GymSelect
            label="Scheduled date"
            value={day}
            options={dates ?? weekDates(date)}
            disabled={busy || !!pending}
            onChange={setDay}
          />
        ) : (
          <EventDatePicker
            value={day}
            disabled={busy || !!pending}
            onChange={setDay}
          />
        )}
        <p className="text-xs text-muted-foreground">
          {dateLabel(day, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
        {repeat && !event && <div className="space-y-4 rounded-2xl border border-[var(--event-accent)]/30 p-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Repeat every (weeks)" type="number" min="1" max="52" value={intervalWeeks} onChange={e => setIntervalWeeks(e.target.value)} />
            <Field label="Occurrence limit (optional)" type="number" min="1" max="1000000" value={count} onChange={e => setCount(e.target.value)} />
          </div>
          <WeekdaySelector days={days} onChange={setDays} disabled={busy || !!pending} />
          <ChartDatePicker label="Repeat until (optional)" value={end} minimum={day} modal onChange={setEnd} />
          <p className="text-xs text-muted-foreground">Starts on the date above{end ? ` · ends ${calendar.dateLabel(end)}` : " · no end date"}.</p>
        </div>}
        <Field
          label="Category"
          value={draft.category || "Personal"}
          maxLength={80}
          disabled={busy}
          onChange={(event) =>
            patch({
              category: event.target.value,
            })
          }
        />
        <GymSelect
          label="Icon"
          value={draft.icon || "calendar"}
          options={["calendar", "book", "work", "coffee", "workout"]}
          disabled={busy || !!pending}
          onChange={(icon) =>
            patch({
              icon: icon as EventItem["icon"],
            })
          }
        />
        <EventColorPicker
          value={draft.tone || "blue"}
          disabled={busy || !!pending}
          onChange={(tone) => patch({ tone })}
        />
        <TimingFields
          value={draft.timing || untimed()}
          disabled={busy}
          onChange={(timing) =>
            patch({
              timing,
            })
          }
        />
        {repeat && !event && <div className="space-y-3">
          {extraSlots.map((slot, index) => <div key={slot.id} className="space-y-2 rounded-2xl border border-border p-3">
            <div className="flex items-center justify-between gap-3"><span className="text-sm font-medium">Occurrence {index + 2}</span><GymButton disabled={busy || !!pending} aria-label={`Remove occurrence ${index + 2}`} onClick={() => setExtraSlots(slots => slots.filter(s => s.id !== slot.id))}>Remove</GymButton></div>
            <TimingFields value={slot.timing} disabled={busy || !!pending} onChange={timing => setExtraSlots(slots => slots.map(s => s.id === slot.id ? { ...s, timing } : s))} />
          </div>)}
          <GymButton disabled={busy || !!pending || extraSlots.length >= 11} onClick={() => setExtraSlots(slots => [...slots, { id: crypto.randomUUID(), timing: untimed() }])}>Add another occurrence per day</GymButton>
          {extraSlots.length > 0 && <p className="text-xs text-muted-foreground">Each selected day has {extraSlots.length + 1} separate occurrences. The occurrence limit includes all of them.</p>}
        </div>}
        <Notes
          keepVisible
          label="Event notes (optional)"
          maxLength={3000}
          value={draft.notes || ""}
          disabled={busy}
          onChange={(event) =>
            patch({
              notes: event.target.value,
            })
          }
        />
      </fieldset>
      {event && (
        <p className="text-sm font-medium">
          {event.completed ? "Completed" : "Planned"}
          {event.completedAt &&
            ` · ${new Date(event.completedAt).toLocaleString()}`}
        </p>
      )}
      {busy && (
        <p role="status" className="sr-only">
          {pending?.kind === "preset"
            ? "Saving event preset…"
            : pending?.kind === "save"
              ? "Saving event…"
              : "Updating event…"}
        </p>
      )}
      {error && (
        <p role="alert" className="gym-error">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <GymButton
          tone="blue"
          className={
            busy && pending?.kind === "save"
              ? "min-w-28 disabled:opacity-100"
              : "min-w-28"
          }
          disabled={busy}
          aria-busy={busy && pending?.kind === "save"}
          aria-label={
            busy && pending?.kind === "save" ? "Saving event" : undefined
          }
          onClick={() => void save()}
        >
          {busy && pending?.kind === "save" ? (
            <EventLoadingSpinner />
          ) : pending && !busy ? (
            "Retry save"
          ) : (
            repeat && !event ? "Save schedule" : "Save event"
          )}
        </GymButton>
        {event && onComplete && (
          <GymButton
            tone="orange"
            className={
              busy && !pending ? "min-w-28 disabled:opacity-100" : "min-w-28"
            }
            aria-busy={busy && !pending}
            aria-label={busy && !pending ? "Updating event" : undefined}
            disabled={busy || !!pending}
            onClick={async () => {
              setBusy(true);
              try {
                await onComplete();
                onClose();
              } catch (reason) {
                setError(
                  reason instanceof Error
                    ? reason.message
                    : "Save failed — retry",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && !pending ? (
              <EventLoadingSpinner />
            ) : event.completed ? (
              "Reopen"
            ) : (
              "Complete"
            )}
          </GymButton>
        )}
        {onPreset && !repeat && (
          <GymButton
            className={
              busy && pending?.kind === "preset"
                ? "min-w-[164px] disabled:opacity-100"
                : "min-w-[164px]"
            }
            aria-busy={busy && pending?.kind === "preset"}
            aria-label={
              busy && pending?.kind === "preset"
                ? "Saving event preset"
                : undefined
            }
            disabled={busy || !!pending || !draft.title.trim()}
            onClick={async () => {
              const checked = eventSchema.safeParse(draft);
              if (!checked.success) {
                setError(checked.error.issues[0].message);
                return;
              }
              const command = {
                event: checked.data as EventItem,
                date: day,
                kind: "preset" as const,
              };
              setPending(command);
              setBusy(true);
              setError("");
              try {
                await onPreset(command.event);
                onClose();
              } catch (reason) {
                setError(
                  reason instanceof Error
                    ? reason.message
                    : "Save failed — retry",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && pending?.kind === "preset" ? (
              <EventLoadingSpinner />
            ) : (
              "Use as event preset"
            )}
          </GymButton>
        )}
      </div>
    </GymDialog>
  );
}
