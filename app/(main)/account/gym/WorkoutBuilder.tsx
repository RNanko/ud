"use client";

import { useId, useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2, Save, Play, CalendarPlus } from "lucide-react";
import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, closestCenter } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GymReveal } from "./GymMotion";
import TimingFields from "../events/TimingFields";
import { untimed } from "@/lib/planner-time";
import { defaultTargets, distanceDisplay, distanceStore, weightDisplay, weightStore } from "@/lib/gym/logic";
import { suggestWorkoutName } from "@/lib/gym/workout-name";
import { blueprintSchema } from "@/lib/gym/validation";
import { dateLabel, weekDates } from "@/lib/gym/dates";
import type { Blueprint, ExerciseDefinition, Targets, Units, WorkoutExercise } from "@/lib/gym/types";
import ExercisePicker from "./ExercisePicker";
import ExerciseIcon from "./ExerciseIcon";
import { Field, GymButton, GymDialog, Notes, NumberField } from "./GymUI";
export function ScheduleDialog({
  selectedDate,
  onSave,
  onClose
}: {
  selectedDate: string;
  onSave: (dates: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const [dates, setDates] = useState([selectedDate]),
    [date, setDate] = useState(selectedDate),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return <GymDialog open title="Add to week" description="Each date gets its own copy of these planned targets." onClose={() => {
    if (!busy) onClose();
  }}>
    <div className="flex flex-wrap gap-2">{weekDates(selectedDate).map(day => <GymButton key={day} aria-pressed={dates.includes(day)} tone={dates.includes(day) ? "blue" : "neutral"} onClick={() => setDates(dates.includes(day) ? dates.filter(value => value !== day) : [...dates, day])}>{dateLabel(day, {
          weekday: "short",
          day: "numeric"
        })}</GymButton>)}</div>
    <Field label="Another date" type="date" value={date} onChange={event => setDate(event.target.value)} />
    <GymButton onClick={() => {
      if (date && !dates.includes(date)) setDates([...dates, date]);
    }}>
      <Plus />Add date</GymButton>
    <div className="flex flex-wrap gap-2">{[...dates].sort().map(day => <GymButton key={day} aria-label={`Remove date ${day}`} onClick={() => setDates(dates.filter(value => value !== day))}>{dateLabel(day)} ×</GymButton>)}</div>{error && <p role="alert" className="gym-error">{error}</p>}<GymButton tone="blue" disabled={busy || !dates.length} onClick={async () => {
      setBusy(true);
      try {
        await onSave(dates);
        onClose();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Save failed — retry");
      } finally {
        setBusy(false);
      }
    }}>
      <CalendarPlus />{busy ? "Saving…" : `Schedule ${dates.length} workout${dates.length === 1 ? "" : "s"}`}</GymButton>
  </GymDialog>;
}
export default function WorkoutBuilder({
  initial,
  exercises,
  recent,
  units: incomingUnits,
  selectedDate,
  today,
  mode = "build",
  editingPlan = false,
  onCustom,
  onSave,
  onSchedule,
  onStart
}: {
  initial: Blueprint;
  exercises: ExerciseDefinition[];
  recent: string[];
  units: Units;
  selectedDate: string;
  today: string;
  mode?: "build" | "log";
  editingPlan?: boolean;
  onCustom: (exercise: ExerciseDefinition) => Promise<void>;
  onSave: (data: Blueprint) => Promise<void>;
  onSchedule: (data: Blueprint, dates: string[]) => Promise<void>;
  onStart: (data: Blueprint, date: string, logged: boolean) => Promise<void>;
}) {
  const [units]=useState(incomingUnits);
  const [draft, setDraft] = useState(() => ({ ...initial, name: initial.name.trim() ? initial.name : suggestWorkoutName(initial.exercises.map(exercise => exercise.definition)) })),
    [automaticName, setAutomaticName] = useState(!initial.name.trim()),
    [review, setReview] = useState(false),
    [schedule, setSchedule] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [date, setDate] = useState(selectedDate > today ? today : selectedDate);
  const dndId = useId(),
    sensors = useSensors(useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    }), useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    }));
  const patchExercise = (id: string, patch: Partial<WorkoutExercise>) => setDraft(current => ({
    ...current,
    exercises: current.exercises.map(exercise => exercise.id === id ? {
      ...exercise,
      ...patch
    } : exercise)
  }));
  const toggle = (definition: ExerciseDefinition) => setDraft(current => {
    const exercises = current.exercises.some(exercise => exercise.definition.id === definition.id) ? current.exercises.filter(exercise => exercise.definition.id !== definition.id) : [...current.exercises, {
      id: crypto.randomUUID(),
      definition: structuredClone(definition),
      targets: defaultTargets(definition),
      notes: ""
    }];
    return { ...current, exercises, name: automaticName ? suggestWorkoutName(exercises.map(exercise => exercise.definition)) : current.name };
  });
  const move = (index: number, offset: number) => setDraft(current => ({
    ...current,
    exercises: arrayMove(current.exercises, index, index + offset)
  }));
  const run = async (action: (data: Blueprint) => Promise<void>) => {
    const checked = blueprintSchema.safeParse(draft);
    if (!checked.success) {
      setError(checked.error.issues[0].message);
      setReview(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await action(checked.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Save failed — retry");
    } finally {
      setBusy(false);
    }
  };
  const current = <section className="space-y-4" aria-label="Current workout">
    <h2 className="text-xl font-semibold">{mode === "log" ? "Completed workout details" : editingPlan ? "Edit planned workout" : "Your workout"}</h2>
    <Field label="Workout name" placeholder="Choose exercises for a suggested name" value={draft.name} maxLength={120} onChange={event => {
      setAutomaticName(!event.target.value.trim());
      setDraft({ ...draft, name: event.target.value });
    }} />
    {draft.exercises.length > 0 && (automaticName ? <p className="text-xs text-muted-foreground">Named from your selected exercises. You can edit it.</p> : <GymButton className="text-xs" onClick={() => {
      setAutomaticName(true);
      setDraft(current => ({ ...current, name: suggestWorkoutName(current.exercises.map(exercise => exercise.definition)) }));
    }}>Use suggested name</GymButton>)}
    <Notes label="Workout notes (optional)" value={draft.notes} onChange={event => setDraft({
      ...draft,
      notes: event.target.value
    })} />{mode === "log" ? <Field label="Workout date" type="date" max={today} value={date} onChange={event => setDate(event.target.value)} /> : <NumberField label="Estimated duration (minutes, optional)" value={draft.estimatedMinutes} onChange={estimatedMinutes => setDraft({
      ...draft,
      estimatedMinutes
    })} />}{mode !== "log" && <TimingFields value={draft.timing || untimed()} onChange={timing => setDraft(current => ({ ...current, timing }))} />}<DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={({
      active,
      over
    }) => {
      if (over && active.id !== over.id) setDraft(current => ({
        ...current,
        exercises: arrayMove(current.exercises, current.exercises.findIndex(exercise => exercise.id === active.id), current.exercises.findIndex(exercise => exercise.id === over.id))
      }));
    }}>
      <SortableContext items={draft.exercises.map(exercise => exercise.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">{draft.exercises.map((exercise, index) => <GymReveal key={exercise.id}><SelectedExercise exercise={exercise} index={index} total={draft.exercises.length} units={units} targets={mode !== "log"} onPatch={patch => patchExercise(exercise.id, patch)} onMove={offset => move(index, offset)} onRemove={() => toggle(exercise.definition)} /></GymReveal>)}</div>
      </SortableContext>
    </DndContext>{!draft.exercises.length && <p className="rounded-2xl border border-dashed p-6 text-muted-foreground">Choose exercises from the library to begin.</p>}{error && <p role="alert" className="gym-error">{error}</p>}<div className="flex flex-wrap gap-2">{mode === "log" ? <GymButton tone="orange" disabled={busy || !date || date > today} onClick={() => run(async data => {
        await onStart(data, date, true);
        setReview(false);
      })}>
        <Plus />Enter actual results</GymButton> : <>
        <GymButton tone="blue" disabled={busy} onClick={() => run(onSave)}>
          <Save />{editingPlan ? "Save plan changes" : "Save workout"}</GymButton>
        <GymButton disabled={busy} onClick={() => run(async () => {
          setSchedule(true);
        })}>
          <CalendarPlus />Add to week</GymButton>
        <GymButton tone="orange" disabled={busy} onClick={() => run(async data => {
          await onStart(data, today, false);
          setReview(false);
        })}>
          <Play />Start now</GymButton>
      </>}</div>
    <p className="text-xs text-muted-foreground">{mode === "log" ? "Next, enter what you actually did. No live timer is required." : "Targets are saved separately from actual results. Saving a template does not schedule it."}</p>
  </section>;
  return <div className="grid items-start gap-6 pb-24 lg:grid-cols-2 lg:pb-0">
    <ExercisePicker exercises={exercises} selected={draft.exercises.map(exercise => exercise.definition.id)} recent={recent} onToggle={toggle} onCustom={onCustom} />
    {!review && <div className="hidden rounded-3xl border border-border bg-card/20 p-5 lg:block">{current}</div>}
    <div className="fixed bottom-3 left-3 right-3 z-30 flex items-center justify-between gap-3 rounded-2xl border border-border bg-background p-3 shadow-xl lg:hidden">
      <span className="font-semibold">{draft.exercises.length} selected</span>
      <GymButton tone="blue" onClick={() => setReview(true)}>Review workout</GymButton>
    </div>{review && <GymDialog open full title="Review workout" onClose={() => setReview(false)}>{current}</GymDialog>}{schedule && <ScheduleDialog selectedDate={selectedDate} onClose={() => setSchedule(false)} onSave={async dates => {
      const checked = blueprintSchema.parse(draft);
      await onSchedule(checked, dates);
      setReview(false);
    }} />}</div>;
}
function SelectedExercise({
  exercise,
  index,
  total,
  units,
  targets,
  onPatch,
  onMove,
  onRemove
}: {
  exercise: WorkoutExercise;
  index: number;
  total: number;
  units: Units;
  targets: boolean;
  onPatch: (patch: Partial<WorkoutExercise>) => void;
  onMove: (offset: number) => void;
  onRemove: () => void;
}) {
  const {
    setNodeRef,
    transform,
    transition,
    isDragging,
    attributes,
    listeners
  } = useSortable({
    id: exercise.id
  });
  const patch = (change: Partial<Targets>) => onPatch({
    targets: {
      ...exercise.targets,
      ...change
    }
  });
  const tracking = exercise.definition.tracking;
  return <article ref={setNodeRef} style={{
    transform: CSS.Transform.toString(transform),
    transition: transition,
    opacity: isDragging ? 0.5 : 1
  }} className="gym-tile rounded-2xl border border-border bg-background p-3">
    <div className="flex flex-wrap items-center gap-2">
      <div className="gym-art-stage gym-art-compact"><ExerciseIcon icon={exercise.definition.icon} exerciseId={exercise.definition.id} size={64} /></div>
      <h3 className="min-w-0 flex-1 font-semibold">{exercise.definition.name}</h3>
      <GymButton {...attributes} {...listeners} aria-label={`Drag ${exercise.definition.name}`} className="touch-none px-2">
        <GripVertical />
      </GymButton>
    </div>
    <div className="my-2 flex gap-2">
      <GymButton aria-label={`Move ${exercise.definition.name} up`} disabled={index === 0} onClick={() => onMove(-1)}>
        <ArrowUp />
      </GymButton>
      <GymButton aria-label={`Move ${exercise.definition.name} down`} disabled={index === total - 1} onClick={() => onMove(1)}>
        <ArrowDown />
      </GymButton>
      <GymButton aria-label={`Remove ${exercise.definition.name} from workout`} onClick={onRemove}>
        <Trash2 />
      </GymButton>
    </div>{targets && <>
      <p className="mb-2 text-xs text-muted-foreground">Planned targets · {exercise.definition.loadConvention === "none" ? exercise.definition.equipment : exercise.definition.loadConvention}</p>
      <div className="grid grid-cols-2 gap-3">{tracking !== "cardio" && <NumberField label="Sets" value={exercise.targets.sets} step={1} min={1} max={30} onChange={value => patch({
          sets: value ?? 1
        })} />}{!["duration", "cardio"].includes(tracking) && <NumberField label="Repetitions" value={exercise.targets.reps} min={1} step={1} onChange={reps => patch({
          reps
        })} />}{["weight-reps", "assistance-reps"].includes(tracking) && <NumberField label={`${tracking === "assistance-reps" ? "Assistance" : "Target load"} (${units.weight}, optional)`} value={exercise.targets.loadKg === null ? null : weightDisplay(exercise.targets.loadKg, units)} onChange={value => patch({
          loadKg: value === null ? null : weightStore(value, units)
        })} />}{["duration", "cardio"].includes(tracking) && <NumberField label={tracking === "cardio" ? "Duration (minutes)" : "Duration (seconds)"} value={exercise.targets.seconds === null ? null : exercise.targets.seconds / (tracking === "cardio" ? 60 : 1)} onChange={value => patch({
          seconds: value === null ? null : value * (tracking === "cardio" ? 60 : 1)
        })} />}{tracking === "cardio" && <NumberField label={`Distance (${units.distance}, optional)`} value={exercise.targets.distanceKm === null ? null : distanceDisplay(exercise.targets.distanceKm, units)} onChange={value => patch({
          distanceKm: value === null ? null : distanceStore(value, units)
        })} />}{tracking !== "cardio" && <NumberField label="Rest (seconds, optional)" value={exercise.targets.restSeconds} onChange={restSeconds => patch({
          restSeconds
        })} />}</div>
    </>}<div className="mt-3">
      <Notes label="Exercise notes (optional)" value={exercise.notes} onChange={event => onPatch({
        notes: event.target.value
      })} />
    </div>
  </article>;
}
