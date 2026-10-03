import test from "node:test";
import assert from "node:assert/strict";
import { loadModule, hookHarness, jsxRuntime, findNode, plain } from "./helpers.mjs";
import { dates, events, logic, library } from "./gym-fixture.mjs";

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function savedStateFixture() {
  const harness = hookHarness();
  const notifications = [];
  const queue = loadModule("lib/save-queue.ts");
  const hook = loadModule("hooks/use-saved-state.ts", {
    react: harness.react,
    "@/lib/save-queue": queue,
    sonner: { toast: { error: (...args) => notifications.push(args) } },
  });
  return { harness, hook, notifications };
}

test("save queue preserves edit order even with a slow first request", async () => {
  const firstSave = deferred();
  const stored = [];
  const { createSaveQueue } = loadModule("lib/save-queue.ts");
  const queue = createSaveQueue(async (snapshot) => {
    if (snapshot === "first") await firstSave.promise;
    stored.push(snapshot);
  });
  const first = queue.enqueue("first");
  const second = queue.enqueue("second");
  await Promise.resolve();
  assert.deepEqual(stored, []);
  firstSave.resolve();
  await Promise.all([first, second]);
  assert.deepEqual(stored, ["first", "second"]);
});

test("failed saves are surfaced and later saves can recover", async () => {
  let fails = true;
  const { createSaveQueue } = loadModule("lib/save-queue.ts");
  const queue = createSaveQueue(async () => { if (fails) throw new Error("offline"); });
  await assert.rejects(queue.enqueue("first"), /offline/);
  await assert.rejects(queue.flush(), /offline/);
  fails = false;
  await queue.enqueue("latest");
  await queue.flush();
});

test("loading a saved board does not autosave it", async () => {
  const { harness, hook } = savedStateFixture();
  const saves = [];
  let state = harness.render(() => hook.useSavedState(["initial"], async (data) => {
    saves.push(data); return { success: true };
  }));
  state.loadData(["loaded"]);
  await state.flush();
  state = harness.render(() => hook.useSavedState(["initial"], async () => ({ success: true })));
  assert.deepEqual(plain(state.data), ["loaded"]);
  assert.deepEqual(saves, []);
});


export function eventsFixture({ loadWeek, saveWeek } = {}) {
  const harness = hookHarness(), saves = [], notifications = [], effects = []; let initialized = false;
  const initial = { week: "2026-WK40", days: [{ day: "Monday", workday: true }], dayData: [
    { id: "monday", day: "Monday", tasks: [{ id: "task", title: "Old week", completed: false }] },
  ] };
  const empty = () => ({ templates: [], plans: [], sessions: [], customExercises: [], restDays: [] });
  const mocks = {
    react: { ...harness.react, useEffect: fn => { if (!initialized) effects.push(fn); } }, "react/jsx-runtime": jsxRuntime,
    "next/dynamic": () => "EventsBoard", "framer-motion": { AnimatePresence: "AnimatePresence", MotionConfig: "MotionConfig", motion: { div: "motion.div" }, useIsPresent: () => true, useReducedMotion: () => false },
    "lucide-react": { Trash2: "Trash2" }, "./WeekPresets": "WeekPresets",
    "@/types/types": {}, "@/lib/gym/types": {}, "@/lib/events": events, "@/lib/planner-time": {},
    "@/lib/gym/dates": { ...dates, localDate: () => "2026-10-02", browserTimezone: () => "Europe/Warsaw" }, "@/lib/gym/logic": logic,
    "@/lib/gym/library": { exerciseLibrary: library }, "@/hooks/use-gym-sync": { notifyGymChange() {}, useGymSync() {} },
    "@/hooks/use-gym-units": { useGymUnits: () => ({ units: { weight: "kg", distance: "km" } }) },
    "@/lib/actions/gym.actions": { getGymData: async () => empty() },
    "@/lib/actions/planner.actions": { saveEventBoard: async command => { saves.push(plain(command)); const result = saveWeek ? await saveWeek(command.data, command.week) : { success: true }; return { ...result, data: command.data }; } },
    "@/lib/actions/events.actions": { getUserEventsList: loadWeek || (async () => []), getDefaultWeekEvents: async () => ({ success: true, data: [] }) },
    "@/app/components/ui/select": Object.fromEntries(["Select", "SelectContent", "SelectItem", "SelectTrigger", "SelectValue"].map(key => [key, key])),
    "../gym/GymUI": { GymButton: "GymButton", GymDialog: "GymDialog", GymSelect: "GymSelect", Confirm: "Confirm" },
    "../gym/WeekNavigator": "WeekNavigator", "../gym/SessionEditor": "SessionEditor",
    "./EventEditor": "EventEditor", "./QuickWorkoutSheet": "QuickWorkoutSheet", "./PlanWorkoutSheet": "PlanWorkoutSheet", "./PresetSheet": "PresetSheet", "./PlanTimingSheet": "PlanTimingSheet",
    "@/app/components/shared/account/ScheduleConflictNotice": "ScheduleConflictNotice",
    sonner: { toast: { error: message => notifications.push(message) } },
  };
  const EventsClient = loadModule("app/(main)/account/events/EventsClient.tsx", mocks, { structuredClone, localStorage: { getItem: () => null }, window: { location: { search: "" }, dispatchEvent() {} } }).default;
  const render = () => { let tree = harness.render(() => EventsClient({ data: initial, listOfWeeks: [initial.week, "2026-WK39"] })); if (!initialized) { initialized = true; effects.forEach(fn => fn()); tree = harness.render(() => EventsClient({ data: initial, listOfWeeks: [initial.week, "2026-WK39"] })); } return tree; };
  return { initial, saves, notifications, render };
}

