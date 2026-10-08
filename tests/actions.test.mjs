import test from "node:test";
import assert from "node:assert/strict";
import { loadModule } from "./helpers.mjs";

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

// The replacement write contract is exercised through actual actions and PGlite
// in web-money-sql.test.mjs. Old exported signatures must fail closed.
test("all unversioned Finance writer signatures fail closed without database access", async () => {
  const {actions,writes,tags}=financeFixture();
  for(const result of await Promise.all([
    actions.createFinanceCategory({name:"Food",type:"-"}), actions.removeFinanceCategory({name:"Food",type:"-"}),
    actions.restoreFinanceCategory({name:"Food",type:"-"}), actions.saveFinanceEntry(null,validEntry),
    actions.saveFinanceEntry("owned",validEntry), actions.updateListItem("owned","amount","12.50"),
    actions.removeListItem("owned"), actions.addExpens(null,new FormData()), actions.addIncome(null,new FormData()),
  ])) { assert.equal(result.success,false); assert.match(result.message,/Reload Finance/); }
  assert.equal(writes.length,0);assert.equal(tags.length,0);
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
    react: { cache: fn => fn },
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
