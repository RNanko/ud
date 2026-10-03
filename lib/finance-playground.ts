import type { FinanceEntry, MoneyType } from "./finance";

export type FinanceCategory = { name: string; type: MoneyType; hidden?: boolean };
export const categoryKey = ({ name, type }: FinanceCategory) => `${type}:${name.trim().toLocaleLowerCase("en")}`;

export function mergeFinanceCategories(saved: FinanceCategory[], entries: FinanceEntry[]): FinanceCategory[] {
  const defaults: FinanceCategory[] = [
    ...["Salary", "Freelance", "Gifts"].map((name) => ({ name, type: "+" as const })),
    ...["Food", "Transport", "Home", "Shopping", "Health"].map((name) => ({ name, type: "-" as const })),
  ];
  const categories = new Map<string, FinanceCategory>();
  const hidden = new Set(saved.filter((category) => category.hidden).map(categoryKey));
  for (const category of [...saved, ...entries.filter((entry) => entry.category).map((entry) => ({ name: entry.category!, type: entry.type })), ...defaults]) {
    if (!hidden.has(categoryKey(category)) && !categories.has(categoryKey(category))) categories.set(categoryKey(category), category);
  }
  return [...categories.values()];
}

export type CategoryRingCell = { region: "top" | "bottom" | "left" | "right-upper" | "right-lower"; index: number; count: number };

// Continuous strips fill every edge, even when the two category counts differ.
// The right-hand middle is reserved for the shared add/remove category target.
export function categoryRing(revenueCount: number, spendingCount: number) {
  const bandCount = (count: number) => count <= 4 ? Math.max(0, count - 1) : count % 2 ? 3 : 2;
  const top = bandCount(revenueCount), bottom = bandCount(spendingCount);
  const revenueSides = Math.floor((revenueCount - top) / 2), spendingSides = Math.floor((spendingCount - bottom) / 2);
  const revenueRight = revenueCount - top - revenueSides, spendingRight = spendingCount - bottom - spendingSides;
  const sides = revenueSides + spendingSides;
  const revenue: CategoryRingCell[] = [], spending: CategoryRingCell[] = [];
  for (let index = 0; index < top; index++) revenue.push({ region: "top", index, count: top });
  for (let index = 0; index < revenueSides; index++) revenue.push({ region: "left", index, count: sides });
  for (let index = 0; index < revenueRight; index++) revenue.push({ region: "right-upper", index, count: revenueRight });
  for (let index = 0; index < spendingSides; index++) spending.push({ region: "left", index: revenueSides + index, count: sides });
  for (let index = 0; index < spendingRight; index++) spending.push({ region: "right-lower", index, count: spendingRight });
  for (let index = 0; index < bottom; index++) spending.push({ region: "bottom", index, count: bottom });
  return { revenue, spending, sides, top, bottom, halfCount: Math.max(revenueRight, spendingRight, Math.ceil(sides / 2)), dense: revenueCount + spendingCount > 12 };
}

export function reorderFinanceCategories(categories: FinanceCategory[], active: FinanceCategory, target: FinanceCategory) {
  if (active.type !== target.type || categoryKey(active) === categoryKey(target)) return categories;
  const source = categories.findIndex((category) => categoryKey(category) === categoryKey(active));
  const destination = categories.findIndex((category) => categoryKey(category) === categoryKey(target));
  if (source < 0 || destination < 0) return categories;
  const next = [...categories];
  next.splice(destination, 0, next.splice(source, 1)[0]);
  return next;
}

export const FINANCE_SLIDER_LIMITS = [500, 1000, 2000, 4000, 8000, 10000, 12000, 14000, 16000, 18000, 20000];
export function stepFinanceSliderMax(current: number, direction: 1 | -1) {
  return direction === 1
    ? FINANCE_SLIDER_LIMITS.find((limit) => limit > current) ?? 20000
    : [...FINANCE_SLIDER_LIMITS].reverse().find((limit) => limit < current) ?? 500;
}
export function financeSliderMaxForAmount(current: number, amount: number) {
  return Math.min(20000, Math.max(current, FINANCE_SLIDER_LIMITS.find((limit) => limit >= amount) ?? 20000));
}

export function stepFinanceAmount(value: string, direction: 1 | -1) {
  const amount = Number(value);
  const cents = Number.isFinite(amount) ? Math.round(amount * 100) : 0;
  return (Math.min(99999999999900, Math.max(0, cents + direction * 100)) / 100).toFixed(2);
}
