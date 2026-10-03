import test from "node:test";
import assert from "node:assert/strict";
import { loadModule, hookHarness, jsxRuntime, findNode, plain } from "./helpers.mjs";

const domain = loadModule("lib/todo.ts"), interaction = loadModule("lib/todo-interaction.ts");
const seed = () => { const board = domain.emptyTodoBoard(); board[1].items = ["a", "hidden", "b", "c"].map(id => ({ id, content: `Task ${id}` })); return board; };
const ids = board => plain(board.map(group => group.items.map(task => task.id)));
const tick = () => new Promise(resolve => setImmediate(resolve));

test("stable task insertion preserves hidden siblings, handles empty groups and first/last slots", () => {
  const initial = seed();
  const next = domain.moveTodoTask(initial, "c", { groupId: "todo", beforeId: "a" });
  assert.deepEqual(ids(next)[1], ["c", "a", "hidden", "b"]);
  assert.deepEqual(ids(initial)[1], ["a", "hidden", "b", "c"]);
  assert.deepEqual(ids(domain.moveTodoTask(next, "c", { groupId: "done", beforeId: null })), [[], ["a", "hidden", "b"], [], ["c"]]);
  assert.deepEqual(ids(domain.moveTodoTask(next, "a", { groupId: "todo", beforeId: null }))[1], ["c", "hidden", "b", "a"]);
  for (const destination of [{ groupId: "new-group", beforeId: null }, { groupId: "todo", beforeId: "absent" }, { groupId: "todo", beforeId: "c" }]) assert.equal(domain.moveTodoTask(next, "c", destination), next);
});
test("keyboard movement uses current groups and cannot invent a status or move past an edge", () => {
  let board = seed();
  board = domain.moveTodoTask(board, "a", domain.keyboardTodoDestination(board, "a", "ArrowDown"));
  assert.deepEqual(ids(board)[1], ["hidden", "a", "b", "c"]);
  for (let step = 0; step < 2; step++) board = domain.moveTodoTask(board, "a", domain.keyboardTodoDestination(board, "a", "ArrowRight"));
  assert.deepEqual(ids(board), [[], ["hidden", "b", "c"], [], ["a"]]);
  assert.equal(domain.keyboardTodoDestination(board, "a", "ArrowRight"), null);
  assert.equal(domain.keyboardTodoDestination(board, "a", "ArrowDown"), null);
  assert.equal(domain.keyboardTodoDestination(board, "a", "Escape"), null);
});
test("validation rejects duplicate task IDs, forged groups and empty task text", () => {
  assert.equal(domain.todoBoardSchema.safeParse(seed()).success, true);
  for (const mutate of [board => { board[0].id = "new-status"; }, board => { board[2].items.push({ ...board[1].items[0] }); }, board => { board[1].items[0].content = " "; }, board => { board[1].items[0].id = "trash"; }]) { const board = seed(); mutate(board); assert.equal(domain.todoBoardSchema.safeParse(board).success, false); }
});
test("whole-card sensors exclude nested controls without excluding the card's own button role", () => {
  const card = {}, control = {};
  for (const child of [card, null]) assert.equal(interaction.isTodoControl({ closest: () => child }, card), false);
  assert.equal(interaction.isTodoControl({ closest: () => control }, card), true);
  const sensor = { activators: [{ eventName: "onMouseDown", handler: () => true }] };
  class Base {}; Base.activators = sensor.activators;
  const sensors = loadModule("app/(main)/account/to-do/TodoSensors.ts", { "@dnd-kit/core": { MouseSensor: Base, TouchSensor: Base, KeyboardSensor: Base }, "@/lib/todo-interaction": interaction });
  for (const name of ["TodoMouseSensor", "TodoTouchSensor", "TodoKeyboardSensor"]) {
    const activate = sensors[name].activators[0].handler;
    assert.equal(activate({ target: { closest: () => control }, currentTarget: card }, {}, {}), false);
    assert.equal(activate({ target: { closest: () => card }, currentTarget: card }, {}, {}), true);
  }
});

