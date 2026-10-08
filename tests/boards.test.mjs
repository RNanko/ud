import test from "node:test";
import assert from "node:assert/strict";
import { loadModule, hookHarness, jsxRuntime, findNode, plain } from "./helpers.mjs";
import { dates, events, logic, library, validation, fixture as databaseFixture } from "./gym-fixture.mjs";

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function savedStateFixture() {
  const harness = hookHarness();
  const queue = loadModule("lib/save-queue.ts");
  const hook = loadModule("hooks/use-saved-state.ts", {
    react: harness.react,
    "@/lib/save-queue": queue,
  });
  return { harness, hook };
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

test("saved state exposes a failed save inline and retries the latest snapshot", async () => {
  const { harness, hook } = savedStateFixture();
  const writes = [];
  let fail = true;
  const save = async data => { writes.push(plain(data)); return { success: !fail }; };
  const render = () => harness.render(() => hook.useSavedState(["initial"], save));
  render().changeData(["updated"]);
  await assert.rejects(render().flush(), /Unable to save/);
  assert.match(render().error, /could not be saved/);
  fail = false;
  render().retry();
  await render().flush();
  assert.equal(render().error, "");
  assert.deepEqual(writes, [["updated"], ["updated"]]);
});


export function eventsFixture({ loadWeek, saveWeek, startsOn = "monday", loadWindow, saveWindow } = {}) {
  const harness = hookHarness(), saves = [], effects = []; let initialized = false;
  const initial = { week: "2026-WK40", days: [{ day: "Monday", workday: true }], dayData: [
    { id: "monday", day: "Monday", tasks: [{ id: "task", title: "Old week", completed: false }] },
  ] };
  const empty = () => ({ templates: [], plans: [], sessions: [], customExercises: [], restDays: [] });
  const mocks = {
    react: { ...harness.react, useEffect: fn => { if (!initialized) effects.push(fn); } }, "react/jsx-runtime": jsxRuntime,
    "next/dynamic": () => "EventsBoard", "framer-motion": { AnimatePresence: "AnimatePresence", MotionConfig: "MotionConfig", motion: { div: "motion.div" }, useIsPresent: () => true, useReducedMotion: () => false },
    "lucide-react": { LoaderCircle: "LoaderCircle", Plus: "Plus", Trash2: "Trash2" }, "./WeekPresets": "WeekPresets",
    "@/lib/gym/validation": validation,
    "@/hooks/use-account-calendar": { useAccountCalendar: () => ({ localDate: () => "2026-10-02", browserTimezone: () => "Europe/Warsaw", startsOn, weekDates: date => dates.weekDates(date, startsOn), hour12: false }) },
    "@/lib/actions/calendar-window.actions": { getAccountEventWindow: loadWindow || (async () => []), saveAccountEventWindow: saveWindow || (async command => ({success:true,data:command.data})) },
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
    "@/app/components/shared/loader": "AppLoader",
  };
  const EventsClient = loadModule("app/(main)/account/events/EventsClient.tsx", mocks, { structuredClone, localStorage: { getItem: () => null }, window: { location: { search: "" }, dispatchEvent() {} } }).default;
  const render = () => { let tree = harness.render(() => EventsClient({ data: initial, listOfWeeks: [initial.week, "2026-WK39"] })); if (!initialized) { initialized = true; effects.forEach(fn => fn()); tree = harness.render(() => EventsClient({ data: initial, listOfWeeks: [initial.week, "2026-WK39"] })); } return tree; };
  return { initial, saves, render };
}

test("week switching keeps the original board until load succeeds, without writing either week", async () => {
  const load = deferred(), fixture = eventsFixture({ loadWeek: () => load.promise });
  const switchWeek = findNode(fixture.render(), node => node.type === "Select").props.onValueChange("39");
  let tree = fixture.render(), select = findNode(tree, node => node.type === "Select");
  assert.equal(select.props.value, "40"); assert.equal(select.props.disabled, true); assert.deepEqual(fixture.saves, []);
  assert.equal(findNode(tree, node => node.type === "Select" && node.props.name === "year").props.disabled, true);
  assert.equal(findNode(tree, node => node.type === "AppLoader").props.label, "Loading week…");
  load.resolve([]); await switchWeek; tree = fixture.render();
  assert.equal(findNode(tree, node => node.type === "Select").props.value, "39");
  assert.deepEqual(plain(findNode(tree, node => node.type === "EventsBoard").props.items), []); assert.deepEqual(fixture.saves, []);
  assert.equal(findNode(tree, node => node.type === "AppLoader"), undefined);
});
test("week switching waits for outstanding edits and subsequent edits target the selected week", async () => {
  const save = deferred(), order = [], fixture = eventsFixture({ saveWeek: async (_, week) => { order.push("save:" + week); if (week === "2026-WK40") await save.promise; return { success: true }; }, loadWeek: async () => { order.push("load"); return []; } });
  let tree = fixture.render(); const board = findNode(tree, node => node.type === "EventsBoard");
  const mutation = board.props.actions.move(board.props.items[0], "2026-09-28", 1);
  tree = fixture.render(); const switchWeek = findNode(tree, node => node.type === "Select").props.onValueChange("39");
  await Promise.resolve(); assert.deepEqual(order, ["save:2026-WK40"]); save.resolve(); await mutation; await switchWeek;
  tree = fixture.render(); findNode(tree, node => node.type === "EventsBoard").props.actions.create("2026-09-21");
  tree = fixture.render(); await findNode(tree, node => node.type === "EventEditor").props.onSave({ id: "new-event", title: "New week", completed: false }, "2026-09-21");
  assert.deepEqual(order, ["save:2026-WK40", "load", "save:2026-WK39"]);
});
test("failed week load preserves the user's current week and reports the error", async () => {
  const fixture = eventsFixture({ loadWeek: async () => { throw new Error("offline"); } });
  await findNode(fixture.render(), node => node.type === "Select").props.onValueChange("39");
  const tree = fixture.render(); assert.equal(findNode(tree, node => node.type === "Select").props.value, "40");
  assert.equal(findNode(tree, node => node.type === "Select" && node.props.name === "year").props.value, "2026");
  assert.equal(findNode(tree, node => node.type === "Select").props.disabled, false); assert.ok(findNode(tree, node => node.props?.role === "alert")); assert.deepEqual(fixture.saves, []);
});
test("separate week and year selectors handle ISO week 53 and stay synchronized with calendar navigation", async () => {
  const loaded = [], fixture = eventsFixture({loadWeek: async week => {loaded.push(week); return [];}});
  fixture.initial.week = "2026-WK53";
  let tree = fixture.render();
  const select = (name) => findNode(tree, node => node.type === "Select" && node.props.name === name);
  assert.equal(events.weeksInYear("2026"), 53); assert.equal(events.weeksInYear("2027"), 52);
  assert.equal(events.weeksInYear("2020"), 53); assert.equal(events.weeksInYear("2021"), 52);
  assert.throws(() => events.weeksInYear("invalid"), /valid year/);
  assert.ok(findNode(select("week"), node => node.type === "SelectItem" && node.props.value === "53"));
  await select("year").props.onValueChange("2027");
  tree = fixture.render();
  assert.equal(select("week").props.value, "52"); assert.equal(select("year").props.value, "2027");
  assert.equal(findNode(select("week"), node => node.type === "SelectItem" && node.props.value === "53"), undefined);
  assert.deepEqual(loaded, ["2027-WK52"]); assert.deepEqual(fixture.saves, []);
  findNode(tree, node => node.type === "WeekNavigator").props.onSelect("2025-12-29");
  await new Promise(resolve => setImmediate(resolve));
  tree = fixture.render();
  assert.equal(select("week").props.value, "1"); assert.equal(select("year").props.value, "2026");
  assert.deepEqual(loaded, ["2027-WK52", "2026-WK1"]); assert.deepEqual(fixture.saves, []);
});

test("failed year navigation preserves both selectors and the existing board", async () => {
  const fixture = eventsFixture({loadWeek: async () => {throw new Error("offline");}});
  const before = plain(findNode(fixture.render(), node => node.type === "EventsBoard").props.items);
  await findNode(fixture.render(), node => node.type === "Select" && node.props.name === "year").props.onValueChange("2027");
  const tree = fixture.render();
  assert.equal(findNode(tree, node => node.type === "Select" && node.props.name === "week").props.value, "40");
  assert.equal(findNode(tree, node => node.type === "Select" && node.props.name === "year").props.value, "2026");
  assert.deepEqual(plain(findNode(tree, node => node.type === "EventsBoard").props.items), before);
  assert.ok(findNode(tree, node => node.props?.role === "alert")); assert.deepEqual(fixture.saves, []);
});

test("completing and reopening events show pending feedback until the save finishes and block duplicate changes", async () => {
  for (const completed of [false, true]) {
    const save = deferred(), fixture = eventsFixture({ saveWeek: () => save.promise });
    fixture.initial.dayData[0].tasks[0].completed = completed;
    let board = findNode(fixture.render(), node => node.type === "EventsBoard");
    board.props.actions.complete(board.props.items[0]);
    board = findNode(fixture.render(), node => node.type === "EventsBoard");
    assert.deepEqual(plain(board.props.completion), { id: "task", completed: !completed });
    assert.equal(board.props.items[0].completed, !completed);
    board.props.actions.complete(board.props.items[0]);
    await Promise.resolve();
    assert.equal(fixture.saves.length, 1);
    save.resolve({ success: true });
    await new Promise(resolve => setImmediate(resolve));
    board = findNode(fixture.render(), node => node.type === "EventsBoard");
    assert.equal(board.props.completion, null);
    assert.equal(board.props.items[0].completed, !completed);
    assert.equal(fixture.saves.length, 1);
  }
});

test("failed reopening restores the checked event and retry shows reopening feedback", async () => {
  let fail = true;
  const retry = deferred(), fixture = eventsFixture({ saveWeek: () => fail ? { success: false, message: "offline" } : retry.promise });
  fixture.initial.dayData[0].tasks[0].completed = true;
  let board = findNode(fixture.render(), node => node.type === "EventsBoard");
  board.props.actions.complete(board.props.items[0]);
  await new Promise(resolve => setImmediate(resolve));
  board = findNode(fixture.render(), node => node.type === "EventsBoard");
  assert.equal(board.props.items[0].completed, true);
  assert.equal(board.props.completion, null);
  fail = false;
  findNode(fixture.render(), node => node.type === "GymButton" && node.props.children === "Retry last save").props.onClick();
  board = findNode(fixture.render(), node => node.type === "EventsBoard");
  assert.deepEqual(plain(board.props.completion), { id: "task", completed: false });
  retry.resolve({ success: true });
  await new Promise(resolve => setImmediate(resolve));
  board = findNode(fixture.render(), node => node.type === "EventsBoard");
  assert.equal(board.props.items[0].completed, false);
  assert.equal(board.props.completion, null);
  assert.deepEqual(fixture.saves[0], fixture.saves[1]);
});

test("failed optimistic completion restores the event and retries the exact completion timestamp", async () => {
  let fail = true; const fixture = eventsFixture({ saveWeek: async () => ({ success: !fail, message: "offline" }) });
  const board = findNode(fixture.render(), node => node.type === "EventsBoard"); board.props.actions.complete(board.props.items[0]);
  await new Promise(resolve => setImmediate(resolve));
  let tree = fixture.render(); assert.equal(findNode(tree, node => node.type === "EventsBoard").props.items[0].completed, false);
  assert.equal(findNode(tree, node => node.type === "EventsBoard").props.completion, null);
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

test("moving events shows a header spinner without the app loader, blocks duplicate moves, and clears on failure and retry success", async () => {
  const save = deferred(), retry = deferred();
  let attempt = 0;
  const fixture = eventsFixture({ saveWeek: () => ++attempt === 1 ? save.promise : retry.promise });
  const board = findNode(fixture.render(), node => node.type === "EventsBoard");
  const moving = board.props.actions.move(board.props.items[0], "2026-09-29", 0);
  let tree = fixture.render();
  assert.equal(findNode(tree, node => node.type === "AppLoader"), undefined);
  assert.ok(findNode(findNode(tree, node => node.type === "header"), node => node.type === "LoaderCircle"));
  assert.ok(findNode(tree, node => node.props?.role === "status" && node.props.children === "Moving event…"));
  assert.equal(findNode(tree, node => node.props?.inert === true).props["aria-busy"], true);
  await assert.rejects(board.props.actions.move(board.props.items[0], "2026-09-30", 0), /in progress/);
  assert.equal(fixture.saves.length, 1);
  save.resolve({ success: false, message: "offline" });
  await assert.rejects(moving, /offline/);
  tree = fixture.render();
  assert.equal(findNode(tree, node => node.type === "AppLoader"), undefined);
  assert.equal(findNode(tree, node => node.type === "LoaderCircle"), undefined);
  assert.equal(findNode(tree, node => node.type === "EventsBoard").props.items[0].date, "2026-09-28");
  findNode(tree, node => node.type === "GymButton" && node.props.children === "Retry last save").props.onClick();
  tree = fixture.render();
  assert.equal(findNode(tree, node => node.type === "AppLoader"), undefined);
  assert.ok(findNode(findNode(tree, node => node.type === "header"), node => node.type === "LoaderCircle"));
  retry.resolve({ success: true });
  await new Promise(resolve => setImmediate(resolve));
  tree = fixture.render();
  assert.equal(findNode(tree, node => node.type === "AppLoader"), undefined);
  assert.equal(findNode(tree, node => node.type === "LoaderCircle"), undefined);
  assert.equal(findNode(tree, node => node.type === "EventsBoard").props.items[0].date, "2026-09-29");
  assert.deepEqual(fixture.saves[0], fixture.saves[1]);
});

test("creating a future event saves its ISO week, preserves both users' existing events, and opens its actual date", async () => {
  const db = databaseFixture(), target = "2027-01-01", week = events.weekKey(target);
  assert.equal(week, "2026-WK53");
  db.rows.userEvents.push(
    {id:"target-alice",userId:"alice",week,data:[{id:"friday",day:"Friday",tasks:[{id:"keep",title:"Existing appointment",completed:false}]}]},
    {id:"target-bob",userId:"bob",week,data:[{id:"friday",day:"Friday",tasks:[{id:"bob",title:"Private appointment",completed:false}]}]},
  );
  const fixture = eventsFixture({
    loadWeek: async requested => plain(db.rows.userEvents.find(row => row.userId === "alice" && row.week === requested)?.data ?? []),
    saveWeek: async (_, savedWeek) => db.planner.saveEventBoard(fixture.saves.findLast(command => command.week === savedWeek)),
  });
  db.rows.userEvents.push({id:"current-alice",userId:"alice",week:fixture.initial.week,data:plain(fixture.initial.dayData)});
  const before = plain(db.rows.userEvents);
  findNode(fixture.render(), node => node.type === "EventsBoard").props.actions.create("2026-10-02");
  const draft = {id:crypto.randomUUID(),title:"Future event",completed:false};
  await findNode(fixture.render(), node => node.type === "EventEditor").props.onSave(draft,target);
  assert.equal(fixture.saves.length,1); assert.equal(fixture.saves[0].week,week);
  assert.deepEqual(db.rows.userEvents.find(row => row.id === "current-alice"),before[2]);
  assert.deepEqual(db.rows.userEvents.find(row => row.id === "target-bob"),before[1]);
  assert.deepEqual(db.rows.userEvents[0].data[0].tasks.map(event => event.id),["keep",draft.id]);
  const tree = fixture.render();
  assert.equal(findNode(tree,node => node.type === "WeekNavigator").props.selected,target);
  const items = findNode(tree,node => node.type === "EventsBoard").props.items;
  assert.equal(items.find(item => item.id === draft.id).date,target);
});

test("an ambiguous future save retries the same command and event ID without duplicating it", async () => {
  const db = databaseFixture(); let first = true, loads = 0;
  const fixture = eventsFixture({loadWeek:async()=>{loads++;return [];},saveWeek:async()=>{
    const result = await db.planner.saveEventBoard(fixture.saves.at(-1));
    if(first){first=false;throw Error("Lost response");} return result;
  }});
  findNode(fixture.render(),node=>node.type === "EventsBoard").props.actions.create("2026-10-02");
  const draft = {id:crypto.randomUUID(),title:"Next year",completed:false}, date="2027-07-12";
  await assert.rejects(findNode(fixture.render(),node=>node.type === "EventEditor").props.onSave(draft,date),/Lost response/);
  assert.equal(findNode(fixture.render(),node=>node.type === "Select" && node.props.name === "week").props.value,"40");
  await findNode(fixture.render(),node=>node.type === "EventEditor").props.onSave(draft,date);
  assert.deepEqual(fixture.saves[0],fixture.saves[1]); assert.equal(loads,1);
  assert.equal(db.rows.userEvents.flatMap(row=>row.data.flatMap(day=>day.tasks)).length,1);
  assert.equal(findNode(fixture.render(),node=>node.type === "WeekNavigator").props.selected,date);
});

test("Sunday calendar creation writes the canonical ISO week and displays the requested Sunday window", async () => {
  const windows=[], fixture=eventsFixture({startsOn:"sunday",loadWindow:async date=>{windows.push(date);return fixture.saves.at(-1)?.data ?? []}});
  let tree=fixture.render(); await new Promise(resolve=>setImmediate(resolve)); tree=fixture.render();
  findNode(tree,node=>node.type === "EventsBoard").props.actions.create("2026-10-02");
  const draft={id:crypto.randomUUID(),title:"Sunday",completed:false}, date="2027-01-03";
  await findNode(fixture.render(),node=>node.type === "EventEditor").props.onSave(draft,date);
  assert.equal(fixture.saves[0].week,"2026-WK53");
  assert.equal(windows.at(-1),date);
  assert.equal(findNode(fixture.render(),node=>node.type === "EventsBoard").props.items[0].date,date);
});

test("a future target read failure and invalid date do not write an event or replace the current board", async () => {
  const fixture=eventsFixture({loadWeek:async()=>{throw Error("offline")}});
  const tree=fixture.render(); findNode(tree,node=>node.type === "EventsBoard").props.actions.create("2026-10-02");
  const draft={id:crypto.randomUUID(),title:"Future",completed:false};
  await assert.rejects(findNode(fixture.render(),node=>node.type === "EventEditor").props.onSave(draft,"2027-02-30"));
  await assert.rejects(findNode(fixture.render(),node=>node.type === "EventEditor").props.onSave(draft,"2027-07-12"),/offline/);
  assert.deepEqual(fixture.saves,[]);
  assert.equal(findNode(fixture.render(),node=>node.type === "EventsBoard").props.items[0].id,"task");
});
