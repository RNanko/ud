"use client";

import { useEffect, useState } from "react";
import { GymReveal } from "./GymMotion";
import { Check, Plus, Timer, Copy, ArrowLeftRight } from "lucide-react";
import { useGymSession } from "@/hooks/use-gym-session";
import { previousExercise, sessionExercise, sessionSummary, confirmSessionEntries } from "@/lib/gym/logic";
import { sessionSchema } from "@/lib/gym/validation";
import { getGymData, reopenGymWorkout } from "@/lib/actions/gym.actions";
import { dateLabel } from "@/lib/gym/dates";
import type { ExerciseDefinition, SessionData, SessionExercise, SessionRecord, Units } from "@/lib/gym/types";
import { Confirm, Field, GymButton, GymDialog, Notes } from "./GymUI";
import ExerciseLogFields, { actualLabel, plannedLabel } from "./ExerciseLogFields";
import ExerciseIcon from "./ExerciseIcon";
import ExercisePicker from "./ExercisePicker";
import GymSafety from "./GymSafety";
import { applySessionCardio, cardioAddons, type Addon } from "@/lib/gym/presets";
export default function SessionEditor({
  session,
  history,
  exercises,
  units: incomingUnits,
  today,
  onCustom,
  onSaved,
  onReload,
  onReopened,
  onClose
}: {
  session: SessionRecord;
  history: SessionRecord[];
  exercises: ExerciseDefinition[];
  units: Units;
  today: string;
  onCustom: (exercise: ExerciseDefinition) => Promise<void>;
  onSaved: (record: SessionRecord) => void;
  onReload: () => Promise<void>;
  onReopened: (record: SessionRecord) => void;
  onClose: () => void;
}) {
  const [units]=useState(incomingUnits);
  const [addon, setAddon] = useState<Addon>("none"), [addonMinutes, setAddonMinutes] = useState(10), [addonMessage, setAddonMessage] = useState("");
  const log = useGymSession(session, onSaved),
    {
      data,
      update
    } = log;
  const [editing, setEditing] = useState(session.data.status === "active"),
    [picker, setPicker] = useState(false),
    [replacement, setReplacement] = useState<string | null>(null),
    [confirm, setConfirm] = useState<{
      title: string;
      description: string;
      action: () => Promise<void>;
    } | null>(null),
    [error, setError] = useState(""),
    [now, setNow] = useState(() => Date.now()),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  const patchExercise = (exercise: SessionExercise) => update(current => ({
    ...current,
    exercises: current.exercises.map(item => item.id === exercise.id ? exercise : item)
  }));
  const close = async () => {
    setBusy(true);
    try {
      await log.flush();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Save failed — retry");
    } finally {
      setBusy(false);
    }
  };
  const summary = sessionSummary(data),
    rest = data.restUntil ? Math.max(0, Math.ceil((Date.parse(data.restUntil) - now) / 1000)) : 0;
  const finish = () => {
    const recorded = confirmSessionEntries(data), recordedSummary = sessionSummary(recorded);
    const next: SessionData = {
      ...recorded,
      status: "completed",
      completionMode: recordedSummary.exercises ? "detailed" : "confirmation",
      finishedAt: data.finishedAt || new Date().toISOString(),
      restUntil: null
    };
    const checked = sessionSchema.safeParse(next);
    if (!checked.success) {
      setError(checked.error.issues[0].message);
      return;
    }
    setConfirm({
      title: "Finish workout?",
      description: !recordedSummary.exercises ? "Marks this workout completed without detailed results. No sets, duration, distance, or volume are invented. Planned targets stay separate." : `Marks this workout completed and confirms ${recordedSummary.exercises} recorded exercises and ${recordedSummary.sets} strength sets together. Blank or incomplete entries remain unlogged; skipped work and original planned targets stay intact.`,
      action: async () => {
        update(checked.data);
        await log.flush();
        setEditing(false);
        setError("");
      }
    });
  };
  return <GymDialog open full title={data.name} description={`${data.status === "completed" ? "Completed workout" : data.logged ? "Enter a completed workout" : "Active training"} · ${dateLabel(data.date)} · ${data.timezone}`} onClose={() => {
    if (!busy) void close();
  }}>
    {data.originalPlan?.preset && <GymSafety compact />}
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p role="status" className={log.state === "failed" ? "gym-error" : "text-sm text-muted-foreground"}>{log.state === "saving" ? "Saving…" : log.state === "failed" ? "Save failed — retry" : "Saved to your account"}</p>{log.state === "failed" && <GymButton tone="orange" onClick={() => {
        setError("");
        void log.flush().catch(reason => setError(reason instanceof Error ? reason.message : "Save failed — retry"));
      }}>Retry save</GymButton>}{log.state === "failed" && <GymButton onClick={() => setConfirm({
        title: "Reload saved version?",
        description: "Discards unsaved changes in this window and reloads the last account record. Use this if another window changed the workout.",
        action: onReload
      })}>Reload saved version</GymButton>}{data.status === "completed" && !editing && <GymButton onClick={() => setConfirm({
        title: "Edit completed results?",
        description: "Changes update your weekly totals and performance history. Your original planned targets remain preserved.",
        action: async () => {
          setEditing(true);
        }
      })}>Edit results</GymButton>}{data.status === "completed" && !editing && <GymButton onClick={() => {
        const mutationId = crypto.randomUUID();
        setConfirm({ title: "Reopen completed workout?", description: "Preserves the actual date and all recorded results. The workout becomes active and is excluded from completed totals until you finish it again.", action: async () => {
          await log.flush(); const records = await getGymData(), record = records.sessions.find(item => item.id === session.id);
          if (!record) throw new Error("Session not found");
          const result = await reopenGymWorkout({ id: record.id, revision: record.revision, mutationId });
          if (!result.success) throw new Error(result.message); onReopened(result.session);
        } });
      }}>Reopen workout</GymButton>}</div>{(error || log.error) && <p role="alert" className="gym-error">{error || log.error}</p>}<div className="grid gap-3 sm:grid-cols-2">
      <Field label="Workout name" value={data.name} disabled={!editing || busy} onChange={event => update({
        ...data,
        name: event.target.value
      })} />
      <Field label="Actual workout date" type="date" max={today} value={data.date} disabled={!editing || busy} onChange={event => update({
        ...data,
        date: event.target.value
      })} />
    </div>
    <p className="text-sm text-muted-foreground">{data.status === "completed" && !summary.exercises ? "Completed — no details logged" : `${summary.exercises} completed exercises · ${summary.sets} strength sets · ${summary.skipped} exercises with remaining work skipped`}</p>{!data.logged && data.status === "active" && editing && <div className="gym-orange flex flex-wrap items-center gap-3 rounded-2xl border p-3">
      <Timer />
      <span className="font-semibold tabular-nums">{data.restUntil ? rest > 0 ? `${Math.floor(rest / 60)}:${String(rest % 60).padStart(2, "0")} rest remaining` : "Rest finished" : "Rest timer"}</span>
      <GymButton onClick={() => update({
        ...data,
        restUntil: new Date(Date.now() + 90000).toISOString()
      })}>90 seconds</GymButton>
      <GymButton onClick={() => update({
        ...data,
        restUntil: null
      })}>Reset</GymButton>
    </div>}<div className="space-y-4">{data.exercises.map(exercise => {
        const previous = previousExercise(history, {
          ...session,
          data
        }, exercise.definition.id);
        return <GymReveal key={exercise.id}><article className="rounded-3xl border border-border bg-card/20 p-4">
          <header className="mb-3 flex items-center gap-3">
            <div className="gym-art-stage gym-art-compact"><ExerciseIcon icon={exercise.definition.icon} exerciseId={exercise.definition.id} size={72} /></div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold">{exercise.definition.name}</h3>
              {exercise.phase && <p className="text-xs font-medium text-[var(--gym-blue)]">{exercise.phase === "preparation" ? "Preparation" : exercise.phase === "cardio" ? "Cardio phase" : "Strength phase"}</p>}
              <p className="text-xs text-muted-foreground">{exercise.definition.category} · {exercise.definition.loadConvention === "none" ? exercise.definition.equipment : exercise.definition.loadConvention}</p>
            </div>
          </header>
          <div className="mb-4 space-y-2 text-sm">
            <p className="gym-blue rounded-xl border p-3">
              <strong>Planned:</strong> {plannedLabel(exercise, units)}</p>{previous && <p className="rounded-xl bg-muted/30 p-3">
              <strong>Previous</strong> · {dateLabel(previous.date)}: {actualLabel(previous.exercise, units)}</p>}<p className="font-semibold">Actual{exercise.skipped && " · Remaining work skipped"}</p>
            {data.originalPlan?.exercises.find(item => item.id === exercise.id)?.notes && <details><summary className="cursor-pointer text-sm">Planned guidance / segment sequence</summary><p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">{data.originalPlan.exercises.find(item => item.id === exercise.id)?.notes}</p></details>}
          </div>{editing && <div className="mb-3 flex flex-wrap gap-2">
            <GymButton onClick={() => patchExercise({
              ...exercise,
              skipped: !exercise.skipped
            })}>{exercise.skipped ? "Resume exercise" : "Skip remaining"}</GymButton>
            <GymButton disabled={data.exercises.length >= 50} onClick={() => {
              setReplacement(exercise.id);
              setPicker(true);
            }}>
              <ArrowLeftRight />Replace exercise</GymButton>{previous && <GymButton onClick={() => setConfirm({
              title: "Use previous values?",
              description: "Copies values into today’s fields. Review them before Finish workout confirms the current results together.",
              action: async () => {
                patchExercise({
                  ...exercise,
                  sets: previous.exercise.sets.map(set => ({
                    ...set,
                    id: crypto.randomUUID(),
                    completed: false
                    ,rir: null, controlled: false, pain: false
                  })),
                  cardio: previous.exercise.cardio ? {
                    ...previous.exercise.cardio,
                    completed: false
                  } : null
                });
              }
            })}>
              <Copy />Use previous values</GymButton>}{!data.logged && data.status === "active" && exercise.planned?.restSeconds && <GymButton onClick={() => update({
              ...data,
              restUntil: new Date(Date.now() + exercise.planned!.restSeconds! * 1000).toISOString()
            })}>
              <Timer />Rest {exercise.planned.restSeconds}s</GymButton>}</div>}{editing ? <ExerciseLogFields exercise={exercise} units={units} disabled={busy || exercise.skipped} onChange={patchExercise} onRemoveSet={id => setConfirm({
            title: "Remove actual set?",
            description: "This removes the entry from actual results and updates totals. Planned sets stay intact.",
            action: async () => {
              patchExercise({
                ...exercise,
                sets: exercise.sets.filter(set => set.id !== id)
              });
              await log.flush();
            }
          })} /> : <div className="gym-orange space-y-2 rounded-2xl border p-3">
            <p>{actualLabel(exercise, units)}</p>{exercise.sets.map((set, index) => set.completed && set.notes ? <p className="text-sm text-muted-foreground" key={set.id}>Set {index + 1} notes: {set.notes}</p> : null)}{exercise.cardio?.notes && <p className="text-sm text-muted-foreground">{exercise.cardio.notes}</p>}<p className="text-xs text-muted-foreground">{exercise.cardio ? exercise.cardio.completed ? "Cardio entry confirmed" : "Cardio entry incomplete" : `${exercise.sets.filter(set => set.completed).length} of ${exercise.sets.length} actual sets confirmed`}{exercise.planned && exercise.definition.tracking !== "cardio" ? ` · ${exercise.planned.sets} sets originally planned` : ""}</p>
          </div>}
          <div className="mt-3">
            <Notes label="Actual exercise notes" value={exercise.notes} disabled={!editing || busy} onChange={event => patchExercise({
              ...exercise,
              notes: event.target.value
            })} />
          </div>
        </article></GymReveal>;
      })}</div>{editing && <GymButton disabled={data.exercises.length >= 50} onClick={() => {
      setReplacement(null);
      setPicker(true);
    }}>
      <Plus />Add unplanned exercise</GymButton>}{editing && data.status === "active" && data.exercises.some(item => item.definition.tracking !== "cardio") && <details className="rounded-2xl border border-border p-4">
      <summary className="cursor-pointer font-semibold">Cardio after training · optional</summary>
      <div className="mt-3 space-y-3">
        <p className="text-sm text-muted-foreground">An easy phase of this workout. Include 2 easy minutes at each end. Actual time and distance stay blank until you record them. None skips the remaining cardio phase and keeps earlier results.</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Active workout cardio option"><GymButton aria-pressed={addon === "none"} disabled={busy} onClick={() => setAddon("none")}>None</GymButton>{cardioAddons.map(option => <GymButton key={option.id} aria-pressed={addon === option.id} tone={addon === option.id ? "blue" : "neutral"} disabled={busy} onClick={() => setAddon(option.id)}>{option.name}</GymButton>)}</div>
        {addon !== "none" && <div className="flex flex-wrap gap-2" role="group" aria-label="Easy cardio planned duration">{[10, 15, 20].map(minutes => <GymButton key={minutes} aria-pressed={addonMinutes === minutes} disabled={busy} onClick={() => setAddonMinutes(minutes)}>{minutes} min</GymButton>)}</div>}
        <GymButton tone="blue" disabled={busy} onClick={() => {try {update(applySessionCardio(data, addon, addonMinutes)); setAddonMessage(addon === "none" ? "Remaining cardio phase skipped. Earlier actual results are preserved." : "Easy cardio phase updated. Record what you actually do below."); setError("");} catch (reason) {setError(reason instanceof Error ? reason.message : "Unable to add cardio.");}}}>Apply cardio choice</GymButton>
        {addonMessage && <p role="status" className="text-sm text-muted-foreground">{addonMessage}</p>}
      </div>
    </details>}<Notes label="Workout notes" value={data.notes} disabled={!editing || busy} onChange={event => update({
      ...data,
      notes: event.target.value
    })} />
    <footer className="sticky bottom-0 -mx-5 flex flex-wrap gap-2 border-t border-border bg-background px-5 py-3">
      <GymButton disabled={busy} onClick={() => void close()}>{editing && data.status === "active" ? "Save partial & close" : "Save & close"}</GymButton>{editing && data.status === "active" && <GymButton tone="orange" disabled={busy} onClick={() => finish()}>
        <Check />Finish workout</GymButton>}</footer>{picker && <GymDialog open full title={replacement ? "Replace exercise" : "Add exercise"} description={replacement ? "The original exercise and its targets remain in the log with remaining work skipped." : "Additional exercises do not change the original plan."} onClose={() => setPicker(false)}>
      <ExercisePicker exercises={exercises} recent={[]} onCustom={onCustom} onToggle={definition => {
        if (data.exercises.length >= 50) { setError("A session can contain up to 50 exercises."); setPicker(false); return; }
        update(current => ({
          ...current,
          exercises: [...current.exercises.map(exercise => exercise.id === replacement ? {
            ...exercise,
            skipped: true
          } : exercise), sessionExercise(definition)]
        }));
        setPicker(false);
      }} />
    </GymDialog>}{confirm && <Confirm title={confirm.title} description={confirm.description} onConfirm={confirm.action} onClose={() => setConfirm(null)} />}</GymDialog>;
}
