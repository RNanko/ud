import test from "node:test";
import assert from "node:assert/strict";
import { loadModule, plain } from "./helpers.mjs";

const orm = {
  eq: (column, value) => ({ column, value }),
  and: (...conditions) => ({ conditions }),
  desc: (column) => column,
  sql: () => "sql",
};
const table = { id: "id", userId: "user_id", createdAt: "created_at" };

function financeFixture({ userId = "alice", rows = [{ id: "owned" }] } = {}) {
  const writes = [];
  const tags = [];
  const query = {
    onConflictDoUpdate(config) { writes.push({ conflict: config }); return this; },
    from() { return this; },
    set(values) { writes.push({ values }); return this; },
    values(values) { writes.push({ values }); return this; },
    where(condition) { writes.push({ condition }); return this; },
    returning: async () => rows,
  };
  const db = {
    insert() { writes.push({ operation: "insert" }); return query; },
    update() { writes.push({ operation: "update" }); return query; },
    delete() { writes.push({ operation: "delete" }); return query; },
    select() { writes.push({ operation: "select" }); return query; },
  };
  const requireUserId = async (requested) => {
    if (!userId || (requested !== undefined && requested !== userId)) throw new Error("Unauthorized");
    return userId;
  };
  const actions = loadModule("lib/actions/finance.actions.ts", {
    "next/headers": { headers: async () => ({}) },
    "../auth": { auth: {} },
    "../db/drizzle": db,
    "../db/schema": { financeTable: table, financeCategories: { userId: "user_id", type: "type", name: "name", normalizedName: "normalized_name" } },
    "@/types/validators": loadModule("types/validators.ts"),
    "../finance": loadModule("lib/finance.ts"),
    "../utils": {},
    "drizzle-orm": orm,
    "next/cache": { updateTag: (tag) => tags.push(tag) },
    "../session": { requireUserId },
  });
  return { actions, writes, tags };
}

const validEntry = { type: "-", amount: "12.50", date: "2026-10-02", category: " Food ", subcategory: "", comment: "" };

test("finance categories validate input, use the session owner and resolve duplicate names atomically", async () => {
  const { actions, writes } = financeFixture({ rows: [{ name: "Coffee", type: "-" }] });
  for (const invalid of [{ name: " ", type: "-" }, { name: "x".repeat(61), type: "-" }, { name: "Coffee", type: "other" }]) assert.equal((await actions.createFinanceCategory(invalid)).success, false);
  assert.equal(writes.length, 0);
  const result = await actions.createFinanceCategory({ name: " Coffee ", type: "-", userId: "bob" });
  assert.equal(result.success, true);
  const values = writes.find((entry) => entry.values).values;
  assert.equal(values.userId, "alice"); assert.equal(values.name, "Coffee"); assert.equal(values.normalizedName, "coffee");
  assert.deepEqual(plain(writes.find((entry) => entry.conflict).conflict.target), ["user_id", "type", "normalized_name"]);
  const anonymous = financeFixture({ userId: null });
  assert.equal((await anonymous.actions.createFinanceCategory({ name: "Coffee", type: "-" })).success, false);
  assert.equal(anonymous.writes.length, 0);
  await assert.rejects(actions.getFinanceCategories("bob"), /Unauthorized/);
});

test("category removal and restoration are owner-scoped tombstones and never change finance records", async () => {
  const { actions, writes } = financeFixture();
  const result = await actions.removeFinanceCategory({ name: " Food ", type: "-", userId: "bob" });
  assert.equal(result.success, true);
  const values = writes.find((entry) => entry.values).values;
  assert.equal(values.userId, "alice"); assert.equal(values.normalizedName, "food"); assert.equal(values.hidden, true);
  assert.equal(writes.some((entry) => ["delete", "update"].includes(entry.operation)), false);
  assert.deepEqual(plain(writes.find((entry) => entry.conflict).conflict.target), ["user_id", "type", "normalized_name"]);
  assert.equal((await actions.restoreFinanceCategory({ name: "Food", type: "-" })).category.hidden, false);
  const anonymous = financeFixture({ userId: null });
  assert.equal((await anonymous.actions.removeFinanceCategory({ name: "Food", type: "-" })).success, false);
  assert.equal(anonymous.writes.length, 0);
  const invalid = financeFixture();
  for (const input of [{ name: "", type: "-" }, { name: "Food", type: "invalid" }]) assert.equal((await invalid.actions.removeFinanceCategory(input)).success, false);
  assert.equal(invalid.writes.length, 0);
});

