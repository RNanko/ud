"use client";

import { Check, Dumbbell, History, Play } from "lucide-react";
import type { PlannerItem } from "@/lib/events";
import { workoutHistory, workoutLink } from "@/lib/gym/event-links";
import { dateLabel } from "@/lib/gym/dates";
import { sessionSummary } from "@/lib/gym/logic";
import type { SessionRecord, Units } from "@/lib/gym/types";
import { actualLabel, plannedLabel } from "../gym/ExerciseLogFields";
import { GymButton, GymDialog } from "../gym/GymUI";
import WorkoutLinkedEvents from "../gym/WorkoutLinkedEvents";

export default function WorkoutDetailsSheet({ item, history, units, onClose, onSession, onStart, onSchedule }: {
  item: PlannerItem;
  history: SessionRecord[];
  units: Units;
  onClose: () => void;
  onSession: (session: SessionRecord) => void;
  onStart: () => void;
  onSchedule: () => void;
}) {
  const workout = item.session?.data || item.plan?.data;
  if (!workout) return null;
  const related = workoutHistory(item, history), link = workoutLink(item);
  return <GymDialog open full title={item.title} description={`Training · ${dateLabel(item.date)}`} onClose={onClose}>
    <section aria-label="Workout exercises" className="space-y-3">
      <h3 className="flex items-center gap-2 font-semibold"><Dumbbell size={18} />{workout.exercises.length} exercises</h3>
      {!workout.exercises.length && <p className="text-sm text-muted-foreground">No exercises were added to this workout.</p>}
      {workout.exercises.map((exercise, index) => <article key={exercise.id} className="rounded-2xl border border-border bg-card/20 p-4">
        <div className="flex items-start gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">{index + 1}</span>
          <div className="min-w-0"><h4 className="font-semibold">{exercise.definition.name}</h4><p className="mt-1 text-xs text-muted-foreground">{exercise.definition.category} · {exercise.definition.equipment}</p>
            <p className="mt-2 text-sm text-muted-foreground">{"sets" in exercise ? actualLabel(exercise, units) : plannedLabel({ ...exercise, planned: exercise.targets, sets: [], cardio: null, skipped: false }, units)}</p>
            {exercise.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{exercise.notes}</p>}
          </div>
        </div>
      </article>)}
      {workout.notes && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{workout.notes}</p>}
    </section>
    {link && <WorkoutLinkedEvents kind={link.kind} id={link.id} />}
    <section aria-label="Workout history" className="space-y-3">
      <h3 className="flex items-center gap-2 font-semibold"><History size={18} />Workout history</h3>
      {!related.length && <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">No finished workouts in this routine yet.</p>}
      <ul className="space-y-2">{related.map(session => {
        const summary = sessionSummary(session.data);
        return <li key={session.id}><button type="button" onClick={() => onSession(session)} className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-border bg-card/20 p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-[var(--gym-blue)]">
          <Check size={18} className="shrink-0 text-[var(--gym-blue)]" />
          <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{dateLabel(session.data.date)}{session.id === item.session?.id && " · This workout"}</span><span className="block text-xs text-muted-foreground">{summary.exercises ? `${summary.exercises} exercises · ${summary.sets} sets` : "Finished without detailed results"}</span></span>
          <span className="text-xs text-[var(--gym-blue)]">View results</span>
        </button></li>;
      })}</ul>
    </section>
    <footer className="flex flex-wrap gap-2 border-t border-border pt-4">
      {item.session ? <GymButton tone="blue" onClick={() => onSession(item.session!)}>{item.completed ? "Open recorded results" : "Continue workout"}</GymButton> : <GymButton tone="blue" onClick={onStart}><Play size={16} />Start workout</GymButton>}
      {item.plan && <GymButton onClick={onSchedule}>Edit schedule</GymButton>}
    </footer>
  </GymDialog>;
}
