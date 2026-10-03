"use client";

import Link from "next/link";
import { Dumbbell } from "lucide-react";
import { useState } from "react";
import type { Blueprint, TemplateRecord } from "@/lib/gym/types";
import { untimed, type EventTiming } from "@/lib/planner-time";
import { dateLabel } from "@/lib/gym/dates";
import { GymButton, GymDialog } from "../gym/GymUI";
import FinanceSelect from "../finance/FinanceSelect";
import TimingFields from "./TimingFields";
import { blueprintSchema } from "@/lib/gym/validation";
export default function PlanWorkoutSheet({
  templates,
  date,
  onSchedule,
  onClose
}: {
  templates: TemplateRecord[];
  date: string;
  onSchedule: (data: Blueprint, date: string, id: string) => Promise<void>;
  onClose: () => void;
}) {
  const [chosen, setChosen] = useState(templates[0]?.id || ""),
    [timing, setTiming] = useState<EventTiming>(() => templates[0]?.data.timing || untimed());
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [pending, setPending] = useState<Blueprint | null>(null),
    [id] = useState(() => crypto.randomUUID());
  return <GymDialog open title="Plan workout" description={`Schedule a saved Gym routine on ${dateLabel(date)}. Times are optional.`} onClose={() => {
    if (!busy) onClose();
  }}>
    {templates.length ? <><FinanceSelect icon={Dumbbell} label="Workout template" title="Workout template" value={chosen} options={templates.map(template => ({
        value: template.id,
        label: template.data.name
      }))} onValueChange={value => {
        if (!pending) {
          setChosen(value);
          setTiming(templates.find(template => template.id === value)?.data.timing || untimed());
        }
      }} /><TimingFields value={timing} disabled={busy || !!pending} onChange={setTiming} /></> : <p className="text-muted-foreground">Build and save a workout in Gym first.</p>}
    {error && <p role="alert" className="gym-error">{error}</p>}
    <div className="flex flex-wrap gap-2"><GymButton tone="blue" disabled={busy || !chosen} onClick={async () => {
        const checked = blueprintSchema.safeParse(pending || {
          ...templates.find(template => template.id === chosen)!.data,
          timing
        });
        if (!checked.success) {
          setError(checked.error.issues[0].message);
          return;
        }
        const data = checked.data;
        setPending(data);
        setBusy(true);
        setError("");
        try {
          await onSchedule(data, date, id);
          onClose();
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : "Save failed — retry");
        } finally {
          setBusy(false);
        }
      }}>{busy ? "Saving…" : pending ? "Retry scheduling" : "Add workout"}</GymButton><Link href="/account/gym" className="gym-button gym-blue inline-flex min-h-11 items-center rounded-2xl border px-3 py-2 text-sm">Build a workout in Gym</Link></div>
  </GymDialog>;
}
