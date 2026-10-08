"use client";
import { useAccountFormat } from "@/hooks/use-account-format";

import {
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import * as Dialog from "@radix-ui/react-dialog";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Grip,
  GripVertical,
  History,
  LoaderCircle,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import {
  categoryKey,
  categoryRing,
  financeSliderMaxForAmount,
  stepFinanceSliderMax,
  type CategoryRingCell,
  type FinanceCategory,
} from "@/lib/finance-playground";
import { localDate, type FinanceEntry, type MoneyType } from "@/lib/finance";
import { financeEntrySchema } from "@/types/validators";
import AmountInput from "./AmountInput";
import FinanceSelect from "./FinanceSelect";
import { financeDialogClass, type EntryDraft } from "./FinanceEditor";

import { useAccountPreferences } from "@/app/components/shared/account/AccountPreferencesProvider";
import { cashMinor, displayCash } from "@/lib/account/decimal";
const categoryCoordinates =
  (
    selected: () => string | null,
    select: (id: string) => void,
  ): KeyboardCoordinateGetter =>
  (event, { currentCoordinates, context }) => {
    const directions: Record<string, [number, number]> = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    };
    const direction = directions[event.code];
    if (!direction || !context.collisionRect) return;
    event.preventDefault();
    const selectedId = selected();
    const rect =
      (selectedId && context.droppableRects.get(selectedId)) ||
      context.activeNode?.getBoundingClientRect() ||
      context.collisionRect;
    const x = rect.left + rect.width / 2,
      y = rect.top + rect.height / 2;
    const targets = context.droppableContainers
      .getEnabled()
      .flatMap((container) => {
        const activeCategory = context.active?.data.current?.category;
        const targetCategory = container.data.current?.category;
        if (
          activeCategory &&
          targetCategory &&
          activeCategory.type !== targetCategory.type
        )
          return [];
        const target = context.droppableRects.get(container.id);
        if (!target) return [];
        const dx = target.left + target.width / 2 - x,
          dy = target.top + target.height / 2 - y;
        const distance = dx * direction[0] + dy * direction[1];
        if (distance <= 4) return [];
        return [
          {
            id: String(container.id),
            target,
            score:
              distance + Math.abs(dx * direction[1] - dy * direction[0]) * 2,
          },
        ];
      })
      .sort((a, b) => a.score - b.score);
    if (!targets[0]) return;
    select(targets[0].id);
    const target = targets[0].target;
    return {
      x:
        currentCoordinates.x +
        target.left +
        target.width / 2 -
        context.collisionRect.left -
        context.collisionRect.width / 2,
      y:
        currentCoordinates.y +
        target.top +
        target.height / 2 -
        context.collisionRect.top -
        context.collisionRect.height / 2,
    };
  };

