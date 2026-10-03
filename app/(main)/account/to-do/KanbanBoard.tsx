"use client";

import { useEffect, useId, useRef, useState } from "react";
import { DndContext, DragOverlay, MeasuringStrategy, closestCenter, pointerWithin, defaultDropAnimationSideEffects, useDroppable, useSensor, useSensors, type DragEndEvent, type DragMoveEvent, type KeyboardCoordinateGetter } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useReducedMotion } from "framer-motion";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Textarea } from "@/app/components/ui/textarea";
import { updateToDoList } from "@/lib/actions/todo.actions";
import { useTodoBoard } from "@/hooks/use-todo-board";
import { keyboardTodoDestination, moveTodoTask, taskGroup, type TodoBoard, type TodoDestination, type TodoTask } from "@/lib/todo";
import { TodoKeyboardSensor, TodoMouseSensor, TodoTouchSensor } from "./TodoSensors";

type LiftedTask = { task: TodoTask; groupId: string; width: number; height: number; slotOffset: number; groupHeights: Record<string, number> };
const groupTone = (groupId: string) => {
  switch (groupId) {
    case "backlog": return "orange";
    case "in-progress": return "yellow";
    case "done": return "green";
    default: return "blue";
  }
};
export default function KanbanBoard({ data }: { data: TodoBoard }) {
  const board = useTodoBoard(data, updateToDoList), reduced = useReducedMotion(), contextId = useId();
  const [active, setActive] = useState<LiftedTask | null>(null), [preview, setPreview] = useState<TodoBoard | null>(null), [drop, setDrop] = useState<TodoDestination | "trash" | null>(null);
  const [settling, setSettling] = useState(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (settleTimer.current !== null) clearTimeout(settleTimer.current); }, []);
  const visible = preview || board.data;
  const drag = useRef<LiftedTask | null>(null), view = useRef(board.data), keyboard = useRef(false), keyboardTarget = useRef<TodoDestination | null>(null), suppressClickUntil = useRef(0);
  useEffect(() => { if (!drag.current) view.current = board.data; }, [board.data]);
  const domId = (id: string) => `${contextId}-task-${id}`;
  const keyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
    const destination = keyboardTodoDestination(view.current, String(args.active), event.code);
    if (!destination || !args.context.collisionRect) return;
    const source = taskGroup(view.current, String(args.active));
    const index = source?.items.findIndex(task => task.id === args.active) ?? -1;
    const neighbour = source?.items[index + (event.code === "ArrowUp" ? -1 : 1)];
    const targetGroup = view.current.find(group => group.id === destination.groupId);
    const last = targetGroup?.items.filter(task => task.id !== args.active).at(-1);
    const vertical = event.code === "ArrowUp" || event.code === "ArrowDown";
    const target = vertical ? neighbour?.id : destination.beforeId || last?.id || destination.groupId;
    const rect = target ? args.context.droppableRects.get(target) : null;
    if (!rect) return;
    event.preventDefault(); keyboardTarget.current = destination;
    const y = vertical ? rect.top + (event.code === "ArrowDown" ? rect.height - args.context.collisionRect.height : 0) : target === destination.groupId ? rect.top + (drag.current?.slotOffset || 76) : destination.beforeId ? rect.top : rect.bottom + 8;
    return { x: rect.left + rect.width / 2 - args.context.collisionRect.width / 2, y };
  };
  const sensors = useSensors(
    useSensor(TodoMouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TodoTouchSensor, { activationConstraint: { delay: 240, tolerance: 8 } }),
    useSensor(TodoKeyboardSensor, { coordinateGetter: keyboardCoordinates, scrollBehavior: reduced ? "auto" : "smooth" })
  );
  function showPreview(event: DragMoveEvent) {
    const lifted = drag.current;
    if (!lifted || !event.over) { setDrop(null); return; }
    const id = String(event.over.id);
    if (id === "trash") { setDrop("trash"); return; }
    let destination: TodoDestination | null = null;
    if (keyboard.current) {
      destination = keyboardTarget.current;
      keyboardTarget.current = null;
      if (!destination) return;
    } else {
      if (id === lifted.task.id) return;
      const target = view.current.find(group => group.id === id) || taskGroup(view.current, id);
      if (!target) { setDrop(null); return; }
      const center = event.active.rect.current.translated;
      const y = center ? center.top + center.height / 2 : event.over.rect.top;
      const items = target.items.filter(task => task.id !== lifted.task.id);
      const index = items.findIndex(task => task.id === id);
      destination = { groupId: target.id, beforeId: index >= 0 ? (y > event.over.rect.top + event.over.rect.height / 2 ? items[index + 1]?.id ?? null : id) : (y < event.over.rect.top + 60 ? items[0]?.id ?? null : null) };
    }
    const next = moveTodoTask(view.current, lifted.task.id, destination);
    view.current = next; setPreview(next); setDrop(destination);
  }
  function reset() {
    drag.current = null; keyboardTarget.current = null;
    setActive(null); setPreview(null); setDrop(null);
    suppressClickUntil.current = Date.now() + 350;
    // Let the previous preview finish before another pickup creates a second overlay.
    if (!reduced) {
      setSettling(true);
      if (settleTimer.current !== null) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => { setSettling(false); settleTimer.current = null; }, 220);
    }
  }
  function restoreFocus(id: string, groupId?: string) {
    requestAnimationFrame(() => (document.getElementById(domId(id)) || (groupId ? document.getElementById(domId(groupId)) : null))?.focus({ preventScroll: true }));
  }
  function end(event: DragEndEvent) {
    const lifted = drag.current;
    if (!lifted) return;
    const next = event.over?.id === "trash" ? view.current.map(group => ({ ...group, items: group.items.filter(task => task.id !== lifted.task.id) })) : view.current;
    reset();
    if (!event.over) { view.current = board.current.current; restoreFocus(lifted.task.id, lifted.groupId); return; }
    void board.commit(next).then(() => restoreFocus(lifted.task.id, lifted.groupId));
  }
  const label = (id: string) => view.current.flatMap(group => group.items).find(task => task.id === id)?.content || drag.current?.task.content || "Task";
  const position = (id: string) => {
    const group = taskGroup(view.current, id);
    return group ? `position ${group.items.findIndex(task => task.id === id) + 1} of ${group.items.length} in ${group.title}` : "its original position";
  };
  return <div className="todo-board" data-saving={board.saving} onClickCapture={event => {
    if (Date.now() < suppressClickUntil.current) { event.preventDefault(); event.stopPropagation(); }
  }}>
    <span role="status" className="sr-only" aria-live="polite">{board.status}</span>
    <div className="grid grid-cols-[1fr_50px] md:grid-cols-[1fr_200px] 2xl:grid-cols-[1fr_300px] gap-4">
      <DndContext id={contextId} sensors={sensors} measuring={{ droppable: { strategy: MeasuringStrategy.Always } }} accessibility={{
        screenReaderInstructions: { draggable: "Press Space or Enter to lift this task. Up and down reorder tasks; left and right move between existing groups. Press Space or Enter to drop, or Escape to cancel." },
        announcements: {
          onDragStart: ({ active }) => `Picked up ${label(String(active.id))}. ${position(String(active.id))}.`,
          onDragOver: ({ active, over }) => over?.id === "trash" ? `Delete target. Drop to delete ${label(String(active.id))}.` : over ? `${label(String(active.id))}, ${position(String(active.id))}.` : "Outside a drop target. Dropping here cancels the move.",
          onDragEnd: ({ active, over }) => !over ? "Move canceled. Original position restored." : over.id === "trash" ? "Task removed. Saving change." : `Dropped ${label(String(active.id))}, ${position(String(active.id))}. Saving change.`,
          onDragCancel: () => "Move canceled. Original position restored."
        }
      }} collisionDetection={args => {
        if (!args.pointerCoordinates) return closestCenter(args);
        const hits = pointerWithin(args);
        const taskHits = hits.filter(hit => hit.id === "trash" || view.current.some(group => group.items.some(task => task.id === hit.id)));
        return taskHits.length ? taskHits : hits;
      }} onDragStart={event => {
        if (board.busy.current || settling) return;
        const source = taskGroup(board.current.current, String(event.active.id)), task = source?.items.find(task => task.id === event.active.id);
        // Dnd-kit can emit pickup before its initial rectangle is populated.
        const rect = event.active.rect.current.initial || document.getElementById(domId(String(event.active.id)))?.getBoundingClientRect();
        if (!task || !source || !rect) return;
        const groupHeights = Object.fromEntries(board.current.current.map(group => [group.id, document.getElementById(domId(`group:${group.id}`))?.getBoundingClientRect().height || 160]));
        const groupTop = document.getElementById(domId(`group:${source.id}`))?.getBoundingClientRect().top;
        const firstTop = document.getElementById(domId(source.items[0].id))?.getBoundingClientRect().top;
        const lifted = { task, groupId: source.id, width: rect.width, height: rect.height, groupHeights, slotOffset: groupTop !== undefined && firstTop !== undefined ? firstTop - groupTop : 76 };
        drag.current = lifted; view.current = board.current.current; keyboard.current = event.activatorEvent.type === "keydown";
        suppressClickUntil.current = Infinity;
        setActive(lifted); setPreview(board.current.current); setDrop(null);
      }} onDragMove={showPreview} onDragOver={showPreview} onDragEnd={end} onDragCancel={() => {
        const id = drag.current?.task.id; reset(); view.current = board.current.current;
        if (id) restoreFocus(id);
      }}>
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-5">
          {visible.map(group => <TaskGroup key={group.id} group={group} domId={domId} reduced={Boolean(reduced)} disabled={board.saving || settling} draggingId={active?.task.id || null} minimumHeight={active?.groupHeights[group.id]} insertion={drop && drop !== "trash" && drop.groupId === group.id ? drop : null} commit={board.commit} />)}
        </div>
        <DragOverlay adjustScale={false} dropAnimation={reduced ? null : { duration: 200, easing: "ease-out", sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0" } } }) }}>
          {active && <div className="todo-task todo-drag-preview rounded border p-3" data-tone={drop === "trash" ? "red" : groupTone(drop ? drop.groupId : active.groupId)} style={{ width: active.width, height: active.height }}>
            <div className="flex items-center gap-3 wrap-anywhere"><span className="text-lg">{active.task.content}</span></div>
          </div>}
        </DragOverlay>
        <TrashDropZone active={Boolean(active)} />
      </DndContext>
    </div>
  </div>;
}

function SortableTask({ task, groupId, domId, disabled, reduced, insertion }: { task: TodoTask; groupId: string; domId: string; disabled: boolean; reduced: boolean; insertion: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled, transition: reduced ? null : { duration: 200, easing: "ease-out" } });
  return <li id={domId} ref={node => { setNodeRef(node); setActivatorNodeRef(node); }} {...attributes} {...listeners} aria-label={`${task.content}, ${groupId === "done" ? "completed" : groupId.replaceAll("-", " ")}`} aria-roledescription="sortable task" data-dragging={isDragging} data-insertion={insertion} data-completed={groupId === "done"} data-tone={groupTone(groupId)} style={{ transform: CSS.Transform.toString(transform), transition: reduced ? undefined : `${transition ? `${transition}, ` : ""}color 180ms, border-color 180ms, background-color 180ms, box-shadow 180ms` }} className="todo-task rounded border p-3">
    <div className="todo-task-body flex items-center gap-3 cursor-grab"><span className="wrap-anywhere text-lg">{task.content}</span></div>
  </li>;
}

