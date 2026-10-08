"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState, type FormEvent } from "react";
import { X, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { financeEntrySchema } from "@/types/validators";
import { localDate, type FinanceEntry, type MoneyType } from "@/lib/finance";
import AmountInput from "./AmountInput";
import { financeCurrencyLabel, type FinanceCurrency } from "@/lib/finance-currencies";

export type EntryDraft = {
  type: MoneyType; amount: string; date: string; category: string; subcategory: string; comment: string; currency?: FinanceCurrency;
};

export const financeDialogClass = "fixed z-50 inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-t-3xl border border-border bg-background p-5 shadow-2xl outline-none sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[460px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:p-7";

export default function FinanceEditor({ entry, initialType, categories, defaultCurrency, onSave, onClose, blocked = false, recovery }: {
  entry: FinanceEntry | null; initialType: MoneyType; categories: string[]; defaultCurrency: FinanceCurrency;
  onSave: (id: string | null, draft: EntryDraft) => Promise<void>; onClose: () => void; blocked?: boolean; recovery?: React.ReactNode;
}) {
  const currency=entry?entry.currency??null:defaultCurrency;
  const [type, setType] = useState<MoneyType>(entry?.type || initialType);
  const [amount, setAmount] = useState(entry?.amount || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || blocked) return;
    const data = new FormData(event.currentTarget);
    const draft: EntryDraft = {
      type, amount: String(data.get("amount") || ""), date: String(data.get("date") || ""),
      category: String(data.get("category") || ""), subcategory: String(data.get("subcategory") || ""),
      comment: String(data.get("comment") || ""),
      ...(!entry&&currency?{currency:currency as FinanceCurrency}:{}),
    };
    const parsed = financeEntrySchema.safeParse(draft);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setSaving(true);
    setError("");
    try {
      await onSave(entry?.id || null, draft);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save. Please try again.");
    } finally { setSaving(false); }
  }

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open && !saving && !blocked) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className={financeDialogClass} onEscapeKeyDown={(event) => { if (saving || blocked) event.preventDefault(); }} onPointerDownOutside={(event) => { if (saving || blocked) event.preventDefault(); }}>
          <Dialog.Title className="pr-10 text-xl font-semibold">{entry ? "Edit transaction" : "Add transaction"}</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">{entry ? `${financeCurrencyLabel(currency)} · original currency preserved.` : currency === "NONE" ? "Numbers only, as selected in Account Settings." : `${currency} · from your Account Settings.`}</Dialog.Description>
          <Dialog.Close disabled={saving || blocked} aria-label="Close transaction form" className="absolute right-3 top-3 flex size-11 items-center justify-center rounded-full hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"><X size={20} /></Dialog.Close>
          {recovery}<form onSubmit={submit} className="mt-6 space-y-5">
            <fieldset disabled={saving || blocked} className="space-y-5">
              <legend className="sr-only">Transaction details</legend>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Transaction type">
                <Button type="button" aria-pressed={type === "-"} variant="outline" className={`h-12 ${type === "-" ? "border-orange-400/60 bg-orange-400/10 dark:border-orange-400/60 dark:bg-orange-400/10 text-orange-300" : ""}`} onClick={() => setType("-")}><ArrowUpRight /> Spending</Button>
                <Button type="button" aria-pressed={type === "+"} variant="outline" className={`h-12 ${type === "+" ? "border-sky-400/60 bg-sky-400/10 dark:border-sky-400/60 dark:bg-sky-400/10 text-sky-300" : ""}`} onClick={() => setType("+")}><ArrowDownLeft /> Revenue</Button>
              </div>
              <div className="space-y-2"><Label htmlFor="finance-amount">Amount</Label><AmountInput id="finance-amount" name="amount" value={amount} onChange={setAmount} disabled={saving || blocked} required autoFocus /></div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="finance-date">Date</Label><Input id="finance-date" name="date" type="date" defaultValue={entry?.date || localDate()} required className="h-12 min-w-0 bg-card dark:bg-card dark:border-border [color-scheme:dark]" /></div>
                <div className="space-y-2"><Label htmlFor="finance-category">Category</Label><Input id="finance-category" name="category" list="finance-categories" defaultValue={entry?.category || ""} placeholder={type === "-" ? "e.g. Food" : "e.g. Salary"} required maxLength={200} className="h-12 bg-card dark:bg-card dark:border-border" /><datalist id="finance-categories">{categories.map((category) => <option key={category} value={category} />)}</datalist></div>
              </div>
              <div className="space-y-2"><Label htmlFor="finance-subcategory">Detail <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="finance-subcategory" name="subcategory" defaultValue={entry?.subcategory || ""} placeholder={type === "-" ? "e.g. Weekly groceries" : "e.g. October paycheck"} maxLength={200} className="h-12 bg-card dark:bg-card dark:border-border" /></div>
              <div className="space-y-2"><Label htmlFor="finance-comment">Note <span className="font-normal text-muted-foreground">(optional)</span></Label><Textarea id="finance-comment" name="comment" defaultValue={entry?.comment || ""} placeholder="Anything you want to remember" maxLength={5000} rows={2} className="bg-card dark:bg-card dark:border-border" /></div>
            </fieldset>
            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-3 pt-1"><Button type="button" variant="outline" disabled={saving || blocked} className="h-12 flex-1 dark:bg-card dark:border-border" onClick={onClose}>Cancel</Button><Button disabled={saving || blocked} className={`h-12 flex-1 ${type === "+" ? "bg-sky-400 text-sky-950 hover:bg-sky-300" : "bg-orange-400 text-orange-950 hover:bg-orange-300"}`}>{saving ? "Saving…" : entry ? "Save changes" : `Add ${type === "+" ? "revenue" : "spending"}`}</Button></div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