function stateFixture(save) {
  const harness = hookHarness(), notices = [];
  const toast = { error: (message, options) => { notices.push({ message, options }); return notices.length; }, dismiss() {} };
  const hook = loadModule("hooks/use-todo-board.ts", { react: harness.react, sonner: { toast }, "@/lib/todo": domain });
  return { harness, hook, notices, render: () => harness.render(() => hook.useTodoBoard(seed(), save)) };
}
test("failed saves restore the saved board, Retry reuses the same task IDs, and repeated taps are locked", async () => {
  let fail = true, release; const calls = [];
  const fixture = stateFixture(async (next, previous) => { calls.push(plain({ next, previous })); if (fail) return { success: false }; await new Promise(resolve => { release = resolve; }); return { success: true }; });
  let state = fixture.render(); assert.equal(calls.length, 0);
  const next = domain.moveTodoTask(state.data, "a", { groupId: "done", beforeId: null });
  assert.equal(await state.commit(next), false);
  assert.deepEqual(ids(fixture.render().data), ids(seed()));
  fail = false; fixture.notices[0].options.action.onClick(); state = fixture.render(); assert.equal(state.saving, true);
  assert.equal(await state.commit(domain.emptyTodoBoard()), false);
  release(); await tick(); state = fixture.render();
  assert.deepEqual(ids(state.data), ids(next)); assert.equal(state.status, "Saved");
  assert.deepEqual(calls[0], calls[1]); assert.equal(calls.length, 2);
  fixture.notices[0].options.action.onClick(); await tick(); assert.equal(calls.length, 2);
});
test("an old failed retry cannot undo a newer success; conflicts restore the server board", async () => {
  let mode = "fail"; const calls = [], latest = domain.moveTodoTask(seed(), "c", { groupId: "backlog", beforeId: null });
  const fixture = stateFixture(async next => { calls.push(next); return mode === "fail" ? { success: false } : mode === "conflict" ? { success: false, conflict: true, data: latest } : { success: true }; });
  await fixture.render().commit(domain.moveTodoTask(seed(), "a", { groupId: "done", beforeId: null }));
  const retry = fixture.notices[0].options.action.onClick;
  mode = "ok"; await fixture.render().commit(domain.moveTodoTask(seed(), "b", { groupId: "backlog", beforeId: null }));
  retry(); await tick(); assert.equal(calls.length, 2);
  mode = "conflict"; await fixture.render().commit(seed());
  assert.deepEqual(ids(fixture.render().data), ids(latest)); assert.equal(fixture.notices.at(-1).options.action, undefined);
});

