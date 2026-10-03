"use client";
import { useAccountCalendar } from "@/hooks/use-account-calendar";

import { useEffect, useId, useRef, useState } from "react";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, pointerWithin, useDroppable, useSensor, useSensors, type KeyboardCoordinateGetter, type DragEndEvent, type DragOverEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowUp, BookOpen, Briefcase, CalendarDays, Check, Coffee, Dumbbell, GripVertical, MoreHorizontal, Plus } from "lucide-react";
import { Card } from "@/app/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { comparePlannerItems, destinationOrder, type PlannerItem } from "@/lib/events";

import { sessionSummary, durationLabel, decimalLabel, distanceDisplay } from "@/lib/gym/logic";
import type { Units } from "@/lib/gym/types";
import { timeLabel } from "@/lib/planner-time";
import { dateLabel } from "@/lib/gym/dates";
import { GymButton } from "../gym/GymUI";
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
};
export default function EventsBoard({
  items,
  selected,
  today,
  hour12,
  units,
  actions
}: {
  items: PlannerItem[];
  selected: string;
  today: string;
  hour12: boolean;
  units: Units;
  actions: EventBoardActions;
}) {
  const { weekDates }=useAccountCalendar();
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
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.code)) return;
    event.preventDefault();
    const source = keyboardItems.current.find(item => item.id === args.active),
      rect = args.context.collisionRect;
    if (!source || !rect) return;
    let target: string | undefined;
    if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
      const days = weekDates(selected),
        index = days.indexOf(source.date),
        date = days[index + (event.code === "ArrowLeft" ? -1 : 1)];
      if (date) target = `day:${date}`;
    } else if (!source.timing?.start) {
      const siblings = keyboardItems.current.filter(item => item.date === source.date && !item.timing?.start && !item.session),
        index = siblings.findIndex(item => item.id === source.id);
      target = siblings[index + (event.code === "ArrowUp" ? -1 : 1)]?.id;
    }
    const destination = target ? args.context.droppableRects.get(target) : null;
    if (destination) return {
      x: destination.left + destination.width / 2 - rect.width / 2,
      y: destination.top + destination.height / 2 - rect.height / 2
    };
  };
  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8
    }
  }), useSensor(KeyboardSensor, {
    coordinateGetter: keyboardCoordinates
  }));
  const destination = (over: string) => over.startsWith("day:") ? over.slice(4) : visible.find(item => item.id === over)?.date;
  function over(event: DragOverEvent) {
    if (!active || !event.over) {
      setOverId(null);
      return;
    }
    const target = String(event.over.id),
      date = destination(target);
    if (!date || target === active.id) return;
    setOverId(target);
    const source = visible.find(item => item.id === active.id);
    const insertAfter = source?.date === date && visible.findIndex(item => item.id === target) > visible.findIndex(item => item.id === active.id);
    const order = destinationOrder(visible.filter(item => item.date === date), target, active.id, insertAfter);
    const next = visible.map(item => item.id === active.id ? {
      ...item,
      date,
      order
    } : item).sort((a, b) => a.date.localeCompare(b.date) || comparePlannerItems(a, b));
    keyboardItems.current = next;
    setPreview(next);
  }
  function end(event: DragEndEvent) {
    const moved = preview?.find(item => item.id === active?.id);
    setActive(null);
    setPreview(null);
    setOverId(null);
    if (!event.over || !active || !moved || active.date === moved.date && active.order === moved.order) return;
    void actions.move(active, moved.date, moved.order).catch(() => {});
  }
  const day = (date: string) => <Day key={date} date={date} today={today} items={visible.filter(item => item.date === date)} active={active} overId={overId} hour12={hour12} units={units} actions={actions} />;
  return <DndContext id={id} sensors={sensors} accessibility={{
    screenReaderInstructions: {
      draggable: "Press Space to lift. Left and right move between days; up and down reorder untimed events. Press Space to drop or Escape to cancel. On mobile, use the Move to day menu."
    }
  }} collisionDetection={args => {
    const pointer = pointerWithin(args);
    return pointer.length ? pointer : closestCenter(args);
  }} onDragStart={event => {
    const item = items.find(item => item.id === event.active.id);
    if (item) {
      keyboardItems.current = items;
      setActive(item);
      setPreview(items);
    }
  }} onDragOver={over} onDragEnd={end} onDragCancel={() => {
    setActive(null);
    setPreview(null);
    setOverId(null);
  }}>
  {desktop ? <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{weekDates(selected).map(day)}</div> : <div>{day(selected)}</div>}
  <DragOverlay dropAnimation={reduced ? null : {
      duration: 220,
      easing: "ease-out"
    }}>
   {active && <motion.div initial={reduced ? false : {
        scale: 1
      }} animate={{
        scale: reduced ? 1 : 1.025
      }} transition={{
        duration: 0.16
      }} className={cn("events-drag-preview rounded-2xl border bg-background p-4 shadow-2xl", active.manual?.tone === "orange" ? "gym-orange" : "gym-blue")}>
    <div className="flex gap-2"><GripVertical size={18} /><strong className="wrap-anywhere">{active.title}</strong></div><p className="mt-2 text-sm text-muted-foreground">{timeLabel(active.timing, hour12)} · {active.completed ? "Completed" : "Planned"}</p>
   </motion.div>}
  </DragOverlay>
 </DndContext>;
}
function Day({
  date,
  today,
  items,
  active,
  overId,
  hour12,
  units,
  actions
}: {
  date: string;
  today: string;
  items: PlannerItem[];
  active: PlannerItem | null;
  overId: string | null;
  hour12: boolean;
  units: Units;
  actions: EventBoardActions;
}) {
  const {
    setNodeRef,
    isOver
  } = useDroppable({
    id: `day:${date}`
  });
  const destination = isOver || !!(active && overId && items.some(item => item.id === overId));
  const siblings = items.filter(item => !item.timing?.start && !item.session);
  return <Card ref={setNodeRef} className={cn("min-w-0 gap-3 rounded-3xl border p-3 transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none", destination && "events-drop-day")}>
  <h3 className="rounded-2xl bg-muted/40 p-3 font-semibold">{dateLabel(date, {
        weekday: "long",
        day: "numeric",
        month: "short"
      })}{date === today && " · Today"}</h3>
  <SortableContext items={items.filter(item => !item.session).map(item => item.id)} strategy={verticalListSortingStrategy}>
   <div className="space-y-3">{items.map(item => <div key={item.id} className={cn(active && overId === item.id && !item.timing?.start && (items.findIndex(candidate => candidate.id === active.id) > items.findIndex(candidate => candidate.id === item.id) ? "events-insertion-after" : "events-insertion"))}>
    <EventCard item={item} dragging={active?.id === item.id} hour12={hour12} units={units} actions={actions} onShift={offset => {
            const place = siblings.findIndex(candidate => candidate.id === item.id),
              target = siblings[place + offset];
            if (target) void actions.move(item, date, offset < 0 ? target.order - 1 : target.order + 1).catch(() => {});
          }} upDisabled={siblings.findIndex(candidate => candidate.id === item.id) <= 0 || !!item.timing?.start || !!item.session} downDisabled={siblings.findIndex(candidate => candidate.id === item.id) >= siblings.length - 1 || !!item.timing?.start || !!item.session} />
   </div>)}</div>
  </SortableContext>
  {!items.length && <p className="px-3 py-4 text-sm text-muted-foreground">Plan an event or a workout for this day.</p>}
  <div className="flex flex-wrap gap-2"><GymButton onClick={() => actions.create(date)}><Plus />Add event</GymButton><GymButton tone="blue" onClick={() => actions.plan(date)}><Dumbbell />Plan workout</GymButton></div>
 </Card>;
}
const icons = {
  calendar: CalendarDays,
  book: BookOpen,
  work: Briefcase,
  coffee: Coffee,
  workout: Dumbbell
};
function EventCard({
  item,
  dragging,
  hour12,
  units,
  actions,
  onShift,
  upDisabled,
  downDisabled
}: {
  item: PlannerItem;
  dragging: boolean;
  hour12: boolean;
  units: Units;
  actions: EventBoardActions;
  onShift: (offset: number) => void;
  upDisabled: boolean;
  downDisabled: boolean;
}) {
  const reduced = useReducedMotion();
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition
  } = useSortable({
    id: item.id,
    disabled: !!item.session,
    transition: reduced ? null : {
      duration: 220,
      easing: "ease-out"
    }
  });
  const Icon = icons[item.manual?.icon || (item.manual ? "calendar" : "workout")],
    summary = item.session ? sessionSummary(item.session.data) : null;
  return <div ref={setNodeRef} style={{
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: dragging ? 0.15 : 1
  }}>
  <motion.article initial={reduced ? false : {
      opacity: 0,
      y: 6
    }} animate={{
      opacity: 1,
      y: 0
    }} transition={{
      duration: reduced ? 0 : 0.18
    }} data-completed={item.completed} className={cn("events-card min-w-0 rounded-2xl border p-3", item.completed || item.manual?.tone === "orange" ? "gym-orange" : "gym-blue")}>
   <header className="flex items-start gap-2"><Icon className="mt-1 shrink-0" size={18} /><div className="min-w-0 flex-1"><h4 className="wrap-anywhere font-semibold text-foreground">{item.title}</h4><p className="mt-1 text-xs text-muted-foreground">{item.manual?.category || "Training"} · {timeLabel(item.timing, hour12)}</p></div>
    {!item.session && <GymButton {...attributes} {...listeners} aria-label={`Drag ${item.title}`} className="touch-none px-2"><GripVertical size={18} /></GymButton>}
    <DropdownMenu><DropdownMenuTrigger asChild><GymButton aria-label={`Menu for ${item.title}`} className="px-2"><MoreHorizontal size={18} /></GymButton></DropdownMenuTrigger><DropdownMenuContent className="gym-menu rounded-2xl p-2">
     <DropdownMenuItem className="min-h-11" onSelect={() => actions.detail(item)}>{item.manual ? "Edit / details" : item.completed ? "View results" : item.session ? "Continue workout" : "Plan details / time"}</DropdownMenuItem>
     <DropdownMenuItem className="min-h-11" onSelect={() => actions.complete(item)}>{item.completed ? "Reopen" : item.manual ? "Complete" : "Complete / Log workout"}</DropdownMenuItem>
     {item.plan && <DropdownMenuItem className="min-h-11" onSelect={() => actions.editSchedule(item)}>Edit scheduled date / time</DropdownMenuItem>}
     {!item.session && <DropdownMenuItem className="min-h-11" onSelect={() => actions.moveDialog(item)}>Move to day</DropdownMenuItem>}
     <DropdownMenuItem className="min-h-11" onSelect={() => actions.remove(item)}>Remove</DropdownMenuItem>
    </DropdownMenuContent></DropdownMenu>
   </header>
   <p className="my-3 flex min-h-6 items-center gap-2 text-sm font-medium"><AnimatePresence initial={false}>{item.completed && <motion.span key="checked" initial={reduced ? false : {
            opacity: 0,
            scale: 0.7
          }} animate={{
            opacity: 1,
            scale: 1
          }} exit={{
            opacity: 0
          }} transition={{
            duration: reduced ? 0 : 0.18
          }}><Check size={17} /></motion.span>}</AnimatePresence>{item.completed ? summary && !summary.exercises ? "Completed — no details logged" : "Completed" : item.session ? "Active workout" : "Planned"}</p>
   {item.manual?.notes && <p className="mb-3 whitespace-pre-wrap wrap-anywhere text-sm text-muted-foreground">{item.manual.notes}</p>}
   {item.session && item.plan && item.session.data.date !== item.plan.date && <p className="mb-3 text-xs text-muted-foreground">Actual: {dateLabel(item.session.data.date)} · Planned: {dateLabel(item.plan.date)}</p>}
   {summary && summary.exercises > 0 && <div className="mb-3 space-y-1 text-sm text-muted-foreground"><p>{summary.exercises} exercises · {summary.sets} completed sets{summary.timedSeconds ? ` · ${durationLabel(summary.timedSeconds)} timed work` : ""}</p>{Object.entries(summary.cardio).map(([activity, value]) => <p key={activity}>{activity} · {durationLabel(value.seconds)} · {value.knownDistances ? `${decimalLabel(distanceDisplay(value.distanceKm, units))} ${units.distance}` : "Distance unknown"}</p>)}</div>}
   <div className="flex flex-wrap gap-2">{item.manual ? <><GymButton tone={item.completed ? "neutral" : "orange"} aria-label={`${item.completed ? "Reopen" : "Complete"} ${item.title}`} onClick={() => actions.complete(item)}><Check size={16} />{item.completed ? "Reopen" : "Complete"}</GymButton><GymButton onClick={() => actions.detail(item)}>Details</GymButton></> : item.completed ? <><GymButton tone="orange" onClick={() => actions.detail(item)}>View results</GymButton><GymButton onClick={() => actions.complete(item)}>Reopen</GymButton></> : <><GymButton tone="orange" onClick={() => actions.start(item)}>{item.session ? "Continue workout" : "Start workout"}</GymButton><GymButton onClick={() => actions.complete(item)}>Complete / Log workout</GymButton></>}
    {!item.session && !item.timing?.start && <><GymButton aria-label={`Move ${item.title} up`} disabled={upDisabled} onClick={() => onShift(-1)}><ArrowUp size={16} /></GymButton><GymButton aria-label={`Move ${item.title} down`} disabled={downDisabled} onClick={() => onShift(1)}><ArrowDown size={16} /></GymButton></>}
   </div>
  </motion.article>
 </div>;
}
