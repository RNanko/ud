import test from "node:test";
import assert from "node:assert/strict";
import { loadModule, hookHarness, jsxRuntime, findNode, plain } from "./helpers.mjs";
import { fixture, blueprint, dates, events, logic, timing } from "./gym-fixture.mjs";

const today = dates.dateInZone(new Date(), "Europe/Warsaw"), timezone = "Europe/Warsaw";
const event = (patch = {}) => ({ id: crypto.randomUUID(), title: "Reading", completed: false, completedAt: null, notes: "Keep this note", category: "Personal", icon: "book", tone: "blue", ...patch });
const board = item => [{ id: "monday", day: "Monday", tasks: [item] }];
const save = (before, data, week = events.weekKey(today)) => ({ mutationId: crypto.randomUUID(), week, before, data });
const schedule = async (state, data = blueprint()) => (await state.actions.scheduleGymWorkout({ operationId: crypto.randomUUID(), data, dates: [today], timezone })).plans[0];
const quick = (plan, patch = {}) => ({ id: crypto.randomUUID(), mutationId: crypto.randomUUID(), sessionId: null, planId: plan.id, revision: null, date: today, timezone, notes: "Confirmed training", ...patch });

test("optional local times distinguish untimed, start-only, ranges, and explicit overnight ends", () => {
  assert.equal(timing.timeLabel(timing.untimed()), "Any time");
  assert.equal(timing.timeLabel({ start: "18:30", duration: null, overnight: false }), "18:30");
  assert.equal(timing.timeLabel({ start: "07:00", duration: 45, overnight: false }), "07:00–07:45");
  assert.match(timing.timeLabel({ start: "18:30", duration: null, overnight: false }, true), /6:30 PM/);
  assert.equal(timing.timingSchema.safeParse({ start: "23:30", duration: 60, overnight: false }).success, false);
  assert.equal(timing.timingSchema.safeParse({ start: "23:30", duration: 30, overnight: false }).success, false);
  assert.equal(timing.timingSchema.safeParse({ start: "23:30", duration: 30, overnight: true }).success, true);
  assert.equal(timing.timeLabel({ start: "23:30", duration: 60, overnight: true }), "23:30–00:30 (+1 day)");
  for (const value of [-1, 0, 1441]) assert.equal(timing.timingSchema.safeParse({ start: "10:00", duration: value, overnight: false }).success, false);
});
test("week keys, date placement and chronological ordering survive year and DST boundaries", () => {
  for (const date of ["2026-03-29", "2026-10-25", "2027-01-01", "2027-01-04"]) assert.equal(events.weekDate(events.weekKey(date)), dates.weekStart(date));
  assert.equal(events.weekSchema.safeParse("2026-WK54").success, false);
  const data = { templates: [], plans: [], sessions: [], customExercises: [], restDays: [] };
  const items = events.plannerItems(board(event({ timing: { start: "18:00", duration: 30, overnight: false } })), data, "2026-03-29");
  assert.equal(items[0].date, "2026-03-23");
  const list = [{ id: "untimed", order: -100 }, { id: "late", order: 0, timing: { start: "18:00" } }, { id: "early", order: 100, timing: { start: "07:00" } }].sort(events.comparePlannerItems);
  assert.deepEqual(list.map(item => item.id), ["early", "late", "untimed"]);
});
test("manual completion persists a timestamp on the scheduled day; reopening preserves all details", async () => {
  const state = fixture(), item = event({ timing: { start: "18:30", duration: 45, overnight: false } });
  const initial = await state.planner.saveEventBoard(save([], board(item))); assert.equal(initial.success, true);
  const at = new Date().toISOString(), completed = board({ ...item, completed: true, completedAt: at });
  const command = save(initial.data, completed), result = await state.planner.saveEventBoard(command);
  assert.equal(result.success, true); assert.equal(result.data[0].day, "Monday"); assert.equal(result.data[0].tasks[0].completedAt, at);
  assert.equal((await state.planner.saveEventBoard(command)).success, true); assert.equal(state.rows.userEvents.length, 1);
  const reopened = await state.planner.saveEventBoard(save(result.data, board({ ...result.data[0].tasks[0], completed: false })));
  const actual = reopened.data[0].tasks[0]; assert.equal(actual.completedAt, null);
  for (const key of ["id", "title", "notes", "category", "icon", "tone", "timing"]) assert.deepEqual(plain(actual[key]), plain(item[key]));
});
test("new board retries and concurrent clicks use one row; stale and foreign changes cannot overwrite it", async () => {
  const state = fixture(), command = save([], board(event()));
  const results = await Promise.all([state.planner.saveEventBoard(command), state.planner.saveEventBoard(command)]);
  assert.ok(results.every(result => result.success)); assert.equal(state.rows.userEvents.length, 1);
  const stale = await state.planner.saveEventBoard(save([], board(event({ title: "Stale" })))); assert.equal(stale.success, false); assert.match(stale.message, /Newer/);
  state.rows.userEvents.push({ id: "bob-private", userId: "bob", week: command.week, data: board(event({ title: "Private" })) });
  const own = await state.planner.saveEventBoard(save(results[0].data, board({ ...results[0].data[0].tasks[0], title: "Updated" }))); assert.equal(own.success, true);
  assert.equal(state.rows.userEvents.find(row => row.userId === "bob").data[0].tasks[0].title, "Private");
  const denied = fixture({ owner: null }); assert.equal((await denied.planner.saveEventBoard(command)).success, false); assert.equal(denied.calls.length, 0);
});
test("JSONB key ordering does not create a false stale-state error, and elapsed times never complete events", async () => {
  const state = fixture(), item = event({ timing: { start: "00:01", duration: null, overnight: false } }), initial = await state.planner.saveEventBoard(save([], board(item)));
  const row = state.rows.userEvents[0]; row.data[0].tasks[0] = Object.fromEntries(Object.entries(row.data[0].tasks[0]).reverse());
  const result = await state.planner.saveEventBoard(save(initial.data, board({ ...item, notes: "Changed" })));
  assert.equal(result.success, true); assert.equal(result.data[0].tasks[0].completed, false);
  const untimed = await state.planner.saveEventBoard(save(result.data, board({ ...result.data[0].tasks[0], timing: timing.untimed() })));
  assert.equal(untimed.data[0].tasks[0].timing.start, null);
});
test("quick training completion confirms one session without fabricating any actual metrics", async () => {
  const state = fixture(), bp = blueprint(["bench-press", "stationary-cycling"]); bp.exercises[0].targets.loadKg = 60;
  const plan = await schedule(state, bp), command = quick(plan), result = await state.actions.completeGymWorkout(command);
  assert.equal(result.success, true); assert.equal(result.session.data.completionMode, "confirmation");
  assert.equal(result.session.data.originalPlan.exercises[0].targets.loadKg, 60);
  assert.ok(result.session.data.exercises[0].sets.every(set => set.loadKg === null && set.reps === null && !set.completed));
  assert.equal(result.session.data.exercises[1].cardio.seconds, null); assert.equal(result.session.data.exercises[1].cardio.distanceKm, null);
  assert.deepEqual(plain(logic.weeklySummary([result.session], dates.weekDates(today))), { workouts: 1, sets: 0, cardioSeconds: 0, distance: {} });
  assert.equal((await state.actions.completeGymWorkout(command)).success, true);
  assert.equal((await state.actions.completeGymWorkout(quick(plan))).success, true); assert.equal(state.rows.gymSessions.length, 1);
});
test("future training confirmation and foreign session completion/reopening are rejected", async () => {
  const state = fixture(), plan = await schedule(state);
  assert.equal((await state.actions.completeGymWorkout(quick(plan, { date: dates.addCalendarDays(today, 1) }))).success, false); assert.equal(state.rows.gymSessions.length, 0);
  const foreign = crypto.randomUUID(); state.rows.gymSessions.push({ id: foreign, userId: "bob", archived: false, revision: 0 });
  assert.equal((await state.actions.completeGymWorkout(quick(plan, { sessionId: foreign }))).success, false);
  assert.equal((await state.actions.reopenGymWorkout({ id: foreign, revision: 0, mutationId: crypto.randomUUID() })).success, false);
});
test("detailed completion and reopening preserve actual results, date, and immutable targets", async () => {
  const state = fixture(), plan = await schedule(state), started = await state.actions.startGymSession({ id: crypto.randomUUID(), planId: plan.id, data: null, date: today, timezone, logged: false });
  const data = structuredClone(started.session.data); data.exercises[0].sets[0] = { ...data.exercises[0].sets[0], loadKg: 55, reps: 9, completed: true };
  const saved = await state.actions.saveGymSession({ id: started.session.id, revision: 0, mutationId: crypto.randomUUID(), data });
  const result = await state.actions.completeGymWorkout(quick(plan, { sessionId: saved.session.id, revision: saved.session.revision }));
  assert.equal(result.success, true); assert.equal(result.session.data.completionMode, "detailed");
  const command = { id: result.session.id, revision: result.session.revision, mutationId: crypto.randomUUID() }, reopened = await state.actions.reopenGymWorkout(command);
  assert.equal(reopened.success, true); assert.equal(reopened.session.data.status, "active"); assert.equal(reopened.session.data.finishedAt, null);
  assert.deepEqual(plain(reopened.session.data.exercises), plain(result.session.data.exercises)); assert.equal(reopened.session.data.date, today);
  assert.equal(logic.weeklySummary([reopened.session], dates.weekDates(today)).workouts, 0);
  assert.equal((await state.actions.reopenGymWorkout(command)).success, true);
});
test("editing a schedule after completion changes neither actual results nor the original snapshot", async () => {
  const state = fixture(), plan = await schedule(state), completed = await state.actions.completeGymWorkout(quick(plan));
  const before = plain(completed.session.data), command = { id: plan.id, revision: plan.revision, mutationId: crypto.randomUUID(), date: dates.addCalendarDays(today, 1), timezone, timing: { start: "18:30", duration: 45, overnight: false } };
  const result = await state.actions.editGymPlanSchedule(command); assert.equal(result.success, true);
  assert.deepEqual(plain(state.rows.gymSessions[0].data), before); assert.equal((await state.actions.editGymPlanSchedule(command)).success, true);
  const projected = events.plannerItems([], await state.actions.getGymData(), today);
  assert.equal(projected.filter(item => item.session).length, 1); assert.equal(projected[0].date, today);
  assert.equal(projected.filter(item => !item.session).length, 0);
});
test("week presets reset completion and copy planned timing/targets only, with safe partial-save retry", async () => {
  const state = fixture(), source = events.weekKey(today), target = events.weekKey(dates.addCalendarDays(today, 7));
  const item = event({ completed: true, completedAt: new Date().toISOString(), timing: { start: "07:00", duration: 45, overnight: false } }), plan = await schedule(state);
  await state.actions.completeGymWorkout(quick(plan));
  assert.equal((await state.planner.savePlannerPreset({ week: source, board: board(item), includeTraining: true })).success, true);
  const stored = state.rows.userEvents.find(row => row.week === "default-WK").data;
  assert.ok(stored.flatMap(day => day.tasks).every(item => !item.completed && item.completedAt === null));
  const command = { operationId: crypto.randomUUID(), week: target, timezone, before: [], preset: stored };
  const scheduleOriginal = state.actions.scheduleGymWorkout; let failing = true;
  state.actions.scheduleGymWorkout = (...args) => failing ? Promise.resolve({ success: false, message: "Save failed — retry" }) : scheduleOriginal(...args);
  assert.equal((await state.planner.applyPlannerPreset(command)).success, false);
  assert.equal(state.rows.userEvents.find(row => row.week === target).data[0].tasks.length, 1);
  failing = false; assert.equal((await state.planner.applyPlannerPreset(command)).success, true); assert.equal((await state.planner.applyPlannerPreset(command)).success, true);
  assert.equal(state.rows.userEvents.find(row => row.week === target).data.flatMap(day => day.tasks).length, 1);
  assert.equal(state.rows.gymPlans.length, 2); assert.equal(state.rows.gymSessions.length, 1);
  const copied = state.rows.gymPlans.find(row => row.id !== plan.id); assert.deepEqual(plain(copied.data.exercises), plain(plan.data.exercises));
  assert.ok(copied.date >= events.weekDate(target));
});
test("event presets remain owner-scoped and untimed, and retries do not duplicate the preset", async () => {
  const state = fixture(), item = event({ completed: true, completedAt: new Date().toISOString(), timing: timing.untimed() });
  assert.equal((await state.planner.saveEventPreset({ event: item })).success, true); assert.equal((await state.planner.saveEventPreset({ event: item })).success, true);
  const records = await state.planner.getEventPresets(); assert.equal(records.length, 1); assert.equal(records[0].completed, false); assert.equal(records[0].completedAt, null); assert.equal(records[0].timing.start, null);
});
test("successive keyboard drag steps use the current day; cancellation writes nothing and restores the original day", () => {
  const harness = hookHarness(), item = { id: "event", date: today, title: "Reading", completed: false, order: 0, manual: event() }, moves = [];
  const Board = loadModule("app/(main)/account/events/EventsBoard.tsx", {
    react: { ...harness.react, useId: () => "board" }, "react/jsx-runtime": jsxRuntime,
    "@dnd-kit/core": { DndContext: "DndContext", DragOverlay: "DragOverlay", useSensors: (...sensors) => sensors, useSensor: (sensor, options) => ({ sensor, options }), PointerSensor: {}, KeyboardSensor: {} },
    "@dnd-kit/sortable": { SortableContext: "SortableContext", verticalListSortingStrategy: {} }, "@dnd-kit/utilities": {},
    "framer-motion": { useReducedMotion: () => false, motion: { div: "motion.div" }, AnimatePresence: "AnimatePresence" },
    "lucide-react": {}, "@/app/components/ui/card": {}, "@/app/components/ui/dropdown-menu": {}, "@/lib/utils": { cn: (...values) => values.filter(Boolean).join(" ") },
    "@/lib/events": events, "@/lib/gym/dates": dates, "@/lib/gym/logic": logic, "@/lib/planner-time": timing, "../gym/GymUI": {}, "./EventCompletionCheckbox": "EventCompletionCheckbox",
  }).default;
  const render = () => harness.render(() => Board({ items: [item], selected: today, today, hour12: false, units: { weight: "kg", distance: "km" }, actions: { move: (...args) => { moves.push(args); return Promise.resolve(); } } }));
  findNode(render(), node => node.type === "DndContext").props.onDragStart({ active: { id: item.id } });
  const keyboard = findNode(render(), node => node.type === "DndContext").props.sensors[1].options.coordinateGetter;
  const days = dates.weekDates(today), previous = days[days.indexOf(today) - 1];
  if (previous && days.indexOf(previous) > 0) {
    const args = { active: item.id, context: { collisionRect: { width: 100, height: 50 }, droppableRects: new Map(days.map((date, index) => [`day:${date}`, { left: index * 100, top: 0, width: 200, height: 100 }])) } };
    assert.equal(keyboard({ code: "ArrowLeft", preventDefault() {} }, args).x, days.indexOf(previous) * 100 + 50);
    findNode(render(), node => node.type === "DndContext").props.onDragOver({ over: { id: `day:${previous}` } });
    render();
    assert.equal(keyboard({ code: "ArrowLeft", preventDefault() {} }, args).x, (days.indexOf(previous) - 1) * 100 + 50);
  }
  findNode(render(), node => node.type === "DndContext").props.onDragOver({ over: { id: `day:${dates.addCalendarDays(today, 1)}` } });
  findNode(render(), node => node.type === "DndContext").props.onDragCancel();
  assert.deepEqual(moves, []); assert.ok(findNode(render(), node => node.props?.date === today).props.items.some(row => row.id === item.id));
});

test("untimed insertion moves both upward and downward without changing chronological timed order", () => {
  const items = [{ id: "morning", order: -1, timing: { start: "07:30" } }, { id: "first", order: 0 }, { id: "second", order: 1024 }, { id: "third", order: 2048 }];
  const down = events.destinationOrder(items, "second", "first", true), up = events.destinationOrder(items, "first", "third");
  assert.ok(down > items[2].order && down < items[3].order);
  assert.ok(up < items[1].order);
  const reordered = items.map(item => item.id === "first" ? { ...item, order: down } : item).sort(events.comparePlannerItems);
  assert.deepEqual(reordered.map(item => item.id), ["morning", "second", "first", "third"]);
});
