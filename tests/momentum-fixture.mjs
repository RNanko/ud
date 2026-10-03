import { loadModule, plain } from "./helpers.mjs";
import { dates, logic as gymLogic, events, validation as gymValidation } from "./gym-fixture.mjs";
export const types = loadModule("lib/momentum/types.ts");
export const content = loadModule("lib/momentum/content.ts");
export const logic = loadModule("lib/momentum/logic.ts", { "../gym/dates": dates, "../gym/logic": gymLogic, "../events": events, "./content": content });
export const goalTypes = loadModule("lib/momentum/goals/types.ts");
export const goalValidation = loadModule("lib/momentum/goals/validation.ts", { "../../gym/validation": gymValidation, "../types": types, "./types": goalTypes });
export const goalEvaluation = loadModule("lib/momentum/goals/evaluate.ts", { "../../gym/dates": dates, "../logic": logic, "./types": goalTypes });
export const goalReducer = loadModule("lib/momentum/goals/reducer.ts", { "../../gym/dates": dates, "../logic": logic, "./evaluate": goalEvaluation });
export const goalReconcile = loadModule("lib/momentum/goals/reconcile.ts", { "../../gym/dates": dates, "./evaluate": goalEvaluation }, { structuredClone });
export const goalReview = loadModule("lib/momentum/goals/review.ts", { "../../gym/dates": dates, "./evaluate": goalEvaluation });
export const validation = loadModule("lib/momentum/validation.ts", { "../gym/validation": gymValidation, "./types": types, "./goals/validation": goalValidation });
export const scheduling = loadModule("lib/momentum/scheduling.ts", { "../planner-time": loadModule("lib/planner-time.ts"), "./logic": logic });
export const reducer = loadModule("lib/momentum/reducer.ts", { "../gym/dates": dates, "./logic": logic, "./types": types, "./goals/reducer": goalReducer }, { structuredClone });
export const todo = loadModule("lib/todo.ts");
export const emptySources = () => ({ todo: todo.emptyTodoBoard(), gym: { templates: [], plans: [], sessions: [], customExercises: [], restDays: [] }, weeks: [] });
export const context = (data, sources = emptySources(), at = "2026-10-03T10:00:00.000Z") => {
  const activities = logic.sourceActivities(sources, "Europe/Warsaw");
  return { date: dates.dateInZone(new Date(at), "Europe/Warsaw"), timezone: "Europe/Warsaw", now: at, activities, summaryFor: week => logic.buildSummary(sources, activities, data, week, "Europe/Warsaw", at) };
};
export const reduce = (data, command, sources, at) => reducer.reduceMomentum(data, validation.commandSchema.parse(command), context(data, sources, at));
export function fixture({ owner = "alice" } = {}) {
  let currentOwner = owner, now = "2026-10-03T10:00:00.000Z", fail = false;
  const columns = ["userId", "id", "data", "revision", "mutations", "updatedAt", "week"];
  const tables = Object.fromEntries(["momentumState", "kanbanBoard", "userEvents"].map(table => [table, Object.fromEntries(columns.map(key => [key, { table, key }]))]));
  const rows = { momentumState: [], kanbanBoard: [], userEvents: [] }, sources = { alice: emptySources(), bob: emptySources() }, calls = [];
  sources.alice.todo[1].items.push({ id: "alice-task", content: "My next action" }); sources.bob.todo[1].items.push({ id: "bob-task", content: "Private Bob action" });
  const eq = (column, value) => ({ column, value }), and = (...parts) => ({ parts });
  const matches = (row, condition) => !condition || (condition.parts ? condition.parts.every(part => matches(row, part)) : JSON.stringify(row[condition.column.key]) === JSON.stringify(condition.value));
  const query = (operation, selected) => {
    let table, where, values, change, ignore = false;
    return { from(value) { table = value; return this; }, where(value) { where = value; return this; }, values(value) { values = value; return this; }, set(value) { change = value; return this; }, onConflictDoNothing() { ignore = true; return this; }, returning(value) { selected = value; return this; }, then(resolve, reject) { try {
      calls.push({ operation, table: table.userId.table, where });
      if (fail) { fail = false; throw new Error("offline"); }
      const store = rows[table.userId.table]; let output = [];
      if (operation === "insert") { const existing = store.find(row => table.userId.table === "momentumState" ? row.userId === values.userId : row.id === values.id); if (!existing) { const row = { revision: 0, mutations: [], ...structuredClone(values) }; store.push(row); output = [row]; } else if (!ignore) throw new Error("Unique constraint"); }
      if (operation === "select") output = store.filter(row => matches(row, where));
      if (operation === "update") { output = store.filter(row => matches(row, where)); output.forEach(row => Object.assign(row, structuredClone(change))); }
      resolve(plain(selected ? output.map(row => Object.fromEntries(Object.entries(selected).map(([key, column]) => [key, row[column.key]]))) : output));
    } catch (error) { reject(error); } } };
  };
  const db = { select: value => query("select", value), insert: table => query("insert").from(table), update: table => query("update").from(table) };
  class ClockDate extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return Date.parse(now); } }
  const taskActions = { getToDoList: async () => { const data = sources[currentOwner].todo; if (!rows.kanbanBoard.some(row => row.userId === currentOwner)) rows.kanbanBoard.push({ id: `todo:${currentOwner}`, userId: currentOwner, data }); return plain(rows.kanbanBoard.find(row => row.userId === currentOwner).data); }, updateToDoList: async (next, before) => { const row = rows.kanbanBoard.find(row => row.userId === currentOwner); if (JSON.stringify(row.data) !== JSON.stringify(before)) return { success: false, message: "Newer changes" }; row.data = structuredClone(next); sources[currentOwner].todo = row.data; return { success: true, data: next }; } };
  const actions = loadModule("lib/actions/momentum.actions.ts", { "drizzle-orm": { eq, and }, "next/cache": { revalidatePath() {} }, "../db/drizzle": db, "../db/schema": tables, "../session": { requireUserId: async () => { if (!currentOwner) throw new Error("Unauthorized"); return currentOwner; } }, "./gym.actions": { getGymData: async () => plain(sources[currentOwner].gym) }, "./todo.actions": taskActions, "../gym/dates": dates, "../gym/validation": gymValidation, "../todo": todo, "../momentum/types": types, "../momentum/logic": logic, "../momentum/validation": validation, "../momentum/reducer": reducer, "../momentum/scheduling": scheduling, "../momentum/goals/evaluate": goalEvaluation, "../momentum/goals/reconcile": goalReconcile, "../momentum/goals/review": goalReview, "../planner-time": loadModule("lib/planner-time.ts") }, { Date: ClockDate });
  return { actions, rows, sources, calls, owner: value => { currentOwner = value; }, setTime: value => { now = value; }, failNext: () => { fail = true; } };
}
