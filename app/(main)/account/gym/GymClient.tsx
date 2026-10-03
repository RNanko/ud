"use client";
import { useAccountCalendar } from "@/hooks/use-account-calendar";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig } from "framer-motion";
import { GymReveal } from "./GymMotion";
import { notifyGymChange, useGymSync } from "@/hooks/use-gym-sync";
import { useGymUnits } from "@/hooks/use-gym-units";
import { CalendarDays, Dumbbell, History, Library, Plus, Play } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import * as repository from "@/lib/actions/gym.actions";
import { exerciseLibrary } from "@/lib/gym/library";

import { calendarDay } from "@/lib/gym/validation";
import { defaultTargets, emptyBlueprint } from "@/lib/gym/logic";
import type { Blueprint, ExerciseDefinition, GymData, PlanRecord, SessionRecord, TemplateRecord } from "@/lib/gym/types";
import { Confirm, Field, GymButton, GymDialog } from "./GymUI";
import WorkoutBuilder, { ScheduleDialog } from "./WorkoutBuilder";
import ExercisePicker from "./ExercisePicker";
import { WorkoutArtwork } from "./WorkoutCard";
import WeeklyPlan from "./WeeklyPlan";
import GymHistory from "./GymHistory";
import SessionEditor from "./SessionEditor";
import ScheduleConflictNotice from "@/app/components/shared/account/ScheduleConflictNotice";
type BuilderContext = {
  key: string;
  initial: Blueprint;
  mode: "build" | "log";
  template?: TemplateRecord;
  plan?: PlanRecord;
};
type Result = {
  success: boolean;
  message?: string;
};
export default function GymClient({
  initial
}: {
  initial: GymData;
}) {
  const { browserTimezone, localDate, weekStart }=useAccountCalendar();
  const { units } = useGymUnits();
  const [data, setData] = useState(initial),
    [tab, setTab] = useState("week"),
    [selected, setSelected] = useState(""),
    [today, setToday] = useState(""),
    [zone, setZone] = useState("UTC"),
    [builder, setBuilder] = useState<BuilderContext>({
      key: "initial",
      initial: emptyBlueprint(),
      mode: "build"
    }),
    [active, setActive] = useState<SessionRecord | null>(null),
    [sessionEpoch, setSessionEpoch] = useState(0),
    [chooser, setChooser] = useState<string | null>(null),
    [duplicate, setDuplicate] = useState<PlanRecord | TemplateRecord | null>(null),
    [move, setMove] = useState<PlanRecord | null>(null),
    [destination, setDestination] = useState(""),
    [copy, setCopy] = useState(false),
    [confirm, setConfirm] = useState<{
      title: string;
      description: string;
      action: () => Promise<void>;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const lock = useRef(false),
    pending = useRef<(() => Promise<void>) | null>(null),
    pendingLabel = useRef("");
  const queryOpened = useRef(false);
  useGymSync(setData, busy || !!active);
  useEffect(() => {
    if (queryOpened.current) return;
    queryOpened.current = true;
    const current = localDate();
    setToday(current);
    setSelected(current);
    setDestination(current);
    setZone(browserTimezone());
    const query = new URLSearchParams(window.location.search), sessionId = query.get("session"), planId = query.get("plan"), date = query.get("date");
    if (date && calendarDay.safeParse(date).success) setSelected(date);
    const session = initial.sessions.find(item => item.id === sessionId || planId && item.planId === planId);
    if (session) setActive(session);
    else if (planId) {
      const plan = initial.plans.find(item => item.id === planId);
      if (plan) setSelected(plan.date);
    }
  }, [initial,browserTimezone,localDate]);
  useEffect(() => {
    const updateToday = () => setToday(localDate());
    const timer = setInterval(updateToday, 60000);
    document.addEventListener("visibilitychange", updateToday);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", updateToday);
    };
  }, [localDate]);
  useEffect(()=>{setZone(browserTimezone());setToday(localDate());},[browserTimezone,localDate]);
  const execute = async (job: () => Promise<void>) => {
    if (lock.current) throw new Error("Saving is in progress");
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await job();
      pending.current = null;
    } catch (reason) {
      pending.current = job;
      setError(reason instanceof Error ? reason.message : "Save failed — retry");
      throw reason;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const perform = async <R extends Result,>(operation: () => Promise<R>, after: (result: R) => void, success: string) => {
    if (pending.current) {
      if (pendingLabel.current !== success) throw new Error("Retry the previous save first. Your entered details are still here.");
      await execute(pending.current);
      setMessage(`${success}. Retried the previous request; save again if you changed its values.`);
      return;
    }
    const job = async () => {
      const result = await operation();
      if (!result.success) throw new Error(result.message || "Save failed — retry");
      after(result);
      notifyGymChange();
      setMessage(success);
    };
    pendingLabel.current = success;
    await execute(job);
  };
  const reload = async () => {
    const fresh = await repository.getGymData();
    setData(fresh);
  };
  const openBuilder = (initial = emptyBlueprint(), mode: "build" | "log" = "build", template?: TemplateRecord, plan?: PlanRecord) => {
    setBuilder({
      key: crypto.randomUUID(),
      initial: structuredClone(initial),
      mode,
      template,
      plan
    });
    setTab("build");
    setChooser(null);
  };
  const custom = async (definition: ExerciseDefinition) => {
    const command = {
      id: definition.id,
      revision: data.customExercises.find(record => record.id === definition.id)?.revision ?? null,
      mutationId: crypto.randomUUID(),
      kind: "exercise",
      data: definition
    };
    await perform(() => repository.saveGymEntity(command), result => {
      if (result.success) setData(current => ({
        ...current,
        customExercises: [...current.customExercises.filter(record => record.id !== result.record.id), result.record as GymData["customExercises"][number]]
      }));
    }, "Custom exercise saved");
  };
  const schedule = async (blueprint: Blueprint, dates: string[]) => {
    const command = {
      operationId: crypto.randomUUID(),
      dates,
      timezone: zone,
      data: blueprint
    };
    await perform(() => repository.scheduleGymWorkout(command), result => {
      if (result.success) {
        setData(current => ({
          ...current,
          plans: [...current.plans.filter(plan => !result.plans.some(added => added.id === plan.id)), ...result.plans]
        }));
        setSelected(dates[0]);
        setTab("week");
        setDuplicate(null);
        setChooser(null);
      }
    }, "Workouts scheduled");
  };
  const save = async (blueprint: Blueprint) => {
    if (builder.plan) {
      const plan = builder.plan,
        command = {
          id: plan.id,
          revision: plan.revision,
          mutationId: crypto.randomUUID(),
          date: plan.date,
          timezone: plan.timezone,
          data: blueprint
        };
      await perform(() => repository.editGymPlan(command), result => {
        if (result.success) {
          setData(current => ({
            ...current,
            plans: current.plans.map(item => item.id === result.plan.id ? result.plan : item)
          }));
          setBuilder(current => ({
            ...current,
            plan: result.plan
          }));
        }
      }, "Plan changes saved");
    } else {
      const command = {
        id: builder.template?.id || crypto.randomUUID(),
        revision: builder.template?.revision ?? null,
        mutationId: crypto.randomUUID(),
        kind: "template",
        data: blueprint
      };
      await perform(() => repository.saveGymEntity(command), result => {
        if (result.success) {
          const record = result.record as TemplateRecord;
          setData(current => ({
            ...current,
            templates: [...current.templates.filter(item => item.id !== record.id), record]
          }));
          setBuilder(current => ({
            ...current,
            template: record
          }));
        }
      }, "Reusable workout saved");
    }
  };
  const start = async (blueprint: Blueprint | null, date: string, logged: boolean, planId: string | null = null) => {
    const command = {
      id: crypto.randomUUID(),
      planId,
      data: blueprint,
      date,
      timezone: zone,
      logged
    };
    await perform(() => repository.startGymSession(command), result => {
      if (result.success) {
        setData(current => ({
          ...current,
          sessions: [...current.sessions.filter(item => item.id !== result.session.id), result.session]
        }));
        setActive(result.session);
      }
    }, "Workout log ready");
  };
  const archive = (id: string, kind: "plan" | "session" | "entity") => setConfirm({
    title: kind === "session" ? "Delete actual workout log?" : kind === "plan" ? "Remove planned workout?" : "Remove reusable workout?",
    description: kind === "session" ? "This removes actual results from your summaries and exercise history. The original plan remains." : kind === "plan" ? "Only the plan is removed. Any linked actual workout log stays in your history." : "Previously scheduled workouts and training history stay intact.",
    action: async () => {
      await perform(() => repository.archiveGymRecord({
        id,
        kind,
        archived: true
      }), () => {
        setData(current => kind === "session" ? {
          ...current,
          sessions: current.sessions.filter(item => item.id !== id)
        } : kind === "plan" ? {
          ...current,
          plans: current.plans.filter(item => item.id !== id)
        } : {
          ...current,
          templates: current.templates.filter(item => item.id !== id),
          customExercises: current.customExercises.filter(item => item.id !== id)
        });
      }, "Removed");
    }
  });
  const action = (job: () => Promise<void>) => {
    void job().catch(reason => setError(reason instanceof Error ? reason.message : "Save failed — retry"));
  };
  const exercises = [...exerciseLibrary, ...data.customExercises.map(record => record.data)],
    recent = [...new Set(data.sessions.filter(session => session.data.status === "completed").flatMap(session => session.data.exercises.filter(exercise => exercise.sets.some(set => set.completed) || exercise.cardio?.completed).map(exercise => exercise.definition.id)))];
  if (!today) return <div role="status" className="p-8 text-muted-foreground">Loading workout calendar…</div>;
  const first = !data.templates.length && !data.plans.length && !data.sessions.length;
  return <MotionConfig reducedMotion="user"><main className="gym-scope min-w-0 space-y-6 pb-8">
    <GymReveal><header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="gym-error mb-2 flex items-center gap-2 text-xs uppercase tracking-[.18em]">
          <Dumbbell size={15} />Gym & Body Adviser</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your training, your pace.</h1>
        <p className="mt-2 text-sm text-muted-foreground">Build a routine. Plan your week. Record what you actually did.</p>
      </div>
      <GymButton tone="blue" onClick={() => openBuilder()}>
        <Plus />Build workout</GymButton>
    </header></GymReveal>
    {error && <div role="alert" className="gym-orange flex flex-wrap items-center gap-3 rounded-2xl border p-3">
      <p className="flex-1 text-sm">{error}</p>{pending.current && <>
        <GymButton disabled={busy} onClick={() => {
          if (pending.current) action(() => execute(pending.current!));
        }}>Retry last save</GymButton>
        <GymButton disabled={busy} onClick={() => {
          pending.current = null;
          setError("");
          action(reload);
        }}>Reload account records</GymButton>
      </>}</div>}{(busy || message) && <p role="status" className="text-sm text-muted-foreground">{busy ? "Saving…" : message}</p>}{first && tab === "week" && <section className="gym-blue rounded-3xl border p-6">
      <h2 className="text-2xl font-semibold">Start with one good workout.</h2>
      <p className="my-3 text-sm text-muted-foreground">Choose exercises and save a routine, or log training you already completed. Your calendar starts empty.</p>
      <div className="flex flex-wrap gap-3">
        <GymButton tone="blue" onClick={() => openBuilder()}>Build your first workout</GymButton>
        <GymButton tone="orange" onClick={() => openBuilder(emptyBlueprint(), "log")}>Log a completed workout</GymButton>
      </div>
    </section>}{data.sessions.some(record => record.data.status === "active") && <section data-workout-status="in-progress" className="gym-workout-state space-y-2 rounded-3xl border p-4" aria-label="Saved active workouts">
      <h2 className="font-semibold">Pick up where you left off</h2>
      <div className="flex flex-wrap gap-2">{data.sessions.filter(record => record.data.status === "active").map(record => <GymButton key={record.id} tone="in-progress" onClick={() => setActive(record)}>Resume {record.data.name} · {record.data.date}</GymButton>)}</div>
    </section>}<Tabs value={tab} onValueChange={setTab}>
      <TabsList className="mb-5 grid h-auto w-full grid-cols-4 rounded-2xl border border-border bg-card/40 p-1">
        <TabsTrigger value="week" className="min-h-12 gap-2 rounded-xl">
          <CalendarDays />
          <span className="hidden sm:inline">Weekly </span>Plan</TabsTrigger>
        <TabsTrigger value="build" className="min-h-12 gap-2 rounded-xl">
          <Dumbbell />Build</TabsTrigger>
        <TabsTrigger value="library" className="min-h-12 gap-2 rounded-xl">
          <Library />Library</TabsTrigger>
        <TabsTrigger value="history" className="min-h-12 gap-2 rounded-xl">
          <History />History</TabsTrigger>
      </TabsList>
      <TabsContent value="week">
        <GymReveal>
        <WeeklyPlan data={data} selected={selected} today={today} units={units} onSelect={setSelected} actions={{
          plan: date => {
            setSelected(date);
            setChooser(date);
          },
          log: date => {
            setSelected(date);
            openBuilder(emptyBlueprint(), "log");
          },
          rest: (date, rest) => action(async () => {
            await perform(() => repository.setGymRestDay({
              date,
              timezone: zone,
              rest
            }), () => setData(current => ({
              ...current,
              restDays: rest ? [...new Set([...current.restDays, date])] : current.restDays.filter(item => item !== date)
            })), "Rest-day marker saved");
          }),
          start: plan => action(() => start(null, today, false, plan.id)),
          edit: plan => openBuilder(plan.data, "build", undefined, plan),
          move: plan => {
            setMove(plan);
            setDestination(plan.date);
          },
          duplicate: setDuplicate,
          remove: archive,
          open: setActive,
          copy: () => {
            setCopy(true);
            setDestination(selected);
          }
        }} />
        </GymReveal>
      </TabsContent>
      <TabsContent value="build" forceMount className={tab !== "build" ? "hidden" : ""}>
        <GymReveal active={tab === "build"} distance={0}>
        <div className="mb-5 flex flex-wrap gap-2">{data.templates.map(template => <GymButton key={template.id} tone={builder.template?.id === template.id ? "blue" : "neutral"} onClick={() => openBuilder(template.data, "build", template)}>Use / edit {template.data.name}</GymButton>)}</div>
        <WorkoutBuilder key={builder.key} initial={builder.initial} exercises={exercises} recent={recent} units={units} selectedDate={selected} today={today} mode={builder.mode} editingPlan={!!builder.plan} onCustom={custom} onSave={save} onSchedule={schedule} onStart={async (blueprint, date, logged) => {
          if (builder.plan && !logged) {
            if (!pending.current || pendingLabel.current !== "Workout log ready") await save(blueprint);
            await start(null, date, false, builder.plan.id);
          } else await start(blueprint, date, logged);
        }} />
        </GymReveal>
      </TabsContent>
      <TabsContent value="library">
        <GymReveal>
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
          <ExercisePicker exercises={exercises} recent={recent} onCustom={custom} onToggle={exercise => {
            const blueprint = emptyBlueprint();
            blueprint.exercises = [{
              id: crypto.randomUUID(),
              definition: exercise,
              targets: defaultTargets(exercise),
              notes: ""
            }];
            openBuilder(blueprint);
          }} />
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Saved routines</h2>{data.templates.map(template => <article key={template.id} className="rounded-3xl border border-border bg-card/20 p-4">
              <h3 className="font-semibold">{template.data.name}</h3>
              <WorkoutArtwork exercises={template.data.exercises} />
              <p className="my-2 text-sm text-muted-foreground">{template.data.exercises.length} exercises · reusable template</p>
              <div className="flex flex-wrap gap-2">
                <GymButton onClick={() => openBuilder(template.data, "build", template)}>Use / edit</GymButton>
                <GymButton tone="blue" onClick={() => setDuplicate(template)}>Add to week</GymButton>
                <GymButton tone="orange" onClick={() => action(() => start(template.data, today, false))}>
                  <Play />Start</GymButton>
                <GymButton onClick={() => archive(template.id, "entity")}>Remove</GymButton>
              </div>
            </article>)}{!data.templates.length && <p className="rounded-3xl border border-dashed p-6 text-muted-foreground">Saved workouts appear here. Editing a routine leaves scheduled targets and historical results unchanged.</p>}<h3 className="font-semibold">Custom exercises</h3>{data.customExercises.map(record => <div key={record.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border p-3">
              <span>{record.data.name}</span>
              <GymButton onClick={() => archive(record.id, "entity")}>Archive exercise</GymButton>
            </div>)}</section>
        </div>
        </GymReveal>
      </TabsContent>
      <TabsContent value="history">
        <GymReveal>
        <GymHistory sessions={data.sessions} units={units} onOpen={setActive} onRemove={id => archive(id, "session")} />
        </GymReveal>
      </TabsContent>
    </Tabs><AnimatePresence>{chooser && <GymDialog key="choose-workout" open title="Plan workout" description="Choose a routine or build a new workout for this day." onClose={() => setChooser(null)}>
      <div className="space-y-2">{data.templates.map(template => <GymButton className="w-full justify-start" key={template.id} onClick={() => action(() => schedule(template.data, [chooser]))}>{template.data.name}</GymButton>)}</div>
      <GymButton tone="blue" onClick={() => openBuilder()}>Build a new workout</GymButton>
    </GymDialog>}{duplicate && <ScheduleDialog key="duplicate-workout" selectedDate={selected} onClose={() => setDuplicate(null)} onSave={dates => schedule(duplicate.data, dates)} />}{(move || copy) && <GymDialog key="move-copy-workout" open title={move ? "Move planned workout" : "Copy planned week"} description={move ? "Move the independent plan to another date." : "Copies planned targets only. Actual sets, cardio results, completion status, and rest markers are excluded."} onClose={() => {
      if (!busy) {
        setMove(null);
        setCopy(false);
      }
    }}>
      <Field label={move ? "Destination date" : "Destination week (choose any date)"} type="date" value={destination} onChange={event => setDestination(event.target.value)} />
      {move && <ScheduleConflictNotice source={{ kind: "workout", id: move.id }} date={destination} timing={move.data.timing} />}
      <GymButton tone="blue" disabled={busy || !destination || copy && weekStart(destination) === weekStart(selected)} onClick={() => action(async () => {
        if (move) {
          const command = {
            id: move.id,
            revision: move.revision,
            mutationId: crypto.randomUUID(),
            date: destination,
            timezone: zone,
            data: move.data
          };
          await perform(() => repository.editGymPlan(command), result => {
            if (result.success) {
              setData(current => ({
                ...current,
                plans: current.plans.map(plan => plan.id === result.plan.id ? result.plan : plan)
              }));
              setSelected(destination);
              setMove(null);
            }
          }, "Plan moved");
        } else {
          const command = {
            operationId: crypto.randomUUID(),
            from: selected,
            to: destination,
            timezone: zone
          };
          await perform(() => repository.copyGymWeek(command), result => {
            if (result.success) {
              setData(current => ({
                ...current,
                plans: [...current.plans.filter(plan => !result.plans.some(added => plan.id === added.id)), ...result.plans]
              }));
              setSelected(destination);
              setCopy(false);
            }
          }, "Planned week copied");
        }
      })}>{move ? "Move workout" : "Copy plans"}</GymButton>
    </GymDialog>}{active && <SessionEditor key={`${active.id}:${sessionEpoch}`} session={active} history={data.sessions} exercises={exercises} units={units} today={today} onCustom={custom} onReload={async () => {
      const fresh = await repository.getGymData();
      setData(fresh);
      setActive(fresh.sessions.find(record => record.id === active.id) || null);
      setSessionEpoch(current => current + 1);
    }} onReopened={record => {
      setData(current => ({ ...current, sessions: current.sessions.map(item => item.id === record.id ? record : item) }));
      setActive(record); setSessionEpoch(current => current + 1); notifyGymChange();
    }} onSaved={record => {
      setData(current => ({
        ...current,
        sessions: current.sessions.map(item => item.id === record.id ? record : item)
      }));
      notifyGymChange();
    }} onClose={() => {
      setActive(null);
      setTab("week");
    }} />}{confirm && <Confirm key="gym-confirm" title={confirm.title} description={confirm.description} onConfirm={confirm.action} onClose={() => setConfirm(null)} />}</AnimatePresence></main></MotionConfig>;
}