function boardFixture({ reduced = true } = {}) {
  const harness = hookHarness(), saves = [], timers = [];
  const hook = loadModule("hooks/use-todo-board.ts", { react: harness.react, sonner: { toast: { error() {}, dismiss() {} } }, "@/lib/todo": domain });
  const Board = loadModule("app/(main)/account/to-do/KanbanBoard.tsx", {
    react: { ...harness.react, useId: () => "todo-proof" }, "react/jsx-runtime": jsxRuntime,
    "@dnd-kit/core": { DndContext: "DndContext", DragOverlay: "DragOverlay", MeasuringStrategy: { Always: "always" }, useSensor: (sensor, options) => ({ sensor, options }), useSensors: (...sensors) => sensors, defaultDropAnimationSideEffects: () => ({}), closestCenter: () => [], pointerWithin: () => [] },
    "@dnd-kit/sortable": { SortableContext: "SortableContext", verticalListSortingStrategy: "vertical" }, "@dnd-kit/utilities": { CSS: {} },
    "framer-motion": { useReducedMotion: () => reduced }, "lucide-react": { Plus: "Plus", Trash2: "Trash2" },
    "@/app/components/ui/button": { Button: "Button" }, "@/app/components/ui/card": { Card: "Card" }, "@/app/components/ui/textarea": { Textarea: "Textarea" },
    "@/lib/actions/todo.actions": { updateToDoList: async (next, previous) => { saves.push(plain({ next, previous })); return { success: true }; } },
    "@/hooks/use-todo-board": hook, "@/lib/todo": domain, "./TodoSensors": { TodoMouseSensor: "mouse", TodoTouchSensor: "touch", TodoKeyboardSensor: "keyboard" }
  }, { setTimeout: (callback, duration) => { timers.push({ callback, duration }); return timers.length; }, clearTimeout() {}, requestAnimationFrame: callback => callback(), document: { getElementById: () => ({ focus() {}, getBoundingClientRect: () => ({ width: 300, height: 52 }) }) } }).default;
  const render = () => harness.render(() => Board({ data: seed() }));
  return { saves, render, timers, context: () => findNode(render(), node => node.type === "DndContext").props, groups: () => {
    const children = findNode(render(), node => node.type === "DndContext").props.children[0].props.children;
    return children.map(node => node.props.group);
  } };
}
const dragEvent = (over = "done", keyboard = false) => ({ active: { id: "a", rect: { current: { initial: { width: 300, height: 52 }, translated: { top: 120, height: 52 } } } }, activatorEvent: { type: keyboard ? "keydown" : "mousedown" }, over: over ? { id: over, rect: { top: 100, height: 300 } } : null });
test("drag previews never persist; Escape and off-board drops restore the original group", async () => {
  for (const cancel of [true, false]) {
    const fixture = boardFixture(); fixture.context().onDragStart(dragEvent()); fixture.context().onDragOver(dragEvent());
    assert.deepEqual(ids(fixture.groups())[3], ["a"]); assert.equal(fixture.saves.length, 0);
    if (cancel) fixture.context().onDragCancel(); else fixture.context().onDragEnd(dragEvent(null));
    await tick(); assert.deepEqual(ids(fixture.groups()), ids(seed())); assert.equal(fixture.saves.length, 0);
  }
});
test("pickup measures the card when Dnd-kit has not populated its initial rectangle", () => {
  const fixture = boardFixture(), event = dragEvent(); event.active.rect.current.initial = null;
  fixture.context().onDragStart(event);
  const overlay = findNode(fixture.render(), node => node.type === "DragOverlay");
  assert.equal(overlay.props.children.props.style.width, 300); assert.equal(overlay.props.children.props.style.height, 52);
  assert.equal(fixture.saves.length, 0); fixture.context().onDragCancel();
});
test("touch activation uses a deliberate hold and existing trash drops delete only the chosen stable ID", async () => {
  const fixture = boardFixture();
  assert.deepEqual(plain(fixture.context().sensors.find(sensor => sensor.sensor === "touch").options.activationConstraint), { delay: 240, tolerance: 8 });
  assert.deepEqual(plain(fixture.context().sensors.find(sensor => sensor.sensor === "mouse").options.activationConstraint), { distance: 8 });
  fixture.context().onDragStart(dragEvent()); fixture.context().onDragEnd(dragEvent("trash")); await tick();
  assert.deepEqual(ids(fixture.groups())[1], ["hidden", "b", "c"]);
  assert.equal(fixture.saves.length, 1); assert.deepEqual(ids(fixture.saves[0].previous), ids(seed()));
});
test("a drop settles before another pickup; reduced motion avoids the cooldown", async () => {
  const fixture = boardFixture({ reduced: false }); fixture.context().onDragStart(dragEvent()); fixture.context().onDragEnd(dragEvent()); await tick();
  fixture.context().onDragStart(dragEvent());
  assert.equal(findNode(fixture.render(), node => node.type === "DragOverlay").props.children, null);
  assert.equal(fixture.timers[0].duration, 220); fixture.timers[0].callback();
  fixture.context().onDragStart(dragEvent());
  assert.ok(findNode(fixture.render(), node => node.type === "DragOverlay").props.children);
  fixture.context().onDragCancel();
});
test("a valid drop persists once, keyboard targets follow successive moves, and reduced motion disables settling", async () => {
  const fixture = boardFixture(); fixture.context().onDragStart(dragEvent("todo", true));
  const coordinateGetter = fixture.context().sensors.find(sensor => sensor.sensor === "keyboard").options.coordinateGetter;
  const rects = new Map(domain.todoGroups.map((group, index) => [group.id, { left: index * 350, top: 0, width: 300, height: 300 }]));
  for (const over of ["in-progress", "done"]) {
    coordinateGetter({ code: "ArrowRight", preventDefault() {} }, { active: "a", context: { collisionRect: { width: 300, height: 52 }, droppableRects: rects } });
    fixture.context().onDragMove(dragEvent(over, true));
  }
  assert.deepEqual(ids(fixture.groups())[3], ["a"]);
  assert.equal(findNode(fixture.render(), node => node.type === "DragOverlay").props.dropAnimation, null);
  fixture.context().onDragEnd(dragEvent()); await tick(); assert.equal(fixture.saves.length, 1);
  fixture.context().onDragEnd(dragEvent()); await tick(); assert.equal(fixture.saves.length, 1);
  const tree = fixture.render(); let stopped = false; tree.props.onClickCapture({ preventDefault() {}, stopPropagation() { stopped = true; } }); assert.equal(stopped, true);
});

