import test from "node:test";
import assert from "node:assert/strict";
import { loadModule, plain } from "./helpers.mjs";

const { summarizeFinance, filterFinance, financeTrend, spendingCategories, reorderFinance, serializeFinanceEntry } = loadModule("lib/finance.ts");
const row = (id, date, amount, type, category = "Food", subcategory = "", comment = "") => ({ id, date, amount, type, category, subcategory, comment });
const data = [
  row("salary", "2026-10-01", "3200", "+", "Salary", "Paycheck"),
  row("food", "2026-10-02", "45.20", "-", "Food", "Groceries", "Weekly shop"),
  row("rent", "2026-10-01", "900", "-", "Home", "Rent"),
  row("old", "2025-10-01", "100", "+", "Salary"),
];

test("dashboard uses the selected year and month, with exact decimal totals", () => {
  const period = filterFinance(data, { month: "2026-10" });
  assert.deepEqual(plain(summarizeFinance(period)), { revenue: 3200, spending: 945.2, balance: 2254.8 });
  assert.deepEqual(plain(summarizeFinance([row("a", "2026-10-02", ".10", "+"), row("b", "2026-10-02", ".20", "+")])), { revenue: .3, spending: 0, balance: .3 });
  assert.equal(summarizeFinance([]).balance, 0);
});

test("history combines search, type, category, and period without mutating source records", () => {
  assert.deepEqual(plain(filterFinance(data, { month: "2026-10", type: "-", category: "Food", search: " WEEKLY " }).map((item) => item.id)), ["food"]);
  assert.equal(filterFinance(data, { search: "missing" }).length, 0);
  assert.equal(filterFinance(data, { month: "all" }).length, 4);
  assert.equal(filterFinance(data, { search: "45.2" }).length, 1);
  assert.equal(data.length, 4);
});

test("cash flow respects year boundaries and spending categories aggregate independently of revenue", () => {
  const trend = financeTrend(data, "2026-02");
  assert.deepEqual(plain(trend.map((month) => month.month)), ["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02"]);
  assert.equal(trend[1].revenue, 100);
  const categories = spendingCategories(filterFinance(data, { month: "2026-10" }));
  assert.deepEqual(plain(categories), [{ category: "Home", amount: 900 }, { category: "Food", amount: 45.2 }]);
});

test("drag reordering preserves records, amounts, and type; invalid or cancelled drops do nothing", () => {
  const reordered = reorderFinance(data, "food", "rent");
  assert.deepEqual(plain(reordered.map((item) => item.id)), ["salary", "rent", "food", "old"]);
  assert.deepEqual(plain(summarizeFinance(reordered)), plain(summarizeFinance(data)));
  assert.equal(reorderFinance(data, "missing", "food"), data);
  assert.equal(reorderFinance(data, "food", "food"), data);
  assert.equal(data[1].id, "food");
});

test("server records serialize dates consistently and never expose the owner", () => {
  const entry = serializeFinanceEntry({ ...data[1], date: new Date("2026-10-02T00:00:00Z"), userId: "private" });
  assert.equal(entry.date, "2026-10-02");
  assert.equal(entry.userId, undefined);
});
