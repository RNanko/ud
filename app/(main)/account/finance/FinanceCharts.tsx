"use client";

import MoneyChartExplorer from "@/app/components/shared/charts/MoneyChartExplorer";
import type { FinanceEntry } from "@/lib/finance";

export default function FinanceCharts({ entries, month, currency }: { entries: FinanceEntry[]; month: string; currency: string }) {
  const [year, number] = month.split("-").map(Number);
  const through = month === "all" ? "" : new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10);
  return <MoneyChartExplorer title="Finance charts" initialCurrency={currency} initialFrom={month === "all" ? "" : `${month}-01`} initialTo={through}
    description="Compare revenue and spending amounts. Totals show activity, not net balance. Amount filters apply to individual transactions."
    records={entries.map(entry => ({ id: entry.id, date: entry.date, category: entry.category || "Uncategorized", detail: entry.subcategory || entry.comment || "", series: entry.type === "+" ? "Revenue" : "Spending", amount: entry.amount, currency: entry.currency ?? null }))} />;
}
