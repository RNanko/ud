import type { Blueprint, CardioLog, ExerciseDefinition, GymData, SessionData, SessionExercise, SessionRecord, StrengthSet, Targets, Units } from "./types";
export const emptyBlueprint = (): Blueprint => ({
  name: "",
  notes: "",
  estimatedMinutes: null,
  exercises: []
});
// One empty entry is a logging row, not a recommended training volume.
export const defaultTargets = (): Targets => ({
  sets: 1,
  reps: null,
  loadKg: null,
  seconds: null,
  distanceKm: null,
  restSeconds: null
});
export const blankSet = (): StrengthSet => ({
  id: crypto.randomUUID(),
  loadKg: null,
  reps: null,
  seconds: null,
  completed: false,
  notes: ""
});
export function sessionExercise(definition: ExerciseDefinition, planned: Targets | null = null, id = crypto.randomUUID(), notes = ""): SessionExercise {
  return {
    id,
    definition: structuredClone(definition),
    planned: planned ? structuredClone(planned) : null,
    notes,
    skipped: false,
    sets: definition.tracking === "cardio" ? [] : Array.from({
      length: planned?.sets || 1
    }, blankSet),
    cardio: definition.tracking === "cardio" ? {
      seconds: null,
      distanceKm: null,
      completed: false,
      notes: ""
    } : null
  };
}
export function newSession(blueprint: Blueprint, date: string, timezone: string, logged: boolean, planned: boolean): SessionData {
  return {
    name: blueprint.name,
    notes: blueprint.notes,
    date,
    timezone,
    status: "active",
    logged,
    startedAt: logged ? null : new Date().toISOString(),
    finishedAt: null,
    restUntil: null,
    originalPlan: planned ? structuredClone(blueprint) : null,
    exercises: blueprint.exercises.map(exercise => ({...sessionExercise(exercise.definition, planned ? exercise.targets : null, exercise.id, planned && blueprint.preset ? "" : exercise.notes), ...(exercise.phase ? {phase: exercise.phase} : {})}))
  };
}
export function validStrengthSet(exercise: SessionExercise, set: StrengthSet) {
  return exercise.definition.tracking === "duration"
    ? set.seconds !== null && Number.isFinite(set.seconds) && set.seconds > 0 && set.seconds <= 604800
    : set.reps !== null && Number.isInteger(set.reps) && set.reps > 0 && set.reps <= 10000 && (!["weight-reps", "assistance-reps"].includes(exercise.definition.tracking) || set.loadKg !== null && Number.isFinite(set.loadKg) && set.loadKg >= 0 && set.loadKg <= 5000);
}
export function validCardioLog(cardio: CardioLog) {
  return cardio.seconds !== null && Number.isFinite(cardio.seconds) && cardio.seconds > 0 && cardio.seconds <= 604800 && (cardio.distanceKm === null || Number.isFinite(cardio.distanceKm) && cardio.distanceKm >= 0 && cardio.distanceKm <= 10000);
}
/** Confirm entered results only. Explicitly skipped work and original targets stay intact. */
export function confirmSessionEntries(data: SessionData): SessionData {
  return { ...data, exercises: data.exercises.map(exercise => exercise.skipped ? exercise : {
    ...exercise,
    sets: exercise.sets.map(set => ({ ...set, completed: validStrengthSet(exercise, set) })),
    cardio: exercise.cardio ? { ...exercise.cardio, completed: validCardioLog(exercise.cardio) } : null,
  }) };
}
export function sessionSummary(session: SessionData) {
  let sets = 0,
    timedSeconds = 0,
    exercises = 0,
    skipped = 0;
  const cardio: Record<string, {
    seconds: number;
    distanceKm: number;
    knownDistances: number;
    entries: number;
  }> = {};
  for (const exercise of session.exercises) {
    if (exercise.skipped) skipped++;
    const done = exercise.sets.filter(set => set.completed && !set.warmup);
    if (done.length || exercise.cardio?.completed) exercises++;
    if (exercise.definition.tracking === "duration") timedSeconds += done.reduce((sum, set) => sum + (set.seconds || 0), 0);else sets += done.length;
    if (exercise.cardio?.completed) {
      const activity = exercise.definition.activity || exercise.definition.name;
      const total = cardio[activity] ||= {
        seconds: 0,
        distanceKm: 0,
        knownDistances: 0,
        entries: 0
      };
      total.seconds += exercise.cardio.seconds || 0;
      total.entries++;
      if (exercise.cardio.distanceKm !== null) {
        total.distanceKm += exercise.cardio.distanceKm;
        total.knownDistances++;
      }
    }
  }
  return {
    sets,
    timedSeconds,
    exercises,
    skipped,
    cardio,
    plannedSets: session.originalPlan?.exercises.filter(exercise => exercise.definition.tracking !== "cardio").reduce((sum, exercise) => sum + exercise.targets.sets, 0) || 0
  };
}
export function weeklySummary(sessions: SessionRecord[], dates: string[]) {
  const completed = sessions.filter(session => session.data.status === "completed" && dates.includes(session.data.date));
  const result = {
    workouts: completed.length,
    sets: 0,
    cardioSeconds: 0,
    distance: {} as Record<string, {
      km: number;
      known: number;
      count: number;
    }>
  };
  for (const session of completed) {
    const summary = sessionSummary(session.data);
    result.sets += summary.sets;
    for (const [activity, cardio] of Object.entries(summary.cardio)) {
      result.cardioSeconds += cardio.seconds;
      const value = result.distance[activity] ||= {
        km: 0,
        known: 0,
        count: 0
      };
      value.km += cardio.distanceKm;
      value.known += cardio.knownDistances;
      value.count += cardio.entries;
    }
  }
  return result;
}
export function previousExercise(sessions: SessionRecord[], current: SessionRecord, exerciseId: string) {
  const cutoff = current.data.startedAt || current.data.finishedAt || new Date().toISOString();
  return [...sessions].filter(session => session.id !== current.id && session.data.status === "completed" && (session.data.date < current.data.date || session.data.date === current.data.date && !!session.data.finishedAt && session.data.finishedAt <= cutoff)).sort((a, b) => `${b.data.date}${b.data.finishedAt}`.localeCompare(`${a.data.date}${a.data.finishedAt}`)).flatMap(session => session.data.exercises.filter(exercise => exercise.definition.id === exerciseId && (exercise.sets.some(set => set.completed) || exercise.cardio?.completed)).map(exercise => ({
    exercise,
    date: session.data.date
  })))[0];
}
export const weightDisplay = (kg: number, units: Units) => units.weight === "lb" ? kg / 0.45359237 : kg;
export const weightStore = (value: number, units: Units) => units.weight === "lb" ? value * 0.45359237 : value;
export const distanceDisplay = (km: number, units: Units) => units.distance === "mi" ? km / 1.609344 : km;
export const distanceStore = (value: number, units: Units) => units.distance === "mi" ? value * 1.609344 : value;
export const decimalLabel = (value: number) => new Intl.NumberFormat("en", {
  maximumFractionDigits: 2
}).format(value);
export const durationLabel = (seconds: number) => seconds < 60 ? `${decimalLabel(seconds)} sec` : `${decimalLabel(seconds / 60)} min`;
export const speed = (seconds: number | null, km: number | null) => seconds && seconds > 0 && km && km > 0 ? km / (seconds / 3600) : null;
export const pace = (seconds: number | null, km: number | null) => seconds && seconds > 0 && km && km > 0 ? seconds / km : null;
export function dayItems(data: GymData, date: string) {
  return {
    plans: data.plans.filter(plan => plan.date === date && !data.sessions.some(session => session.planId === plan.id)),
    sessions: data.sessions.filter(session => session.data.date === date)
  };
}
