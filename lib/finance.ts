import { cashMinor, displayCash } from "./account/decimal";
export type MoneyType = "+" | "-";

export type FinanceEntry = {
  id: string;
  date: string;
  amount: string;
  currency?: string | null;
  category: string | null;
  subcategory: string | null;
  comment: string | null;
  type: MoneyType;
};

export function serializeFinanceEntry(row: {
  id: string; date: Date | string; amount: string; category: string | null;
  subcategory: string | null; comment: string | null; type: string | null; currency?: string | null;
}): FinanceEntry {
  return {
    id: row.id, date: new Date(row.date).toISOString().slice(0, 10),
    amount: row.amount, category: row.category, subcategory: row.subcategory,
    currency: row.currency ?? null,
    comment: row.comment, type: row.type === "+" ? "+" : "-",
  };
}

export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatAmount(value: number | string) {
  return new Intl.NumberFormat("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));
}

export function formatFinanceDate(date: string) {
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

export function summarizeFinance(entries: FinanceEntry[]) {
  // Sum minor units so amounts such as 0.10 + 0.20 remain exact.
  if(new Set(entries.map(row=>row.currency??null)).size>1)throw new Error("Choose one currency before calculating finance totals");
  const revenue = entries.filter((row) => row.type === "+").reduce((sum, row) => sum + cashMinor(row.amount), 0n);
  const spending = entries.filter((row) => row.type === "-").reduce((sum, row) => sum + cashMinor(row.amount), 0n);
  return { revenue: displayCash(revenue), spending: displayCash(spending), balance: displayCash(revenue-spending) };
}

export function filterFinance(entries: FinanceEntry[], filters: {
  month?: string; search?: string; type?: string; category?: string; currency?: string;
}) {
  const search = filters.search?.trim().toLowerCase();
  return entries.filter((row) =>
    (!filters.currency || (row.currency??"unassigned")===filters.currency) &&
    (!filters.month || filters.month === "all" || row.date.startsWith(filters.month)) &&
    (!filters.type || filters.type === "all" || row.type === filters.type) &&
    (!filters.category || (row.category || "Uncategorized") === filters.category) &&
    (!search || [row.category, row.subcategory, row.comment, row.amount].some((field) => field?.toLowerCase().includes(search))),
  );
}

/** History can show every currency without adding unlike amounts together. */
export function summarizeFinanceByCurrency(entries: FinanceEntry[]) {
  const groups = new Map<string | null, FinanceEntry[]>();
  for (const entry of entries) {
    const currency = entry.currency ?? null;
    const group = groups.get(currency) ?? [];
    group.push(entry);
    groups.set(currency, group);
  }
  return [...groups].map(([currency, records]) => ({ currency, ...summarizeFinance(records) }));
}

export function financeTrend(entries: FinanceEntry[], endMonth: string) {
  const [year, month] = endMonth.split("-").map(Number);
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 6 + index, 1));
    const key = date.toISOString().slice(0, 7);
    return { month: key, label: date.toLocaleDateString("en", { month: "short", timeZone: "UTC" }), ...summarizeFinance(filterFinance(entries, { month: key })) };
  });
}

export function spendingCategories(entries: FinanceEntry[]) {
  const amounts = new Map<string, bigint>();
  for (const row of entries.filter((entry) => entry.type === "-")) {
    const key = row.category || "Uncategorized";
    amounts.set(key, (amounts.get(key) || 0n) + cashMinor(row.amount));
  }
  return [...amounts].map(([category, cents]) => ({ category, amount: displayCash(cents) })).sort((a, b) => b.amount - a.amount);
}

export function reorderFinance(entries: FinanceEntry[], activeId: string, overId: string): FinanceEntry[] {
  const from = entries.findIndex((row) => row.id === activeId);
  const to = entries.findIndex((row) => row.id === overId);
  if (from < 0 || to < 0 || from === to) return entries;
  const next = [...entries];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