test("week switching keeps the original board until load succeeds, without writing either week", async () => {
  const load = deferred(), fixture = eventsFixture({ loadWeek: () => load.promise });
  const switchWeek = findNode(fixture.render(), node => node.type === "Select").props.onValueChange("2026-WK39");
  let tree = fixture.render(), select = findNode(tree, node => node.type === "Select");
  assert.equal(select.props.value, "2026-WK40"); assert.equal(select.props.disabled, true); assert.deepEqual(fixture.saves, []);
  load.resolve([]); await switchWeek; tree = fixture.render();
  assert.equal(findNode(tree, node => node.type === "Select").props.value, "2026-WK39");
  assert.deepEqual(plain(findNode(tree, node => node.type === "EventsBoard").props.items), []); assert.deepEqual(fixture.saves, []);
});
test("week switching waits for outstanding edits and subsequent edits target the selected week", async () => {
  const save = deferred(), order = [], fixture = eventsFixture({ saveWeek: async (_, week) => { order.push("save:" + week); if (week === "2026-WK40") await save.promise; return { success: true }; }, loadWeek: async () => { order.push("load"); return []; } });
  let tree = fixture.render(); const board = findNode(tree, node => node.type === "EventsBoard");
  const mutation = board.props.actions.move(board.props.items[0], "2026-09-28", 1);
  tree = fixture.render(); const switchWeek = findNode(tree, node => node.type === "Select").props.onValueChange("2026-WK39");
  await Promise.resolve(); assert.deepEqual(order, ["save:2026-WK40"]); save.resolve(); await mutation; await switchWeek;
  tree = fixture.render(); findNode(tree, node => node.type === "EventsBoard").props.actions.create("2026-09-21");
  tree = fixture.render(); await findNode(tree, node => node.type === "EventEditor").props.onSave({ id: "new-event", title: "New week", completed: false }, "2026-09-21");
  assert.deepEqual(order, ["save:2026-WK40", "load", "save:2026-WK39"]);
});
test("failed week load preserves the user's current week and reports the error", async () => {
  const fixture = eventsFixture({ loadWeek: async () => { throw new Error("offline"); } });
  await findNode(fixture.render(), node => node.type === "Select").props.onValueChange("2026-WK39");
  const tree = fixture.render(); assert.equal(findNode(tree, node => node.type === "Select").props.value, "2026-WK40");
  assert.equal(findNode(tree, node => node.type === "Select").props.disabled, false); assert.equal(fixture.notifications.length, 1); assert.deepEqual(fixture.saves, []);
});
test("failed optimistic completion restores the event and retries the exact completion timestamp", async () => {
  let fail = true; const fixture = eventsFixture({ saveWeek: async () => ({ success: !fail, message: "offline" }) });
  const board = findNode(fixture.render(), node => node.type === "EventsBoard"); board.props.actions.complete(board.props.items[0]);
  await new Promise(resolve => setImmediate(resolve));
  let tree = fixture.render(); assert.equal(findNode(tree, node => node.type === "EventsBoard").props.items[0].completed, false);
  fail = false; await findNode(tree, node => node.type === "GymButton" && node.props.children === "Retry last save").props.onClick();
  await new Promise(resolve => setImmediate(resolve)); tree = fixture.render();
  assert.equal(findNode(tree, node => node.type === "EventsBoard").props.items[0].completed, true);
  assert.equal(fixture.saves.length, 2); assert.deepEqual(fixture.saves[0], fixture.saves[1]);
});
test("failed drag save restores the original date and keeps the same event for retry", async () => {
  const fixture = eventsFixture({ saveWeek: async () => ({ success: false, message: "offline" }) });
  const board = findNode(fixture.render(), node => node.type === "EventsBoard");
  await assert.rejects(board.props.actions.move(board.props.items[0], "2026-09-29", 0), /offline/);
  const item = findNode(fixture.render(), node => node.type === "EventsBoard").props.items[0];
  assert.equal(item.date, "2026-09-28"); assert.equal(item.title, "Old week"); assert.equal(item.id, "task");
});
