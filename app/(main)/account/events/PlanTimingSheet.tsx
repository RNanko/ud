"use client";

import { useState } from "react";
import { untimed, timingSchema, type EventTiming } from "@/lib/planner-time";
import { weekDates } from "@/lib/gym/dates";
import type { PlanRecord } from "@/lib/gym/types";
import { GymButton, GymDialog, GymSelect } from "../gym/GymUI";
import TimingFields from "./TimingFields";
export default function PlanTimingSheet({
  plan,
  onSave,
  onClose
}: {
  plan: PlanRecord;
  onSave: (date: string, timing: EventTiming, mutationId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [date, setDate] = useState(plan.date),
    [timing, setTiming] = useState(plan.data.timing || untimed()),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState<{
      date: string;
      timing: EventTiming;
    } | null>(null),
    [mutationId] = useState(() => crypto.randomUUID());
  return <GymDialog open title={`${plan.data.name} · schedule`} description="Edits the planned date and optional time. Actual training dates, original session targets, and results remain unchanged." onClose={() => {
    if (!busy) onClose();
  }}>
    <GymSelect label="Planned date" value={date} options={weekDates(plan.date)} onChange={value => {
      if (!pending) setDate(value);
    }} />
    <TimingFields value={timing} disabled={busy || !!pending} onChange={setTiming} />
    {error && <p role="alert" className="gym-error">{error}</p>}
    <GymButton tone="blue" disabled={busy} onClick={async () => {
      const checked = timingSchema.safeParse(timing);
      if (!checked.success) {
        setError(checked.error.issues[0].message);
        return;
      }
      const command = pending || {
        date,
        timing: checked.data
      };
      setPending(command);
      setBusy(true);
      setError("");
      try {
        await onSave(command.date, command.timing, mutationId);
        onClose();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Save failed — retry");
      } finally {
        setBusy(false);
      }
    }}>{busy ? "Saving…" : pending ? "Retry schedule save" : "Save schedule"}</GymButton>
  </GymDialog>;
}
