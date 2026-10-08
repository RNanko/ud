"use client";

import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  LayoutDashboard,
  Columns2,
  History,
  Plus,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Wallet,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/app/components/ui/tabs";
import { commitFinance } from "@/lib/actions/finance.actions";
import { useMoneyMutation } from "@/hooks/use-money-mutation";
import type { FinanceCommand, FinanceSnapshot } from "@/lib/money/types";
import MoneyRecovery from "@/app/components/shared/MoneyRecovery";
import {
  filterFinance,
  formatAmount,
  localDate,
  reorderFinance,
  type FinanceEntry,
  type MoneyType,
} from "@/lib/finance";
import { useFinanceOrder } from "@/hooks/use-finance-order";
import { useAccountPreferences } from "@/app/components/shared/account/AccountPreferencesProvider";
import { FinanceBoard, FinanceDashboard, FinanceHistory, FinancePlayground } from "./FinanceViews";
import FinanceViewTransition from "./FinanceViewTransition";
import FinanceSelect from "./FinanceSelect";
import FinanceEditor, {
  financeDialogClass,
  type EntryDraft,
} from "./FinanceEditor";
import HoldDeleteButton from "./HoldDeleteButton";
import {
  categoryKey,
  mergeFinanceCategories,
  reorderFinanceCategories,
  type FinanceCategory,
} from "@/lib/finance-playground";