test("new transactions use the session owner and return the saved record", async () => {
  const { actions, writes } = financeFixture({ rows: [{ ...validEntry, category: "Food", id: "new", subcategory: null, comment: null }] });
  const result = await actions.saveFinanceEntry(null, { ...validEntry, userId: "bob" });
  assert.equal(result.success, true);
  const values = writes.find((entry) => entry.values).values;
  assert.equal(values.userId, "alice");
  assert.match(values.id, /^[0-9a-f-]{36}$/);
  assert.equal(values.amount, "12.50");
  assert.equal(result.entry.id, "new");
});

test("finance editor saves all fields atomically and scopes the update to the owner", async () => {
  const row = { ...validEntry, id: "owned", category: "Food", subcategory: null, comment: null };
  const { actions, writes, tags } = financeFixture({ rows: [row] });
  const result = await actions.saveFinanceEntry("owned", { ...validEntry, userId: "bob" });
  assert.equal(result.success, true);
  const values = writes.find((entry) => entry.values).values;
  assert.equal(values.amount, "12.50");
  assert.equal(values.category, "Food");
  assert.equal(values.subcategory, null);
  assert.equal(values.userId, undefined);
  assert.equal(values.date.toISOString(), "2026-10-02T00:00:00.000Z");
  assert.deepEqual(plain(writes.find((entry) => entry.condition).condition), { conditions: [
    { column: "id", value: "owned" }, { column: "user_id", value: "alice" },
  ] });
  assert.equal(result.entry.date, "2026-10-02");
  assert.deepEqual(tags, ["finance-data"]);
});

test("finance editor rejects invalid amounts, dates, blank categories, and non-owned records", async () => {
  const { actions, writes, tags } = financeFixture({ rows: [] });
  for (const invalid of [
    { amount: "0" }, { amount: "-12" }, { amount: "NaN" }, { amount: "1.234" },
    { amount: "1e3" }, { amount: "Infinity" }, { amount: "" },
    { date: "2026-02-30" }, { category: " " }, { type: "other" },
  ]) assert.equal((await actions.saveFinanceEntry("owned", { ...validEntry, ...invalid })).success, false);
  assert.equal(writes.length, 0);
  assert.equal((await actions.saveFinanceEntry("bob-record", validEntry)).success, false);
  assert.equal(tags.length, 0);
  const anonymous = financeFixture({ userId: null });
  assert.equal((await anonymous.actions.saveFinanceEntry(null, validEntry)).success, false);
  assert.equal(anonymous.writes.length, 0);
});

test("finance mutations reject anonymous callers before database access", async () => {
  const { actions, writes } = financeFixture({ userId: null });
  assert.equal((await actions.removeListItem("other-record")).success, false);
  assert.equal((await actions.updateListItem("other-record", "amount", "12")).success, false);
  assert.equal(writes.length, 0);
});

test("finance edits and deletes require both record ID and session owner", async () => {
  const { actions, writes, tags } = financeFixture();
  assert.equal((await actions.updateListItem("owned", "amount", "12.50")).success, true);
  assert.equal((await actions.removeListItem("owned")).success, true);
  const predicates = writes.filter((entry) => entry.condition).map((entry) => plain(entry.condition));
  assert.deepEqual(predicates, [0, 1].map(() => ({ conditions: [
    { column: "id", value: "owned" }, { column: "user_id", value: "alice" },
  ] })));
  assert.deepEqual(plain(writes.find((entry) => entry.values).values), { amount: "12.50" });
  assert.deepEqual(tags, ["finance-data", "finance-data"]);
});

