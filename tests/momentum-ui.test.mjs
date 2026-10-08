import test from "node:test";
import assert from "node:assert/strict";
import { hookHarness, loadModule, jsxRuntime, plain } from "./helpers.mjs";
import { types } from "./momentum-fixture.mjs";
const flush = () => new Promise(resolve => setImmediate(resolve));
function hookFixture(save, { loadFailure = false } = {}) {
  const harness = hookHarness(), effects = [], calls = [], signals = [], refreshes = [];
  let initialized = false;
  let bundle = { record: { data: types.emptyMomentum(), revision: 0 }, activities: [], today: "2026-10-03", timezone: "Europe/Warsaw", restDays: [], summary: {} };
  const actions = { getMomentumBundle: async () => { if (loadFailure) throw new Error("offline"); return plain(bundle); }, mutateMomentum: async payload => { calls.push(plain(payload)); const result = await save(payload); if (result.success) bundle = { ...bundle, record: result.record }; return result; } };
  const hookModule = loadModule("hooks/use-momentum.ts", { react: { ...harness.react, useCallback: fn => fn, useEffect: fn => { if (!initialized) effects.push(fn); } }, "@/lib/gym/dates": { browserTimezone: () => "Europe/Warsaw" }, "@/lib/actions/momentum.actions": actions }, { window: { addEventListener(name, fn) { if (name === "focus") refreshes.push(fn); }, removeEventListener() {}, dispatchEvent: event => signals.push(event.type) }, document: { visibilityState: "visible", addEventListener() {}, removeEventListener() {} }, localStorage: { setItem() {} }, setInterval: () => 1, clearInterval() {}, Event });
  const render = () => harness.render(() => hookModule.useMomentum());
  return { render, calls, signals, refresh: async () => { refreshes.forEach(fn => fn()); await flush(); }, init: async () => { render(); initialized = true; effects.forEach(fn => fn()); await flush(); } };
}
test("the client keeps confirmed data on failure and retries the same mutation before allowing a different write", async () => {
  let failure = true;
  const fixture = hookFixture(async payload => failure ? { success: false, message: "Save failed — retry" } : { success: true, record: { revision: 1, data: { ...types.emptyMomentum(), preferences: payload.command.value } }, newAwards: [] }); await fixture.init();
  const value = { ...types.emptyMomentum().preferences, thoughts: false };
  assert.equal(await fixture.render().save({ type: "preferences", value }), false); assert.equal(fixture.render().bundle.record.data.preferences.thoughts, true);
  assert.equal(await fixture.render().save({ type: "rest", value: true }), false); assert.equal(fixture.calls.length, 1);
  failure = false; assert.equal(await fixture.render().retry(), true); await flush();
  assert.deepEqual(fixture.calls[0], fixture.calls[1]); assert.equal(fixture.render().bundle.record.data.preferences.thoughts, false); assert.equal(fixture.render().celebration, false);
});
test("a stale save loads newer confirmed data rather than overwriting it or celebrating a failed mutation", async () => {
  const newest = { ...types.emptyMomentum(), preferences: { ...types.emptyMomentum().preferences, rewards: false } };
  const fixture = hookFixture(async () => ({ success: false, conflict: true, message: "Newer changes", record: { data: newest, revision: 5 } })); await fixture.init();
  assert.equal(await fixture.render().save({ type: "rest", value: true }), false); assert.equal(fixture.render().bundle.record.revision, 5); assert.equal(fixture.render().bundle.record.data.preferences.rewards, false); assert.equal(fixture.render().celebration, false);
});
test("loading errors retain a failure state instead of inventing an empty history", async () => {
  const fixture = hookFixture(async () => ({ success: true }), { loadFailure: true }); await fixture.init();
  assert.equal(fixture.render().loading, false); assert.equal(fixture.render().bundle, null); assert.match(fixture.render().error, /could not be loaded/);
});
test("new reveal/expansion animations honor reduced motion and closed content cannot receive keyboard focus", () => {
  const ui = loadModule("app/(main)/account/momentum/MomentumUI.tsx", { react: {}, "react/jsx-runtime": jsxRuntime, "framer-motion": { motion: { div: "motion.div" }, useReducedMotion: () => true }, "next/link": "Link", "lucide-react": { ArrowUpRight: "Icon", Check: "Icon", Circle: "Icon", Dumbbell: "Icon", CalendarDays: "Icon", ListTodo: "Icon" }, "../gym/GymUI": {} });
  const reveal = ui.Reveal({ children: "Test" }), closed = ui.Expand({ children: "Chapter", open: false, id: "chapters" });
  assert.equal(reveal.props.initial, false); assert.equal(reveal.props.transition.duration, 0); assert.equal(closed.props.inert, true); assert.equal(closed.props["aria-hidden"], true); assert.equal(closed.props.transition.duration, 0);
});
test("a thrown transport error retries the same request, while a known validation rejection permits corrected input", async () => {
  let attempt = 0;
  const fixture = hookFixture(async () => { if (++attempt === 1) throw new Error("transport lost"); if (attempt === 2) return { success: false, message: "Choose valid values", retryable: false }; return { success: true, record: { revision: 1, data: types.emptyMomentum() }, newAwards: [] }; }); await fixture.init();
  assert.equal(await fixture.render().save({ type: "rest", value: true }), false);
  assert.equal(await fixture.render().retry(), false); assert.deepEqual(fixture.calls[0], fixture.calls[1]);
  assert.equal(await fixture.render().save({ type: "rest", value: false }), true); assert.notEqual(fixture.calls[2].mutationId, fixture.calls[0].mutationId);
});
test("a background source refresh preserves a rejected form save until correction or explicit reload", async () => {
  const fixture = hookFixture(async () => ({ success: false, message: "Choose an existing savings goal", retryable: false })); await fixture.init();
  assert.equal(await fixture.render().save({ type: "rest", value: true }), false);
  await fixture.refresh();
  assert.equal(fixture.render().status, "Save failed — retry"); assert.equal(fixture.render().error, "Choose an existing savings goal");
  await fixture.render().reload(); assert.equal(fixture.render().error, "");
});
