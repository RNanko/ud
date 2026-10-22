import assert from "node:assert/strict";
import test from "node:test";
import { loadModule } from "./helpers.mjs";

const { categoryKey, financeCategoryLayout, moveFinanceCategory, parseFinanceCategoryPositions } = loadModule("lib/finance-playground.ts");
const plain = value => JSON.parse(JSON.stringify(value));
const categories = Array.from({ length: 35 }, (_, index) => ({ name: `Category ${index}`, type: index === 0 ? "+" : "-" }));

test("saved cards keep their places when a new ring is added or a category is hidden", () => {
  for (const mobile of [false, true]) {
    const before = financeCategoryLayout(categories.slice(0, 11), mobile);
    const target = before.emptyCells[0];
    const positions = moveFinanceCategory(before.positions, categoryKey(categories[0]), { column: target.column - before.centerStart, row: target.row - before.centerStart });
    const expanded = financeCategoryLayout(categories, mobile, positions);
    for (const category of categories.slice(0, 11)) assert.deepEqual(expanded.positions[categoryKey(category)], positions[categoryKey(category)]);
    const hidden = financeCategoryLayout(categories.filter((_, index) => index !== 2), mobile, expanded.positions);
    assert.deepEqual(hidden.positions[categoryKey(categories[0])], positions[categoryKey(categories[0])]);
    assert.equal(hidden.cells.length + hidden.emptyCells.length, hidden.size ** 2 - hidden.centerSpan ** 2);
    assert.equal(new Set(hidden.cells.map(cell => `${cell.column}:${cell.row}`)).size, hidden.cells.length);
  }
});

test("occupied drops swap only the two cards and empty drops leave a hole", () => {
  const layout = financeCategoryLayout(categories.slice(0, 11), false);
  const first = categoryKey(categories[0]), second = categoryKey(categories[1]);
  const swapped = moveFinanceCategory(layout.positions, first, layout.positions[second]);
  assert.deepEqual(swapped[first], layout.positions[second]);
  assert.deepEqual(swapped[second], layout.positions[first]);
  for (const key of Object.keys(layout.positions).slice(2)) assert.deepEqual(swapped[key], layout.positions[key]);
  const empty = layout.emptyCells[0], destination = { column: empty.column - layout.centerStart, row: empty.row - layout.centerStart };
  const moved = moveFinanceCategory(layout.positions, first, destination);
  assert.deepEqual(plain(moved[first]), destination);
  assert.equal(Object.values(moved).some(cell => cell.column === layout.positions[first].column && cell.row === layout.positions[first].row), false);
});

test("invalid or colliding preferences cannot overlap cards or the central action", () => {
  assert.deepEqual(plain(parseFinanceCategoryPositions("invalid json")), {});
  assert.deepEqual(plain(parseFinanceCategoryPositions('{"bad":{"column":999999,"row":1},"other":null}')), {});
  const stored = { [categoryKey(categories[0])]: { column: 0, row: 0 }, [categoryKey(categories[1])]: { column: -1, row: -1 }, [categoryKey(categories[2])]: { column: -1, row: -1 } };
  for (const mobile of [false, true]) {
    const layout = financeCategoryLayout(categories, mobile, stored);
    assert.equal(new Set(layout.cells.map(cell => `${cell.column}:${cell.row}`)).size, categories.length);
    assert.ok(layout.cells.every(cell => cell.column < layout.centerStart || cell.column >= layout.centerStart + layout.centerSpan || cell.row < layout.centerStart || cell.row >= layout.centerStart + layout.centerSpan));
  }
});

test("layout preferences are isolated by account and viewport, with a safe server snapshot", () => {
  const store = new Map(), listeners = new Map(); let serverSnapshot;
  const hook = loadModule("hooks/use-finance-category-layout.ts", {
    react: { useMemo: fn => fn(), useSyncExternalStore: (subscribe, snapshot, server) => { subscribe(() => {}); serverSnapshot = server(); return snapshot(); } },
    "@/lib/finance-playground": { parseFinanceCategoryPositions },
  }, { localStorage: { getItem: key => store.get(key), setItem: (key, value) => store.set(key, value) }, window: { addEventListener: (type, listener) => listeners.set(type, listener), removeEventListener: type => listeners.delete(type), dispatchEvent() {} } }).useFinanceCategoryLayout;
  const positions = { "-:food": { column: -1, row: 2 } };
  assert.equal(hook("first", false).savePositions(positions), true);
  assert.deepEqual(plain(hook("first", false).positions), positions);
  assert.deepEqual(plain(hook("first", true).positions), {});
  assert.deepEqual(plain(hook("second", false).positions), {});
  assert.equal(serverSnapshot, "{}");
});
