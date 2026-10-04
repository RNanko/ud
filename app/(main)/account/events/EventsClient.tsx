"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useIsPresent,
  useReducedMotion,
} from "framer-motion";
import { toast } from "sonner";
import type { EventContainer, EventItem, EventItems } from "@/types/types";
import type {
  Blueprint,
  GymData,
  PlanRecord,
  SessionRecord,
} from "@/lib/gym/types";
import { getUserEventsList } from "@/lib/actions/events.actions";
import { Trash2 } from "lucide-react";
import * as planner from "@/lib/actions/planner.actions";
import * as workouts from "@/lib/actions/gym.actions";
import {
  plannerItems,
  placeManual,
  weekDate,
  weekKey,
  type PlannerItem,
} from "@/lib/events";
import { useAccountCalendar } from "@/hooks/use-account-calendar";
import {
  getAccountEventWindow,
  saveAccountEventWindow,
} from "@/lib/actions/calendar-window.actions";
import { saveAccountSettings } from "@/lib/actions/account.actions";
import { useAccountPreferences } from "@/app/components/shared/account/AccountPreferencesProvider";
import { weeklySummary } from "@/lib/gym/logic";
import { untimed } from "@/lib/planner-time";
import { notifyGymChange, useGymSync } from "@/hooks/use-gym-sync";
import { useGymUnits } from "@/hooks/use-gym-units";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { Confirm, GymButton, GymDialog, GymSelect } from "../gym/GymUI";
import WeekNavigator from "../gym/WeekNavigator";
import SessionEditor from "../gym/SessionEditor";
import EventEditor from "./EventEditor";
import ScheduleConflictNotice from "@/app/components/shared/account/ScheduleConflictNotice";
import QuickWorkoutSheet from "./QuickWorkoutSheet";
import PlanWorkoutSheet from "./PlanWorkoutSheet";
import PresetSheet from "./PresetSheet";
import WeekPresets from "./WeekPresets";
import PlanTimingSheet from "./PlanTimingSheet";
const EventsBoard = dynamic(() => import("./EventsBoard"), {
  ssr: false,
});
const emptyGym = (): GymData => ({
  templates: [],
  plans: [],
  sessions: [],
  customExercises: [],
  restDays: [],
});
type Pending = {
  job: () => Promise<void>;
  rollback?: () => void;
  label: string;
};
export default function EventsClient({
  data,
  listOfWeeks,
  gymData,
  eventPresets = [],
}: {
  data: EventContainer;
  listOfWeeks: string[];
  gymData?: GymData;
  eventPresets?: EventItem[];
}) {
  const { units } = useGymUnits();
  const { settings, replace } = useAccountPreferences();
  const {
    localDate,
    browserTimezone,
    weekDates,
    startsOn,
    hour12: preferredHour12,
  } = useAccountCalendar();
  const [weekData, setWeekData] = useState(data),
    [gym, setGym] = useState(gymData || emptyGym()),
    [presets, setPresets] = useState(eventPresets);
  const [today, setToday] = useState(""),
    [selected, setSelected] = useState(weekDate(data.week)),
    [zone, setZone] = useState("UTC");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("Saved"),
    [direction, setDirection] = useState(1),
    [showCompleted, setShowCompleted] = useState(true);
  const [hour12, setHour12] = useState(false);
  const [editor, setEditor] = useState<{
      event?: EventItem;
      date: string;
    } | null>(null),
    [planDate, setPlanDate] = useState<string | null>(null),
    [quick, setQuick] = useState<PlannerItem | null>(null);
  const [active, setActive] = useState<SessionRecord | null>(null),
    [sessionEpoch, setSessionEpoch] = useState(0),
    [preset, setPreset] = useState<EventItems[] | null>(null),
    [eventPresetOpen, setEventPresetOpen] = useState(false);
  const [move, setMove] = useState<PlannerItem | null>(null),
    [moveDate, setMoveDate] = useState(selected);
  const [planEdit, setPlanEdit] = useState<PlanRecord | null>(null);
  const [weekPresetMode, setWeekPresetMode] = useState<"save" | "apply" | null>(
    null,
  );
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    action: () => Promise<void>;
  } | null>(null);
  const current = useRef(data),
    lock = useRef(false),
    inFlight = useRef<Promise<void> | null>(null),
    pending = useRef<Pending | null>(null);
  const queryOpened = useRef(false);
  useGymSync(setGym, busy || !!active || !!quick);
  useEffect(() => {
    const date = localDate();
    setToday(date);
    setZone(browserTimezone());
    setSelected(weekKey(date) === data.week ? date : weekDate(data.week));
    setHour12(preferredHour12);
  }, [data.week, localDate, browserTimezone, preferredHour12]);
  useEffect(() => {
    if (startsOn !== "sunday") return;
    let valid = true;
    const date = localDate();
    getAccountEventWindow(date)
      .then((dayData) => {
        if (valid && !lock.current) {
          const next = { ...current.current, week: weekKey(date), dayData };
          current.current = next;
          setWeekData(next);
          setSelected(date);
        }
      })
      .catch(() => {
        if (valid)
          setError(
            "Calendar could not load the selected week. Retry before editing.",
          );
      });
    return () => {
      valid = false;
    };
  }, [startsOn, localDate]);

  useEffect(() => {
    if (queryOpened.current) return;
    queryOpened.current = true;
    const query = new URLSearchParams(window.location.search),
      linkedDate = query.get("date");
    if (
      linkedDate &&
      /^\d{4}-\d{2}-\d{2}$/.test(linkedDate) &&
      weekKey(linkedDate) === data.week
    ) {
      setSelected(linkedDate);
      const event = data.dayData
        .flatMap((day) => day.tasks)
        .find((item) => item.id === query.get("event"));
      if (event) setEditor({ event, date: linkedDate });
    }
  }, [data.week, data.dayData]);
  async function execute(
    job: () => Promise<void>,
    label: string,
    rollback?: () => void,
  ) {
    if (lock.current) throw new Error("Saving is in progress");
    const command = pending.current
      ? pending.current.label === label
        ? pending.current
        : null
      : {
          job,
          label,
          rollback,
        };
    if (!command)
      throw new Error(
        "Retry the previous save first. Your entered details are still here.",
      );
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("Saving…");
    const promise = (async () => {
      try {
        await command.job();
        pending.current = null;
        setMessage("Saved");
        window.dispatchEvent(new Event("notifications-changed"));
      } catch (reason) {
        command.rollback?.();
        pending.current = command;
        const text =
          reason instanceof Error ? reason.message : "Save failed — retry";
        setError(text);
        setMessage("Save failed — retry");
        toast.error(text);
        throw reason;
      } finally {
        lock.current = false;
        setBusy(false);
      }
    })();
    inFlight.current = promise;
    try {
      await promise;
    } finally {
      if (inFlight.current === promise) inFlight.current = null;
    }
  }
  function action(job: () => Promise<void>) {
    void job().catch(() => {});
  }
  async function switchWeek(week: string, date = weekDate(week)) {
    if (inFlight.current) {
      try {
        await inFlight.current;
      } catch {
        return;
      }
    }
    if (pending.current) {
      setError(
        "Retry the previous save or reload the saved week before navigating.",
      );
      return;
    }
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const [dayData, records] = await Promise.all([
        startsOn === "sunday"
          ? getAccountEventWindow(date)
          : getUserEventsList(week),
        workouts.getGymData(),
      ]);
      setDirection(weekDate(week) >= weekDate(current.current.week) ? 1 : -1);
      const next = {
        ...current.current,
        week,
        dayData,
      };
      current.current = next;
      setWeekData(next);
      setGym(records);
      setSelected(date);
      setMessage("Saved");
    } catch {
      setError("Unable to load that week. Your current week is still here.");
      toast.error("Unable to load that week");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function saveManual(next: EventItems[], label = "Save event") {
    const before = current.current,
      command = {
        week: before.week,
        mutationId: crypto.randomUUID(),
        before: before.dayData,
        data: next,
      };
    await execute(
      async () => {
        setWeekData({
          ...before,
          dayData: next,
        });
        current.current = {
          ...before,
          dayData: next,
        };
        const result =
          startsOn === "sunday"
            ? await saveAccountEventWindow({
                anchor: selected,
                before: command.before,
                data: command.data,
              })
            : await planner.saveEventBoard(command);
        if (!result.success) throw new Error(result.message);
        current.current = {
          ...before,
          dayData: result.data,
        };
        setWeekData(current.current);
      },
      label,
      () => {
        current.current = before;
        setWeekData(before);
      },
    );
  }
  function savedSession(record: SessionRecord) {
    setGym((value) => ({
      ...value,
      sessions: [
        ...value.sessions.filter((item) => item.id !== record.id),
        record,
      ],
    }));
    notifyGymChange();
  }
  async function openWorkout(
    item: PlannerItem,
    date = today,
    logged = false,
    notes?: string,
  ) {
    if (item.session && notes === undefined) {
      setActive(item.session);
      return;
    }
    if (!item.plan && !item.session) return;
    const command = {
        id: crypto.randomUUID(),
        planId: item.plan?.id || null,
        data: null,
        date,
        timezone: zone,
        logged,
      },
      mutationId = crypto.randomUUID();
    await execute(
      async () => {
        let record = item.session;
        if (!record) {
          const result = await workouts.startGymSession(command);
          if (!result.success) throw new Error(result.message);
          record = result.session;
        }
        if (notes !== undefined) {
          const result = await workouts.saveGymSession({
            id: record.id,
            revision: record.revision,
            mutationId,
            data: {
              ...record.data,
              date,
              notes,
            },
          });
          if (!result.success) throw new Error(result.message);
          record = result.session;
        }
        savedSession(record);
        setActive(record);
      },
      `Start workout:${item.plan?.id || item.session!.id}`,
    );
  }
  function detail(item: PlannerItem) {
    if (item.manual)
      setEditor({
        event: item.manual,
        date: item.date,
      });
    else if (item.session) action(() => openWorkout(item));
    else if (item.plan) setPlanEdit(item.plan);
  }
  function complete(item: PlannerItem) {
    if (item.manual) {
      const event = {
        ...item.manual,
        completed: !item.manual.completed,
        completedAt: item.manual.completed ? null : new Date().toISOString(),
      };
      action(() =>
        saveManual(
          placeManual(current.current.dayData, event, item.date),
          `Complete event:${item.id}`,
        ),
      );
    } else if (item.session?.data.status === "completed") {
      const record = item.session,
        command = {
          id: record.id,
          revision: record.revision,
          mutationId: crypto.randomUUID(),
        };
      setConfirm({
        title: "Reopen completed workout?",
        description:
          "Keeps every recorded result and the actual training date. The workout becomes active and leaves completed totals until you confirm completion again.",
        action: () =>
          execute(async () => {
            const result = await workouts.reopenGymWorkout(command);
            if (!result.success) throw new Error(result.message);
            savedSession(result.session);
          }, `Reopen workout:${record.id}`),
      });
    } else setQuick(item);
  }
  async function moveItem(item: PlannerItem, date: string, order: number) {
    if (item.manual)
      return saveManual(
        placeManual(
          current.current.dayData,
          {
            ...item.manual,
            order,
          },
          date,
        ),
        `Move event:${item.id}`,
      );
    if (!item.plan || item.session) return;
    const before = gym,
      command = {
        id: item.plan.id,
        revision: item.plan.revision,
        mutationId: crypto.randomUUID(),
        date,
        timezone: item.plan.timezone,
        data: {
          ...item.plan.data,
          timing: {
            ...(item.plan.data.timing || untimed()),
            order,
          },
        },
      };
    await execute(
      async () => {
        setGym((value) => ({
          ...value,
          plans: value.plans.map((plan) =>
            plan.id === item.plan!.id
              ? {
                  ...plan,
                  date,
                  data: command.data,
                }
              : plan,
          ),
        }));
        const result = await workouts.editGymPlan(command);
        if (!result.success) throw new Error(result.message);
        setGym((value) => ({
          ...value,
          plans: value.plans.map((plan) =>
            plan.id === result.plan.id ? result.plan : plan,
          ),
        }));
        notifyGymChange();
      },
      `Move workout:${item.id}`,
      () => setGym(before),
    );
  }
  function remove(item: PlannerItem) {
    const command = item.manual
      ? null
      : {
          id: item.session?.id || item.plan!.id,
          kind: item.session ? ("session" as const) : ("plan" as const),
          archived: true,
        };
    setConfirm({
      title: `Remove ${item.title}?`,
      description: item.session
        ? "Removes this actual workout from visible history and completed totals. Its original plan is kept."
        : "Removes this scheduled event. Other events and workout results remain intact.",
      action: async () => {
        if (item.manual)
          await saveManual(
            current.current.dayData.map((day) => ({
              ...day,
              tasks: day.tasks.filter((event) => event.id !== item.id),
            })),
            `Remove event:${item.id}`,
          );
        else
          await execute(async () => {
            const result = await workouts.archiveGymRecord(command);
            if (!result.success) throw new Error(result.message);
            setGym(await workouts.getGymData());
            notifyGymChange();
          }, `Remove workout:${item.id}`);
      },
    });
  }
  if (!today) return <p role="status">Loading event calendar…</p>;
  const items = plannerItems(weekData.dayData, gym, selected, startsOn),
    completed = items.filter((item) => item.completed).length;
  const visible = showCompleted
      ? items
      : items.filter((item) => !item.completed),
    summary = weeklySummary(gym.sessions, weekDates(selected));
  const weekOptions = [
    ...new Set([weekData.week, weekKey(today), ...listOfWeeks]),
  ]
    .sort()
    .reverse();
  return (
    <MotionConfig reducedMotion="user">
      <main className="gym-scope min-w-0 space-y-5 pb-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className=" text-blue-300 mb-2 text-xs font-semibold uppercase tracking-[.16em]">
              Your week, connected
            </p>
            <h1 className="text-3xl font-semibold">Events</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Plan your days. Complete events. Keep training connected to Gym.
            </p>
          </div>
          <GymButton
            tone="blue"
            onClick={() =>
              setEditor({
                date: selected,
              })
            }
          >
            Add event
          </GymButton>
        </header>
        <div className="flex flex-wrap gap-2">
          <Select
            disabled={busy}
            value={weekData.week}
            onValueChange={(week) => switchWeek(week)}
          >
            <SelectTrigger className="min-h-11 w-44 rounded-2xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {weekOptions.map((week) => (
                <SelectItem key={week} value={week}>
                  {week}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <GymButton disabled={busy} onClick={() => setEventPresetOpen(true)}>
            Event presets
          </GymButton>
          <GymButton disabled={busy} onClick={() => setWeekPresetMode("save")}>
            Save week preset
          </GymButton>
          <GymButton disabled={busy} onClick={() => setWeekPresetMode("apply")}>
            Apply week preset
          </GymButton>
        </div>
        <WeekNavigator
          selected={selected}
          today={today}
          onSelect={(date) => {
            if (weekKey(date) === current.current.week) setSelected(date);
            else action(() => switchWeek(weekKey(date), date));
          }}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="size-5 accent-[var(--gym-orange)]"
              checked={showCompleted}
              onChange={(event) => setShowCompleted(event.target.checked)}
            />
            Show completed ({completed})
          </label>
          <div className="w-36">
            <GymSelect
              label="Clock format"
              value={hour12 ? "12-hour" : "24-hour"}
              options={["12-hour", "24-hour"]}
              onChange={(value) => {
                const next = value === "12-hour";
                setHour12(next);
                saveAccountSettings({
                  section: "preferences",
                  revision: settings.revision,
                  value: {
                    ...settings.preferences,
                    timeFormat: next ? "12" : "24",
                  },
                })
                  .then(replace)
                  .catch(() => {
                    setHour12(preferredHour12);
                    setError(
                      "Clock preference could not save — retry in Account & Settings.",
                    );
                  });
              }}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-3xl border border-border bg-card/20 p-4">
          <div>
            <p className="text-2xl font-semibold">
              {items.filter((item) => item.manual && item.completed).length}
            </p>
            <p className="text-xs text-muted-foreground">Completed events</p>
          </div>
          <div>
            <p className="text-2xl font-semibold">{summary.workouts}</p>
            <p className="text-xs text-muted-foreground">Completed workouts</p>
          </div>
          <div>
            <p className="text-2xl font-semibold">
              {items.filter((item) => !item.completed).length}
            </p>
            <p className="text-xs text-muted-foreground">Unfinished</p>
          </div>
        </div>
        <p role="status" className="text-sm text-muted-foreground">
          {busy ? "Saving / loading…" : message}
          {!showCompleted && ` · ${completed} completed items hidden`}
        </p>
        {error && (
          <div
            role="alert"
            className="gym-orange flex flex-wrap gap-3 rounded-2xl border p-3"
          >
            <p className="w-full text-sm">{error}</p>
            {pending.current && (
              <GymButton
                disabled={busy}
                onClick={() => {
                  const command = pending.current;
                  if (command)
                    action(() =>
                      execute(command.job, command.label, command.rollback),
                    );
                }}
              >
                Retry last save
              </GymButton>
            )}
            <GymButton
              disabled={busy}
              onClick={() => {
                pending.current = null;
                action(() => switchWeek(current.current.week, selected));
              }}
            >
              Reload saved week
            </GymButton>
          </div>
        )}
        <div className="grid min-w-0" aria-busy={busy} inert={busy}>
          <AnimatePresence initial={false} custom={direction}>
            <WeekScene key={weekData.week} direction={direction}>
              <EventsBoard
                items={visible}
                selected={selected}
                today={today}
                hour12={hour12}
                units={units}
                actions={{
                  create: (date) =>
                    setEditor({
                      date,
                    }),
                  plan: setPlanDate,
                  detail,
                  complete,
                  start: (item) => action(() => openWorkout(item)),
                  remove,
                  move: moveItem,
                  moveDialog: (item) => {
                    setMove(item);
                    setMoveDate(item.date);
                  },
                  editSchedule: (item) => {
                    if (item.plan) setPlanEdit(item.plan);
                  },
                }}
              />
            </WeekScene>
          </AnimatePresence>
        </div>
        <AnimatePresence>
          {editor && (
            <EventEditor
              key={editor.event?.id || editor.date}
              {...editor}
              onClose={() => setEditor(null)}
              onSave={(event, date) =>
                saveManual(placeManual(current.current.dayData, event, date))
              }
              onComplete={
                editor.event
                  ? async () => {
                      const event = {
                        ...editor.event!,
                        completed: !editor.event!.completed,
                        completedAt: editor.event!.completed
                          ? null
                          : new Date().toISOString(),
                      };
                      await saveManual(
                        placeManual(
                          current.current.dayData,
                          event,
                          editor.date,
                        ),
                        `Complete event:${event.id}`,
                      );
                    }
                  : undefined
              }
              onPreset={(event) =>
                execute(async () => {
                  const result = await planner.saveEventPreset({
                    event,
                  });
                  if (!result.success) throw new Error(result.message);
                  setPresets(result.data);
                  setEditor(null);
                }, `Save event preset:${event.id}`)
              }
            />
          )}
          {planDate && (
            <PlanWorkoutSheet
              key="plan-workout"
              templates={gym.templates}
              date={planDate}
              onClose={() => setPlanDate(null)}
              onSchedule={async (data: Blueprint, date: string, id: string) =>
                execute(async () => {
                  const result = await workouts.scheduleGymWorkout({
                    operationId: id,
                    data,
                    dates: [date],
                    timezone: zone,
                  });
                  if (!result.success) throw new Error(result.message);
                  setGym((value) => ({
                    ...value,
                    plans: [
                      ...value.plans.filter(
                        (plan) =>
                          !result.plans.some((added) => added.id === plan.id),
                      ),
                      ...result.plans,
                    ],
                  }));
                  notifyGymChange();
                }, `Schedule workout:${id}`)
              }
            />
          )}
          {quick && (
            <QuickWorkoutSheet
              key="quick-workout"
              item={quick}
              today={today}
              timezone={zone}
              onClose={() => setQuick(null)}
              onSaved={savedSession}
              onDetails={async (date, notes) =>
                openWorkout(quick, date, true, notes)
              }
            />
          )}
          {planEdit && (
            <PlanTimingSheet
              key="plan-timing"
              plan={planEdit}
              onClose={() => setPlanEdit(null)}
              onSave={async (date, timing, mutationId) => {
                const command = {
                  id: planEdit.id,
                  revision: planEdit.revision,
                  mutationId,
                  date,
                  timing,
                  timezone: planEdit.timezone,
                };
                await execute(async () => {
                  const result = await workouts.editGymPlanSchedule(command);
                  if (!result.success) throw new Error(result.message);
                  setGym((value) => ({
                    ...value,
                    plans: value.plans.map((plan) =>
                      plan.id === result.plan.id ? result.plan : plan,
                    ),
                  }));
                  notifyGymChange();
                }, `Edit schedule:${planEdit.id}`);
              }}
            />
          )}
          {preset && (
            <PresetSheet
              key="week-preset"
              preset={preset}
              selected={selected}
              onClose={() => setPreset(null)}
              onApply={async (preset, operationId) => {
                const command = {
                  operationId,
                  week: current.current.week,
                  before: current.current.dayData,
                  preset,
                  timezone: zone,
                };
                await execute(async () => {
                  const result = await planner.applyPlannerPreset(command);
                  if (!result.success) throw new Error(result.message);
                  current.current = {
                    ...current.current,
                    dayData: result.data,
                  };
                  setWeekData(current.current);
                  setGym(await workouts.getGymData());
                  notifyGymChange();
                }, `Apply preset:${operationId}`);
              }}
            />
          )}
          {weekPresetMode && (
            <WeekPresets
              mode={weekPresetMode}
              week={weekData.week}
              board={weekData.dayData}
              onClose={() => setWeekPresetMode(null)}
              onApply={(board) => {
                setWeekPresetMode(null);
                setPreset(board);
              }}
            />
          )}
          {eventPresetOpen && (
            <GymDialog
              key="event-presets"
              open
              title="Event presets"
              description="Choose a preset, adjust its time and date, then save a fresh planned event. Removing a preset keeps its existing scheduled events."
              onClose={() => setEventPresetOpen(false)}
            >
              {!presets.length && (
                <p className="text-muted-foreground">
                  Open event details and choose “Use as event preset” to save
                  one.
                </p>
              )}
              {presets.map((event) => (
                <div key={event.id} className="flex items-center gap-2">
                  <GymButton
                    className="flex-1 justify-start"
                    disabled={busy}
                    onClick={() => {
                      setEventPresetOpen(false);
                      setEditor({
                        date: selected,
                        event: {
                          ...event,
                          id: crypto.randomUUID(),
                          completed: false,
                          completedAt: null,
                        },
                      });
                    }}
                  >
                    {event.title}
                  </GymButton>
                  <GymButton
                    disabled={busy}
                    aria-label={`Remove event preset ${event.title}`}
                    onClick={() =>
                      setConfirm({
                        title: `Remove preset ${event.title}?`,
                        description:
                          "Removes only this reusable event preset. Existing scheduled events and completed records remain unchanged.",
                        action: () =>
                          execute(async () => {
                            const result = await planner.removeEventPreset({
                              id: event.id,
                            });
                            if (!result.success)
                              throw new Error(result.message);
                            setPresets(result.data);
                          }, `Remove preset:${event.id}`),
                      })
                    }
                  >
                    <Trash2 size={16} />
                  </GymButton>
                </div>
              ))}
            </GymDialog>
          )}
          {move && (
            <GymDialog
              key="move-event"
              open
              title="Move planned event"
              description="Keeps the local time, duration, notes, and other details."
              onClose={() => {
                if (!busy) setMove(null);
              }}
            >
              <GymSelect
                label="Destination date"
                value={moveDate}
                options={weekDates(selected)}
                onChange={setMoveDate}
              />
              <ScheduleConflictNotice
                date={moveDate}
                timing={move.timing}
                source={
                  move.plan
                    ? { kind: "workout", id: move.plan.id }
                    : { kind: "event", id: move.id, week: weekKey(move.date) }
                }
              />
              <GymButton
                disabled={busy}
                tone="blue"
                onClick={() =>
                  action(async () => {
                    await moveItem(move, moveDate, move.order);
                    setMove(null);
                  })
                }
              >
                Move event
              </GymButton>
              {error && (
                <p role="alert" className="gym-error">
                  {error}
                </p>
              )}
            </GymDialog>
          )}
          {active && (
            <SessionEditor
              key={`${active.id}:${sessionEpoch}`}
              session={active}
              history={gym.sessions}
              exercises={[
                ...gym.customExercises.map((item) => item.data),
                ...gymExerciseLibrary,
              ]}
              units={units}
              today={today}
              onCustom={async (definition) => {
                const result = await workouts.saveGymEntity({
                  id: definition.id,
                  revision: null,
                  mutationId: crypto.randomUUID(),
                  kind: "exercise",
                  data: definition,
                });
                if (!result.success) throw new Error(result.message);
                setGym(await workouts.getGymData());
              }}
              onReload={async () => {
                const next = await workouts.getGymData();
                setGym(next);
                setActive(
                  next.sessions.find((item) => item.id === active.id) || null,
                );
                setSessionEpoch((value) => value + 1);
              }}
              onSaved={savedSession}
              onReopened={(record) => {
                savedSession(record);
                setActive(record);
                setSessionEpoch((value) => value + 1);
              }}
              onClose={() => setActive(null)}
            />
          )}
          {confirm && (
            <Confirm
              key="event-confirm"
              title={confirm.title}
              description={confirm.description}
              onConfirm={confirm.action}
              onClose={() => setConfirm(null)}
            />
          )}
        </AnimatePresence>
      </main>
    </MotionConfig>
  );
}
import { exerciseLibrary as gymExerciseLibrary } from "@/lib/gym/library";
function WeekScene({
  direction,
  children,
}: {
  direction: number;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion(),
    present = useIsPresent();
  return (
    <motion.div
      className="min-w-0"
      style={{
        gridArea: "1 / 1",
      }}
      inert={!present}
      aria-hidden={!present || undefined}
      custom={direction}
      variants={{
        enter: (direction: number) => ({
          opacity: 0,
          x: reduced ? 0 : direction * 12,
        }),
        exit: (direction: number) => ({
          opacity: 0,
          x: reduced ? 0 : -direction * 12,
        }),
      }}
      initial="enter"
      animate={{
        opacity: 1,
        x: 0,
      }}
      exit="exit"
      transition={{
        duration: reduced ? 0 : 0.2,
        ease: "easeOut",
      }}
    >
      {children}
    </motion.div>
  );
}
