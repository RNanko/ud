"use client";
import { useEffect, useState } from "react";
import { getMomentumConflicts } from "@/lib/actions/momentum.actions";
import type { SourceRef } from "@/lib/momentum/types";
import type { EventTiming } from "@/lib/planner-time";
export default function ScheduleConflictNotice({ source, date, timing }: { source: SourceRef; date: string; timing?: EventTiming }) {
  const [result, setResult] = useState<Awaited<ReturnType<typeof getMomentumConflicts>> | null>(null), [failed, setFailed] = useState(false);
  const input = JSON.stringify({ source, date, timing });
  useEffect(() => { let valid = true; getMomentumConflicts(JSON.parse(input)).then(value => { if (valid) { setResult(value); setFailed(false); } }).catch(() => { if (valid) setFailed(true); }); return () => { valid = false; }; }, [input]);
  if (failed) return <p role="alert" className="text-sm text-muted-foreground">Schedule conflicts could not be checked. Review the destination day before confirming.</p>;
  if (!result || result.input !== input) return <p role="status" className="text-sm text-muted-foreground">Checking the destination schedule…</p>;
  return <div className="space-y-2 text-sm text-muted-foreground">{result.untimed ? <p>No clock time is set. Review the day’s commitments; an overlap cannot be inferred.</p> : <><p>{result.overlaps.length ? "Local-time overlap with:" : "No known timed overlap in the saved schedule."}</p>{result.overlaps.map(item => <p key={item} className="text-primary-minus">{item}</p>)}{!!result.uncertain.length && <><p>End time unknown; check these commitments:</p>{result.uncertain.map(item => <p key={item}>{item}</p>)}</>}</>}<p className="text-xs">This is a preview of currently saved plans. Optional clock times are preserved.</p></div>;
}
