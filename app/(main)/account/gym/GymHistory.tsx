"use client";

import { useState } from "react";
import { dateLabel } from "@/lib/gym/dates";
import type { SessionRecord, Units } from "@/lib/gym/types";
import { Field } from "./GymUI";
import { SessionCard } from "./WorkoutCard";
import { actualLabel } from "./ExerciseLogFields";
import FinanceSelect from "../finance/FinanceSelect";
import { Dumbbell } from "lucide-react";
export default function GymHistory({
  sessions,
  units,
  onOpen,
  onRemove
}: {
  sessions: SessionRecord[];
  units: Units;
  onOpen: (session: SessionRecord) => void;
  onRemove: (id: string) => void;
}) {
  const [search, setSearch] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [exercise, setExercise] = useState("");
  const completed = sessions.filter(session => session.data.status === "completed"),
    definitions = [...new Map(completed.flatMap(session => session.data.exercises.map(item => [item.definition.id, item.definition] as const))).values()];
  const chosen = definitions.find(definition => definition.id === exercise);
  const visible = [...completed].filter(session => session.data.name.toLowerCase().includes(search.toLowerCase()) && (!from || session.data.date >= from) && (!to || session.data.date <= to) && (!exercise || session.data.exercises.some(item => item.definition.id === exercise && (item.cardio?.completed || item.sets.some(set => set.completed))))).sort((a, b) => b.data.date.localeCompare(a.data.date));
  return <section className="space-y-5">
    <div>
      <h2 className="text-xl font-semibold">Workout history & progress</h2>
      <p className="mt-1 text-sm text-muted-foreground">Only confirmed actual results appear here. Choose an exercise to compare its recorded performance.</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Search workouts" value={search} onChange={event => setSearch(event.target.value)} />
      <div className="grid min-w-0 gap-2 text-sm font-medium"><span>Exercise performance</span><FinanceSelect label="Exercise performance" title="Exercise performance" icon={Dumbbell} value={exercise} options={[{
        value: "",
        label: "All exercises"
      }, ...definitions.map(definition => ({
        value: definition.id,
        label: `${definition.name} · ${definition.equipment}`
      }))]} onValueChange={setExercise} className="gym-input" /></div>
      <Field label="From date" type="date" value={from} onChange={event => setFrom(event.target.value)} />
      <Field label="To date" type="date" value={to} onChange={event => setTo(event.target.value)} />
    </div>{exercise && <div className="rounded-3xl border border-border bg-card/20 p-4">
      <h3 className="mb-3 font-semibold">{chosen?.name} · Actual performance</h3>{visible.flatMap(session => session.data.exercises.filter(item => item.definition.id === exercise).map(item => <div key={`${session.id}:${item.id}`} className="border-t border-border py-3 text-sm">
        <p className="font-medium">{dateLabel(session.data.date)} · {session.data.name}</p>
        <p className="mt-1 gym-error">{actualLabel(item, units)}</p>
        <p className="text-xs text-muted-foreground">{item.definition.loadConvention === "none" ? item.definition.activity || item.definition.tracking : item.definition.loadConvention}</p>
      </div>))}<p className="mt-2 text-xs text-muted-foreground">Assistance is shown as assistance. Activity types are kept separate; no recovery scores or automatic load prescriptions are inferred.</p>
    </div>}<div className="grid gap-4 xl:grid-cols-2">{visible.map(session => <SessionCard key={session.id} session={session} units={units} onOpen={() => onOpen(session)} onRemove={() => onRemove(session.id)} onRemovePlan={() => undefined} />)}</div>{!visible.length && <p className="rounded-3xl border border-dashed p-8 text-center text-muted-foreground">No completed workouts match yet. Log a workout or finish an active session to see your results.</p>}</section>;
}