function actionFixture() {
  let owner = "alice", stored = { id: "owned", userId: "alice", data: seed() }; const writes = [];
  const columns = { id: "id", userId: "userId", data: "data" };
  const eq = (column, value) => ({ column, value }), and = (...conditions) => ({ conditions });
  const match = condition => condition.conditions ? condition.conditions.every(match) : condition.column === "data" ? domain.sameTodoBoard(stored.data, condition.value) : stored[condition.column] === condition.value;
  const db = { query: { kanbanBoard: { findFirst: async ({ where }) => stored && match(where) ? structuredClone(stored) : null } }, update: () => {
    let next, where; const query = { set: value => { next = value.data; return query; }, where: value => { where = value; return query; }, returning: async () => { writes.push(where); if (!match(where)) return []; stored.data = structuredClone(next); return [{ id: stored.id }]; } }; return query;
  } };
  const actions = loadModule("lib/actions/todo.actions.ts", { "../db/drizzle": db, "../db/schema": { kanbanBoard: columns }, "drizzle-orm": { eq, and }, "next/cache": { updateTag() {} }, "../session": { requireUserId: async requested => { if (!owner || requested && requested !== owner) throw new Error("Unauthorized"); return owner; } }, "../todo": domain });
  return { actions, writes, data: () => stored.data, owner: value => { owner = value; } };
}
test("owner-scoped compare-and-save persists order, makes retries idempotent, and rejects stale or invalid boards", async () => {
  const fixture = actionFixture(), initial = seed(), next = domain.moveTodoTask(initial, "a", { groupId: "done", beforeId: null });
  assert.equal((await fixture.actions.updateToDoList(next, initial)).success, true); assert.deepEqual(ids(fixture.data()), ids(next));
  assert.equal((await fixture.actions.updateToDoList(next, initial)).success, true); assert.equal(fixture.writes.length, 1);
  const stale = domain.moveTodoTask(initial, "b", { groupId: "backlog", beforeId: null });
  const conflict = await fixture.actions.updateToDoList(stale, initial); assert.equal(conflict.conflict, true); assert.deepEqual(ids(conflict.data), ids(next)); assert.deepEqual(ids(fixture.data()), ids(next));
  fixture.owner("bob"); assert.equal((await fixture.actions.updateToDoList(stale, initial)).success, false);
  fixture.owner(null); assert.equal((await fixture.actions.updateToDoList(next, initial)).success, false);
  fixture.owner("alice"); assert.equal((await fixture.actions.updateToDoList([], initial)).success, false);
  assert.equal(fixture.writes.length, 2);
});
