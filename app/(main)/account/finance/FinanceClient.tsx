"use client";

import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { LayoutDashboard, Columns2, History, Plus, ChevronLeft, ChevronRight, LoaderCircle, Wallet, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { saveFinanceEntry, updateListItem, removeListItem, createFinanceCategory, removeFinanceCategory, restoreFinanceCategory } from "@/lib/actions/finance.actions";
import { filterFinance, formatAmount, localDate, reorderFinance, type FinanceEntry, type MoneyType } from "@/lib/finance";
import { useFinanceOrder } from "@/hooks/use-finance-order";
import { useAccountPreferences } from "@/app/components/shared/account/AccountPreferencesProvider";
import FinanceBoard from "./FinanceBoard";
import FinanceDashboard from "./FinanceDashboard";
import FinanceHistory from "./FinanceHistory";
import FinanceSelect from "./FinanceSelect";
import FinanceEditor, { financeDialogClass, type EntryDraft } from "./FinanceEditor";
import FinancePlayground from "./FinancePlayground";
import HoldDeleteButton from "./HoldDeleteButton";
import { categoryKey, mergeFinanceCategories, reorderFinanceCategories, type FinanceCategory } from "@/lib/finance-playground";

export default function FinanceClient({ initialEntries, initialCategories = [], userId }: { initialEntries: FinanceEntry[]; initialCategories?: FinanceCategory[]; userId: string }) {
  const {settings}=useAccountPreferences();
  const [currency,setCurrency]=useState<string>(()=>initialEntries.some(entry=>entry.currency===settings.preferences.financeDefaultCurrency)||!initialEntries.length?settings.preferences.financeDefaultCurrency:initialEntries[0].currency??"unassigned");
  const [entries, setEntries] = useState(initialEntries);
  const [savedCategories, setSavedCategories] = useState(initialCategories);
  const [view, setView] = useState("add");
  const [month, setMonth] = useState(() => localDate().slice(0, 7));
  const [editor, setEditor] = useState<{ entry: FinanceEntry | null; type: MoneyType } | null>(null);
  const [deleting, setDeleting] = useState<FinanceEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const mutationLock = useRef(false);
  const { ordered, saveOrder } = useFinanceOrder(entries, userId);
  const currencyEntries=filterFinance(entries,{currency});
  const periodEntries = filterFinance(currencyEntries, { month });
  const months = [...new Set([localDate().slice(0, 7), month === "all" ? "" : month, ...entries.map((entry) => entry.date.slice(0, 7))])].filter(Boolean).sort().reverse();
  const { ordered: quickCategories, saveOrder: saveCategoryOrder, orderEntries: orderCategories } = useFinanceOrder(mergeFinanceCategories(savedCategories, entries).map((category) => ({ ...category, id: categoryKey(category) })), userId, "finance-category-order");
  const categories = [...new Set(quickCategories.map((category) => category.name))].sort();

  async function createCategory(category: FinanceCategory) {
    return await mutate(async () => {
      const result = await createFinanceCategory(category);
      if (!result.success) throw new Error(result.message);
      setSavedCategories((previous) => [...previous.filter((item) => categoryKey(item) !== categoryKey(result.category)), result.category]);
      toast.success(result.message);
      return orderCategories(mergeFinanceCategories([...savedCategories.filter((item) => categoryKey(item) !== categoryKey(result.category)), result.category], entries).map((item) => ({ ...item, id: categoryKey(item) }))).filter((item) => item.type === category.type).findIndex((item) => categoryKey(item) === categoryKey(result.category));
    });
  }

  async function changeCategoryVisibility(category: FinanceCategory, hidden: boolean) {
    await mutate(async () => {
      const result = await (hidden ? removeFinanceCategory(category) : restoreFinanceCategory(category));
      if (!result.success) throw new Error(result.message);
      setSavedCategories((previous) => [...previous.filter((item) => categoryKey(item) !== categoryKey(category)), result.category]);
    });
    toast.success(hidden ? "Category removed. Past transactions are kept." : "Category restored", hidden ? { duration: 10000, action: { label: "Undo", onClick: () => { void changeCategoryVisibility(category, false).catch((error) => toast.error(error instanceof Error ? error.message : "Could not restore category")); } } } : undefined);
  }

  function reorderCategories(active: FinanceCategory, target: FinanceCategory) {
    if (mutationLock.current) return;
    const next = reorderFinanceCategories(quickCategories, active, target).map((category) => ({ ...category, id: categoryKey(category) }));
    if (!saveCategoryOrder(next)) toast.error("Device storage is unavailable. Category order could not be saved.");
  }

  async function mutate<T,>(operation: () => Promise<T>): Promise<T> {
    if (mutationLock.current) throw new Error("Please wait for the current change to finish.");
    mutationLock.current = true;
    setBusy(true);
    try { return await operation(); }
    finally { mutationLock.current = false; setBusy(false); }
  }

  function add(type: MoneyType) { if (!mutationLock.current) setEditor({ entry: null, type }); }
  function edit(entry: FinanceEntry) { if (!mutationLock.current) setEditor({ entry, type: entry.type }); }

  async function save(id: string | null, draft: EntryDraft) {
    await mutate(async () => {
      const result = await saveFinanceEntry(id, draft);
      if (!result.success) throw new Error(result.message);
      setEntries((previous) => id ? previous.map((entry) => entry.id === id ? result.entry : entry) : [result.entry, ...previous]);
      // Reveal a newly entered or edited transaction even if its date is outside the current period.
      setCurrency(result.entry.currency??"unassigned");
      if (month !== "all" && !result.entry.date.startsWith(month)) setMonth(result.entry.date.slice(0, 7));
      toast.success(result.message);
    });
  }

  async function move(entry: FinanceEntry, type: MoneyType, allowUndo = true) {
    if (entry.type === type) return;
    try {
      await mutate(async () => {
        const result = await updateListItem(entry.id, "type", type);
        if (!result.success) throw new Error(result.message);
        setEntries((previous) => previous.map((row) => row.id === entry.id ? { ...row, type } : row));
      });
      toast.success(`Moved to ${type === "+" ? "revenue" : "spending"}`, {
        duration: 10000,
        ...(allowUndo ? { action: { label: "Undo", onClick: () => { void move({ ...entry, type }, entry.type, false); } } } : {}),
      });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not move this transaction."); }
  }

  function reorder(activeId: string, overId: string) {
    if (mutationLock.current) return;
    const next = reorderFinance(ordered, activeId, overId);
    setEntries(next);
    if (!saveOrder(next)) toast.error("Order changed for this visit. Device storage is unavailable.");
  }

  async function deleteEntry(entry: FinanceEntry) {
    await mutate(async () => {
      const result = await removeListItem(entry.id);
      if (!result.success) throw new Error(result.message);
      setEntries((previous) => previous.filter((row) => row.id !== entry.id));
    });
    toast.success("Transaction deleted");
  }

  async function remove() {
    if (!deleting) return;
    setDeleteError("");
    try {
      await deleteEntry(deleting);
      setDeleting(null);
    } catch (error) { setDeleteError(error instanceof Error ? error.message : "Could not delete. Please try again."); }
  }

  function shiftMonth(offset: number) {
    const [year, value] = (month === "all" ? localDate().slice(0, 7) : month).split("-").map(Number);
    setMonth(new Date(Date.UTC(year, value - 1 + offset, 1)).toISOString().slice(0, 7));
  }

  return (
    <section className="mx-auto max-w-6xl space-y-6 pb-10" aria-label="Finance workspace">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"><Wallet size={14} /> Your money, at a glance</p><h1 className="text-3xl sm:text-4xl">Finance</h1><p className="mt-2 text-sm text-muted-foreground">Less guesswork. More peace of mind.</p></div>
      </header>
      <div className="grid gap-3 sm:grid-cols-[240px_minmax(0,1fr)]"><FinanceSelect label="Finance currency filter" title="Currency" icon={Wallet} value={currency} onValueChange={setCurrency} options={[...new Set([settings.preferences.financeDefaultCurrency,"PLN","EUR","USD",...entries.map(entry=>entry.currency??"unassigned")])].map(value=>({value,label:value==="unassigned"?"Currency not recorded":value}))}/><p className="text-sm text-muted-foreground self-center">{currency==="unassigned"?"These older records have no stored currency. Their amounts are preserved, without guessing or conversion.":`All totals shown in ${currency}. New entries default to ${settings.preferences.financeDefaultCurrency}. Other currencies are kept separate.`}</p></div>
      <Tabs value={view} onValueChange={setView} className="gap-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <TabsList aria-label="Finance views" className="grid h-12 w-full grid-cols-4 rounded-2xl border border-border bg-card p-1 xl:w-[500px]"><TabsTrigger disabled={busy} value="add" className="h-full rounded-xl data-[state=active]:text-foreground! dark:data-[state=active]:bg-muted text-xs sm:text-sm"><Plus className="hidden sm:block" />Add action</TabsTrigger><TabsTrigger disabled={busy} value="dashboard" className="h-full rounded-xl data-[state=active]:text-foreground! dark:data-[state=active]:bg-muted text-xs sm:text-sm"><LayoutDashboard className="hidden sm:block" />Dashboard</TabsTrigger><TabsTrigger disabled={busy} value="board" className="h-full rounded-xl data-[state=active]:text-foreground! dark:data-[state=active]:bg-muted text-xs sm:text-sm"><Columns2 className="hidden sm:block" />Money board</TabsTrigger><TabsTrigger disabled={busy} value="history" className="h-full rounded-xl data-[state=active]:text-foreground! dark:data-[state=active]:bg-muted text-xs sm:text-sm"><History className="hidden sm:block" />History</TabsTrigger></TabsList>
          <div className="flex min-w-0 items-center gap-2"><Button size="icon" variant="outline" aria-label="Previous month" className="size-11 shrink-0 rounded-xl dark:bg-card dark:border-border" disabled={busy} onClick={() => shiftMonth(-1)}><ChevronLeft size={17} /></Button><FinanceSelect label="Finance period" title="Time period" icon={CalendarDays} value={month} disabled={busy} onValueChange={setMonth} className="flex-1 xl:w-52" options={[{ value: "all", label: "All time" }, ...months.map((value) => ({ value, label: new Date(`${value}-01T00:00:00Z`).toLocaleDateString("en", { month: "long", year: "numeric", timeZone: "UTC" }) }))]} /><Button size="icon" variant="outline" aria-label="Next month" className="size-11 shrink-0 rounded-xl dark:bg-card dark:border-border" disabled={busy} onClick={() => shiftMonth(1)}><ChevronRight size={17} /></Button></div>
        </div>
        <div role="status" aria-live="polite" className="sr-only">{busy ? "Saving your changes" : "All changes saved"}</div>
        {busy && <p className="flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle size={14} className="animate-spin" /> Saving changes…</p>}
        <TabsContent value="add"><FinancePlayground categories={quickCategories} entries={periodEntries} historyEntries={entries} busy={busy} onAdd={add} onSave={save} onCreateCategory={createCategory} onRemoveCategory={(category) => changeCategoryVisibility(category, true)} onReorderCategory={reorderCategories} /></TabsContent>
        <TabsContent value="dashboard"><FinanceDashboard entries={periodEntries} allEntries={currencyEntries} month={month} onAdd={add} onHistory={() => setView("history")} onShowAll={() => { setMonth("all"); setView("history"); }} /></TabsContent>
        <TabsContent value="board"><FinanceBoard entries={filterFinance(ordered, { month,currency })} busy={busy} onAdd={add} onEdit={edit} onMove={(entry, type) => { void move(entry, type); }} onReorder={reorder} onDelete={deleteEntry} /></TabsContent>
        <TabsContent value="history"><FinanceHistory key={month} entries={periodEntries} busy={busy} onEdit={edit} onMove={(entry, type) => { void move(entry, type); }} onDelete={(entry) => { setDeleteError(""); setDeleting(entry); }} /></TabsContent>
      </Tabs>
      {editor && <FinanceEditor entry={editor.entry} initialType={editor.type} defaultCurrency={settings.preferences.financeDefaultCurrency} categories={categories} onSave={save} onClose={() => setEditor(null)} />}
      <Dialog.Root open={!!deleting} onOpenChange={(open) => { if (!open && !busy) setDeleting(null); }}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" /><Dialog.Content className={financeDialogClass} onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }} onPointerDownOutside={(event) => { if (busy) event.preventDefault(); }}><Dialog.Title className="text-xl font-semibold">Delete this transaction?</Dialog.Title><Dialog.Description className="mt-3 text-sm leading-relaxed text-muted-foreground">{deleting?.subcategory || deleting?.category} · {formatAmount(deleting?.amount || 0)}. This removes the transaction from your history and updates your totals. This cannot be undone.</Dialog.Description>{deleteError && <p role="alert" className="mt-4 text-sm text-red-400">{deleteError}</p>}<div className="mt-6 flex gap-3"><Button variant="outline" disabled={busy} className="h-12 flex-1" onClick={() => setDeleting(null)}>Keep transaction</Button><HoldDeleteButton label={deleting?.subcategory || deleting?.category || "transaction"} disabled={busy} onConfirm={remove} /></div></Dialog.Content></Dialog.Portal></Dialog.Root>
    </section>
  );
}



