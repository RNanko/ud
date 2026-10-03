"use client";

import { useMemo, useState } from "react";
import { Plus, Search, Layers } from "lucide-react";
import { categories, equipmentTypes, iconKeys, trackingTypes, type ExerciseDefinition } from "@/lib/gym/types";
import { definitionSchema } from "@/lib/gym/validation";
import { exerciseIconIds } from "@/lib/gym/icons";
import { Field, GymButton, GymDialog, GymSelect, Notes } from "./GymUI";
import ExerciseIcon, { ExerciseCategoryIcon } from "./ExerciseIcon";
import ExerciseCard, { trackingLabels } from "./ExerciseCard";
import { GymReveal } from "./GymMotion";
export { trackingLabels } from "./ExerciseCard";
export default function ExercisePicker({
  exercises,
  selected = [],
  recent = [],
  onToggle,
  onCustom
}: {
  exercises: ExerciseDefinition[];
  selected?: string[];
  recent?: string[];
  onToggle: (exercise: ExerciseDefinition) => void;
  onCustom: (exercise: ExerciseDefinition) => Promise<void>;
}) {
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [equipment, setEquipment] = useState(""),
    [onlyRecent, setOnlyRecent] = useState(false),
    [custom, setCustom] = useState(false),
    [detail, setDetail] = useState<ExerciseDefinition | null>(null);
  const visible = useMemo(() => exercises.filter(exercise => exercise.name.toLowerCase().includes(search.toLowerCase()) && (!category || exercise.category === category) && (!equipment || exercise.equipment === equipment) && (!onlyRecent || recent.includes(exercise.id))), [exercises, search, category, equipment, onlyRecent, recent]);
  return <section className="space-y-4" aria-label="Exercise library">
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-xl font-semibold">Choose exercises</h2>
      <GymButton onClick={() => setCustom(true)} aria-label="Create custom exercise">
        <Plus />Custom</GymButton>
    </div>
    <Field label="Search exercises" placeholder="Search by name" value={search} onChange={event => setSearch(event.target.value)} />
    <div className="gym-category-filters" role="group" aria-label="Body parts">
      <GymButton tone={!category ? "blue" : "neutral"} aria-pressed={!category} onClick={() => setCategory("")}><Layers size={24} />All</GymButton>
      {categories.map(item => <GymButton key={item} tone={category === item ? "blue" : "neutral"} aria-pressed={category === item} onClick={() => setCategory(item)}><ExerciseCategoryIcon category={item} />{item}</GymButton>)}
    </div>
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
      <GymSelect label="Equipment" value={equipment} options={["", ...equipmentTypes]} onChange={setEquipment} />
      <GymButton className="h-12" aria-pressed={onlyRecent} tone={onlyRecent ? "blue" : "neutral"} onClick={() => setOnlyRecent(!onlyRecent)}>Recent</GymButton>
    </div>
    <p className="text-sm text-muted-foreground">{visible.length} exercises · body parts and equipment are separate filters</p>
    <div className="gym-exercise-grid">{visible.map((exercise, index) => {
        const picked = selected.includes(exercise.id);
        return <GymReveal key={exercise.id} delay={index * 0.025}><ExerciseCard exercise={exercise} selected={picked} onToggle={() => onToggle(exercise)} onDetails={() => setDetail(exercise)} /></GymReveal>;
      })}{!visible.length && <div className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">
        <Search className="mx-auto mb-2" />{onlyRecent ? "No recently completed exercises match. Try all exercises." : "No matches. Change your filters or create a custom exercise."}</div>}</div>{detail && <GymDialog open title={detail.name} onClose={() => setDetail(null)} description={detail.description}>
      <div className="gym-exercise-detail">
        <div className="gym-art-stage"><ExerciseIcon icon={detail.icon} exerciseId={detail.id} size={160} /></div>
        <div className="space-y-2"><span className="gym-category-tag">{detail.category}</span><p className="font-medium">{detail.equipment}</p><p className="text-sm text-muted-foreground">{trackingLabels[detail.tracking]}</p></div>
      </div>
      <p className="text-sm">Primary: {detail.primaryMuscles.join(", ") || detail.category}<br />Secondary: {detail.secondaryMuscles.join(", ") || "None specified"}<br />{detail.loadConvention !== "none" && `Load convention: ${detail.loadConvention}`}</p>{detail.alternatives.length > 0 && <div>
        <h3 className="mb-2 font-medium">Compatible alternatives</h3>
        <div className="flex flex-wrap gap-2">{exercises.filter(exercise => detail.alternatives.includes(exercise.id)).map(exercise => <GymButton key={exercise.id} onClick={() => {
            onToggle(exercise);
            setDetail(null);
          }}>{exercise.name}</GymButton>)}</div>
      </div>}</GymDialog>}{custom && <CustomExercise onClose={() => setCustom(false)} onSave={onCustom} />}</section>;
}
function CustomExercise({
  onClose,
  onSave
}: {
  onClose: () => void;
  onSave: (exercise: ExerciseDefinition) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ExerciseDefinition>(() => ({
      id: crypto.randomUUID(),
      name: "",
      category: "Chest",
      primaryMuscles: [],
      secondaryMuscles: [],
      equipment: "Bodyweight",
      tracking: "reps",
      loadConvention: "none",
      icon: "bodyweight",
      description: "",
      alternatives: [],
      activity: null
    })),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const patch = (value: Partial<ExerciseDefinition>) => setDraft({
    ...draft,
    ...value
  });
  return <GymDialog open title="Custom exercise" onClose={() => {
    if (!busy) onClose();
  }} description="Choose how this exercise is measured. Saved records keep this configuration.">
    <Field label="Exercise name" value={draft.name} maxLength={120} onChange={event => patch({
      name: event.target.value
    })} />
    <GymSelect label="Category" value={draft.category} options={categories} onChange={value => patch({
      category: value as ExerciseDefinition["category"]
    })} />
    <GymSelect label="Equipment" value={draft.equipment} options={equipmentTypes} onChange={value => patch({
      equipment: value as ExerciseDefinition["equipment"]
    })} />
    <GymSelect label="Tracking type" value={trackingLabels[draft.tracking]} options={trackingTypes.map(value => trackingLabels[value])} onChange={value => {
      const tracking = trackingTypes.find(key => trackingLabels[key] === value)!;
      patch({
        tracking,
        loadConvention: tracking === "assistance-reps" ? "assistance" : tracking === "weight-reps" ? "total external load" : "none",
        activity: tracking === "cardio" ? draft.name || "Custom cardio" : null
      });
    }} />{draft.tracking === "weight-reps" && <GymSelect label="Load convention" value={draft.loadConvention} options={["total external load", "per dumbbell", "machine-displayed load"]} onChange={value => patch({
      loadConvention: value as ExerciseDefinition["loadConvention"]
    })} />}{draft.tracking === "cardio" && <Field label="Activity type" value={draft.activity || ""} onChange={event => patch({
      activity: event.target.value
    })} />}<GymSelect label="Equipment icon" value={draft.icon} options={iconKeys.filter(key => exerciseIconIds[key])} onChange={value => patch({
      icon: value as ExerciseDefinition["icon"]
    })} />
    <div className="gym-art-stage mx-auto"><ExerciseIcon icon={draft.icon} size={96} decorative={false} label={`${draft.icon} equipment preview`} /></div>
    <Notes label="Setup guidance (optional)" value={draft.description} onChange={event => patch({
      description: event.target.value
    })} />{error && <p role="alert" className="gym-error">{error}</p>}<GymButton tone="blue" disabled={busy} onClick={async () => {
      const checked = definitionSchema.safeParse({
        ...draft,
        primaryMuscles: [draft.category]
      });
      if (!checked.success) {
        setError(checked.error.issues[0].message);
        return;
      }
      setBusy(true);
      try {
        await onSave(checked.data);
        onClose();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Save failed — retry");
      } finally {
        setBusy(false);
      }
    }}>Save custom exercise</GymButton>
  </GymDialog>;
}
