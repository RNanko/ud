"use client";
import { useState } from "react";
import { CalendarDays, Plus, Square } from "lucide-react";
import type { EventSchedule } from "@/lib/events/recurrence";
import { useAccountCalendar } from "@/hooks/use-account-calendar";
import { GymButton, GymDialog } from "../gym/GymUI";
import { EventLoadingSpinner } from "./EventCompletionCheckbox";

export default function EventSchedulesDialog({ schedules, onClose, onCreate, onStop }: {
  schedules: EventSchedule[]; onClose: () => void; onCreate: () => void;
  onStop: (schedule: EventSchedule, operationId: string) => Promise<void>;
}) {
  const calendar = useAccountCalendar();
  const [pending, setPending] = useState<{ schedule: EventSchedule; operation: string } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <GymDialog open title="Scheduled events" description="Manage the schedules for your repeating events." onClose={() => { if (!busy) onClose(); }}>
    <div className="space-y-3">
      {!schedules.length && <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">Choose weekdays for reading, walks, study, or another repeating activity.</p>}
      {schedules.map(s => <div key={s.id} data-event-tone={s.event.tone || "blue"} className="event-editor flex items-center gap-3 rounded-2xl border border-border p-4">
        <CalendarDays size={21} className="shrink-0 text-[var(--event-accent)]" aria-hidden="true" />
        <div className="min-w-0 flex-1"><p className="break-words font-semibold">{s.event.title}</p>
          <p className="text-sm text-muted-foreground">{s.days.map(d => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][d]).join(" · ")}{s.event.timing?.start ? ` · ${s.event.timing.start}` : ""}</p>
          <p className="text-xs text-muted-foreground">{calendar.dateLabel(s.start)}{s.end ? ` – ${calendar.dateLabel(s.end)}` : " · No end date"}{s.stoppedFrom ? ` · Stopped from ${calendar.dateLabel(s.stoppedFrom)}` : ""}</p>
        </div>
        {!s.stoppedFrom && <GymButton aria-label={`Stop ${s.event.title}`} title="Stop future occurrences" disabled={busy} onClick={() => { setError(""); setPending({ schedule: s, operation: crypto.randomUUID() }); }}><Square size={15} aria-hidden="true" /></GymButton>}
      </div>)}
    </div>
    <GymButton tone="blue" disabled={busy} onClick={onCreate}><Plus size={17} /> Create schedule</GymButton>
    {pending && <GymDialog open title={`Stop ${pending.schedule.event.title}?`} description="Stops new occurrences from tomorrow. Earlier dates and saved or completed occurrences are kept." onClose={() => { if (!busy) setPending(null); }}>
      {error && <p role="alert" className="gym-error">{error}</p>}
      <GymButton tone="orange" disabled={busy} onClick={async () => { setBusy(true); setError(""); try { await onStop(pending.schedule, pending.operation); setPending(null); } catch (e) { setError(e instanceof Error ? e.message : "Could not stop this schedule. Retry."); } finally { setBusy(false); } }}>{busy ? <EventLoadingSpinner /> : "Stop schedule"}</GymButton>
    </GymDialog>}
  </GymDialog>;
}
