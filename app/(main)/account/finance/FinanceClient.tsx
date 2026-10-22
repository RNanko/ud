"use client";

import { useRef, useState } from "react";
import {
  LayoutDashboard,
  ChartNoAxesCombined,
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
import { useFinanceBackgroundSave } from "@/hooks/use-finance-background-save";
import type { FinanceCommand, FinanceSnapshot } from "@/lib/money/types";
import MoneyRecovery from "@/app/components/shared/MoneyRecovery";
import BackgroundSaveStatus from "@/app/components/shared/BackgroundSaveStatus";
import {
  filterFinance,
  financeDashboardSelection,
  localDate,
  type FinanceEntry,
  type MoneyType,
} from "@/lib/finance";
import { useFinanceOrder } from "@/hooks/use-finance-order";
import { useAccountPreferences } from "@/app/components/shared/account/AccountPreferencesProvider";
import { FinanceCharts, FinanceDashboard, FinanceHistory, FinancePlayground } from "./FinanceViews";
import FinanceViewTransition from "./FinanceViewTransition";
import motionStyles from "./finance-motion.module.css";
import FinanceSelect from "./FinanceSelect";
import { financeCurrencyLabel } from "@/lib/finance-currencies";
import FinanceEditor, { type EntryDraft } from "./FinanceEditor";
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
  const [dashboardCurrency, setDashboardCurrency] = useState<string | null>(null);
  const [editor, setEditor] = useState<{
    entry: FinanceEntry | null;
    type: MoneyType;
  } | null>(null);
  const [saving, setBusy] = useState(false);
  const [quickVersion, setQuickVersion] = useState(0);
  const [categoryVersion, setCategoryVersion] = useState(0);
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
  const quickWrites = useFinanceBackgroundSave(snapshotRef.current, snapshot => {
    snapshotRef.current = snapshot;
    setEntries(snapshot.entries);
    setSavedCategories(snapshot.categories);
    mutation.adoptRevision(snapshot.revision);
  }, userId);
  const busy = saving || !!mutation.pending || quickWrites.count > 0;
  const quickBlocked = saving || !!mutation.pending || !!quickWrites.failure;
  const confirming = saving || mutation.pending?.status === "sending" || quickWrites.phase === "saving";
  const pendingData = mutation.pending?.command.data;
  const latestEntry = pendingData && "id" in pendingData ? mutation.pending?.latest?.entries.find(entry => entry.id === pendingData.id) : undefined;
  const describeEntry = (entry: FinanceEntry) => [entry.type === "+" ? "Revenue" : "Spending", entry.amount, entry.currency ?? "Unspecified currency", entry.date, entry.category, entry.subcategory, entry.comment].filter(Boolean).join(" · ");
  function finishRecovery() {
    if (pendingData?.kind === "entry" && pendingData.create && !editor) setQuickVersion(value => value + 1);
    if (pendingData?.kind === "category") setCategoryVersion(value => value + 1);
    setEditor(null); setActionError(""); setUndo(null);
  }
  const recovery = mutation.pending && mutation.pending.status !== "sending" && pendingData ? <MoneyRecovery
    status={mutation.pending.status} message={mutation.pending.message}
    draft={pendingData.kind === "entry" ? describeEntry({...pendingData.entry, id: pendingData.id, subcategory: pendingData.entry.subcategory || "", comment: pendingData.entry.comment || ""}) : pendingData.kind === "delete" ? "Delete this transaction" : `${pendingData.hidden ? "Hide" : "Show"} category: ${pendingData.name} (${pendingData.type})`}
    latest={pendingData.kind === "category" ? (mutation.pending.latest?.categories.find(category => categoryKey(category) === categoryKey(pendingData))?.hidden ? "Category hidden" : "Category available") : latestEntry ? describeEntry(latestEntry) : pendingData.kind === "entry" && pendingData.create ? "The account changed elsewhere. This is a new transaction." : "This transaction was deleted. It cannot be restored by this edit."}
    canRetry={pendingData.kind === "category" || pendingData.kind === "entry" && pendingData.create || mutation.pending.status !== "conflict" || !!latestEntry}
    onRetry={() => { void mutation.retry().then(snapshot => { if(snapshot) finishRecovery(); }).catch(() => {}); }}
    onDiscard={() => { mutation.discard(); finishRecovery(); }} /> : null;
  const currencyEntries = filterFinance(entries, { currency });
  const periodEntries = filterFinance(currencyEntries, { month });
  const dashboard = financeDashboardSelection(entries,currency,dashboardCurrency,month);
  const visibleMonth = view === "dashboard" ? dashboard.month : month;
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
      const snapshot = await mutation.run({kind: "category", name: category.name, type: category.type, hidden: false, ...(category.icon !== undefined ? {icon:category.icon} : {})});
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

  async function saveQuick(_id: string | null, draft: EntryDraft) {
    if (mutationLock.current || mutation.pending || quickWrites.failure) throw new Error("Resolve the pending change before adding another amount.");
    void quickWrites.queue.enqueue({ kind: "entry", id: crypto.randomUUID(), create: true,
      entry: { ...draft, currency: draft.currency ?? currency } }, snapshotRef.current).catch(() => {});
    if (month !== "all" && !draft.date.startsWith(month)) setMonth(draft.date.slice(0, 7));
  }

  async function removeQuickCategory(category: FinanceCategory) {
    if (mutationLock.current || mutation.pending || quickWrites.failure) throw new Error("Resolve the pending change before removing another category.");
    void quickWrites.queue.enqueue({ kind: "category", name: category.name, type: category.type, hidden: true }, snapshotRef.current).catch(() => {});
    setUndo({ label: `Category “${category.name}” removed. Past transactions are kept.`, action: () => changeCategoryVisibility(category, false) });
  }

  async function mutate<T>(operation: () => Promise<T>): Promise<T> {
    if (quickWrites.queue.getState().count) throw new Error("Finish saving the board changes before editing their details.");
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
        ...(id && draft.currency !== undefined && draft.currency !== original?.currency ? { changeCurrency: true } : {}),
        entry: {...draft, currency: draft.currency ?? (id ? original?.currency ?? null : currency)}});
      if (month !== "all" && !draft.date.startsWith(month)) setMonth(draft.date.slice(0, 7));
    });
  }

  async function deleteEntry(entry: FinanceEntry) {
    await mutate(async () => {
      await mutation.run({kind: "delete", id: entry.id});
    });
    setUndo(null);
  }

  function shiftMonth(offset: number) {
    if(view === "dashboard" && dashboard.months.length) {
      const index=dashboard.month === "all" ? dashboard.months.length : dashboard.months.indexOf(dashboard.month);
      setMonth(dashboard.months[Math.max(0,Math.min(dashboard.months.length-1,index+offset))]);
      return;
    }
    const [year, value] = (month === "all" ? localDate().slice(0, 7) : month)
      .split("-")
      .map(Number);
    setMonth(
      new Date(Date.UTC(year, value - 1 + offset, 1)).toISOString().slice(0, 7),
    );
  }

  return (
    <section
      className={`${motionStyles.workspace} mx-auto max-w-6xl space-y-6 pb-10`}
      aria-label="Finance workspace"
    >
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className={`${motionStyles.eyebrow} mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground`}>
            <Wallet size={14} /> Your money, at a glance
          </p>
          <div className="flex items-center gap-3">
            <h1 className={`${motionStyles.heading} text-3xl sm:text-4xl`}>Finance</h1>
            <span role="status" aria-atomic="true" className="flex size-5 shrink-0 items-center justify-center">
              {confirming && !editor && <LoaderCircle aria-hidden="true" size={20} className="animate-spin text-primary motion-reduce:animate-none" />}
              <span className="sr-only">{confirming ? "Saving finance changes" : busy || actionError ? "Change not confirmed" : "All changes saved"}</span>
            </span>
          </div>
          <p className={`${motionStyles.intro} text-sm text-muted-foreground`}>
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
      {!editor && recovery}
      <BackgroundSaveStatus count={quickWrites.count} failure={quickWrites.failure} showProgress={false}
        onRetry={() => { void quickWrites.queue.retry().catch(() => {}); }}
        onDiscard={() => { if (quickWrites.queue.discard()) setUndo(null); }} />
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
      <Tabs value={view} onValueChange={next => {
        if(view === "dashboard")setMonth(dashboard.month);
        setView(next);
      }} className="gap-5">
        <div className={`${motionStyles.toolbar} flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between`}>
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
              value="charts"
              className="h-full rounded-xl data-[state=active]:text-foreground! dark:data-[state=active]:bg-muted text-xs sm:text-sm"
            >
              <ChartNoAxesCombined className="hidden sm:block" />
              Charts
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
          {view !== "charts" && <div className="flex min-w-0 flex-wrap items-center gap-2">
            {view === "dashboard" && (dashboard.currencies.length > 1 ? <FinanceSelect
              label="Dashboard currency" title="Transaction currency" icon={Wallet}
              value={dashboard.currency} onValueChange={setDashboardCurrency}
              className="w-full sm:w-48" options={dashboard.currencies.map(value=>({value,label:financeCurrencyLabel(value)}))}
            /> : <span className="w-full text-sm text-muted-foreground sm:w-auto sm:pr-2">{financeCurrencyLabel(dashboard.currency)}</span>)}
            <Button
              size="icon"
              variant="outline"
              aria-label="Previous month"
              className={`${motionStyles.previous} size-11 shrink-0 rounded-xl dark:bg-card dark:border-border`}
              disabled={busy || view === "dashboard" && dashboard.month !== "all" && dashboard.month === dashboard.months[0]}
              onClick={() => shiftMonth(-1)}
            >
              <ChevronLeft size={17} />
            </Button>
            <FinanceSelect
              label="Finance period"
              title="Time period"
              icon={CalendarDays}
              value={visibleMonth}
              disabled={busy}
              onValueChange={setMonth}
              className="flex-1 xl:w-52"
              options={[
                { value: "all", label: "All time" },
                ...(view === "dashboard" ? [...dashboard.months].reverse() : months).map((value) => ({
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
              className={`${motionStyles.next} size-11 shrink-0 rounded-xl dark:bg-card dark:border-border`}
              disabled={busy || view === "dashboard" && dashboard.month !== "all" && dashboard.month === dashboard.months.at(-1)}
              onClick={() => shiftMonth(1)}
            >
              <ChevronRight size={17} />
            </Button>
          </div>}
        </div>
        <FinanceViewTransition view={view}>
        <TabsContent value="add">
          <FinancePlayground
            key={quickVersion}
            userId={userId}
            initialAmount={quickVersion ? "0.00" : undefined}
            categoryVersion={categoryVersion}
            recovery={recovery}
            categories={quickCategories}
            entries={periodEntries}
            historyEntries={entries}
            busy={quickBlocked}
            onAdd={add}
            onSave={saveQuick}
            onCreateCategory={createCategory}
            onRemoveCategory={removeQuickCategory}
            onReorderCategory={reorderCategories}
          />
        </TabsContent>
        <TabsContent value="dashboard">
          <FinanceDashboard
            entries={dashboard.entries}
            allEntries={dashboard.records}
            month={dashboard.month}
            onAdd={add}
            onHistory={() => { setMonth(dashboard.month); setView("history"); }}
            onShowAll={() => {
              setMonth("all");
              setView("history");
            }}
          />
        </TabsContent>
        <TabsContent value="charts">
          <FinanceCharts key={month} entries={entries} month={month} currency={currency} />
        </TabsContent>
        <TabsContent value="history">
          <FinanceHistory
            key={month}
            entries={filterFinance(entries, { month })}
            busy={busy}
            onEdit={edit}
            onDelete={deleteEntry}
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
    </section>
  );
}
