"use client";

import MoneyChartExplorer from "@/app/components/shared/charts/MoneyChartExplorer";
import { Button } from "@/app/components/ui/button";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { decimalString } from "@/lib/account/decimal";
import type { ValuedPosition } from "@/lib/investments";

export default function InvestmentCharts({ rows, refreshing, disabled, onRefresh, updatedAt, error, warnings }: {
  rows: ValuedPosition[]; refreshing: boolean; disabled: boolean; onRefresh: () => void;
  updatedAt: string; error: string; warnings: string[];
}) {
  const unpriced = rows.filter(row => row.supported && row.valueUnits === null).length;
  return <MoneyChartExplorer title="Portfolio charts" initialCurrency="USD" totalLabel="Current value"
    description="Current value by asset or purchase month. Date filters select positions by their purchase date, not historical market prices. Amount filters apply to each position’s current value."
    headerActions={<Button variant="outline" disabled={refreshing || disabled} onClick={onRefresh} aria-label="Refresh investment prices" aria-busy={refreshing} className="h-11 rounded-xl border-sky-400/25 bg-transparent text-sky-300 hover:bg-sky-400/10">
      {refreshing ? <LoaderCircle aria-hidden="true" size={17} className="animate-spin text-primary motion-reduce:animate-none" /> : <RefreshCw aria-hidden="true" size={17} />}
      Refresh prices
    </Button>}
    records={rows.filter(row => row.supported && row.valueUnits !== null).map(row => ({ id: row.position.id, date: row.position.boughtOn, category: row.position.symbol, detail: row.position.name, series: row.position.kind === "crypto" ? "Crypto" : "Stocks & ETFs", amount: decimalString(BigInt(row.valueUnits!), 24), currency: "USD" }))}>
    <p role="status" className="text-xs text-muted-foreground">{refreshing ? "Updating market prices" : `Updated ${updatedAt}`} · USD · Quotes may be delayed.</p>
    {unpriced > 0 && <p role="status" className="text-xs text-muted-foreground">{unpriced} {unpriced === 1 ? "position is" : "positions are"} awaiting a price and excluded from the chart.</p>}
    {(error || warnings.length > 0) && <p role={error ? "alert" : "status"} className="rounded-2xl border border-orange-400/25 bg-orange-400/5 px-4 py-3 text-sm text-orange-200">{error || warnings.join(" ")}</p>}
  </MoneyChartExplorer>;
}