export default function FinancePlayground({
  categories,
  entries,
  historyEntries = entries,
  busy: parentBusy,
  recovery,
  initialAmount = "50.00",
  categoryVersion = 0,
  onAdd,
  onSave,
  onCreateCategory,
  onRemoveCategory,
  onReorderCategory,
}: {
  categories: FinanceCategory[];
  entries: FinanceEntry[];
  historyEntries?: FinanceEntry[];
  busy: boolean;
  recovery?: React.ReactNode;
  initialAmount?: string;
  categoryVersion?: number;
  onAdd: (type: MoneyType) => void;
  onSave: (id: string | null, draft: EntryDraft) => Promise<void>;
  onCreateCategory: (category: FinanceCategory) => Promise<number>;
  onRemoveCategory: (category: FinanceCategory) => Promise<void>;
  onReorderCategory: (active: FinanceCategory, target: FinanceCategory) => void;
}) {
  const { formatAmount } = useAccountFormat();
  const { settings } = useAccountPreferences();
  const currency = settings.preferences.financeDefaultCurrency;
  const dragContextId = useId();
  const [amount, setAmount] = useState(initialAmount);
  const [date, setDate] = useState(localDate);
  const [detail, setDetail] = useState("");
  const [note, setNote] = useState("");
  const [range, setRange] = useState(500);
  const [dragging, setDragging] = useState(false);
  const [targetType, setTargetType] = useState<MoneyType | null>(null);
  const [draggedCategory, setDraggedCategory] =
    useState<FinanceCategory | null>(null);
  const [dragSize, setDragSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [trashOver, setTrashOver] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<FinanceCategory | null>(null);
  const [removing, setRemoving] = useState<FinanceCategory | null>(null);
  const busy = parentBusy || removing !== null;
  const [adding, setAdding] = useState<{
    type: MoneyType;
    version: number;
  } | null>(null);
  const [pages, setPages] = useState({ "+": 0, "-": 0 });
  const savingRef = useRef(false);
  const keyboardDrag = useRef(false);
  const keyboardTarget = useRef<string | null>(null);
  const reduceMotion = useReducedMotion();
  const sliderProgress = useMotionValue(0.1);
  const previousDetails = useMemo(
    () =>
      [
        ...new Set(
          [...historyEntries]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((entry) => entry.subcategory?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ].slice(0, 30),
    [historyEntries],
  );
  const validation = financeEntrySchema.safeParse({
    type: "-",
    amount,
    date,
    category: "preview",
    subcategory: detail,
    comment: note,
  });
  const valid = validation.success;
  const disabled = busy || !valid;
  const allRevenue = categories.filter((category) => category.type === "+"),
    allSpending = categories.filter((category) => category.type === "-");
  const revenuePage = Math.min(
    pages["+"],
    Math.max(0, Math.ceil(allRevenue.length / 15) - 1),
  );
  const spendingPage = Math.min(
    pages["-"],
    Math.max(0, Math.ceil(allSpending.length / 15) - 1),
  );
  const revenue = allRevenue.slice(revenuePage * 9, revenuePage * 9 + 15),
    spending = allSpending.slice(spendingPage * 9, spendingPage * 9 + 15);
  const ring = categoryRing(revenue.length, spending.length);
  const sliderMax = range;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: categoryCoordinates(
        () => keyboardTarget.current,
        (id) => {
          keyboardTarget.current = id;
        },
      ),
    }),
  );
  const categoryTotal = (category: FinanceCategory) =>
    displayCash(
      entries
        .filter(
          (entry) =>
            entry.type === category.type &&
            entry.category?.trim().toLocaleLowerCase("en") ===
              category.name.trim().toLocaleLowerCase("en"),
        )
        .reduce((sum, entry) => sum + cashMinor(entry.amount), 0n),
    );

  function changeAmount(value: string) {
    setAmount(value);
    setError("");
    setSaved(null);
    const max = financeSliderMaxForAmount(range, Number(value) || 0);
    setRange(max);
    animate(
      sliderProgress,
      Math.min(1, Math.max(0, Number(value) / max || 0)),
      { duration: reduceMotion ? 0 : 0.16 },
    );
  }
  function changeRange(direction: 1 | -1) {
    const next = stepFinanceSliderMax(range, direction);
    setRange(next);
    const value = Math.min(next, Math.max(0, Number(amount) || 0));
    if (Number(amount) > next) {
      setAmount(value.toFixed(2));
      setSaved(null);
      setError("");
    }
    animate(sliderProgress, value / next, {
      duration: reduceMotion ? 0 : 0.16,
    });
  }
  async function addTo(category: FinanceCategory) {
    if (busy || savingRef.current || draggedCategory) return;
    const draft = {
      currency,
      type: category.type,
      amount,
      date,
      category: category.name,
      subcategory: detail,
      comment: note,
    };
    const parsed = financeEntrySchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    savingRef.current = true;
    setError("");
    setSaved(null);
    try {
      await onSave(null, draft);
      setSaved(category);
      setAmount("0.00");
      setDetail("");
      setNote("");
      sliderProgress.set(0);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not save. Your amount is still here.",
      );
    } finally {
      savingRef.current = false;
    }
  }

  function cancelDrag() {
    setDragging(false);
    setDraggedCategory(null);
    setTrashOver(false);
    setTargetType(null);
    keyboardTarget.current = null;
    keyboardDrag.current = false;
  }
  async function finishCategoryDrag(
    category: FinanceCategory,
    target: string | number | undefined | null,
  ) {
    if (busy || savingRef.current) return;
    if (target === "category-action") {
      savingRef.current = true;
      setRemoving(category);
      setError("");
      try {
        await onRemoveCategory(category);
        setSaved(null);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not remove the category. Try again.",
        );
      } finally {
        savingRef.current = false;
        setRemoving(null);
      }
    } else {
      const over = categories.find((item) => categoryKey(item) === target);
      if (over && over.type === category.type)
        onReorderCategory(category, over);
    }
  }

  function tiles(
    type: MoneyType,
    group: FinanceCategory[],
    slots: typeof ring.revenue,
  ) {
    return (
      <div
        className={`finance-category-group ${type === "+" ? "finance-revenue-group" : "finance-spending-group"}`}
      >
        {group.map((category, index) => (
          <CategoryTile
            key={categoryKey(category)}
            category={category}
            busy={busy}
            disabled={disabled || dragging}
            position={slots[index]}
            mobileSpan={mobileCellSpan(index, group.length)}
            compact={ring.dense}
            dragging={dragging}
            saved={!!saved && categoryKey(saved) === categoryKey(category)}
            total={categoryTotal(category)}
            onAdd={() => {
              void addTo(category);
            }}
            onRemove={() => {
              void finishCategoryDrag(category, "category-action");
            }}
          />
        ))}
      </div>
    );
  }
  function pager(type: MoneyType, count: number, page: number) {
    return (
      count > 15 && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label={`Previous ${type === "+" ? "revenue" : "spending"} categories`}
            disabled={page === 0 || busy}
            onClick={() =>
              setPages((previous) => ({ ...previous, [type]: page - 1 }))
            }
          >
            <ChevronLeft size={16} />
          </Button>
          <span className="text-xs text-muted-foreground">
            {page + 1}/{Math.ceil(count / 15)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label={`Next ${type === "+" ? "revenue" : "spending"} categories`}
            disabled={(page + 1) * 15 >= count || busy}
            onClick={() =>
              setPages((previous) => ({ ...previous, [type]: page + 1 }))
            }
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      )
    );
  }

  const dragOverlay = (
    <DragOverlay zIndex={60} dropAnimation={reduceMotion ? null : undefined}>
      {dragging && (
        <motion.div
          data-amount-preview
          data-category-preview={!!draggedCategory}
          data-target-type={
            draggedCategory && trashOver ? "trash" : (targetType ?? "none")
          }
          style={
            {
              width: dragSize?.width,
              height: dragSize?.height,
              "--preview-neon":
                draggedCategory && trashOver
                  ? "#ff4466"
                  : (draggedCategory?.type ?? targetType) === "-"
                    ? "#fb923c"
                    : "#38bdf8",
            } as CSSProperties
          }
          animate={{
            borderColor:
              draggedCategory && trashOver
                ? "#ff4466"
                : (draggedCategory?.type ?? targetType) === "-"
                  ? "#fb923c"
                  : (draggedCategory?.type ?? targetType) === "+"
                    ? "#38bdf8"
                    : "#71717a",
            color:
              draggedCategory && trashOver
                ? "#ffc4ce"
                : (draggedCategory?.type ?? targetType) === "-"
                  ? "#fdba74"
                  : (draggedCategory?.type ?? targetType) === "+"
                    ? "#7dd3fc"
                    : "#fafafa",
          }}
          transition={{ duration: reduceMotion ? 0 : 0.15 }}
          className={`finance-drag-preview relative flex items-center justify-center rounded-2xl border-2 text-center ${draggedCategory ? "flex-col gap-1 px-2 pb-2 pt-8" : "gap-3 bg-gradient-to-r from-sky-400/15 to-orange-400/15 px-3 text-xl font-semibold tabular-nums"}`}
        >
          {draggedCategory ? (
            <>
              <GripVertical
                size={17}
                className="absolute right-3 top-3 opacity-70"
              />
              <span className="w-full px-2 text-[15px] font-semibold wrap-anywhere">
                {draggedCategory.name}
              </span>
              <span className="text-xs tabular-nums opacity-70">
                {formatAmount(categoryTotal(draggedCategory))}
              </span>
              {trashOver && (
                <span className="mt-2 flex items-center gap-1 text-xs">
                  <Trash2 size={14} />
                  Release to remove
                </span>
              )}
            </>
          ) : (
            <>
              <Grip size={21} />
              <span>Drag {formatAmount(amount)}</span>
            </>
          )}
        </motion.div>
      )}
    </DragOverlay>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold">Add action</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Set an amount. Drag it to a category. Done.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            disabled={busy}
            className="h-12 rounded-xl bg-orange-400 px-3 text-orange-950 hover:bg-orange-300"
            onClick={() => onAdd("-")}
          >
            <Plus size={17} />
            Add spending
          </Button>
          <Button
            disabled={busy}
            variant="outline"
            className="h-12 rounded-xl border-sky-400/30 text-sky-300 hover:bg-sky-400/10 hover:text-sky-200"
            onClick={() => onAdd("+")}
          >
            <ArrowDownLeft size={17} />
            Add revenue
          </Button>
        </div>
      </div>
      <section
        className="finance-playground rounded-3xl border border-border bg-card/30 p-3 sm:p-5"
        aria-label="Drag an amount to a category"
      >
        <div className="mb-3 flex min-h-11 items-center justify-between">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-sky-300">
            <ArrowDownLeft size={16} />
            Revenue
          </p>
          {pager("+", allRevenue.length, revenuePage)}
        </div>
        <DndContext
          id={dragContextId}
          sensors={sensors}
          collisionDetection={(args) =>
            keyboardDrag.current && keyboardTarget.current
              ? [{ id: keyboardTarget.current }]
              : args.pointerCoordinates
                ? pointerWithin(args)
                : rectIntersection(args)
          }
          onDragStart={(event) => {
            keyboardDrag.current = event.activatorEvent.type === "keydown";
            keyboardTarget.current =
              keyboardDrag.current && event.active?.data.current?.category
                ? categoryKey(event.active.data.current.category)
                : null;
            setDraggedCategory(event.active?.data.current?.category ?? null);
            const source = (
              event.activatorEvent.target as HTMLElement | null
            )?.closest?.("[data-category-key], [data-amount-token]");
            const rect =
              source?.getBoundingClientRect() ??
              event.active?.rect?.current?.initial;
            setDragSize(
              rect ? { width: rect.width, height: rect.height } : null,
            );
            setTargetType(null);
            setTrashOver(false);
            setDragging(true);
            setSaved(null);
          }}
          onDragOver={(event) => {
            setTargetType(
              categories.find((item) => categoryKey(item) === event.over?.id)
                ?.type ?? null,
            );
            setTrashOver(event.over?.id === "category-action");
          }}
          onDragCancel={cancelDrag}
          onDragEnd={(event) => {
            const target = keyboardDrag.current
              ? keyboardTarget.current
              : event.over?.id;
            const category =
              event.active?.data.current?.category ?? draggedCategory;
            cancelDrag();
            if (category) {
              void finishCategoryDrag(category, target);
            } else {
              const over = categories.find(
                (item) => categoryKey(item) === target,
              );
              if (over) void addTo(over);
            }
          }}
          accessibility={{
            screenReaderInstructions: {
              draggable:
                "Press Space to pick up an amount or a category grip. Use arrow keys to choose a target, then Space to drop. Drop a category on the trash target to remove its box, or another category of the same type to reorder. Escape cancels. Past transactions are kept.",
            },
          }}
        >
          <div
            className="finance-category-ring"
            data-side-count={ring.sides}
            data-top-count={ring.top}
            data-bottom-count={ring.bottom}
            style={
              {
                "--ring-side-count": ring.sides,
                "--ring-half-count": ring.halfCount,
              } as CSSProperties
            }
          >
            {tiles("+", revenue, ring.revenue)}
            <div className="finance-center-with-action">
              <div
                className={`finance-amount-center relative flex min-w-0 flex-col justify-center rounded-3xl border bg-background p-3 transition-colors sm:p-6 ${targetType === "-" ? "border-orange-400" : targetType === "+" ? "border-sky-400" : "border-border"}`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <label
                    htmlFor="quick-finance-amount"
                    className="text-sm font-medium"
                  >
                    Your amount{currency === "NONE" ? "" : ` · ${currency}`}
                  </label>
                  <Sparkles size={16} className="text-muted-foreground" />
                </div>
                <AmountInput
                  id="quick-finance-amount"
                  compact
                  value={amount}
                  onChange={changeAmount}
                  disabled={busy}
                />
                <div className="relative mt-3 h-8">
                  <div className="absolute inset-x-0 top-3 h-2 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className="h-full origin-left rounded-full bg-gradient-to-r from-sky-400 to-orange-400"
                      style={{ scaleX: sliderProgress }}
                    />
                  </div>
                  <input
                    aria-label="Amount slider"
                    type="range"
                    min="0"
                    max={sliderMax}
                    step="1"
                    value={Math.min(sliderMax, Number(amount) || 0)}
                    disabled={busy}
                    onChange={(event) =>
                      changeAmount(Number(event.target.value).toFixed(2))
                    }
                    className="finance-amount-slider absolute inset-0 h-8 w-full cursor-ew-resize bg-transparent"
                  />
                </div>
                <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <button
                    type="button"
                    disabled={busy || range <= 500}
                    aria-label="Decrease slider range"
                    title="Lower the slider maximum"
                    className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border hover:bg-orange-400/10 hover:text-orange-300 disabled:opacity-30"
                    onClick={() => changeRange(-1)}
                  >
                    <ChevronDown size={19} />
                  </button>
                  <span className="text-center tabular-nums">
                    0 — {formatAmount(sliderMax)}
                  </span>
                  <button
                    type="button"
                    disabled={busy || range >= 20000}
                    aria-label="Increase slider range"
                    title={
                      range >= 8000
                        ? "Raise the maximum by 2,000"
                        : "Raise the slider maximum"
                    }
                    className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-400/5 text-sky-300 hover:bg-sky-400/15 disabled:opacity-30"
                    onClick={() => changeRange(1)}
                  >
                    <ChevronUp size={19} />
                  </button>
                </div>
                {removing ? (
                  <div
                    role="status"
                    aria-live="polite"
                    className="flex min-h-14 items-center gap-2.5 rounded-xl border border-orange-400/25 bg-orange-400/5 px-3 py-2 text-xs"
                  >
                    <LoaderCircle
                      aria-hidden="true"
                      size={20}
                      className="shrink-0 animate-spin motion-reduce:animate-none text-orange-300"
                    />
                    <div className="min-w-0">
                      <p className="font-medium wrap-anywhere">
                        Removing “{removing.name}”…
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Your past transactions are kept.
                      </p>
                    </div>
                  </div>
                ) : (
                  <AmountToken
                    amount={amount}
                    disabled={disabled || !!draggedCategory}
                    dragging={dragging && !draggedCategory}
                    busy={busy}
                    targetType={targetType}
                  />
                )}
                {!removing && (
                  <p className="mt-2 text-center text-xs leading-relaxed text-muted-foreground">
                    Or tap a category to add this amount.
                  </p>
                )}
                <details className="group/options mt-3 border-t border-border">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-xs font-medium text-muted-foreground outline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                    <span>Details & options</span>
                    <ChevronDown
                      aria-hidden="true"
                      size={16}
                      className="transition-transform group-open/options:rotate-180 motion-reduce:transition-none"
                    />
                  </summary>
                  <div className="pb-1 pt-1">
                    <div className="grid grid-cols-4 gap-2">
                      {[10, 50, 100, 250].map((value) => (
                        <button
                          key={value}
                          type="button"
                          disabled={busy}
                          aria-pressed={Number(amount) === value}
                          className="h-11 rounded-xl border border-border bg-card text-xs font-medium tabular-nums hover:border-sky-400/50 hover:bg-sky-400/10 aria-pressed:border-sky-400/50 aria-pressed:bg-sky-400/10 aria-pressed:text-sky-300"
                          onClick={() => changeAmount(value.toFixed(2))}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 space-y-3">
                      <div>
                        <p className="mb-1.5 text-xs text-muted-foreground">
                          Reuse a previous detail
                        </p>
                        <FinanceSelect
                          className="min-h-11 rounded-xl px-3"
                          label="Previous details"
                          title="Recent details"
                          icon={History}
                          value={previousDetails.includes(detail) ? detail : ""}
                          disabled={busy || !previousDetails.length}
                          onValueChange={(value) => {
                            setDetail(value);
                            setError("");
                            setSaved(null);
                          }}
                          options={[
                            {
                              value: "",
                              label: previousDetails.length
                                ? "Type a new detail"
                                : "No previous details yet",
                            },
                            ...previousDetails.map((value) => ({
                              value,
                              label: value,
                            })),
                          ]}
                        />
                      </div>
                      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                        <div className="min-w-0">
                          <label
                            htmlFor="quick-finance-detail"
                            className="mb-1.5 block text-xs text-muted-foreground"
                          >
                            Detail · optional
                          </label>
                          <Input
                            id="quick-finance-detail"
                            value={detail}
                            disabled={busy}
                            maxLength={200}
                            placeholder="e.g. Groceries or taxi"
                            className="h-11 min-w-0 rounded-xl bg-card dark:bg-card dark:border-border"
                            onChange={(event) => {
                              setDetail(event.target.value);
                              setError("");
                              setSaved(null);
                            }}
                          />
                        </div>
                        <div className="min-w-0">
                          <label
                            htmlFor="quick-finance-date"
                            className="mb-1.5 block text-xs text-muted-foreground"
                          >
                            Transaction date
                          </label>
                          <Input
                            id="quick-finance-date"
                            type="date"
                            value={date}
                            disabled={busy}
                            required
                            className="h-11 min-w-0 rounded-xl bg-card dark:bg-card dark:border-border [color-scheme:dark]"
                            onChange={(event) => {
                              setDate(event.target.value);
                              setError("");
                              setSaved(null);
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <label
                          htmlFor="quick-finance-note"
                          className="mb-1.5 block text-xs text-muted-foreground"
                        >
                          Note · optional
                        </label>
                        <Textarea
                          id="quick-finance-note"
                          value={note}
                          disabled={busy}
                          rows={2}
                          maxLength={5000}
                          placeholder="Add a note…"
                          className="min-h-16 rounded-xl resize-y bg-card dark:bg-card dark:border-border"
                          onChange={(event) => {
                            setNote(event.target.value);
                            setError("");
                            setSaved(null);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </details>
                {!validation.success && amount !== "0.00" && amount !== "0" && (
                  <p className="mt-2 text-center text-xs text-orange-300">
                    {validation.error.issues[0].message}
                  </p>
                )}
                {saved && (
                  <motion.p
                    role="status"
                    initial={{ opacity: 0, y: reduceMotion ? 0 : 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`mt-3 flex items-center justify-center gap-2 text-sm ${saved.type === "+" ? "text-sky-300" : "text-orange-300"}`}
                  >
                    <Check size={16} />
                    Added to {saved.name}
                  </motion.p>
                )}
                {error && (
                  <p
                    role="alert"
                    className="mt-3 text-center text-sm text-red-300"
                  >
                    {error}
                  </p>
                )}
              </div>
              <CategoryAction
                categoryDragging={!!draggedCategory}
                removing={removing}
                busy={busy}
                onAdd={() => setAdding({ type: "-", version: categoryVersion })}
              />
            </div>
            <p className="finance-mobile-spending-label flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-widest text-orange-300">
              <ArrowUpRight size={16} />
              Spending
            </p>
            {tiles("-", spending, ring.spending)}
          </div>
          {typeof document === "undefined"
            ? dragOverlay
            : createPortal(dragOverlay, document.body)}
        </DndContext>
        <div className="mt-3 flex min-h-11 items-center justify-between">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-orange-300">
            <ArrowUpRight size={16} />
            Spending
          </p>
          {pager("-", allSpending.length, spendingPage)}
        </div>
      </section>
      {adding && adding.version === categoryVersion && (
        <CategoryDialog
          initialType={adding.type}
          blocked={parentBusy}
          recovery={recovery}
          onClose={() => setAdding(null)}
          onSave={async (category) => {
            const index = await onCreateCategory(category);
            setPages((previous) => ({
              ...previous,
              [category.type]: Math.floor(index / 15),
            }));
          }}
        />
      )}
    </div>
  );
}

function mobileCellSpan(index: number, count: number) {
  const remainder = count % 3;
  return remainder && index >= count - remainder ? 12 / remainder : 4;
}
function cellStyle(position: CategoryRingCell, mobileSpan: number) {
  return {
    "--strip-index": position.index,
    "--strip-count": position.count,
    "--mobile-span": mobileSpan,
  } as CSSProperties;
}

function CategoryTile({
  category,
  position,
  mobileSpan,
  total,
  busy,
  disabled,
  compact,
  dragging,
  saved,
  onAdd,
  onRemove,
}: {
  category: FinanceCategory;
  position: CategoryRingCell;
  mobileSpan: number;
  total: number;
  busy: boolean;
  disabled: boolean;
  compact: boolean;
  dragging: boolean;
  saved: boolean;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const { formatAmount } = useAccountFormat();
  const { isOver, setNodeRef } = useDroppable({
    id: categoryKey(category),
    data: { category },
    disabled: busy,
  });
  const {
    attributes,
    listeners,
    setNodeRef: setDragNodeRef,
    setActivatorNodeRef,
    isDragging,
  } = useDraggable({
    id: `category:${categoryKey(category)}`,
    data: { category },
    disabled: busy,
  });
  const revenue = category.type === "+";
  return (
    <article
      ref={(node) => {
        setNodeRef(node);
        setDragNodeRef(node);
      }}
      title={category.name}
      data-category-key={categoryKey(category)}
      data-ring-region={position.region}
      style={cellStyle(position, mobileSpan)}
      className={`finance-category-tile relative min-h-28 min-w-0 overflow-hidden rounded-2xl border text-center transition-colors ${isDragging ? "opacity-30" : ""} ${revenue ? "border-sky-400/20 bg-sky-400/5 text-sky-200 hover:border-sky-400/60 hover:bg-sky-400/15" : "border-orange-400/20 bg-orange-400/5 text-orange-200 hover:border-orange-400/60 hover:bg-orange-400/15"} ${isOver || saved ? (revenue ? "ring-2 ring-sky-400 bg-sky-400/20!" : "ring-2 ring-orange-400 bg-orange-400/20!") : dragging ? "border-dashed" : ""}`}
    >
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        aria-label={`Add ${revenue ? "revenue" : "spending"} to ${category.name}`}
        className="flex h-full min-h-28 w-full flex-col items-center justify-center gap-1 px-2 pb-2 pt-8 disabled:cursor-default! focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <span
          className={`line-clamp-2 w-full font-semibold wrap-anywhere ${compact ? "text-xs sm:text-sm" : "text-[13px] sm:text-[15px]"}`}
        >
          {saved && <Check size={14} className="mr-1 inline" />}
          {category.name}
        </span>
        <span className="max-w-full truncate text-xs tabular-nums opacity-60">
          {isOver ? "Drop here" : formatAmount(total)}
        </span>
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onRemove}
        aria-label={`Remove ${revenue ? "revenue" : "spending"} category ${category.name}`}
        title="Remove category · past transactions are kept"
        className="absolute left-0 top-0 flex h-11 w-1/2 sm:size-11 cursor-pointer items-center justify-center rounded-xl text-muted-foreground hover:bg-red-400/10 hover:text-red-300 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40"
      >
        <Trash2 aria-hidden="true" size={15} />
      </button>
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        type="button"
        disabled={busy}
        aria-label={`Drag ${revenue ? "revenue" : "spending"} category ${category.name}`}
        title="Drag to rearrange or remove this category"
        className="absolute right-0 top-0 flex h-11 w-1/2 sm:size-11 touch-none items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/60 hover:text-foreground cursor-grab! active:cursor-grabbing! focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40"
      >
        <GripVertical size={17} />
      </button>
    </article>
  );
}

function CategoryAction({
  categoryDragging,
  removing,
  busy,
  onAdd,
}: {
  categoryDragging: boolean;
  removing: FinanceCategory | null;
  busy: boolean;
  onAdd: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: "category-action",
    disabled: busy || !categoryDragging,
  });
  const reduceMotion = useReducedMotion();
  return (
    <button
      ref={setNodeRef}
      type="button"
      disabled={busy}
      onClick={() => {
        if (!categoryDragging) onAdd();
      }}
      aria-busy={!!removing}
      aria-label={
        removing
          ? `Removing category ${removing.name}`
          : categoryDragging
            ? "Drop category here to remove"
            : "Add category"
      }
      data-category-action
      data-removal-target={categoryDragging || !!removing}
      data-trash-over={categoryDragging && isOver}
      className="finance-category-action flex flex-col items-center justify-center gap-2 rounded-2xl border px-2 text-sm font-semibold"
    >
      {removing ? (
        <LoaderCircle
          aria-hidden="true"
          size={24}
          className="animate-spin motion-reduce:animate-none"
        />
      ) : categoryDragging ? (
        <motion.span
          className="pointer-events-none inline-flex"
          animate={{
            y: reduceMotion ? 0 : [0, isOver ? -10 : -6, 0],
            scale: reduceMotion ? 1 : isOver ? 1.12 : 1,
          }}
          transition={{
            y: {
              duration: isOver ? 0.65 : 0.95,
              repeat: reduceMotion ? 0 : Infinity,
              ease: "easeInOut",
            },
            scale: { duration: reduceMotion ? 0 : 0.15 },
          }}
        >
          <Trash2 size={24} />
        </motion.span>
      ) : (
        <Plus size={24} />
      )}
      <span>
        {removing
          ? "Removing…"
          : categoryDragging
            ? isOver
              ? "Release to remove"
              : "Drop to remove"
            : "Add category"}
      </span>
      {categoryDragging && (
        <span className="finance-category-action-hint text-[10px] font-normal opacity-75">
          History is kept
        </span>
      )}
    </button>
  );
}

function AmountToken({
  amount,
  disabled,
  dragging,
  busy,
  targetType,
}: {
  amount: string;
  disabled: boolean;
  dragging: boolean;
  busy: boolean;
  targetType: MoneyType | null;
}) {
  const { formatAmount } = useAccountFormat();
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: "quick-finance-value",
    disabled,
  });
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      type="button"
      disabled={disabled}
      aria-label={`Drag amount ${formatAmount(amount)} to a category`}
      data-amount-token
      className={`flex h-14 w-full touch-none items-center justify-center gap-3 rounded-2xl border bg-gradient-to-r from-sky-400/15 via-sky-400/10 to-orange-400/15 text-base sm:text-lg font-semibold tabular-nums shadow-sm outline-offset-4 focus-visible:outline-2 focus-visible:outline-sky-400 cursor-grab! active:cursor-grabbing! disabled:opacity-40 ${targetType === "-" ? "border-orange-400 text-orange-300" : targetType === "+" ? "border-sky-400 text-sky-300" : "border-sky-400/40"} ${dragging ? "opacity-30" : ""}`}
    >
      <Grip size={21} />
      <span>
        {busy
          ? "Saving…"
          : Number(amount) > 0
            ? `Drag ${formatAmount(amount)}`
            : "Choose an amount"}
      </span>
    </button>
  );
}

function CategoryDialog({
  initialType,
  onSave,
  onClose,
  blocked = false,
  recovery,
}: {
  initialType: MoneyType;
  onSave: (category: FinanceCategory) => Promise<void>;
  onClose: () => void;
  blocked?: boolean;
  recovery?: React.ReactNode;
}) {
  const [type, setType] = useState<MoneyType>(initialType);
  const [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || blocked) return;
    const name = String(
      new FormData(event.currentTarget).get("name") || "",
    ).trim();
    if (!name) {
      setError("Name your category");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({ name, type });
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not save your category.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !saving && !blocked) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content
          className={financeDialogClass}
          onEscapeKeyDown={(event) => {
            if (saving || blocked) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (saving || blocked) event.preventDefault();
          }}
        >
          <Dialog.Title className="text-xl font-semibold">
            New {type === "+" ? "revenue" : "spending"} category
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            Give your money a place to land.
          </Dialog.Description>
          <Dialog.Close
            disabled={saving || blocked}
            aria-label="Close category form"
            className="absolute right-3 top-3 flex size-11 items-center justify-center rounded-full hover:bg-muted"
          >
            <X size={18} />
          </Dialog.Close>
          {recovery}
          <form onSubmit={submit} className="mt-5 space-y-5">
            <div
              className="grid grid-cols-2 gap-2"
              role="group"
              aria-label="Category type"
            >
              <Button
                type="button"
                disabled={saving || blocked}
                variant="outline"
                aria-pressed={type === "-"}
                className={`h-12 ${type === "-" ? "border-orange-400/60 bg-orange-400/10 text-orange-300" : ""}`}
                onClick={() => setType("-")}
              >
                <ArrowUpRight size={17} />
                Spending
              </Button>
              <Button
                type="button"
                disabled={saving || blocked}
                variant="outline"
                aria-pressed={type === "+"}
                className={`h-12 ${type === "+" ? "border-sky-400/60 bg-sky-400/10 text-sky-300" : ""}`}
                onClick={() => setType("+")}
              >
                <ArrowDownLeft size={17} />
                Revenue
              </Button>
            </div>
            <div>
              <label
                htmlFor="new-finance-category"
                className="mb-2 block text-sm"
              >
                Category name
              </label>
              <Input
                id="new-finance-category"
                name="name"
                required
                maxLength={60}
                autoFocus
                disabled={saving || blocked}
                placeholder={type === "+" ? "e.g. Side project" : "e.g. Coffee"}
                className="h-12 bg-card dark:bg-card dark:border-border"
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-red-300">
                {error}
              </p>
            )}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={saving || blocked}
                className="h-12 flex-1"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                disabled={saving || blocked}
                className={`h-12 flex-1 ${type === "+" ? "bg-sky-400 text-sky-950 hover:bg-sky-300" : "bg-orange-400 text-orange-950 hover:bg-orange-300"}`}
              >
                <Plus size={16} />
                {saving ? "Saving…" : "Create category"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