test("non-owned records are not reported as successful changes", async () => {
  const { actions, tags } = financeFixture({ rows: [] });
  assert.equal((await actions.removeListItem("bob-record")).success, false);
  assert.equal((await actions.updateListItem("bob-record", "comment", "text")).success, false);
  assert.equal(tags.length, 0);
});

test("finance update allowlist and validation reject tampered fields and invalid values", async () => {
  const { actions, writes } = financeFixture();
  for (const [field, value] of [
    ["userId", "bob"], ["id", "replacement"], ["__proto__", "x"],
    ["amount", "-1"], ["amount", "NaN"], ["amount", "Infinity"], ["amount", ""],
    ["date", "2026-02-30"], ["date", "bad"], ["type", "expense"], ["category", " "],
  ]) assert.equal((await actions.updateListItem("owned", field, value)).success, false, `${field}: ${value}`);
  assert.equal(writes.length, 0);
});

test("all supported finance fields still save valid values", async () => {
  const { actions } = financeFixture();
  for (const [field, value] of [
    ["type", "+"], ["date", "2026-10-02"], ["category", "Food"],
    ["subcategory", "Groceries"], ["amount", "0"], ["comment", ""],
  ]) assert.equal((await actions.updateListItem("owned", field, value)).success, true, field);
});

test("private financial reads reject a caller-supplied different user", async () => {
  const { actions, writes } = financeFixture();
  await assert.rejects(actions.getFinanceData("bob"), /Unauthorized/);
  await assert.rejects(actions.getChartIncomeOutcomeData("bob", false), /Unauthorized/);
  assert.equal(writes.length, 0);
});

test("session guard rejects missing/mismatched users and bypasses stale cookie cache", async () => {
  let session = null;
  let options;
  const { requireUserId } = loadModule("lib/session.ts", {
    "next/headers": { headers: async () => ({}) },
    "./auth": { auth: { api: { getSession: async (input) => { options = input; return session; } } } },
  });
  await assert.rejects(requireUserId(), /Unauthorized/);
  session = { session: { userId: "alice" } };
  await assert.rejects(requireUserId("bob"), /Unauthorized/);
  assert.equal(await requireUserId("alice"), "alice");
  assert.equal(options.query.disableCookieCache, true);
});

test("retired avatar endpoint never uploads and still checks ownership", async () => {
 let loggedIn=false;
 const actions=loadModule('lib/actions/account.actions.ts', {'../db/drizzle':{},'../db/schema':{},'drizzle-orm':{},'next/cache':{},'../session':{requireUserId:async()=>{if(!loggedIn)throw Error('Unauthorized');return 'alice';}}});
 await assert.rejects(actions.updateAvatar(),/Unauthorized/);
 loggedIn=true;
 await assert.rejects(actions.updateAvatar(),/no longer supported/);
 assert.equal(actions.uploadImage,undefined);
});

test("cached private readers authorize before touching caches or database queries", async () => {
  const deny = async () => { throw new Error("Unauthorized"); };
  const modules = [
    ["lib/actions/todo.actions.ts", "getToDoList", ["bob"]],
    ["lib/actions/events.actions.ts", "getEventsList", ["bob", "2026-WK40"]],
    ["lib/actions/events.actions.ts", "getListOfWeeks", ["bob"]],
  ];
  for (const [file, name, args] of modules) {
    const actions = loadModule(file, {
      "next/headers": {}, "../auth": {}, "../db/drizzle": {}, "../db/schema": {},
      "drizzle-orm": {}, "next/cache": {}, "../session": { requireUserId: deny },
      "../todo": loadModule("lib/todo.ts"),
    });
    await assert.rejects(actions[name](...args), /Unauthorized/, name);
  }
});
