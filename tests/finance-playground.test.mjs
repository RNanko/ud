import test from "node:test";
import assert from "node:assert/strict";
import { loadModule, hookHarness, jsxRuntime, findNode } from "./helpers.mjs";

const helpers = loadModule("lib/finance-playground.ts");
const { createHoldConfirm } = loadModule("lib/hold-confirm.ts");

test("category perimeter fills every strip and reserves the right-hand middle for the action target", () => {
  for (let revenue = 0; revenue <= 10; revenue++) for (let spending = 0; spending <= 10; spending++) {
    const ring = helpers.categoryRing(revenue, spending);
    assert.equal(ring.revenue.length, revenue); assert.equal(ring.spending.length, spending);
    const cells = [...ring.revenue, ...ring.spending];
    assert.equal(new Set(cells.map(({ region, index }) => `${region}:${index}`)).size, cells.length);
    for (const region of ["top", "bottom", "left", "right-upper", "right-lower"]) {
      const strip = cells.filter((cell) => cell.region === region).sort((a, b) => a.index - b.index);
      strip.forEach((cell, index) => { assert.equal(cell.index, index); assert.equal(cell.count, strip.length); });
    }
    for (const region of ["left", "right-upper", "right-lower"]) {
      const upper = ring.revenue.filter((cell) => cell.region === region), lower = ring.spending.filter((cell) => cell.region === region);
      if (upper.length && lower.length) assert.ok(upper.at(-1).index < lower[0].index);
    }
  }
  assert.equal(helpers.categoryRing(6, 6).dense, false);
  assert.equal(helpers.categoryRing(7, 7).dense, true);
  assert.equal(helpers.categoryRing(3, 6).sides, 2);
  assert.ok(helpers.categoryRing(3, 3).revenue.some((cell) => cell.region === "right-upper"));
  assert.ok(helpers.categoryRing(3, 3).spending.some((cell) => cell.region === "right-lower"));
  for (const count of [1, 3, 8, 9]) {
    const ring = helpers.categoryRing(count, count);
    assert.ok(ring.revenue.filter((cell) => cell.region.startsWith("right")).every((cell) => cell.region === "right-upper"));
    assert.ok(ring.spending.filter((cell) => cell.region.startsWith("right")).every((cell) => cell.region === "right-lower"));
  }
});

test("removed categories stay hidden despite defaults and history; restoring keeps transaction totals", () => {
  const entries = [{ category: "Food", type: "-", amount: "12.34" }, { category: "Food", type: "+", amount: "45.67" }];
  let merged = helpers.mergeFinanceCategories([{ name: " FOOD ", type: "-", hidden: true }], entries);
  assert.equal(merged.some((category) => helpers.categoryKey(category) === "-:food"), false);
  assert.equal(merged.some((category) => helpers.categoryKey(category) === "+:food"), true);
  merged = helpers.mergeFinanceCategories([{ name: "Food", type: "-", hidden: false }], entries);
  assert.equal(merged.filter((category) => helpers.categoryKey(category) === "-:food").length, 1);
  assert.equal(entries[0].amount, "12.34"); assert.equal(entries.length, 2);
});

test("category reordering preserves type and names and ignores cross-type and cancelled moves", () => {
  const categories = [{ name: "A", type: "-" }, { name: "Income", type: "+" }, { name: "B", type: "-" }];
  const next = helpers.reorderFinanceCategories(categories, categories[0], categories[2]);
  assert.equal(next[2].name, "A"); assert.equal(categories[0].name, "A");
  assert.equal(helpers.reorderFinanceCategories(categories, categories[0], categories[1]), categories);
  assert.equal(helpers.reorderFinanceCategories(categories, { name: "missing", type: "-" }, categories[0]), categories);
});

test("slider maximum doubles through 8,000 then steps by 2,000, with reversible bounded controls", () => {
  let max = 500; const limits = [max];
  while (max < 20000) { max = helpers.stepFinanceSliderMax(max, 1); limits.push(max); }
  assert.deepEqual(limits, [500, 1000, 2000, 4000, 8000, 10000, 12000, 14000, 16000, 18000, 20000]);
  assert.equal(helpers.stepFinanceSliderMax(20000, 1), 20000);
  for (let index = limits.length - 2; index >= 0; index--) { max = helpers.stepFinanceSliderMax(max, -1); assert.equal(max, limits[index]); }
  assert.equal(helpers.stepFinanceSliderMax(500, -1), 500);
  assert.equal(helpers.financeSliderMaxForAmount(500, 15000), 16000);
  assert.equal(helpers.financeSliderMaxForAmount(500, 999999), 20000);
});

