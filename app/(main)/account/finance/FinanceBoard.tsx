"use client";
import { useAccountFormat } from "@/hooks/use-account-format";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCorners,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDownLeft,
  ArrowUpRight,
  GripVertical,
  Pencil,
  Plus,
  ArrowLeftRight,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import {
  summarizeFinance,
  type FinanceEntry,
  type MoneyType,
} from "@/lib/finance";
import HoldDeleteButton from "./HoldDeleteButton";

type BoardProps = {
  entries: FinanceEntry[];
  busy: boolean;
  onAdd: (type: MoneyType) => void;
  onEdit: (entry: FinanceEntry) => void;
  onMove: (entry: FinanceEntry, type: MoneyType) => void;
  onReorder: (activeId: string, overId: string) => void;
  onDelete: (entry: FinanceEntry) => Promise<void>;
};

export default function FinanceBoard(props: BoardProps) {
  const { formatAmount } = useAccountFormat();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const active = props.entries.find((entry) => entry.id === activeId);
  function drop(event: DragEndEvent) {
    setActiveId(null);
    if (props.busy || !event.over || event.active.id === event.over.id) return;
    const entry = props.entries.find((row) => row.id === event.active.id);
    const target = props.entries.find((row) => row.id === event.over?.id);
    const type =
      event.over.id === "spending-lane"
        ? "-"
        : event.over.id === "revenue-lane"
          ? "+"
          : target?.type;
    if (!entry || !type) return;
    if (entry.type !== type) props.onMove(entry, type);
    else if (target) props.onReorder(entry.id, target.id);
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <p>
          Drag the grip to reorder or move cards. Hold a trash icon to delete.
        </p>
        <p className="text-xs">Card order is saved on this device.</p>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(event) => setActiveId(String(event.active.id))}
        onDragEnd={drop}
        onDragCancel={() => setActiveId(null)}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              "Press Space to pick up a transaction. Use arrow keys to move it. Press Space to drop, or Escape to cancel. You can also use its Move button.",
          },
        }}
      >
        <div className="grid items-start gap-5 md:grid-cols-2">
          <MoneyLane {...props} type="-" />
          <MoneyLane {...props} type="+" />
        </div>
        <DragOverlay>
          {active && (
            <div className="rounded-2xl border border-primary bg-card p-4 shadow-2xl">
              <p className="text-sm font-medium">
                {active.subcategory || active.category}
              </p>
              <p
                className={`mt-2 text-xl font-semibold ${active.type === "+" ? "text-sky-300" : "text-orange-300"}`}
              >
                {active.type}
                {formatAmount(active.amount)}
              </p>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function MoneyLane({ type, ...props }: BoardProps & { type: MoneyType }) {
  const { formatAmount } = useAccountFormat();
  const revenue = type === "+";
  const { setNodeRef, isOver } = useDroppable({
    id: revenue ? "revenue-lane" : "spending-lane",
    disabled: props.busy,
  });
  const entries = props.entries.filter((entry) => entry.type === type);
  const totals = summarizeFinance(entries);
  const color = revenue ? "text-sky-300" : "text-orange-300";
  return (
    <section
      ref={setNodeRef}
      aria-label={revenue ? "Revenue board" : "Spending board"}
      className={`min-w-0 rounded-3xl border p-3 transition-colors sm:p-4 ${isOver ? (revenue ? "border-sky-400 bg-sky-400/10" : "border-orange-400 bg-orange-400/10") : "border-border bg-card/40"}`}
    >
      <div className="mb-4 flex items-center gap-3 px-1 pt-1">
        <div
          className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${revenue ? "bg-sky-400/10" : "bg-orange-400/10"} ${color}`}
        >
          {revenue ? <ArrowDownLeft size={21} /> : <ArrowUpRight size={21} />}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">
            {revenue ? "Revenue" : "Spending"}{" "}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              {entries.length}
            </span>
          </h2>
          <p className={`mt-0.5 text-xl font-semibold tabular-nums ${color}`}>
            {formatAmount(revenue ? totals.revenue : totals.spending)}
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="size-11 rounded-xl"
          disabled={props.busy}
          aria-label={`Add ${revenue ? "revenue" : "spending"}`}
          onClick={() => props.onAdd(type)}
        >
          <Plus />
        </Button>
      </div>
      <SortableContext
        items={entries.map((entry) => entry.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="min-h-32 space-y-3">
          {entries.map((entry) => (
            <MoneyCard key={entry.id} entry={entry} {...props} />
          ))}
          {!entries.length && (
            <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-border px-4 text-center">
              <p className="text-sm font-medium">
                {revenue ? "Give your income a home" : "Start with one expense"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add a transaction or drop a card here.
              </p>
              <Button
                variant="ghost"
                disabled={props.busy}
                className={`mt-3 h-11 ${color}`}
                onClick={() => props.onAdd(type)}
              >
                <Plus size={16} /> Add {revenue ? "revenue" : "spending"}
              </Button>
            </div>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

function MoneyCard({
  entry,
  busy,
  onEdit,
  onMove,
  onDelete,
}: BoardProps & { entry: FinanceEntry }) {
  const { formatAmount, formatFinanceDate } = useAccountFormat();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id, disabled: busy });
  const revenue = entry.type === "+";
  return (
    <article
      ref={setNodeRef}
      data-finance-id={entry.id}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm ${isDragging ? "opacity-30" : ""}`}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground wrap-anywhere">
            {entry.category || "Uncategorized"}
          </p>
          <h3 className="mt-1 text-base font-medium wrap-anywhere">
            {entry.subcategory || entry.category || "Transaction"}
          </h3>
        </div>
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          disabled={busy}
          aria-label={`Drag ${entry.subcategory || entry.category}`}
          className="-mr-2 -mt-2 flex size-11 shrink-0 touch-none items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring cursor-grab active:cursor-grabbing disabled:opacity-40"
        >
          <GripVertical size={20} />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
        <p
          className={`text-xl font-semibold tabular-nums ${revenue ? "text-sky-300" : "text-orange-300"}`}
        >
          {revenue ? "+" : "−"}
          {formatAmount(entry.amount)}
        </p>
        <time
          dateTime={entry.date}
          className="pb-0.5 text-xs text-muted-foreground"
        >
          {formatFinanceDate(entry.date)}
        </time>
      </div>
      {entry.comment && (
        <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground wrap-anywhere">
          {entry.comment}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-border pt-2">
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => onEdit(entry)}
          className="h-11 flex-1 text-xs"
          aria-label={`Edit ${entry.subcategory || entry.category}`}
        >
          <Pencil size={14} /> Edit
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => onMove(entry, revenue ? "-" : "+")}
          className="h-11 flex-1 text-xs"
          aria-label={`Move ${entry.subcategory || entry.category} to ${revenue ? "spending" : "revenue"}`}
        >
          <ArrowLeftRight size={14} /> Move to{" "}
          {revenue ? "spending" : "revenue"}
        </Button>
        <HoldDeleteButton
          compact
          label={entry.subcategory || entry.category || "transaction"}
          disabled={busy}
          onConfirm={() => onDelete(entry)}
        />
      </div>
    </article>
  );
}
  