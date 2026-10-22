"use client";
import { useAccountCalendar } from "@/hooks/use-account-calendar";

import { useEffect, useId, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type KeyboardCoordinateGetter,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, useReducedMotion } from "framer-motion";
import {
  Dumbbell,
  GripVertical,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import { Card } from "@/app/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  comparePlannerItems,
  destinationOrder,
  type PlannerItem,
} from "@/lib/events";

import type { Units } from "@/lib/gym/types";
import { eventLinksWorkout } from "@/lib/gym/event-links";
import { timeLabel } from "@/lib/planner-time";
import { dateLabel } from "@/lib/gym/dates";
import { GymButton } from "../gym/GymUI";
import EventCompletionCheckbox, { type EventCompletionPending } from "./EventCompletionCheckbox";
export type EventBoardActions = {
  create: (date: string) => void;
  plan: (date: string) => void;
  detail: (item: PlannerItem) => void;
  complete: (item: PlannerItem) => void;
  start: (item: PlannerItem) => void;
  remove: (item: PlannerItem) => void;
  move: (item: PlannerItem, date: string, order: number) => Promise<void>;
  moveDialog: (item: PlannerItem) => void;
  editSchedule: (item: PlannerItem) => void;
  link: (item: PlannerItem, workout: PlannerItem | null) => Promise<void>;
  linkDialog: (item: PlannerItem) => void;
};
export default function EventsBoard({
  items,
  completions,
  selected,
  today,
  hour12,
  units,
  actions,
}: {
  items: PlannerItem[];
  completions?: readonly EventCompletionPending[];
  selected: string;
  today: string;
  hour12: boolean;
  units: Units;
  actions: EventBoardActions;
}) {
  const { weekDates } = useAccountCalendar();
  const reduced = useReducedMotion(),
    id = useId();
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const [active, setActive] = useState<PlannerItem | null>(null),
    [preview, setPreview] = useState<PlannerItem[] | null>(null),
    [overId, setOverId] = useState<string | null>(null);
  const visible = preview || items;
  // A sensor keeps its initial options; read the latest preview for successive key presses.
  const keyboardItems = useRef(visible);
  const keyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.code)
    )
      return;
    event.preventDefault();
    const source = keyboardItems.current.find(
        (item) => item.id === args.active,
      ),
      rect = args.context.collisionRect;
    if (!source || !rect) return;
    let target: string | undefined;
    if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
      const days = weekDates(selected),
        index = days.indexOf(source.date),
        date = days[index + (event.code === "ArrowLeft" ? -1 : 1)];
      if (date) target = `day:${date}`;
    } else if (!source.timing?.start) {
      const siblings = keyboardItems.current.filter(
          (item) =>
            item.date === source.date && !item.timing?.start && (!item.session || item.plan),
        ),
        index = siblings.findIndex((item) => item.id === source.id);
      target = siblings[index + (event.code === "ArrowUp" ? -1 : 1)]?.id;
    }
    const destination = target ? args.context.droppableRects.get(target) : null;
    if (destination)
      return {
        x: destination.left + destination.width / 2 - rect.width / 2,
        y: destination.top + destination.height / 2 - rect.height / 2,
      };
  };
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: keyboardCoordinates,
    }),
  );
  const destination = (over: string) =>
    over.startsWith("day:")
      ? over.slice(4)
      : visible.find((item) => item.id === over)?.date;
  function over(event: DragOverEvent) {
    if (!active || !event.over) {
      setOverId(null);
      return;
    }
    const target = String(event.over.id);
    if (target.startsWith("workout-link:") && active.manual) {
      setOverId(target);
      setPreview(items);
      keyboardItems.current = items;
      return;
    }
    const
      date = destination(target);
    if (!date || target === active.id) return;
    setOverId(target);
    const source = visible.find((item) => item.id === active.id);
    const insertAfter =
      source?.date === date &&
      visible.findIndex((item) => item.id === target) >
        visible.findIndex((item) => item.id === active.id);
    const order = destinationOrder(
      visible.filter((item) => item.date === date),
      target,
      active.id,
      insertAfter,
    );
    const next = visible
      .map((item) =>
        item.id === active.id
          ? {
              ...item,
              date,
              order,
            }
          : item,
      )
      .sort(
        (a, b) => a.date.localeCompare(b.date) || comparePlannerItems(a, b),
      );
    keyboardItems.current = next;
    setPreview(next);
  }
  function end(event: DragEndEvent) {
    const moved = preview?.find((item) => item.id === active?.id);
    setActive(null);
    setPreview(null);
    setOverId(null);
    if (event.over && active?.manual && String(event.over.id).startsWith("workout-link:")) {
      const workout = items.find(item => item.id === String(event.over!.id).slice("workout-link:".length));
      if (workout && !workout.manual) void actions.link(active, workout).catch(() => {});
      return;
    }
    if (
      !event.over ||
      !active ||
      !moved ||
      (active.date === moved.date && active.order === moved.order)
    )
      return;
    void actions.move(active, moved.date, moved.order).catch(() => {});
  }
  const day = (date: string) => (
    <Day
      key={date}
      date={date}
      today={today}
      items={visible.filter((item) => item.date === date)}
      completions={completions}
      active={active}
      overId={overId}
      hour12={hour12}
      units={units}
      actions={actions}
      workouts={visible.filter(item => !item.manual)}
    />
  );
  return (
    <DndContext
      id={id}
      sensors={sensors}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Press Space to lift. Left and right move between days; up and down reorder untimed events. Press Space to drop or Escape to cancel. On mobile, use the Move to day menu.",
        },
      }}
      collisionDetection={(args) => {
        const pointer = pointerWithin(args);
        const workout = pointer.filter(collision => String(collision.id).startsWith("workout-link:"));
        if (workout.length) return workout;
        return pointer.length ? pointer : closestCenter(args);
      }}
      onDragStart={(event) => {
        const item = items.find((item) => item.id === event.active.id);
        if (item) {
          keyboardItems.current = items;
          setActive(item);
          setPreview(items);
        }
      }}
      onDragOver={over}
      onDragEnd={end}
      onDragCancel={() => {
        setActive(null);
        setPreview(null);
        setOverId(null);
      }}
    >
      {desktop ? (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {weekDates(selected).map(day)}
        </div>
      ) : (
        <div>{day(selected)}</div>
      )}
      <DragOverlay
        dropAnimation={
          reduced
            ? null
            : {
                duration: 220,
                easing: "ease-out",
              }
        }
      >
        {active && (
          <motion.div
            initial={
              reduced
                ? false
                : {
                    scale: 1,
                  }
            }
            animate={{
              scale: reduced ? 1 : 1.025,
            }}
            transition={{
              duration: 0.16,
            }}
            data-event-tone={active.manual ? active.manual.tone || "blue" : undefined}
            className={cn(
              "events-drag-preview rounded-2xl border bg-background p-4 shadow-2xl",
              active.manual?.tone === "orange" ? "gym-orange" : "gym-blue",
            )}
          >
            <div className="flex gap-2">
              <GripVertical size={18} />
              <strong className="wrap-anywhere">{active.title}</strong>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {active.manual?.category || "Training"}
              {active.timing?.start && <> · {timeLabel(active.timing, hour12)}</>}
            </p>
          </motion.div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
function Day({
  date,
  today,
  items,
  completions,
  active,
  overId,
  hour12,
  units,
  actions,
  workouts,
}: {
  date: string;
  today: string;
  items: PlannerItem[];
  completions?: readonly EventCompletionPending[];
  active: PlannerItem | null;
  overId: string | null;
  hour12: boolean;
  units: Units;
  actions: EventBoardActions;
  workouts: PlannerItem[];
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day:${date}`,
  });
  const destination =
    isOver || !!(active && overId && items.some((item) => item.id === overId));
  const siblings = items.filter((item) => !item.timing?.start && !item.session);
  return (
    <Card
      ref={setNodeRef}
      className={cn(
        "min-w-0 gap-3 rounded-3xl border p-3 transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none",
        destination && "events-drop-day",
      )}
    >
      <h3 className="rounded-2xl bg-muted/40 p-3 font-semibold">
        {dateLabel(date, {
          weekday: "long",
          day: "numeric",
          month: "short",
        })}
        {date === today && " · Today"}
      </h3>
      <SortableContext
        items={items.filter((item) => !item.session).map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                active &&
                  overId === item.id &&
                  !item.timing?.start &&
                  !(active.manual && !item.manual) &&
                  (items.findIndex((candidate) => candidate.id === active.id) >
                  items.findIndex((candidate) => candidate.id === item.id)
                    ? "events-insertion-after"
                    : "events-insertion"),
              )}
            >
              <EventCard
                item={item}
                completion={completions?.find(completion => completion.id === item.id)}
                dragging={active?.id === item.id}
                hour12={hour12}
                units={units}
                actions={actions}
                acceptsLink={!!active?.manual && !item.manual}
                linkedWorkout={item.manual ? workouts.find(workout => eventLinksWorkout(item.manual!, workout)) : undefined}
                onShift={(offset) => {
                  const place = siblings.findIndex(
                      (candidate) => candidate.id === item.id,
                    ),
                    target = siblings[place + offset];
                  if (target)
                    void actions
                      .move(
                        item,
                        date,
                        offset < 0 ? target.order - 1 : target.order + 1,
                      )
                      .catch(() => {});
                }}
                upDisabled={
                  siblings.findIndex((candidate) => candidate.id === item.id) <=
                    0 ||
                  !!item.timing?.start ||
                  !!item.session && !item.plan
                }
                downDisabled={
                  siblings.findIndex((candidate) => candidate.id === item.id) >=
                    siblings.length - 1 ||
                  !!item.timing?.start ||
                  !!item.session && !item.plan
                }
              />
            </div>
          ))}
        </div>
      </SortableContext>
      {!items.length && (
        <p className="px-3 py-4 text-sm text-muted-foreground">
          Plan an event or a workout for this day.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <GymButton onClick={() => actions.create(date)}>
          <Plus />
          Add event
        </GymButton>
        <GymButton tone="blue" onClick={() => actions.plan(date)}>
          <Dumbbell />
          Plan workout
        </GymButton>
      </div>
    </Card>
  );
}
function EventCard({
  item,
  completion,
  dragging,
  hour12,
  actions,
  acceptsLink,
  linkedWorkout,
}: {
  item: PlannerItem;
  completion?: EventCompletionPending;
  dragging: boolean;
  hour12: boolean;
  units: Units;
  actions: EventBoardActions;
  acceptsLink: boolean;
  linkedWorkout?: PlannerItem;
  onShift: (offset: number) => void;
  upDisabled: boolean;
  downDisabled: boolean;
}) {
  const reduced = useReducedMotion();
  const { setNodeRef, attributes, listeners, transform, transition } =
    useSortable({
      id: item.id,
      disabled: { draggable: !!item.session && !item.plan, droppable: !!item.session && !item.plan || acceptsLink },
      transition: reduced
        ? null
        : {
            duration: 220,
            easing: "ease-out",
          },
    });
  const { setNodeRef: setLinkNode, isOver: linkOver } = useDroppable({ id: `workout-link:${item.id}`, disabled: !acceptsLink });
  const exercises = item.session?.data.exercises || item.plan?.data.exercises;
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: dragging ? 0.15 : 1,
      }}
    >
      <motion.article
        ref={setLinkNode}
        onClick={item.manual ? undefined : event => {
          if ((event.target as HTMLElement).closest("button, a, label, [role=checkbox], [role=menuitem]")) return;
          actions.detail(item);
        }}
        initial={
          reduced
            ? false
            : {
                opacity: 0,
                y: 6,
              }
        }
        animate={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          duration: reduced ? 0 : 0.18,
        }}
        data-completed={item.completed}
        data-event-tone={item.manual ? item.manual.tone || "blue" : item.completed ? "green" : "blue"}
        className={cn(
          "events-card min-w-0 rounded-2xl border p-3",
          !item.manual && "cursor-pointer",
          linkOver && "ring-2 ring-[var(--event-accent)] shadow-[0_0_20px_color-mix(in_srgb,var(--event-accent)_15%,transparent)]",
          item.completed || item.manual?.tone === "orange"
            ? "gym-orange"
            : "gym-blue",
        )}
      >
        <header className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-start gap-x-2">
          <EventCompletionCheckbox title={item.title} checked={item.completed} pending={completion} onChange={() => actions.complete(item)} />
          <h4 className={cn("min-w-0 wrap-anywhere font-semibold transition-colors duration-200 motion-reduce:transition-none", item.completed ? "text-muted-foreground" : "text-foreground")}>
            {item.manual ? item.title : <button type="button" className="w-full cursor-pointer rounded-md text-left focus-visible:outline-2 focus-visible:outline-[var(--event-accent)]" onClick={() => actions.detail(item)}>{item.title}</button>}
          </h4>
          <div className="-mt-1 flex items-center gap-1">
          {(!item.session || item.plan) && (
            <GymButton
              {...attributes}
              {...listeners}
              aria-label={`Drag ${item.title}`}
              className="touch-none px-2"
            >
              <GripVertical size={18} />
            </GymButton>

          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <GymButton aria-label={`Menu for ${item.title}`} className="px-2">
                <MoreHorizontal size={18} />
              </GymButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="gym-menu rounded-2xl p-2">
              <DropdownMenuItem
                className="min-h-11"
                onSelect={() => actions.detail(item)}
              >
                {item.manual
                  ? "Edit / details"
                  : "Workout details / history"}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-h-11"
                onSelect={() => actions.complete(item)}
              >
                {item.completed
                  ? "Reopen"
                  : item.manual
                    ? "Complete"
                    : "Complete / Log workout"}
              </DropdownMenuItem>
              {item.plan && (
                <DropdownMenuItem
                  className="min-h-11"
                  onSelect={() => actions.editSchedule(item)}
                >
                  Edit scheduled date / time
                </DropdownMenuItem>
              )}
              {item.manual && <DropdownMenuItem className="min-h-11" onSelect={() => actions.linkDialog(item)}>Link to workout</DropdownMenuItem>}
              {item.manual?.workoutLink && <DropdownMenuItem className="min-h-11" onSelect={() => { void actions.link(item, null); }}>Unlink workout</DropdownMenuItem>}
              {(!item.session || item.plan) && (
                <DropdownMenuItem
                  className="min-h-11"
                  onSelect={() => actions.moveDialog(item)}
                >
                  Move to day
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="min-h-11"
                onSelect={() => actions.remove(item)}
              >
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </header>
        <p className="pl-8 text-xs leading-relaxed text-muted-foreground">
          {item.manual?.category || "Training"}
          {item.timing?.start && <> · {timeLabel(item.timing, hour12)}</>}
        </p>
        {exercises && <button type="button" aria-label={`Open ${item.title} workout and history`} onClick={() => actions.detail(item)} className="mt-2 block w-full cursor-pointer rounded-lg pl-8 text-left text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-[var(--event-accent)]">
          <span className="block space-y-1">{exercises.slice(0, 2).map(exercise => <span key={exercise.id} className="block truncate">{exercise.definition.name}</span>)}</span>
          {exercises.length > 2 && <span className="mt-1 block tracking-[0.2em]" aria-label={`${exercises.length - 2} more exercises`}>...</span>}
          {!exercises.length && <span>Open workout</span>}
        </button>}
        {item.manual?.workoutLink && <p className="mt-2 flex items-center gap-1.5 pl-8 text-xs text-muted-foreground"><Dumbbell size={13} aria-hidden="true" />Linked to {linkedWorkout?.title || "workout"}</p>}
        {acceptsLink && <p className="mt-2 rounded-lg border border-dashed border-[var(--event-accent)] p-2 text-center text-xs text-[var(--event-accent)]">Drop event here to link</p>}
        {item.manual?.notes && (
          <p className="mt-2 whitespace-pre-wrap wrap-anywhere pl-8 text-sm leading-relaxed text-muted-foreground">
            {item.manual.notes}

          </p>
        )}
        {item.session &&
          item.plan &&
          item.session.data.date !== item.plan.date && (
            <p className="mb-3 text-xs text-muted-foreground">
              Actual: {dateLabel(item.session.data.date)} · Scheduled:{" "}
              {dateLabel(item.plan.date)}
            </p>
          )}

      </motion.article>
    </div>
  );
}
