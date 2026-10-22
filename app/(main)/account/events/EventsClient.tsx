"use client";
import { notifyScheduleChange } from "@/lib/events/schedule-signal";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useIsPresent,
  useReducedMotion,
} from "framer-motion";
import type { EventContainer, EventItem, EventItems } from "@/types/types";
import type {
  Blueprint,
  GymData,
  PlanRecord,
  SessionRecord,
} from "@/lib/gym/types";
import { getUserEventsList } from "@/lib/actions/events.actions";
import { LoaderCircle, Plus, Trash2, CalendarDays } from "lucide-react";
import { calendarDay } from "@/lib/gym/validation";
import * as planner from "@/lib/actions/planner.actions";
import * as workouts from "@/lib/actions/gym.actions";
import {
  plannerItems,
  placeManual,
  weekDate,
  weekKey,
  weeksInYear,
  type PlannerItem,
} from "@/lib/events";
import { useAccountCalendar } from "@/hooks/use-account-calendar";
import {
  getAccountEventWindow,
  saveAccountEventWindow,
} from "@/lib/actions/calendar-window.actions";
import { weeklySummary } from "@/lib/gym/logic";
import { notifyGymChange, useGymSync } from "@/hooks/use-gym-sync";
import { useGymUnits } from "@/hooks/use-gym-units";
import { usePlannerMoves } from "@/hooks/use-planner-moves";
import BackgroundSaveStatus from "@/app/components/shared/BackgroundSaveStatus";
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
import EventSchedulesDialog from "./EventSchedulesDialog";
import { getEventSchedules, saveNewEventSchedule, saveScheduledEvent, stopScheduledEvents } from "@/lib/actions/event-schedules.actions";
import type { EventSchedule } from "@/lib/events/recurrence";
import ScheduleConflictNotice from "@/app/components/shared/account/ScheduleConflictNotice";
import Loader from "@/app/components/shared/loader";
import PlanWorkoutSheet from "./PlanWorkoutSheet";
import PresetSheet from "./PresetSheet";
import WeekPresets from "./WeekPresets";
import PlanTimingSheet from "./PlanTimingSheet";
import WorkoutDetailsSheet from "./WorkoutDetailsSheet";
import { workoutLink, type WorkoutLink } from "@/lib/gym/event-links";
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
  userId,
  eventPresets = [],
  eventSchedules = [],
}: {
  data: EventContainer;
  listOfWeeks: string[];
  gymData?: GymData;
  eventPresets?: EventItem[];
  userId: string;
  eventSchedules?: EventSchedule[];
}) {
  const { units } = useGymUnits();
  const { localDate, browserTimezone, weekDates, startsOn, hour12 } =
    useAccountCalendar();
  const [weekData, setWeekData] = useState(data),
    [gym, setGym] = useState(gymData || emptyGym()),
    [presets, setPresets] = useState(eventPresets);
  const [today, setToday] = useState(""),
    [selected, setSelected] = useState(weekDate(data.week)),
    [zone, setZone] = useState("UTC");
  const [saving, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("Saved"),
    [direction, setDirection] = useState(1);
  const [boardLoading, setBoardLoading] = useState<string | null>(null);
  const [schedules, setSchedules] = useState(eventSchedules), [schedulesOpen, setSchedulesOpen] = useState(false);
  const [editor, setEditor] = useState<{
      event?: EventItem;
      date: string;
      initialRepeat?: boolean;
    } | null>(null),
    [planDate, setPlanDate] = useState<string | null>(null);
  const [active, setActive] = useState<SessionRecord | null>(null),
    [sessionEpoch, setSessionEpoch] = useState(0),
    [preset, setPreset] = useState<EventItems[] | null>(null),
    [eventPresetOpen, setEventPresetOpen] = useState(false);
  const [move, setMove] = useState<PlannerItem | null>(null),
    [moveDate, setMoveDate] = useState(selected);
  const [planEdit, setPlanEdit] = useState<PlanRecord | null>(null);
  const [workoutDetail, setWorkoutDetail] = useState<PlannerItem | null>(null);
  const [linkEvent, setLinkEvent] = useState<PlannerItem | null>(null);
  const [linkTarget, setLinkTarget] = useState("");
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
  const moves = usePlannerMoves({ events: data, gym: gymData || emptyGym() }, snapshot => {
    current.current = snapshot.events;
    setWeekData(snapshot.events);
    setGym(snapshot.gym);
  }, userId);
  const busy = saving || moves.count > 0;
  useGymSync(fresh => { if (!moves.queue.getState().count) setGym(fresh); }, busy || !!active, selected);
  useEffect(() => {
    const date = localDate();
    setToday(date);
    setZone(browserTimezone());
    setSelected(weekKey(date) === data.week ? date : weekDate(data.week));
  }, [data.week, localDate, browserTimezone]);
  useEffect(() => {
    if (startsOn !== "sunday") return;
    let valid = true;
    const date = localDate();
    getAccountEventWindow(date)
      .then((dayData) => {
        if (valid && !lock.current && !moves.queue.getState().count) {
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
  }, [startsOn, localDate, moves.queue]);

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
    if (moves.queue.getState().count) throw new Error("Finish saving your changes before editing their details.");
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
        throw reason;
      } finally {
        setBoardLoading(null);
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
    if (moves.queue.getState().count) {
      try { await moves.queue.flush(); } catch { return; }
    }
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
    setBoardLoading("Loading week…");
    setError("");
    try {
      const [dayData, records] = await Promise.all([
        startsOn === "sunday"
          ? getAccountEventWindow(date)
          : getUserEventsList(week),
        workouts.getGymData(date),
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
    } finally {
      setBoardLoading(null);
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
  async function saveEditorEvent(event: EventItem, date: string) {
    calendarDay.parse(date);
    if (editor?.event?.scheduled) return updateScheduled(editor.event, event, date);
    if (weekDates(selected).includes(date)) {
      return saveManual(placeManual(current.current.dayData, event, date));
    }
    // Existing events stay in their displayed week. New events are written to
    // their date's canonical ISO week, rather than the board currently on screen.
    if (editor?.event)
      throw new Error("Choose a date in this event's displayed week.");
    const targetWeek = weekKey(date);
    let command:
      | {
          week: string;
          mutationId: string;
          before: EventItems[];
          data: EventItems[];
        }
      | undefined;
    await execute(async () => {
      if (!command) {
        const before = await getUserEventsList(targetWeek);
        command = {
          week: targetWeek,
          mutationId: crypto.randomUUID(),
          before,
          data: placeManual(before, event, date),
        };
      }
      // Keep the exact command on failure. A retry must neither duplicate the
      // event nor overwrite changes made after this target week was loaded.
      const result = await planner.saveEventBoard(command);
      if (!result.success) throw new Error(result.message);
      const dayData =
        startsOn === "sunday" ? await getAccountEventWindow(date) : result.data;
      setDirection(
        weekDate(targetWeek) >= weekDate(current.current.week) ? 1 : -1,
      );
      current.current = { ...current.current, week: targetWeek, dayData };
      setWeekData(current.current);
      setSelected(date);
    }, `Create event:${event.id}`);
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
    else if (item.session || item.plan) setWorkoutDetail(item);
  }
  function complete(item: PlannerItem) {
    if (item.manual) {
      const state = moves.queue.getState();
      if (lock.current || pending.current || state.failure) return;
      const board = state.count ? state.snapshot.events : current.current;
      const event = board.dayData.flatMap(day => day.tasks).find(event => event.id === item.manual!.id);
      if (!event) return;
      void moves.queue.enqueue({
        kind: "completion", id: event.id, completed: !event.completed,
        completedAt: event.completed ? null : new Date().toISOString(),
        anchor: selected, sunday: startsOn === "sunday",
      }, { events: current.current, gym }).catch(() => {});
    } else {
      const state = moves.queue.getState();
      if (lock.current || pending.current || state.failure) return;
      if (item.date > today) { setError("Choose today or a past date to record completion."); return; }
      const activityId = item.plan ? `workout:plan:${item.plan.id}` : `workout:session:${item.session!.id}`;
      void moves.queue.enqueue({ kind: "completion", id: activityId, completed: !item.completed,
        completedAt: item.completed ? null : new Date().toISOString(), anchor: selected, sunday: startsOn === "sunday",
      }, { events: current.current, gym }).catch(() => {});
    }
  }

  async function moveItem(item: PlannerItem, date: string, order: number) {
    if (lock.current || pending.current || moves.failure || (!item.manual && !item.plan)) return;
    // The event handler finishes immediately; the queue checks acknowledgements
    // and prepares subsequent moves from the confirmed board/plan revision.
    void moves.queue.enqueue({
      kind: item.manual ? "event" : "workout", id: item.manual?.id ?? item.plan!.id,
      date, order, anchor: selected, sunday: startsOn === "sunday",
    }, { events: current.current, gym }).catch(() => {});
  }
  async function linkWorkout(item: PlannerItem, target: PlannerItem | null) {
    const state = moves.queue.getState();
    if (!item.manual || lock.current || pending.current || state.failure) return;
    const reference: WorkoutLink | null = target ? workoutLink(target) : null;
    if (target && !reference) return;
    void moves.queue.enqueue({
      kind: "link", id: item.manual.id, workoutLink: reference,
      anchor: selected, sunday: startsOn === "sunday",
    }, { events: current.current, gym }).catch(() => {});
  }
  function remove(item: PlannerItem) {
    const command = item.manual
      ? null
      : {
          id: item.session?.id || item.plan!.id,
          kind: item.session ? ("session" as const) : ("plan" as const),
          date: item.date, revision: item.session?.revision ?? item.plan?.revision, mutationId: crypto.randomUUID(),
          archived: true,
        };
    setConfirm({
      title: `Remove ${item.title}?`,
      description: item.session
        ? "Removes this actual workout from visible history and completed totals. Its original plan is kept."
        : "Removes this scheduled event. Other events and workout results remain intact.",
      action: async () => {
        if (item.manual?.scheduled) await updateScheduled(item.manual, null, item.date);
        else if (item.manual)
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
            setGym(await workouts.getGymData(selected));
            notifyGymChange();
          }, `Remove workout:${item.id}`);
      },
    });
  }
  async function updateScheduled(before: EventItem, event: EventItem | null, date: string) {
    const operationId = crypto.randomUUID();
    await execute(async () => {
      const result = await saveScheduledEvent({ operationId, before, event, date }, userId);
      if (!result.success) throw new Error(result.message);
      const dayData = startsOn === "sunday" ? await getAccountEventWindow(selected) : await getUserEventsList(current.current.week);
      current.current = { ...current.current, dayData }; setWeekData(current.current);
      notifyScheduleChange();
    }, `Update scheduled event:${before.id}`);
  }
  if (!today) return <p role="status">Loading event calendar…</p>;
  const items = plannerItems(weekData.dayData, gym, selected, startsOn),
    summary = weeklySummary(gym.sessions, weekDates(selected), gym.plans);
  const [selectedYear, selectedWeek] = weekData.week.split("-WK");
  const weekOptions = Array.from(
    { length: weeksInYear(selectedYear) },
    (_, index) => String(index + 1),
  );
  const yearOptions = [
    ...new Set([
      ...Array.from({ length: 301 }, (_, index) => String(1900 + index)),
      selectedYear,
      ...listOfWeeks.flatMap(
        (week) => /^(\d{4})-WK\d{1,2}$/.exec(week)?.[1] ?? [],
      ),
    ]),
  ]
    .sort()
    .reverse();
  return (
    <MotionConfig reducedMotion="user">
      <main className="gym-scope min-w-0 space-y-5 pb-8">
        {boardLoading && <Loader label={boardLoading} />}
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className=" text-blue-300 mb-2 text-xs font-semibold uppercase tracking-[.16em]">
              Your week, connected
            </p>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-semibold">Events</h1>
              {busy && !moves.failure && <span role="status" aria-live="polite" className="flex items-center">
                <LoaderCircle aria-hidden="true" size={20} className="animate-spin text-primary motion-reduce:animate-none" />
                <span className="sr-only">Saving events</span>
              </span>}
            </div>
          </div>
        </header>
        <div
          className="flex flex-wrap justify-between gap-2"
          aria-label="Event calendar controls"
        >
          <div className="flex gap-2">
            <GymButton
              tone="blue"
              disabled={busy}
              onClick={() => setEditor({ date: selected })}
            >
              <Plus size={18} aria-hidden="true" /> Add event
            </GymButton>
            <GymButton disabled={busy} onClick={() => setSchedulesOpen(true)}><CalendarDays size={18} aria-hidden="true" /> Schedules</GymButton>
            <Select
              name="week"
              disabled={busy}
              value={selectedWeek}
              onValueChange={(week) => switchWeek(`${selectedYear}-WK${week}`)}
            >
              <SelectTrigger
                aria-label="Week"
                className="min-h-11 w-32 rounded-2xl"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent visibleItems={5}>
                {weekOptions.map((week) => (
                  <SelectItem key={week} value={week}>
                    Week {week}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              name="year"
              disabled={busy}
              value={selectedYear}
              onValueChange={(year) =>
                switchWeek(
                  `${year}-WK${Math.min(Number(selectedWeek), weeksInYear(year))}`,
                )
              }
            >
              <SelectTrigger
                aria-label="Year"
                className="min-h-11 w-36 rounded-2xl"
              >
                <span className="text-muted-foreground">Year</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent visibleItems={5}>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <GymButton disabled={busy} onClick={() => setEventPresetOpen(true)}>
              Event presets
            </GymButton>
            <GymButton
              disabled={busy}
              onClick={() => setWeekPresetMode("save")}
            >
              Save week preset
            </GymButton>
            <GymButton
              disabled={busy}
              onClick={() => setWeekPresetMode("apply")}
            >
              Apply week preset
            </GymButton>
          </div>
        </div>

        <WeekNavigator
          selected={selected}
          today={today}
          onSelect={(date) => {
            if (weekKey(date) === current.current.week) setSelected(date);
            else action(() => switchWeek(weekKey(date), date));
          }}
        />
        <div className="grid grid-cols-3 gap-2 rounded-3xl border border-border bg-card/20 p-4">
          <div>
            <p className="text-2xl font-semibold text-center">
              {items.filter((item) => item.manual && item.completed).length}
            </p>
            <p className="text-xs text-muted-foreground text-center">Completed events</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-center">{summary.workouts}</p>
            <p className="text-xs text-muted-foreground text-center">Completed workouts</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-center">
              {items.filter((item) => !item.completed).length}
            </p>
            <p className="text-xs text-muted-foreground text-center">Unfinished</p>
          </div>
        </div>
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
        <p role="status" aria-live="polite" className="sr-only">{message}</p>
        <BackgroundSaveStatus count={moves.count} failure={moves.failure} showProgress={false}
          onRetry={() => { void moves.queue.retry().catch(() => {}); }}
          onDiscard={() => { if (moves.queue.discard()) action(() => switchWeek(current.current.week, selected)); }} />
        <div className="grid min-w-0" aria-busy={busy} inert={saving || !!moves.failure}>
          <AnimatePresence initial={false} custom={direction}>
            <WeekScene key={weekData.week} direction={direction}>
              <EventsBoard
                items={items}
                completions={moves.completions}
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
                  link: linkWorkout,
                  linkDialog: (item) => { setLinkEvent(item); setLinkTarget(""); },
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
              dates={weekDates(selected)}
              onClose={() => setEditor(null)}
              onSave={saveEditorEvent}
              onSchedule={async (schedule, operationId) => {
                await execute(async () => {
                  const result = await saveNewEventSchedule({ schedule, operationId });
                  if (!result.success) throw new Error(result.message);
                  setSchedules(await getEventSchedules());
                  const dayData = startsOn === "sunday" ? await getAccountEventWindow(selected) : await getUserEventsList(current.current.week);
                  current.current = { ...current.current, dayData }; setWeekData(current.current);
                  notifyScheduleChange();
                }, `Create schedule:${schedule.id}`);
              }}
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
                      if (editor.event!.scheduled) { await updateScheduled(editor.event!, event, editor.date); return; }
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
          {schedulesOpen && <EventSchedulesDialog schedules={schedules} onClose={() => setSchedulesOpen(false)} onCreate={() => { setSchedulesOpen(false); setEditor({ date: selected, initialRepeat: true }); }} onStop={async (schedule, operationId) => {
            const result = await stopScheduledEvents({ id: schedule.id, revision: schedule.revision, operationId });
            if (!result.success) throw new Error(result.message);
            setSchedules(await getEventSchedules());
            const dayData = startsOn === "sunday" ? await getAccountEventWindow(selected) : await getUserEventsList(current.current.week);
            current.current = { ...current.current, dayData }; setWeekData(current.current);
            notifyScheduleChange();
          }} />}
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
          {planEdit && (
            <PlanTimingSheet
              key="plan-timing"
              plan={planEdit}
              onClose={() => setPlanEdit(null)}
              onSave={async (date, timing, mutationId) => {
                const command = {
                  id: planEdit.id,
                  from: planEdit.date,
                  revision: planEdit.revision,
                  mutationId,
                  date,
                  timing,
                  timezone: planEdit.timezone,
                };
                await execute(async () => {
                  const result = await workouts.moveGymPlan(command, userId);
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
                  setGym(await workouts.getGymData(selected));
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
                if (!saving) setMove(null);
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
          {linkEvent && (
            <GymDialog open title={`Link ${linkEvent.title}`} description="Choose a workout in this week. The event keeps its date, time and completion state." onClose={() => setLinkEvent(null)}>
              {items.some(item => !item.manual) ? <>
                <div className="grid gap-2"><label htmlFor="event-workout-link" className="text-sm font-medium">Workout</label>
                  <Select value={linkTarget} onValueChange={setLinkTarget}>
                    <SelectTrigger id="event-workout-link"><SelectValue placeholder="Choose a workout" /></SelectTrigger>
                    <SelectContent>{items.filter(item => !item.manual).map(item => <SelectItem key={item.id} value={item.id}>{item.title} · {item.date}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <GymButton tone="blue" disabled={!linkTarget} onClick={() => {
                  const target = items.find(item => item.id === linkTarget);
                  if (!target) return;
                  void linkWorkout(linkEvent, target);
                  setLinkEvent(null);
                }}>Link event</GymButton>
              </> : <p className="text-sm text-muted-foreground">Plan or record a workout in this week first.</p>}
            </GymDialog>
          )}
          {workoutDetail && (
            <WorkoutDetailsSheet key={workoutDetail.id} item={workoutDetail} history={gym.sessions} units={units}
              onClose={() => setWorkoutDetail(null)}
              onSession={record => { setWorkoutDetail(null); setActive(record); }}
              onStart={() => { setWorkoutDetail(null); action(() => openWorkout(workoutDetail)); }}
              onSchedule={() => { setWorkoutDetail(null); if (workoutDetail.plan) setPlanEdit(workoutDetail.plan); }}
            />
          )}
          {active && (
            <SessionEditor owner={userId}
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
                setGym(await workouts.getGymData(selected));
              }}
              onReload={async () => {
                const next = await workouts.getGymData(selected);
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