test("category names deduplicate case variations while allowing the same name for both types", () => {
  const categories = helpers.mergeFinanceCategories([{ name: " FOOD ", type: "-" }], [{ category: "Food", type: "-" }, { category: "Food", type: "+" }]);
  assert.equal(categories.filter((category) => helpers.categoryKey(category) === "-:food").length, 1);
  assert.equal(categories.filter((category) => helpers.categoryKey(category) === "+:food").length, 1);
});

test("styled amount arrows preserve cents and enforce nonnegative maximum bounds", () => {
  assert.equal(helpers.stepFinanceAmount("12.34", 1), "13.34");
  assert.equal(helpers.stepFinanceAmount("12.34", -1), "11.34");
  assert.equal(helpers.stepFinanceAmount("0.25", -1), "0.00");
  assert.equal(helpers.stepFinanceAmount("", 1), "1.00");
  assert.equal(helpers.stepFinanceAmount("999999999999", 1), "999999999999.00");
});

test("hold confirmation cancels short presses, tolerates repeated starts, and completes exactly once", () => {
  let callback, cancelled = false, completed = 0;
  const hold = createHoldConfirm((fn, duration) => { assert.equal(duration, 1200); callback = fn; cancelled = false; return () => { cancelled = true; }; }, () => completed++);
  assert.equal(hold.start(), true);
  assert.equal(hold.start(), false);
  hold.cancel(); assert.equal(cancelled, true);
  callback(); assert.equal(completed, 0);
  const stale = callback;
  hold.start(); stale(); assert.equal(completed, 0);
  callback(); callback(); assert.equal(completed, 1);
  hold.cancel(); assert.equal(completed, 1);
});

test("delete button cancels release, pointer exit, blur and Escape, and retains failed transactions", async () => {
  const hooks = hookHarness(); let timer, deletes = 0;
  const button = loadModule("app/(main)/account/finance/HoldDeleteButton.tsx", {
    react: hooks.react, "react/jsx-runtime": jsxRuntime, "lucide-react": {},
    "framer-motion": { animate: () => ({ stop() {} }), motion: {}, useMotionValue: () => ({ set() {} }), useReducedMotion: () => false },
    "@/lib/hold-confirm": { createHoldConfirm: (_schedule, complete) => createHoldConfirm((fn) => { timer = fn; return () => {}; }, complete) },
  }).default;
  const render = () => hooks.render(() => button({ label: "Taxi", disabled: false, onConfirm: async () => { deletes++; if (deletes === 1) throw new Error("Delete failed"); } }));
  const control = () => findNode(render(), (node) => node.type === "button").props;
  const pointer = { button: 0, pointerId: 1, currentTarget: { setPointerCapture() {}, getBoundingClientRect: () => ({ left: 0, top: 0, right: 44, bottom: 44 }) } };
  for (const cancel of [() => control().onPointerUp(), () => control().onPointerCancel(), () => control().onBlur(), () => control().onPointerMove({ ...pointer, clientX: 55, clientY: 20 }), () => control().onKeyDown({ key: "Escape" })]) {
    control().onPointerDown(pointer); cancel(); timer(); assert.equal(deletes, 0);
  }
  control().onPointerDown(pointer); timer(); control().onPointerDown(pointer); assert.equal(deletes, 1);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(findNode(render(), (node) => node.props?.role === "alert").props.children, "Delete failed");
  control().onKeyDown({ key: " ", repeat: false, preventDefault() {} }); timer();
  await new Promise((resolve) => setImmediate(resolve)); assert.equal(deletes, 2);
});

