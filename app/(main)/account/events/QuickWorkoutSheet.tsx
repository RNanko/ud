"use client";

import { useState } from "react";
import { completeGymWorkout } from "@/lib/actions/gym.actions";
import { sessionSummary } from "@/lib/gym/logic";
import type { PlannerItem } from "@/lib/events";
import type { SessionRecord } from "@/lib/gym/types";
import { Field, GymButton, GymDialog, Notes } from "../gym/GymUI";
export default function QuickWorkoutSheet({
  item,
  today,
  timezone,
  onClose,
  onSaved,
  onDetails
}: {
  item: PlannerItem;
  today: string;
  timezone: string;
  onClose: () => void;
  onSaved: (record: SessionRecord) => void;
  onDetails: (date: string, notes: string) => Promise<void>;
}) {
  const [date, setDate] = useState(item.session?.data.date || (item.date > today ? today : item.date));
  const [notes, setNotes] = useState(item.session?.data.notes || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [identity] = useState(() => ({
    id: crypto.randomUUID(),
    mutationId: crypto.randomUUID()
  }));
  const [pending, setPending] = useState<Parameters<typeof completeGymWorkout>[0] | null>(null);
  const [detailRequest, setDetailRequest] = useState<{
    date: string;
    notes: string;
  } | null>(null);
  const summary = item.session ? sessionSummary(item.session.data) : null;
  const save = async () => {
    if (!date || date > today) {
      setError("Choose a past or current actual training date");
      return;
    }
    const command = pending || {
      ...identity,
      sessionId: item.session?.id || null,
      planId: item.plan?.id || null,
      revision: item.session?.revision ?? null,
      date,
      timezone: item.session?.data.timezone || timezone,
      notes
    };
    setPending(command);
    setBusy(true);
    setError("");
    try {
      const result = await completeGymWorkout(command);
      if (!result.success) throw new Error(result.message);
      onSaved(result.session);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Save failed — retry");
    } finally {
      setBusy(false);
    }
  };
  return <GymDialog open title={`Complete ${item.title}`} description="Confirm training without guessing actual results. Planned targets stay separate." onClose={() => {
    if (!busy) onClose();
  }}>
    <Field label="Actual training date" type="date" max={today} value={date} disabled={busy || !!pending || !!detailRequest} onChange={event => setDate(event.target.value)} />
    <Notes label="Completion notes (optional)" maxLength={3000} value={notes} disabled={busy || !!pending || !!detailRequest} onChange={event => setNotes(event.target.value)} />
    <p className="rounded-2xl border border-border p-3 text-sm text-muted-foreground">{summary?.exercises ? `${summary.exercises} exercises have confirmed actual entries. Existing results will be preserved.` : "Completed — no details logged. This counts one confirmed workout, with no invented sets, time, distance, or volume."}</p>
    {error && <p role="alert" className="gym-error">{error}</p>}
    <div className="flex flex-wrap gap-2"><GymButton tone="orange" disabled={busy || !!detailRequest || !date || date > today} onClick={() => void save()}>{busy ? "Saving…" : pending ? "Retry completion" : "Confirm completion"}</GymButton><GymButton disabled={busy || !!pending} onClick={async () => {
        const command = detailRequest || {
          date,
          notes
        };
        setDetailRequest(command);
        setBusy(true);
        try {
          await onDetails(command.date, command.notes);
          onClose();
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : "Save failed — retry");
        } finally {
          setBusy(false);
        }
      }}>{detailRequest ? "Retry opening actual results" : "Enter actual results"}</GymButton></div>
  </GymDialog>;
}
