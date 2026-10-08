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
export default function EventEditor({
  event,
  date,
  dates,
  onClose,
  onSave,
  onComplete,
  onPreset,
}: {
  event?: EventItem;
  date: string;
  dates?: string[];
  onClose: () => void;
  onSave: (event: EventItem, date: string) => Promise<void>;
  onComplete?: () => Promise<void>;
  onPreset?: (event: EventItem) => Promise<void>;
}) {
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
    setPending(command);
    setBusy(true);
    setError("");
    try {
      if (command.kind === "preset") await onPreset?.(command.event);
      else await onSave(command.event, command.date);
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
      title={event ? "Event details" : "Create event"}
      description="The scheduled date stays independent of completion. A specific time is optional."
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <fieldset className="space-y-4" disabled={busy || !!pending}>
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
            "Save event"
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
        {onPreset && (
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