function playgroundFixture(save, remove = async () => {}, reorder = () => {}, historyEntries = [], preferences = {}) {
  const hooks = hookHarness();
  const settings = { preferences: { ...loadModule("lib/account/preferences.ts").defaultPreferences, ...preferences } };
  const token = {};
  let keyboardCoordinates;
  const dnd = { DndContext: token, DragOverlay: {}, useSensors: () => [], useSensor: (_sensor, options) => { if (options?.coordinateGetter) keyboardCoordinates = options.coordinateGetter; return {}; }, PointerSensor: {}, KeyboardSensor: {} };
  const component = loadModule("app/(main)/account/finance/FinancePlayground.tsx", {
    react: { ...hooks.react, useId: () => "finance-category-preview" }, "react/jsx-runtime": jsxRuntime, "react-dom": { createPortal: (node) => node }, "@radix-ui/react-dialog": {}, "@dnd-kit/core": dnd,
    "framer-motion": { animate() {}, motion: {}, useMotionValue: () => ({ set() {} }), useReducedMotion: () => true },
    "lucide-react": {}, "@/app/components/ui/button": {}, "@/app/components/ui/input": {}, "@/app/components/ui/textarea": {}, "./FinanceSelect": {},
    "@/lib/finance-playground": helpers, "@/lib/finance": loadModule("lib/finance.ts"),
    "@/types/validators": loadModule("types/validators.ts"), "./AmountInput": {}, "./FinanceEditor": {},
    "@/app/components/shared/account/AccountPreferencesProvider": { useAccountPreferences: () => ({ settings }) },
  }).default;
  const categories = [{ name: "Food", type: "-" }, { name: "Salary", type: "+" }];
  const render = () => hooks.render(() => component({ categories, entries: [], historyEntries, busy: false, onAdd() {}, onCreateCategory() {}, onSave: save, onRemoveCategory: remove, onReorderCategory: reorder }));
  const drop = (category) => findNode(render(), (node) => node.type === token).props.onDragEnd({ over: category ? { id: helpers.categoryKey(category) } : null });
  const drag = () => findNode(render(), (node) => node.type === token).props;
  return { render, drop, categories, drag, settings, coordinates: (...args) => keyboardCoordinates(...args) };
}

test("quick entry uses saved account currency and follows updated numbers-only preferences", async () => {
  const writes = [], fixture = playgroundFixture(async (_id, draft) => writes.push(draft), undefined, undefined, [], { financeDefaultCurrency: "CAD" });
  fixture.drop(fixture.categories[0]); await new Promise(resolve => setImmediate(resolve));
  fixture.settings.preferences.financeDefaultCurrency = "NONE";
  findNode(fixture.render(), node => node.props?.id === "quick-finance-amount").props.onChange("50.00");
  fixture.drop(fixture.categories[0]); await new Promise(resolve => setImmediate(resolve));
  assert.equal(writes[0].currency, "CAD"); assert.equal(writes[1].currency, "NONE");
  assert.equal(writes[0].amount, "50.00"); assert.equal(writes[1].amount, "50.00");
});

