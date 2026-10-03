import recipes from "./strength-presets.json";
import { exerciseFor } from "./catalogue";
import { defaultTargets, sessionExercise } from "./logic";
import type { Blueprint, SessionData, SessionRecord, WorkoutExercise } from "./types";

// Retain historical profile identifiers, without assigning numeric targets.
export type Profile = "foundation" | "regular" | "advanced" | "expert";
export type Role = "M" | "S" | "A" | "C";
export type RecipeBlock = { exercise: string; role: Role; perSide: boolean; timed: boolean };
export type StrengthPreset = { id: string; version: number; name: string; group: string; reviewStatus: "draft"; blocks: RecipeBlock[]; featured: boolean };
export const strengthPresets = recipes as StrengthPreset[];
export type Segment = { exercise: string; minutes: number; effort: string };
export type CardioPreset = { id: string; name: string; variants: number[]; featured?: boolean; experienced?: boolean; segments: (variant: number, jog: boolean) => Segment[] };
const segment = (exercise: string, minutes: number, effort: string): Segment => ({ exercise, minutes, effort });
const steady = (exercise: string, total: number, edge = 5) => [segment(exercise, edge, "easy"), segment(exercise, total - edge * 2, "comfortable steady"), segment(exercise, edge, "easy")];
export const cardioPresets: CardioPreset[] = [
  { id: "cardio-walk", name: "Steady Walk", variants: [20, 30, 40], featured: true, segments: minutes => steady("treadmill_walking", minutes) },
  { id: "cardio-bike", name: "Steady Bike", variants: [20, 30, 45], featured: true, segments: minutes => steady("upright_bike_cycling", minutes) },
  { id: "cardio-elliptical", name: "Elliptical Endurance", variants: [20, 30, 40], segments: minutes => steady("elliptical_training", minutes) },
  { id: "cardio-row", name: "Steady Row", variants: [15, 20, 30], segments: minutes => steady("air_rowing", minutes, 3) },
  { id: "cardio-walk-run", name: "Walk / Run Introduction", variants: [20, 24, 30], segments: (minutes, jog) => [segment("treadmill_walking", 5, "easy"), ...Array.from({ length: (minutes - 10) / 2 }, () => [segment(jog ? "treadmill_running" : "treadmill_walking", 1, jog ? "comfortable jog" : "comfortable walk"), segment("treadmill_walking", 1, "easy")]).flat(), segment("treadmill_walking", 5, "easy")] },
  { id: "cardio-intervals", name: "Controlled Bike Intervals", variants: [28, 34], experienced: true, segments: minutes => [segment("upright_bike_cycling", 5, "easy"), ...Array.from({ length: (minutes - 10) / 3 }, () => [segment("upright_bike_cycling", 1, "controlled brisk"), segment("upright_bike_cycling", 2, "easy")]).flat(), segment("upright_bike_cycling", 5, "easy")] },
];
export const cardioAddons = [
  { id: "walk", name: "Easy Walk", exercise: "treadmill_walking" },
  { id: "bike", name: "Easy Bike", exercise: "upright_bike_cycling" },
  { id: "elliptical", name: "Easy Elliptical", exercise: "elliptical_training" },
] as const;
export type Addon = "none" | typeof cardioAddons[number]["id"];
export function estimateMinutes(exercises: WorkoutExercise[]) {
  if (!exercises.length || exercises.some(item => ["duration", "cardio"].includes(item.definition.tracking) ? item.targets.seconds === null : item.targets.reps === null && !item.targets.repRange)) return null;
  const seconds = exercises.reduce((total, item) => {
    if (item.definition.tracking === "cardio") return total + (item.targets.seconds || 0) + 30;
    const perSide = item.definition.perSide ? 2 : 1;
    const work = item.definition.tracking === "duration" ? item.targets.seconds || 0 : (item.targets.repRange?.[1] || item.targets.reps || 0) * 3;
    return total + work * perSide * item.targets.sets + (item.targets.sets - 1) * (item.targets.restSeconds || 0) + 60;
  }, 0);
  return Math.ceil(seconds / 60);
}
function cardioExercises(segments: Segment[], phase: WorkoutExercise["phase"]): WorkoutExercise[] {
  // Aggregate actual logging per activity; retain the exact segment order in notes.
  const slugs = [...new Set(segments.map(item => item.exercise))];
  const sequence = segments.map((item, index) => `${index + 1}. ${item.minutes} min ${item.effort} · ${exerciseFor(item.exercise).name}`).join("\n");
  return slugs.map(slug => ({ id: crypto.randomUUID(), definition: structuredClone(exerciseFor(slug)), phase,
    targets: { sets: 1, reps: null, loadKg: null, seconds: segments.filter(item => item.exercise === slug).reduce((total, item) => total + item.minutes * 60, 0), distanceKm: null, restSeconds: null },
    notes: `Planned sequence (total time includes opening and closing easy segments):\n${sequence}\nRecord only actual time for this activity. Distance stays unknown unless measured.` }));
}
export function appendCardio(draft: Blueprint, addon: Addon, minutes = 10): Blueprint {
  const exercises = draft.exercises.filter(item => item.phase !== "cardio");
  const definition = cardioAddons.find(item => item.id === addon);
  if (definition) exercises.push(...cardioExercises(steady(definition.exercise, minutes, 2), "cardio"));
  return { ...draft, exercises, estimatedMinutes: estimateMinutes(exercises) };
}
export function applySessionCardio(data: SessionData, addon: Addon, minutes = 10): SessionData {
  if (data.status !== "active") throw new Error("Reopen the workout before changing its cardio phase.");
  if (![10, 15, 20].includes(minutes)) throw new Error("Choose 10, 15 or 20 minutes.");
  if (addon === "none") return {...data, exercises: data.exercises.map(item => item.phase === "cardio" ? {...item, skipped: true} : item)};
  const proposed = appendCardio({name: data.name, notes: "", estimatedMinutes: null, exercises: []}, addon, minutes).exercises[0];
  if (!proposed) throw new Error("Choose an available easy cardio option.");
  const existing = data.exercises.find(item => item.phase === "cardio" && !item.skipped && item.definition.id === proposed.definition.id);
  if (!existing && data.exercises.length >= 50) throw new Error("A session can contain up to 50 exercises.");
  const exercises = data.exercises.map(item => item.phase !== "cardio" ? item : item.id === existing?.id ? {...item, planned: proposed.targets} : {...item, skipped: true});
  if (!existing) exercises.push({...sessionExercise(proposed.definition, proposed.targets), phase: "cardio"});
  return {...data, exercises};
}
export function resolveStrength(preset: StrengthPreset, profile: Profile, compact = false): Blueprint {
  const blocks = compact ? preset.blocks.filter(block => block.role === "M" || block.role === "S" || block.role === "C") : preset.blocks;
  const exercises: WorkoutExercise[] = blocks.map(block => {
      const definition = structuredClone(exerciseFor(block.exercise));
      if (block.perSide) definition.perSide = true;
      return { id: crypto.randomUUID(), definition, targets: defaultTargets(), phase: "strength" as const, notes: "" };
    });
  return { name: preset.name, preset: { id: preset.id, version: preset.version, profile, reviewStatus: "draft" },
    notes: "Exercise selection only. Set your own sets, repetitions, weights and rest. Consult a qualified trainer for technique and suitable targets; seek specialist advice for individual health concerns.",
    exercises, estimatedMinutes: null };
}
export function resolveCardio(preset: CardioPreset, minutes: number, jog = false): Blueprint {
  if (!preset.variants.includes(minutes) && !(minutes > 0 && minutes < Math.min(...preset.variants))) throw new Error("Choose an available duration or a shorter manageable duration");
  const segments = minutes < Math.min(...preset.variants) ? [segment(preset.id === "cardio-walk-run" ? "treadmill_walking" : preset.segments(preset.variants[0], false)[0].exercise, minutes, "easy, including a gradual start and finish")] : preset.segments(minutes, jog);
  const exercises = cardioExercises(segments, "cardio");
  return { name: preset.name, preset: {id: preset.id, version: 1, profile: "foundation", reviewStatus: "draft"},
    notes: "Development preview · not coach reviewed. Choose a manageable duration independently from lifting experience. Moderate effort: you can talk but not sing; this is not a measured heart-rate zone. Consult a qualified trainer; ask a clinician about individual health concerns. Rowing requires familiar technique.", exercises, estimatedMinutes: estimateMinutes(exercises) };
}
export function substitute(item: WorkoutExercise, slug: string): WorkoutExercise {
  const definition = exerciseFor(slug);
  if (!item.definition.alternatives.includes(definition.id)) throw new Error("No configured compatible alternative");
  const targets = { ...defaultTargets(), sets: item.targets.sets, apparatus: null };
  return { ...item, definition: structuredClone(definition), targets, notes: `${item.notes}\nExercise replaced. Enter your own targets for this exercise; previous weights and repetitions have been cleared.` };
}
export function previousWeights(item: WorkoutExercise, history: SessionRecord[], today: string) {
  const before = Date.parse(`${today}T12:00:00Z`);
  const machine = ["Machine", "Cable"].includes(item.definition.equipment);
  const matches = history.filter(record => record.data.status === "completed" && record.data.completionMode !== "confirmation" && record.data.date <= today)
    .sort((a, b) => b.data.date.localeCompare(a.data.date) || (b.data.finishedAt || "").localeCompare(a.data.finishedAt || ""))
    .flatMap(record => record.data.exercises.filter(exercise => exercise.definition.id === item.definition.id && exercise.definition.loadConvention === item.definition.loadConvention).map(exercise => ({record, exercise})));
  const previous = matches[0];
  if (!previous) return null;
  const {record, exercise} = previous, sets = exercise.sets.filter(set => set.completed && !set.warmup);
  const range = item.targets.repRange || [item.targets.reps || 0, item.targets.reps || 0];
  const compatible = !exercise.skipped && sets.length === item.targets.sets && sets.every(set => set.loadKg !== null && set.reps !== null && set.reps >= range[0] && set.reps <= range[1])
    && (!machine || !!item.targets.apparatus && exercise.planned?.apparatus === item.targets.apparatus)
    && before - Date.parse(`${record.data.date}T12:00:00Z`) <= 42 * 86400000;
  return {date: record.data.date, loads: sets.map(set => set.loadKg), compatible, reason: compatible ? "Matching exercise, load convention, apparatus and set/repetition structure. Review before using." : "Reference only: age, apparatus, missing results or set/repetition structure does not match."};
}
