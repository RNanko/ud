import { decimalString, scaledDecimal } from "../account/decimal";

export type MoneyChartRecord = { id: string; date: string; category: string; detail: string; series: string; amount: string; currency: string | null };
export type MoneyChartType = "horizontal" | "vertical" | "pie" | "stacked" | "line";
export type MoneyChartGroup = "category" | "detail" | "month";
export type MoneyChartOrder = "largest" | "smallest" | "name" | "newest" | "oldest";
export type MoneyChartFilters = { from: string; to: string; category: string; detail: string; series: string; currency: string; minimum: string; maximum: string };
export type MoneyChartPoint = { key: string; label: string; total: number; exact: string; [key: string]: number | string };
export const currencyKey = (currency: string | null) => currency ?? "unassigned";

export function chartFilterError(filters: MoneyChartFilters) {
  if (filters.from && filters.to && filters.from > filters.to) return "Choose an end date on or after the start date.";
  const validAmount = (value: string) => !value || /^\d+(?:\.\d{1,24})?$/.test(value);
  if (!validAmount(filters.minimum) || !validAmount(filters.maximum)) return "Enter a nonnegative amount using a decimal point.";
  if (filters.minimum && filters.maximum && scaledDecimal(filters.minimum, 24) > scaledDecimal(filters.maximum, 24)) return "Maximum amount must be at least the minimum amount.";
  return "";
}

export function filterMoneyChart(records: MoneyChartRecord[], filters: MoneyChartFilters) {
  if (chartFilterError(filters)) return [];
  const minimum = filters.minimum ? scaledDecimal(filters.minimum, 24) : null;
  const maximum = filters.maximum ? scaledDecimal(filters.maximum, 24) : null;
  const detail = filters.detail.trim().toLocaleLowerCase();
  return records.filter(record => {
    const amount = scaledDecimal(record.amount, 24);
    return currencyKey(record.currency) === filters.currency &&
      (!filters.from || record.date >= filters.from) && (!filters.to || record.date <= filters.to) &&
      (!filters.category || record.category === filters.category) &&
      (!filters.series || record.series === filters.series) &&
      (!detail || record.detail.toLocaleLowerCase().includes(detail)) &&
      (minimum === null || amount >= minimum) && (maximum === null || amount <= maximum);
  });
}

export function chartPeriod(records: MoneyChartRecord[], from = "", to = "") {
  const dates = records.map(record => record.date).sort();
  const start = from || dates[0] || "", end = to || dates.at(-1) || "";
  return { start, end, multipleMonths: !!start && !!end && start.slice(0, 7) !== end.slice(0, 7) && start <= end };
}

export function buildMoneyChart(records: MoneyChartRecord[], group: MoneyChartGroup, order: MoneyChartOrder, from = "", to = "") {
  // Each chart has one unit. Never add currencies or numbers-only records together.
  if (new Set(records.map(record => currencyKey(record.currency))).size > 1) throw Error("Choose one currency for this chart.");
  const series = [...new Set(records.map(record => record.series))].sort().map((label, index) => ({ label, key: `series${index}` }));
  const seriesKeys = new Map(series.map(item => [item.label, item.key]));
  const groups = new Map<string, { amount: bigint; values: Map<string, bigint>; latest: string }>();
  for (const record of records) {
    const key = group === "month" ? record.date.slice(0, 7) : group === "detail" ? record.detail || "No detail" : record.category;
    const value = groups.get(key) ?? { amount: 0n, values: new Map(), latest: "" };
    const amount = scaledDecimal(record.amount, 24), seriesKey = seriesKeys.get(record.series)!;
    value.amount += amount;
    value.values.set(seriesKey, (value.values.get(seriesKey) ?? 0n) + amount);
    value.latest = value.latest > record.date ? value.latest : record.date;
    groups.set(key, value);
  }
  if (group === "month" && records.length) {
    const { start, end } = chartPeriod(records, from, to);
    const [year, month] = start.split("-").map(Number);
    for (let offset = 0; offset <= 3612; offset++) {
      const key = new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 7);
      if (key > end.slice(0, 7)) break;
      if (!groups.has(key)) groups.set(key, { amount: 0n, values: new Map(), latest: `${key}-01` });
    }
  }
  const sorted = [...groups].sort(([a, left], [b, right]) => {
    if (group === "month") return a.localeCompare(b);
    if (order === "largest" || order === "smallest") {
      const comparison = left.amount === right.amount ? 0 : left.amount > right.amount ? 1 : -1;
      return comparison * (order === "largest" ? -1 : 1) || a.localeCompare(b);
    }
    if (order === "newest" || order === "oldest") return left.latest.localeCompare(right.latest) * (order === "newest" ? -1 : 1) || a.localeCompare(b);
    return a.localeCompare(b);
  });
  const points: MoneyChartPoint[] = sorted.map(([key, value]) => ({
    key, label: key, total: Number(decimalString(value.amount, 24)), exact: decimalString(value.amount, 24),
    ...Object.fromEntries(series.map(item => [item.key, Number(decimalString(value.values.get(item.key) ?? 0n, 24))])),
  }));
  return { points, series, total: Number(decimalString(records.reduce((sum, record) => sum + scaledDecimal(record.amount, 24), 0n), 24)) };
}