test("keyboard category dragging follows the selected target despite overlay movement and skips the other type", async () => {
  let removed = 0;
  const fixture = playgroundFixture(async () => { throw Error("Category drags must not add transactions"); }, async () => { removed++; });
  const category = fixture.categories[0], active = { data: { current: { category } } };
  fixture.drag().onDragStart({ active, activatorEvent: { type: "keydown" } });
  const rect = (left, top) => ({ left, top, width: 100, height: 100 });
  const targets = [
    { id: "-:food", data: { current: { category } }, rect: rect(0, 100) },
    { id: "+:salary", data: { current: { category: fixture.categories[1] } }, rect: rect(80, 100) },
    { id: "-:transport", data: { current: { category: { name: "Transport", type: "-" } } }, rect: rect(250, 100) },
    { id: "category-action", data: { current: {} }, rect: rect(250, 250) },
  ];
  const context = { active, collisionRect: rect(0, -100), droppableContainers: { getEnabled: () => targets }, droppableRects: new Map(targets.map((target) => [target.id, target.rect])) };
  const move = (code) => fixture.coordinates({ code, preventDefault() {} }, { currentCoordinates: { x: 0, y: 0 }, context });
  assert.ok(move("ArrowRight"));
  fixture.render();
  assert.ok(move("ArrowDown"));
  fixture.drag().onDragEnd({ active, over: { id: "+:salary" } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(removed, 1);
});

test("category drags switch the shared action into a trash target, remove only on drop, and never add an amount", async () => {
  let writes = 0, removed = 0;
  const fixture = playgroundFixture(async () => { writes++; }, async () => { removed++; });
  const active = { data: { current: { category: fixture.categories[0] } }, rect: { current: { initial: { width: 180, height: 220 } } } };
  fixture.drag().onDragStart({ active, activatorEvent: { type: "pointerdown" } });
  assert.equal(findNode(fixture.render(), (node) => node.props?.categoryDragging !== undefined).props.categoryDragging, true);
  fixture.drag().onDragOver({ over: { id: "category-action" } });
  const preview = findNode(fixture.render(), (node) => node.props?.["data-amount-preview"]);
  assert.equal(preview.props.animate.borderColor, "#ff4466");
  assert.equal(preview.props.style.width, 180); assert.equal(preview.props.style.height, 220);
  assert.equal(removed, 0);
  fixture.drag().onDragCancel(); assert.equal(removed, 0);
  fixture.drag().onDragStart({ active, activatorEvent: { type: "pointerdown" } });
  fixture.drag().onDragEnd({ active, over: { id: "category-action" } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(removed, 1); assert.equal(writes, 0);
  assert.equal(findNode(fixture.render(), (node) => node.props?.id === "quick-finance-amount").props.value, "50.00");
});

test("failed category removal retains the amount, reports an error and allows retry", async () => {
  let attempts = 0;
  const fixture = playgroundFixture(async () => {}, async () => { if (++attempts === 1) throw new Error("Could not remove"); });
  const active = { data: { current: { category: fixture.categories[0] } } };
  fixture.drag().onDragEnd({ active, over: { id: "category-action" } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(findNode(fixture.render(), (node) => node.props?.role === "alert").props.children, "Could not remove");
  fixture.drag().onDragEnd({ active, over: { id: "category-action" } });
  await new Promise((resolve) => setImmediate(resolve)); assert.equal(attempts, 2);
});

test("slow category removal shows progress, blocks duplicate drops and releases controls after failure and retry", async () => {
  for (const type of ["-", "+"]) {
    let reject, resolve, attempts = 0;
    const fixture = playgroundFixture(async () => { throw Error("Removal must not add money"); }, () => {
      attempts++;
      return new Promise((yes, no) => { resolve = yes; reject = no; });
    });
    const category = fixture.categories.find(item => item.type === type);
    const active = { data: { current: { category } } };
    const drop = () => fixture.drag().onDragEnd({ active, over: { id: "category-action" } });
    findNode(fixture.render(), node => node.props?.category === category && node.props?.onRemove).props.onRemove();
    let tree = fixture.render();
    const action = () => findNode(fixture.render(), node => node.props?.categoryDragging !== undefined).props;
    assert.equal(action().removing.name, category.name);assert.equal(action().busy, true);
    assert.ok(findNode(tree, node => node.props?.role === "status"));
    assert.equal(findNode(tree, node => node.props?.id === "quick-finance-amount").props.disabled, true);
    drop();assert.equal(attempts, 1);
    reject(new Error("Connection failed. Try again."));await new Promise(resolve => setImmediate(resolve));
    assert.equal(action().removing, null);assert.equal(action().busy, false);
    assert.equal(findNode(fixture.render(), node => node.props?.role === "alert").props.children, "Connection failed. Try again.");
    drop();assert.equal(attempts, 2);resolve();await new Promise(resolve => setImmediate(resolve));
    tree = fixture.render();assert.equal(action().removing, null);assert.equal(action().busy, false);
    assert.equal(findNode(tree, node => node.props?.id === "quick-finance-amount").props.value, "50.00");
  }
});

test("drag preview follows spending/revenue target colors and resets on cancellation", () => {
  const fixture = playgroundFixture(async () => { throw new Error("Cancelled drags should not save"); });
  fixture.drag().onDragStart({ activatorEvent: { type: "pointerdown" } });
  fixture.drag().onDragOver({ over: { id: helpers.categoryKey(fixture.categories[0]) } });
  let preview = findNode(fixture.render(), (node) => node.props?.["data-amount-preview"]);
  assert.equal(preview.props.animate.borderColor, "#fb923c");
  fixture.drag().onDragOver({ over: { id: helpers.categoryKey(fixture.categories[1]) } });
  preview = findNode(fixture.render(), (node) => node.props?.["data-amount-preview"]);
  assert.equal(preview.props.animate.borderColor, "#38bdf8");
  fixture.drag().onDragCancel();
  assert.equal(findNode(fixture.render(), (node) => node.props?.["data-amount-preview"]), undefined);
});

test("reducing slider maximum clamps the amount and both controls stop at their limits", () => {
  const fixture = playgroundFixture(async () => {});
  const amountInput = () => findNode(fixture.render(), (node) => node.props?.id === "quick-finance-amount");
  const control = (name) => findNode(fixture.render(), (node) => node.props?.["aria-label"] === name);
  amountInput().props.onChange("15000.00");
  control("Decrease slider range").props.onClick();
  assert.equal(amountInput().props.value, "14000.00");
  for (let index = 0; index < 20; index++) control("Increase slider range").props.onClick();
  assert.equal(control("Increase slider range").props.disabled, true);
  assert.equal(control("Amount slider").props.max, 20000);
  for (let index = 0; index < 20; index++) control("Decrease slider range").props.onClick();
  assert.equal(control("Decrease slider range").props.disabled, true);
  assert.equal(control("Amount slider").props.max, 500);
  assert.equal(amountInput().props.value, "500.00");
});

test("drops save the exact amount and category once; cancelled and duplicate drops create nothing", async () => {
  const writes = []; let release;
  const fixture = playgroundFixture(async (id, draft) => { writes.push({ id, draft }); await new Promise((resolve) => { release = resolve; }); });
  fixture.drop(null); assert.equal(writes.length, 0);
  fixture.drop(fixture.categories[0]); fixture.drop(fixture.categories[1]); assert.equal(writes.length, 1);
  assert.equal(writes[0].id, null); assert.equal(writes[0].draft.amount, "50.00"); assert.equal(writes[0].draft.category, "Food"); assert.equal(writes[0].draft.type, "-");
  release(); await new Promise((resolve) => setImmediate(resolve));
  fixture.drop(fixture.categories[0]); assert.equal(writes.length, 1);
  assert.equal(findNode(fixture.render(), (node) => node.props?.id === "quick-finance-amount").props.value, "0.00");
});

test("a failed save retains the amount and exposes an error for a successful retry", async () => {
  let attempts = 0;
  const fixture = playgroundFixture(async () => { if (++attempts === 1) throw new Error("Connection lost"); });
  fixture.drop(fixture.categories[1]); await new Promise((resolve) => setImmediate(resolve));
  assert.equal(findNode(fixture.render(), (node) => node.props?.role === "alert").props.children, "Connection lost");
  assert.equal(findNode(fixture.render(), (node) => node.props?.id === "quick-finance-amount").props.value, "50.00");
  fixture.drop(fixture.categories[1]); await new Promise((resolve) => setImmediate(resolve));
  assert.equal(attempts, 2);
  assert.equal(findNode(fixture.render(), (node) => node.props?.id === "quick-finance-amount").props.value, "0.00");
});

test("quick transactions reuse details from other months without changing notes, and preserve all fields on a failed save", async () => {
  const writes = [];
  const fixture = playgroundFixture(async (_id, draft) => { writes.push({ ...draft }); if (writes.length === 1) throw new Error("Connection lost"); }, undefined, undefined, [
    { date: "2026-08-01", subcategory: "Train ticket", comment: "Old note" }, { date: "2026-09-01", subcategory: " Groceries " }, { date: "2026-07-01", subcategory: "Groceries" }, { date: "2026-06-01", subcategory: null },
  ]);
  const field = id => findNode(fixture.render(), node => node.props?.id === id).props;
  const selector = () => findNode(fixture.render(), node => node.props?.label === "Previous details").props;
  assert.deepEqual(Array.from(selector().options, option => option.value), ["", "Groceries", "Train ticket"]);
  selector().onValueChange("Train ticket");
  assert.equal(field("quick-finance-detail").value, "Train ticket");
  assert.equal(field("quick-finance-note").value, "");
  assert.equal(findNode(fixture.render(), node => node.props?.label === "Previous notes"), undefined);
  field("quick-finance-note").onChange({ target: { value: "Train ticket home" } });
  field("quick-finance-detail").onChange({ target: { value: "Intercity" } });
  field("quick-finance-date").onChange({ target: { value: "2026-08-21" } });
  fixture.drop(fixture.categories[0]); await new Promise(resolve => setImmediate(resolve));
  assert.equal(field("quick-finance-detail").value, "Intercity");
  assert.equal(field("quick-finance-date").value, "2026-08-21");
  assert.equal(field("quick-finance-note").value, "Train ticket home");
  fixture.drop(fixture.categories[0]); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(writes[0], { currency: "USD", type: "-", amount: "50.00", date: "2026-08-21", category: "Food", subcategory: "Intercity", comment: "Train ticket home" });
  assert.deepEqual(writes[1], writes[0]);
  assert.equal(field("quick-finance-detail").value, "");
  assert.equal(field("quick-finance-note").value, "");
  assert.equal(field("quick-finance-date").value, "2026-08-21");
});
