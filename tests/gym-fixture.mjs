import { hookHarness, loadModule, plain } from "./helpers.mjs";
const finance = loadModule("lib/finance.ts");
export const types = loadModule("lib/gym/types.ts");
export const dates = loadModule("lib/gym/dates.ts", { "../finance": finance });
export const logic = loadModule("lib/gym/logic.ts", {}, { structuredClone });
export const library = loadModule("lib/gym/library.ts").exerciseLibrary;
export const timing = loadModule("lib/planner-time.ts");
export const validation = loadModule("lib/gym/validation.ts", { "./types": types, "./dates": dates, "../planner-time": timing });
export const events = loadModule("lib/events.ts", { "./gym/dates": dates, "./gym/validation": validation, "./planner-time": timing }, { structuredClone });
// Explicit user-entered fixture targets; these are not application defaults.
export function blueprint(ids = ["bench-press"]) { return { name: "Test routine", notes: "", estimatedMinutes: 40, exercises: ids.map((id) => { const definition = library.find((exercise) => exercise.id === id); return { id: crypto.randomUUID(), definition: structuredClone(definition), targets: { ...logic.defaultTargets(), sets: ["duration", "cardio"].includes(definition.tracking) ? 1 : 3, reps: ["duration", "cardio"].includes(definition.tracking) ? null : 10, seconds: definition.tracking === "cardio" ? 1200 : definition.tracking === "duration" ? 45 : null, restSeconds: definition.tracking === "cardio" ? null : 90 }, notes: "" }; }) }; }
export function fixture({ owner = "alice" } = {}) {
  const tables = {};
  for (const name of ["gymEntities", "gymPlans", "gymSessions", "gymRestDays", "userEvents"]) tables[name] = Object.fromEntries(["id", "userId", "kind", "data", "date", "timezone", "revision", "lastMutation", "archived", "planId", "rest", "week"].map((key) => [key, { table: name, key }]));
  const rows = Object.fromEntries(Object.keys(tables).map((name) => [name, []])), calls = [];
  let fail = false;
  const orm = { eq: (column, value) => ({ column, value, operation: "eq" }), gte: (column, value) => ({ column, value, operation: "gte" }), lte: (column, value) => ({ column, value, operation: "lte" }), and: (...conditions) => ({ conditions }), sql: (_, ...values) => ({ increment: values[0] }) };
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)])) : value;
  const matches = (row, condition) => !condition || (condition.conditions ? condition.conditions.every((part) => matches(row, part)) : condition.operation === "eq" ? typeof condition.value === "object" && condition.value !== null ? JSON.stringify(canonical(row[condition.column.key])) === JSON.stringify(canonical(condition.value)) : row[condition.column.key] === condition.value : condition.operation === "gte" ? row[condition.column.key] >= condition.value : row[condition.column.key] <= condition.value);
  const query = (operation, selection) => {
    let table, predicate, values, changes, conflict, ignore = false, output;
    const api = {
      from(value) { table = value; return this; }, where(value) { predicate = value; return this; }, values(value) { values = Array.isArray(value) ? value : [value]; return this; }, set(value) { changes = value; return this; }, onConflictDoNothing() { ignore = true; return this; }, onConflictDoUpdate(value) { conflict = value; return this; }, returning(value) { selection = value; return this; },
      then(resolve, reject) { try {
        if (output === undefined) {
          if (fail) { fail = false; throw new Error("Simulated transport failure"); }
          const name = table.id.table, store = rows[name]; calls.push({ operation, table: name, predicate, values, changes });
          let result;
          if (operation === "select") result = store.filter((row) => matches(row, predicate));
          if (operation === "insert") { result = []; for (const value of values) { const found = store.find((row) => row.id === value.id || name === "gymSessions" && value.planId && row.planId === value.planId || name === "gymRestDays" && row.userId === value.userId && row.date === value.date); if (found && conflict) { Object.assign(found, conflict.set); result.push(found); } else if (found && ignore) continue; else if (found) throw new Error("Unique constraint"); else { const row = { revision: 0, archived: false, ...structuredClone(value) }; store.push(row); result.push(row); } } }
          if (operation === "update") { result = store.filter((row) => matches(row, predicate)); for (const row of result) for (const [key, value] of Object.entries(changes)) row[key] = value?.increment ? row[value.increment.key] + 1 : structuredClone(value); }
          output = plain(selection ? result.map((row) => Object.fromEntries(Object.entries(selection).map(([key, column]) => [key, row[column.key]]))) : result);
        }
        resolve(output);
      } catch (error) { reject(error); } },
    };
    return api;
  };
  const db = { select: (selection) => query("select", selection), insert: (table) => query("insert").from(table), update: (table) => query("update").from(table) };
  db.query = { userEvents: { findFirst: async ({ where }) => (await query("select").from(tables.userEvents).where(where))[0] } };
  const boundary = { "drizzle-orm": orm, "next/cache": { revalidatePath() {}, updateTag() {} }, "../db/drizzle": db, "../db/schema": tables, "../session": { requireUserId: async () => { if (!owner) throw new Error("Unauthorized"); return owner; } }, "../gym/validation": validation, "../gym/logic": logic, "../gym/dates": dates, "../planner-time": timing };
  const actions = loadModule("lib/actions/gym.actions.ts", boundary);
  const planner = loadModule("lib/actions/planner.actions.ts", { ...boundary, "../events": events, "./gym.actions": actions }, { structuredClone });
  return { actions, planner, rows, calls, failNext: () => { fail = true; } };
}
export function sessionHook(initial, save) {
  const harness = hookHarness(), callbacks = [];
  const queue = loadModule("lib/save-queue.ts");
  const timers = new Map(); let timerId = 0;
  const sessionModule = loadModule("hooks/use-gym-session.ts", { react: harness.react, "@/lib/actions/gym.actions": { saveGymSession: save }, "@/lib/save-queue": queue, "@/lib/gym/validation": validation }, { setTimeout: (fn) => { timers.set(++timerId, fn); return timerId; }, clearTimeout: (id) => timers.delete(id) });
  const render = () => harness.render(() => sessionModule.useGymSession(initial, (record) => callbacks.push(record)));
  return { render, callbacks, runTimer: async () => { const entries = [...timers.values()]; timers.clear(); for (const fn of entries) fn(); await new Promise((resolve) => setImmediate(resolve)); } };
}
