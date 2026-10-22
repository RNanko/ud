"use client";

import { useState, type ReactNode } from "react";
import { ArrowDownUp, BarChart3, ChartNoAxesCombined, ChartPie, Columns3, Layers, ListFilter, Tag, Wallet } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { useAccountFormat } from "@/hooks/use-account-format";
import { financeCurrencyLabel } from "@/lib/finance-currencies";
import { buildMoneyChart, chartFilterError, chartPeriod, currencyKey, filterMoneyChart, type MoneyChartFilters, type MoneyChartGroup, type MoneyChartOrder, type MoneyChartRecord, type MoneyChartType } from "@/lib/money/charts";
import FinanceSelect from "@/app/(main)/account/finance/FinanceSelect";
import ChartDatePicker from "./ChartDatePicker";
import MoneyChart from "./MoneyChart";

const chartTypes = [{ value: "horizontal", label: "Horizontal bars", icon: BarChart3 }, { value: "vertical", label: "Vertical bars", icon: Columns3 }, { value: "pie", label: "Pie", icon: ChartPie }, { value: "stacked", label: "Stacked bars", icon: Layers }, { value: "line", label: "Line", icon: ChartNoAxesCombined }] as const;
export default function MoneyChartExplorer({ title, records, initialCurrency, initialFrom = "", initialTo = "", description, headerActions, children, totalLabel = "Total amount" }: {
  title: string; records: MoneyChartRecord[]; initialCurrency: string; initialFrom?: string; initialTo?: string; description?: string;
  headerActions?: ReactNode; children?: ReactNode; totalLabel?: string;
}) {
  const { formatAmount } = useAccountFormat();
  const defaults: MoneyChartFilters = { from: initialFrom, to: initialTo, category: "", detail: "", series: "", currency: initialCurrency, minimum: "", maximum: "" };
  const [filters, setFilters] = useState(defaults);
  const [type, setType] = useState<MoneyChartType>("vertical");
  const [group, setGroup] = useState<MoneyChartGroup>("category");
  const [order, setOrder] = useState<MoneyChartOrder>("largest");
  const update = (key: keyof MoneyChartFilters, value: string) => setFilters(current => ({ ...current, [key]: value }));
  const currencies = [...new Set([initialCurrency, ...records.map(record => currencyKey(record.currency))])].sort();
  const categories = [...new Set(records.filter(record => currencyKey(record.currency) === filters.currency).map(record => record.category))].sort();
  const series = [...new Set(records.map(record => record.series))].sort();
  const selected = filterMoneyChart(records, filters);
  const period = chartPeriod(records.filter(record => currencyKey(record.currency) === filters.currency), filters.from, filters.to);
  const activeType = type === "line" && !period.multipleMonths ? "vertical" : type;
  const activeGroup = activeType === "line" ? "month" : group;
  const data = buildMoneyChart(selected, activeGroup, order, filters.from, filters.to);
  const error = chartFilterError(filters);
  const hasPositive = data.points.some(point => point.total > 0);
  return <section aria-label={title} className="min-w-0 space-y-5 rounded-3xl border border-border bg-card/40 p-4 sm:p-6">
    <header className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><h2 className="flex items-center gap-2 text-lg font-semibold"><ChartNoAxesCombined size={20} className="text-primary" />{title}</h2>{description && <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">{description}</p>}</div><div className="flex flex-wrap items-center gap-2">{headerActions}<Button variant="ghost" className="h-11" onClick={() => { setFilters(defaults); setOrder("largest"); }}>Reset filters</Button></div></header>
    {children}
    <div role="group" aria-label="Chart type" className="flex flex-wrap gap-2">{chartTypes.map(item => <Button key={item.value} variant={activeType === item.value ? "default" : "outline"} aria-pressed={activeType === item.value} disabled={item.value === "line" && !period.multipleMonths} title={item.value === "line" && !period.multipleMonths ? "Choose a period spanning multiple months" : item.label} onClick={() => setType(item.value)} className="h-11 rounded-xl text-xs"><item.icon size={16} />{item.label}</Button>)}</div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <ChartDatePicker label="Chart from" value={filters.from} onChange={value => update("from", value)} maximum={filters.to} />
      <ChartDatePicker label="Chart through" value={filters.to} onChange={value => update("to", value)} minimum={filters.from} />
      <div className="space-y-1.5"><span className="block text-xs text-muted-foreground">Category</span><FinanceSelect label="Chart category" title="Category" icon={Tag} value={filters.category} onValueChange={value => update("category", value)} options={[{ value: "", label: "All categories" }, ...categories.map(value => ({ value, label: value }))]} /></div>
      <div className="space-y-1.5"><span className="block text-xs text-muted-foreground">Details</span><Input aria-label="Chart details" placeholder="Filter details" value={filters.detail} onChange={event => update("detail", event.target.value)} className="h-12 min-w-0 rounded-2xl bg-background dark:bg-background" /></div>
      <div className="space-y-1.5"><span className="block text-xs text-muted-foreground">Minimum amount</span><Input aria-label="Chart minimum amount" inputMode="decimal" placeholder="No minimum" value={filters.minimum} onChange={event => update("minimum", event.target.value)} className="h-12 min-w-0 rounded-2xl bg-background dark:bg-background" /></div>
      <div className="space-y-1.5"><span className="block text-xs text-muted-foreground">Maximum amount</span><Input aria-label="Chart maximum amount" inputMode="decimal" placeholder="No maximum" value={filters.maximum} onChange={event => update("maximum", event.target.value)} className="h-12 min-w-0 rounded-2xl bg-background dark:bg-background" /></div>
      <div className="space-y-1.5"><span className="block text-xs text-muted-foreground">Group by</span><FinanceSelect label="Chart grouping" title="Group by" icon={ListFilter} disabled={activeType === "line"} value={activeGroup} onValueChange={value => setGroup(value as MoneyChartGroup)} options={[{ value: "category", label: "Category" }, { value: "detail", label: "Detail" }, { value: "month", label: "Month" }]} /></div>
      <div className="space-y-1.5"><span className="block text-xs text-muted-foreground">Order</span><FinanceSelect label="Chart order" title="Order" icon={ArrowDownUp} disabled={activeGroup === "month"} value={activeGroup === "month" ? "oldest" : order} onValueChange={value => setOrder(value as MoneyChartOrder)} options={[{ value: "largest", label: "Highest amount" }, { value: "smallest", label: "Lowest amount" }, { value: "name", label: "Alphabetical" }, { value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" }]} /></div>
      {series.length > 1 && <FinanceSelect label="Chart transaction type" title="Type" icon={Layers} value={filters.series} onValueChange={value => update("series", value)} options={[{ value: "", label: "All types" }, ...series.map(value => ({ value, label: value }))]} />}
      <FinanceSelect label="Chart currency" title="Currency" icon={Wallet} value={filters.currency} onValueChange={value => setFilters(current => ({ ...current, currency: value, category: "" }))} options={currencies.map(value => ({ value, label: value === "unassigned" ? "Currency not recorded" : financeCurrencyLabel(value) }))} />
    </div>
    <p role="status" className="text-xs text-muted-foreground">{selected.length} records · {data.points.length} {activeGroup === "month" ? "months" : "groups"} · {totalLabel} {formatAmount(data.total)} {filters.currency === "NONE" ? "(numbers only)" : filters.currency === "unassigned" ? "(currency not recorded)" : filters.currency}{activeType === "line" && " · Monthly totals"}</p>
    {error ? <p role="alert" className="rounded-2xl border border-orange-400/30 p-5 text-sm text-orange-300">{error}</p> : !selected.length || activeType === "pie" && !hasPositive ? <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border p-6 text-center"><ChartNoAxesCombined size={28} className="text-muted-foreground" /><p className="text-sm">{selected.length ? "Pie charts need a positive amount." : "No records match these filters."}</p><p className="text-xs text-muted-foreground">Adjust the dates, category, details, or amount range.</p></div> : <>
      <MoneyChart type={activeType} points={data.points} series={data.series} formatAmount={formatAmount} />
      <details className="rounded-2xl border border-border p-3 text-xs"><summary className="cursor-pointer py-1 font-medium">View chart data</summary><div className="mt-3 max-h-72 overflow-auto"><table className="w-full text-left"><caption className="sr-only">{title} totals by {activeGroup}</caption><thead><tr><th className="p-2">{activeGroup}</th>{data.series.map(item => <th key={item.key} className="p-2 text-right">{item.label}</th>)}<th className="p-2 text-right">Total</th></tr></thead><tbody>{data.points.map(point => <tr key={point.key} className="border-t border-border"><th className="p-2 font-normal wrap-anywhere">{point.label}</th>{data.series.map(item => <td key={item.key} className="p-2 text-right tabular-nums">{formatAmount(Number(point[item.key]))}</td>)}<td className="p-2 text-right tabular-nums">{formatAmount(point.total)}</td></tr>)}</tbody></table></div></details>
    </>}
  </section>;
}