function TaskGroup({ group, domId, reduced, disabled, draggingId, minimumHeight, insertion, commit }: { group: TodoBoard[number]; domId: (id: string) => string; reduced: boolean; disabled: boolean; draggingId: string | null; minimumHeight?: number; insertion: TodoDestination | null; commit: (update: (board: TodoBoard) => TodoBoard) => Promise<boolean> }) {
  const { setNodeRef } = useDroppable({ id: group.id });
  const [input, setInput] = useState(false), [value, setValue] = useState("");
  const dragging = Boolean(draggingId);
  function add() {
    if (!value.trim() || disabled || dragging) return;
    const task = { id: crypto.randomUUID(), content: value.trim(), ...(group.id === "done" ? { completedAt: new Date().toISOString() } : {}) };
    void commit(board => board.map(current => current.id === group.id ? { ...current, items: [...current.items, task] } : current));
    setValue(""); setInput(false);
  }
  return <Card id={domId(`group:${group.id}`)} ref={setNodeRef} style={{ minHeight: minimumHeight }} className="todo-group flex h-full min-h-40 flex-col rounded-md border p-3" data-drop-target={Boolean(insertion)} data-tone={groupTone(group.id)}>
    <h3 className="todo-group-title mb-2 font-medium">{group.title}</h3>
    <SortableContext items={group.items.map(task => task.id)} strategy={verticalListSortingStrategy}>
      <ul className="flex flex-col gap-2" aria-label={`${group.title} tasks`}>
        {group.items.map(task => <SortableTask key={task.id} task={task} groupId={group.id} domId={domId(task.id)} disabled={disabled} reduced={reduced} insertion={Boolean(insertion) && task.id === draggingId} />)}
      </ul>
    </SortableContext>
    <div className="flex justify-center">
      {!input ? <Button id={domId(group.id)} disabled={disabled || dragging} onClick={() => setInput(true)} className="todo-add flex items-center gap-2 border-2 mb-2" aria-label={`Add task to ${group.title}`}><Plus />Add task</Button> : <form onSubmit={event => { event.preventDefault(); add(); }} className="w-full flex flex-col items-center">
        <Textarea autoFocus value={value} disabled={disabled || dragging} maxLength={10000} onChange={event => setValue(event.target.value)} placeholder="Enter task..." aria-label={`New task in ${group.title}`} className="todo-input w-full rounded border p-2" onKeyDown={event => { if (event.key === "Escape") { setValue(""); setInput(false); } }} onBlur={() => { if (!value.trim()) setInput(false); }} />
        <Button variant="secondary" disabled={disabled || dragging || !value.trim()} className="todo-add w-1/3 mt-2" type="submit" aria-label={`Save task to ${group.title}`}>+</Button>
      </form>}
    </div>
  </Card>;
}

function TrashDropZone({ active }: { active: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: "trash" });
  return <div ref={setNodeRef} className="todo-trash flex-center w-full hidden md:block rounded-md border-2 min-h-30" data-active={active} data-over={isOver} aria-label="Delete task drop zone">
    <div className="flex flex-col items-center gap-3 py-3">
      <Trash2 aria-hidden className="todo-trash-icon size-6 md:size-9" />
      <p className="hidden md:block text-xl font-bold text-center">{isOver ? "Drop to delete" : "Delete"}</p>
      {isOver && <span className="sr-only md:hidden">Drop to delete task</span>}
    </div>
  </div>;
}