export default function FinanceClient({
  initialEntries,
  initialRevision,
  initialCategories = [],
  userId,
}: {
  initialEntries: FinanceEntry[];
  initialRevision: number;
  initialCategories?: FinanceCategory[];
  userId: string;
}) {
  const { settings } = useAccountPreferences();
  const currency = settings.preferences.financeDefaultCurrency;
  const [entries, setEntries] = useState(initialEntries);
  const [savedCategories, setSavedCategories] = useState(initialCategories);
  const [view, setView] = useState("add");
  const [month, setMonth] = useState(() => localDate().slice(0, 7));
  const [editor, setEditor] = useState<{
    entry: FinanceEntry | null;
    type: MoneyType;
  } | null>(null);
  const [deleting, setDeleting] = useState<FinanceEntry | null>(null);
  const [saving, setBusy] = useState(false);
  const [quickVersion, setQuickVersion] = useState(0);
  const [categoryVersion, setCategoryVersion] = useState(0);
  const [deleteError, setDeleteError] = useState("");
  const [actionError, setActionError] = useState("");
  const [undo, setUndo] = useState<{
    label: string;
    action: () => Promise<void>;
  } | null>(null);
  const mutationLock = useRef(false);
  const snapshotRef = useRef<FinanceSnapshot>({revision: initialRevision, entries: initialEntries, categories: initialCategories});
  const mutation = useMoneyMutation<FinanceCommand["data"], FinanceSnapshot>(initialRevision, commitFinance, snapshot => {
    snapshotRef.current = snapshot;
    setEntries(snapshot.entries);
    setSavedCategories(snapshot.categories);
  });
  const busy = saving || !!mutation.pending;
  const confirming = saving || mutation.pending?.status === "sending";
  const pendingData = mutation.pending?.command.data;
  const latestEntry = pendingData && "id" in pendingData ? mutation.pending?.latest?.entries.find(entry => entry.id === pendingData.id) : undefined;
  const describeEntry = (entry: FinanceEntry) => [entry.type === "+" ? "Revenue" : "Spending", entry.amount, entry.currency ?? "Unspecified currency", entry.date, entry.category, entry.subcategory, entry.comment].filter(Boolean).join(" · ");
  function finishRecovery() {
    if (pendingData?.kind === "entry" && pendingData.create && !editor) setQuickVersion(value => value + 1);
    if (pendingData?.kind === "category") setCategoryVersion(value => value + 1);
    setEditor(null); setDeleting(null); setActionError(""); setDeleteError(""); setUndo(null);
  }
  const recovery = mutation.pending && mutation.pending.status !== "sending" && pendingData ? <MoneyRecovery
    status={mutation.pending.status} message={mutation.pending.message}
    draft={pendingData.kind === "entry" ? describeEntry({...pendingData.entry, id: pendingData.id, subcategory: pendingData.entry.subcategory || "", comment: pendingData.entry.comment || ""}) : pendingData.kind === "delete" ? "Delete this transaction" : `${pendingData.hidden ? "Hide" : "Show"} category: ${pendingData.name} (${pendingData.type})`}
    latest={pendingData.kind === "category" ? (mutation.pending.latest?.categories.find(category => categoryKey(category) === categoryKey(pendingData))?.hidden ? "Category hidden" : "Category available") : latestEntry ? describeEntry(latestEntry) : pendingData.kind === "entry" && pendingData.create ? "The account changed elsewhere. This is a new transaction." : "This transaction was deleted. It cannot be restored by this edit."}
    canRetry={pendingData.kind === "category" || pendingData.kind === "entry" && pendingData.create || mutation.pending.status !== "conflict" || !!latestEntry}
    onRetry={() => { void mutation.retry().then(snapshot => { if(snapshot) finishRecovery(); }).catch(() => {}); }}
    onDiscard={() => { mutation.discard(); finishRecovery(); }} /> : null;
  const { ordered, saveOrder } = useFinanceOrder(entries, userId);
  const currencyEntries = filterFinance(entries, { currency });
  const periodEntries = filterFinance(currencyEntries, { month });
  const months = [
    ...new Set([
      localDate().slice(0, 7),
      month === "all" ? "" : month,
      ...entries.map((entry) => entry.date.slice(0, 7)),
    ]),
  ]
    .filter(Boolean)
    .sort()
    .reverse();
  const {
    ordered: quickCategories,
    saveOrder: saveCategoryOrder,
    orderEntries: orderCategories,
  } = useFinanceOrder(
    mergeFinanceCategories(savedCategories, entries).map((category) => ({
      ...category,
      id: categoryKey(category),
    })),
    userId,
    "finance-category-order",
  );
  const categories = [
    ...new Set(quickCategories.map((category) => category.name)),
  ].sort();

  async function createCategory(category: FinanceCategory) {
    return await mutate(async () => {
      const snapshot = await mutation.run({kind: "category", name: category.name, type: category.type, hidden: false});
      return orderCategories(mergeFinanceCategories(snapshot.categories, snapshot.entries).map(item => ({...item, id: categoryKey(item)})))
        .filter(item => item.type === category.type).findIndex(item => categoryKey(item) === categoryKey(category));
    });
  }

  async function changeCategoryVisibility(
    category: FinanceCategory,
    hidden: boolean,
  ) {
    await mutate(async () => {
      await mutation.run({kind: "category", name: category.name, type: category.type, hidden});
    });
    setUndo(
      hidden
        ? {
            label: `Category “${category.name}” removed. Past transactions are kept.`,
            action: () => changeCategoryVisibility(category, false),
          }
        : null,
    );
  }

  function reorderCategories(active: FinanceCategory, target: FinanceCategory) {
    if (mutationLock.current) return;
    const next = reorderFinanceCategories(quickCategories, active, target).map(
      (category) => ({ ...category, id: categoryKey(category) }),
    );
    if (!saveCategoryOrder(next))
      setActionError(
        "Device storage is unavailable. Category order could not be saved.",
      );
  }

  async function mutate<T>(operation: () => Promise<T>): Promise<T> {
    if (mutationLock.current)
      throw new Error("Please wait for the current change to finish.");
    mutationLock.current = true;
    setBusy(true);
    setActionError("");
    try {
      return await operation();
    } catch (reason) {
      setActionError(
        reason instanceof Error
          ? reason.message
          : "Could not save this change.",
      );
      throw reason;
    } finally {
      mutationLock.current = false;
      setBusy(false);
    }
  }

  function add(type: MoneyType) {
    if (!mutationLock.current && !mutation.pending) setEditor({ entry: null, type });
  }
  function edit(entry: FinanceEntry) {
    if (!mutationLock.current && !mutation.pending) setEditor({ entry, type: entry.type });
  }

  async function save(id: string | null, draft: EntryDraft) {
    await mutate(async () => {
      const original = id ? snapshotRef.current.entries.find(entry => entry.id === id) : undefined;
      await mutation.run({kind: "entry", id: id || crypto.randomUUID(), create: id === null,
        entry: {...draft, currency: id ? original?.currency ?? null : draft.currency ?? currency}});
      if (month !== "all" && !draft.date.startsWith(month)) setMonth(draft.date.slice(0, 7));
    });
  }

  async function move(entry: FinanceEntry, type: MoneyType, allowUndo = true) {
    if (entry.type === type) return;
    try {
      await mutate(async () => {
        const current = snapshotRef.current.entries.find(row => row.id === entry.id);
        if (!current) throw Error("This transaction no longer exists.");
        await mutation.run({kind: "entry", id: entry.id, create: false, entry: {
          type, date: current.date, amount: current.amount, currency: current.currency ?? null,
          category: current.category || "", subcategory: current.subcategory || "", comment: current.comment || ""
        }});
      });
      setUndo(
        allowUndo
          ? {
              label: `Transaction moved to ${type === "+" ? "revenue" : "spending"}.`,
              action: () => move({ ...entry, type }, entry.type, false),
            }
          : null,
      );
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Could not move this transaction.",
      );
    }
  }

  function reorder(activeId: string, overId: string) {
    if (mutationLock.current) return;
    const next = reorderFinance(ordered, activeId, overId);
    setEntries(next);
    if (!saveOrder(next))
      setActionError(
        "Order changed for this visit. Device storage is unavailable.",
      );
  }

  async function deleteEntry(entry: FinanceEntry) {
    await mutate(async () => {
      await mutation.run({kind: "delete", id: entry.id});
    });
    setUndo(null);
  }

  async function remove() {
    if (!deleting) return;
    setDeleteError("");
    try {
      await deleteEntry(deleting);
      setDeleting(null);
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : "Could not delete. Please try again.",
      );
    }
  }

  function shiftMonth(offset: number) {
    const [year, value] = (month === "all" ? localDate().slice(0, 7) : month)
      .split("-")
      .map(Number);
    setMonth(
      new Date(Date.UTC(year, value - 1 + offset, 1)).toISOString().slice(0, 7),
    );
  }

  return (
    <section
      className="mx-auto max-w-6xl space-y-6 pb-10"
      aria-label="Finance workspace"
    >
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            <Wallet size={14} /> Your money, at a glance
          </p>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl sm:text-4xl">Finance</h1>
            <span role="status" aria-atomic="true" className="flex size-5 shrink-0 items-center justify-center">
              {confirming && !editor && !deleting && <LoaderCircle aria-hidden="true" size={20} className="animate-spin text-primary motion-reduce:animate-none" />}
              <span className="sr-only">{confirming ? "Saving finance changes" : busy || actionError ? "Change not confirmed" : "All changes saved"}</span>
            </span>
          </div>
          <p className=" text-sm text-muted-foreground">
            Less guesswork. More peace of mind.
          </p>
        </div>
      </header>
      {actionError && (
        <p
          role="alert"
          className="rounded-2xl border border-orange-400/30 p-4 text-sm text-orange-300"
        >
          {actionError}
        </p>
      )}
      {!editor && !deleting && recovery}
      {undo && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-2xl border border-border p-4 text-sm"
        >
          <p className="flex-1">{undo.label}</p>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              void undo.action().catch(() => {});
            }}
          >
            Undo
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => setUndo(null)}>
            Dismiss
          </Button>
        </div>
      )}
      <Tabs value={view} onValueChange={setView} className="gap-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <TabsList
            aria-label="Finance views"
            className="grid h-12 w-full grid-cols-4 rounded-2xl border border-border bg-card p-1 xl:w-[500px]"
          >
            <TabsTrigger
              disabled={busy}
              value="add"
              className="h-full rounded-xl data-[state=active]:text-foreground! dark:data-[state=active]:bg-muted text-xs sm:text-sm"
            >
              <Plus className="hidden sm:block" />
              Add action
            </TabsTrigger>
            <TabsTrigger
              disabled={busy}
              value="dashboard"
              className="h-full rounded-xl data-[state=active]:text-foreground! dark:data-[state=active]:bg-muted text-xs sm:text-sm"
            >
              <LayoutDashboard className="hidden sm:block" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger
              disabled={busy}
              value="board"
              className="h-full rounded-xl data-[state=active]:text-foreground! dark:data-[state=active]:bg-muted text-xs sm:text-sm"
            >
              <Columns2 className="hidden sm:block" />
              Money board
            </TabsTrigger>
            <TabsTrigger
              disabled={busy}
              value="history"
              className="h-full rounded-xl data-[state=active]:text-foreground! dark:data-[state=active]:bg-muted text-xs sm:text-sm"
            >
              <History className="hidden sm:block" />
              History
            </TabsTrigger>
          </TabsList>
          <div className="flex min-w-0 items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              aria-label="Previous month"
              className="size-11 shrink-0 rounded-xl dark:bg-card dark:border-border"
              disabled={busy}
              onClick={() => shiftMonth(-1)}
            >
              <ChevronLeft size={17} />
            </Button>
            <FinanceSelect
              label="Finance period"
              title="Time period"
              icon={CalendarDays}
              value={month}
              disabled={busy}
              onValueChange={setMonth}
              className="flex-1 xl:w-52"
              options={[
                { value: "all", label: "All time" },
                ...months.map((value) => ({
                  value,
                  label: new Date(`${value}-01T00:00:00Z`).toLocaleDateString(
                    "en",
                    { month: "long", year: "numeric", timeZone: "UTC" },
                  ),
                })),
              ]}
            />
            <Button
              size="icon"
              variant="outline"
              aria-label="Next month"
              className="size-11 shrink-0 rounded-xl dark:bg-card dark:border-border"
              disabled={busy}
              onClick={() => shiftMonth(1)}
            >
              <ChevronRight size={17} />
            </Button>
          </div>
        </div>
        <FinanceViewTransition view={view}>
        <TabsContent value="add">
          <FinancePlayground
            key={quickVersion}
            initialAmount={quickVersion ? "0.00" : undefined}
            categoryVersion={categoryVersion}
            recovery={recovery}
            categories={quickCategories}
            entries={periodEntries}
            historyEntries={entries}
            busy={busy}
            onAdd={add}
            onSave={save}
            onCreateCategory={createCategory}
            onRemoveCategory={(category) =>
              changeCategoryVisibility(category, true)
            }
            onReorderCategory={reorderCategories}
          />
        </TabsContent>
        <TabsContent value="dashboard">
          <FinanceDashboard
            entries={periodEntries}
            allEntries={currencyEntries}
            month={month}
            onAdd={add}
            onHistory={() => setView("history")}
            onShowAll={() => {
              setMonth("all");
              setView("history");
            }}
          />
        </TabsContent>
        <TabsContent value="board">
          <FinanceBoard
            entries={filterFinance(ordered, { month, currency })}
            busy={busy}
            onAdd={add}
            onEdit={edit}
            onMove={(entry, type) => {
              void move(entry, type);
            }}
            onReorder={reorder}
            onDelete={deleteEntry}
          />
        </TabsContent>
        <TabsContent value="history">
          <FinanceHistory
            key={month}
            entries={filterFinance(entries, { month })}
            busy={busy}
            onEdit={edit}
            onMove={(entry, type) => {
              void move(entry, type);
            }}
            onDelete={(entry) => {
              setDeleteError("");
              setDeleting(entry);
            }}
          />
        </TabsContent>
        </FinanceViewTransition>
      </Tabs>
      {editor && (
        <FinanceEditor
          entry={editor.entry}
          initialType={editor.type}
          defaultCurrency={currency}
          categories={categories}
          onSave={save}
          recovery={recovery}
          blocked={!!mutation.pending}
          onClose={() => { if (!mutation.pending) setEditor(null); }}
        />
      )}
      <Dialog.Root
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleting(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
          <Dialog.Content
            className={financeDialogClass}
            onEscapeKeyDown={(event) => {
              if (busy) event.preventDefault();
            }}
            onPointerDownOutside={(event) => {
              if (busy) event.preventDefault();
            }}
          >
            <Dialog.Title className="text-xl font-semibold">
              Delete this transaction?
            </Dialog.Title>
            <Dialog.Description className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {deleting?.subcategory || deleting?.category} ·{" "}
              {formatAmount(deleting?.amount || 0)}. This removes the
              transaction from your history and updates your totals. This cannot
              be undone.
            </Dialog.Description>
            {recovery}
            {deleteError && (
              <p role="alert" className="mt-4 text-sm text-red-400">
                {deleteError}
              </p>
            )}
            <div className="mt-6 flex gap-3">
              <Button
                variant="outline"
                disabled={busy}
                className="h-12 flex-1"
                onClick={() => setDeleting(null)}
              >
                Keep transaction
              </Button>
              <HoldDeleteButton
                label={
                  deleting?.subcategory || deleting?.category || "transaction"
                }
                disabled={busy}
                onConfirm={remove}
              />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
