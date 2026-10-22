import assert from "node:assert/strict";
import test from "node:test";
import { loadModule } from "./helpers.mjs";

const { placeFeature } = loadModule("app/components/landing/journey/journey-state.ts");
const plain = value => JSON.parse(JSON.stringify(value));

test("placing demo cards leaves the previous state untouched", () => {
  const before = Object.freeze({ ridge: "plan-event" });
  const result = placeFeature(before, "quick-note", "footpath");
  assert.equal(result.occupied, false);
  assert.deepEqual(plain(result.placements), { ridge: "plan-event", footpath: "quick-note" });
  assert.deepEqual(before, { ridge: "plan-event" });
});

test("an occupied checkpoint never silently overwrites another feature", () => {
  const before = { ridge: "plan-event", ascent: "check-workout" };
  const result = placeFeature(before, "check-workout", "ridge", "ascent");
  assert.equal(result.occupied, true);
  assert.equal(result.placements, before);
});

test("repositioning removes only the source after a successful placement", () => {
  const before = { ridge: "plan-event", ascent: "check-workout" };
  const result = placeFeature(before, "plan-event", "footpath", "ridge");
  assert.deepEqual(plain(result.placements), { ascent: "check-workout", footpath: "plan-event" });
  assert.equal(placeFeature(before, "plan-event", "ridge", "ridge").occupied, false);
});
