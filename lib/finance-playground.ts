import type { FinanceEntry, MoneyType } from "./finance";

export type FinanceCategory = { name: string; type: MoneyType; hidden?: boolean; icon?: string | null };
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
export type FinanceCategoryCell = { column: number; row: number };
// Coordinates are relative to the center, so adding a ring preserves saved places.
export type FinanceCategoryPositions = Record<string, FinanceCategoryCell>;

export function parseFinanceCategoryPositions(stored: string): FinanceCategoryPositions {
  try {
    const value = JSON.parse(stored);
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).slice(0, 4096).filter((entry): entry is [string, FinanceCategoryCell] => {
      const cell = entry[1] as FinanceCategoryCell | null;
      return !!cell && Number.isInteger(cell.column) && Number.isInteger(cell.row) && Math.abs(cell.column) <= 50 && Math.abs(cell.row) <= 50;
    }));
  } catch { return {}; }
}

// Fill each perimeter before opening the next ring. Start at the upper-left,
// travel down the left edge, along the bottom, up the right and across the top.
// A two-cell mobile center leaves room for readable cards on a four-column ring.
export function financeCategoryRings(count: number, mobile: boolean) {
  const centerSpan = mobile ? 2 : 3;
  const cells: { column: number; row: number }[] = [];
  let edge = (centerSpan - 1) / 2;
  while (cells.length < count) {
    edge++;
    const perimeter: { column: number; row: number }[] = [];
    for (let row = -edge; row <= edge; row++) perimeter.push({ column: -edge, row });
    for (let column = -edge + 1; column <= edge; column++) perimeter.push({ column, row: edge });
    for (let row = edge - 1; row >= -edge; row--) perimeter.push({ column: edge, row });
    for (let column = edge - 1; column > -edge; column--) perimeter.push({ column, row: -edge });
    const filled = Math.min(perimeter.length, count - cells.length);
    // Distribute a partially filled ring around every side of the value panel.
    for (let index = 0; index < filled; index++) cells.push(perimeter[Math.floor(index * perimeter.length / filled)]);
  }
  // Keep the central action surrounded even when there are no categories yet.
  edge = Math.max(edge, (centerSpan + 1) / 2);
  const offset = edge + 1;
  // Revenue is first in the caller's order. Keep its first card at the board's
  // upper-left corner when additional rings are added around the original one.
  const corner = cells.findIndex(cell => cell.column === -edge && cell.row === -edge);
  if (corner > 0) cells.unshift(cells.splice(corner, 1)[0]);
  const placed = cells.map(({ column, row }) => ({ column: column + offset, row: row + offset }));
  const occupied = new Set(placed.map(cell => `${cell.column}:${cell.row}`));
  const centerStart = offset - (centerSpan - 1) / 2;
  const size = edge * 2 + 1;
  const emptyCells: { column: number; row: number }[] = [];
  for (let row = 1; row <= size; row++) for (let column = 1; column <= size; column++) {
    const outsideCenter = column < centerStart || column >= centerStart + centerSpan || row < centerStart || row >= centerStart + centerSpan;
    if (outsideCenter && !occupied.has(`${column}:${row}`)) emptyCells.push({ column, row });
  }
  return {
    size,
    centerSpan,
    centerStart,
    cells: placed,
    emptyCells,
  };
}

export function financeCategoryLayout(categories: FinanceCategory[], mobile: boolean, stored: FinanceCategoryPositions = {}) {
  const defaults = financeCategoryRings(categories.length, mobile);
  const { centerSpan } = defaults;
  const positions: FinanceCategoryPositions = {};
  const occupied = new Set<string>();
  const keyOf = (cell: FinanceCategoryCell) => `${cell.column}:${cell.row}`;
  const outsideCenter = (cell: FinanceCategoryCell) => cell.column < 0 || cell.column >= centerSpan || cell.row < 0 || cell.row >= centerSpan;
  let levels = (defaults.size - centerSpan) / 2;
  for (const category of categories) {
    const key = categoryKey(category), cell = stored[key];
    if (!cell || !Number.isInteger(cell.column) || !Number.isInteger(cell.row) || Math.abs(cell.column) > 50 || Math.abs(cell.row) > 50 || !outsideCenter(cell) || occupied.has(keyOf(cell))) continue;
    positions[key] = cell;
    occupied.add(keyOf(cell));
    levels = Math.max(levels, -cell.column, -cell.row, cell.column - centerSpan + 1, cell.row - centerSpan + 1);
  }
  const size = centerSpan + levels * 2, centerStart = levels + 1;
  const slots: FinanceCategoryCell[] = [];
  for (let row = -levels; row < centerSpan + levels; row++) for (let column = -levels; column < centerSpan + levels; column++) {
    const cell = { column, row };
    if (outsideCenter(cell)) slots.push(cell);
  }
  categories.forEach((category, index) => {
    const key = categoryKey(category);
    if (positions[key]) return;
    const cell = { column: defaults.cells[index].column - defaults.centerStart, row: defaults.cells[index].row - defaults.centerStart };
    const available = occupied.has(keyOf(cell)) ? slots.find(slot => !occupied.has(keyOf(slot)))! : cell;
    positions[key] = available;
    occupied.add(keyOf(available));
  });
  const absolute = (cell: FinanceCategoryCell) => ({ column: cell.column + centerStart, row: cell.row + centerStart });
  return { size, centerSpan, centerStart, positions, cells: categories.map(category => absolute(positions[categoryKey(category)])), emptyCells: slots.filter(cell => !occupied.has(keyOf(cell))).map(absolute) };
}

export function moveFinanceCategory(positions: FinanceCategoryPositions, key: string, target: FinanceCategoryCell): FinanceCategoryPositions {
  const source = positions[key];
  if (!source) return positions;
  const occupant = Object.keys(positions).find(id => positions[id].column === target.column && positions[id].row === target.row);
  return { ...positions, ...(occupant ? { [occupant]: source } : {}), [key]: target };
}

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
