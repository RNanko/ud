import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { loadModule, plain } from "./helpers.mjs";
import { blueprint, library, logic, validation, fixture, dates } from "./gym-fixture.mjs";
const assets = JSON.parse(readFileSync("lib/gym/catalogue-assets.json", "utf8"));
const catalogue = loadModule("lib/gym/catalogue.ts", {"./catalogue-assets.json": assets, "./library": {exerciseLibrary: library}});
const today = dates.dateInZone(new Date(), "Europe/Warsaw");

test("all supplied exercise and hardware thumbnails are local, unique and measured", () => {
  assert.equal(assets.filter(asset => asset.type === "exercise").length, 714);
  assert.equal(assets.filter(asset => asset.type === "equipment").length, 171);
  assert.equal(new Set(assets.map(asset => asset.id)).size, 885);
  let total = 0;
  for (const asset of assets) {
    assert.match(asset.icon, /^\/gym\/catalogue\/(exercise|equipment)\/[a-z0-9_]+\.webp$/);
    const bytes = statSync(`public${asset.icon}`).size;
    assert.equal(bytes, asset.bytes); assert.ok(bytes < 15000); total += bytes;
    assert.equal(asset.reviewStatus, "draft");
    for (const hardware of asset.equipmentIds) assert.equal(catalogue.catalogueById.get(hardware)?.type, "equipment");
  }
  assert.equal(total, JSON.parse(readFileSync("public/gym/catalogue/manifest.json", "utf8")).totalBytes);
});

test("catalogue tracking keeps timed, per-side, assisted, bodyweight and machine calf variants separate", () => {
  assert.equal(new Set(catalogue.gymExercises.map(exercise => exercise.id)).size, catalogue.gymExercises.length);
  assert.equal(catalogue.exerciseFor("forearm_plank").tracking, "duration");
  assert.equal(catalogue.exerciseFor("side_plank").tracking, "duration");
  assert.equal(catalogue.exerciseFor("dead_bug").tracking, "reps"); assert.equal(catalogue.exerciseFor("dead_bug").perSide, true);
  assert.equal(catalogue.exerciseFor("assisted_pull_up").tracking, "assistance-reps");
  assert.equal(catalogue.exerciseFor("standing_calf_raise").tracking, "reps");
  assert.equal(catalogue.exerciseFor("machine_standing_calf_raise").tracking, "weight-reps");
  assert.notEqual(catalogue.canonicalId("horizontal_leg_press_exercise"), "leg-press");
  assert.equal(catalogue.canonicalId("incline_dumbbell_press"), "incline-dumbbell-press");
  const hardware = catalogue.equipmentFor([{definition: catalogue.exerciseFor("dumbbell_bench_press")}]);
  assert.ok(hardware.some(item => item.id === "equipment:flat_bench"));
});

test("manually selected exercises start with one empty entry and no recommended quantities", () => {
  for (const definition of catalogue.gymExercises) {
    const target = logic.defaultTargets();
    assert.equal(target.sets, 1);
    for (const key of ["reps", "loadKg", "seconds", "distanceKm", "restSeconds"]) assert.equal(target[key], null);
    assert.equal(validation.targetsSchema.safeParse(target).success, true);
    const entry = logic.sessionExercise(definition, target);
    assert.equal(entry.definition.id, definition.id);
    for (const set of entry.sets) { assert.equal(set.reps, null); assert.equal(set.loadKg, null); assert.equal(set.seconds, null); assert.equal(set.completed, false); }
    if (entry.cardio) { assert.equal(entry.cardio.seconds, null); assert.equal(entry.cardio.distanceKm, null); assert.equal(entry.cardio.completed, false); }
  }
});

test("previously saved routines and their workout snapshots remain editable with their recorded values", async () => {
  const f = fixture(), draft = blueprint(), id = crypto.randomUUID();
  draft.preset = {id: "strength-12", version: 1, profile: "regular", reviewStatus: "draft"};
  draft.exercises[0].targets.loadKg = 20;
  const original = plain(draft);
  assert.equal((await f.actions.saveGymEntity({id, mutationId: crypto.randomUUID(), revision: null, kind: "template", data: draft})).success, true);
  const saved = (await f.actions.getGymData()).templates[0];
  assert.deepEqual(plain(saved.data), original);
  const schedule = {operationId: crypto.randomUUID(), data: saved.data, dates: [today], timezone: "Europe/Warsaw"};
  const first = await f.actions.scheduleGymWorkout(schedule), retry = await f.actions.scheduleGymWorkout(schedule);
  assert.equal(first.success, true); assert.equal(retry.success, true); assert.equal(f.rows.gymPlans.length, 1);
  const session = await f.actions.startGymSession({id: crypto.randomUUID(), planId: first.plans[0].id, data: null, date: today, timezone: "Europe/Warsaw", logged: false});
  assert.equal(session.success, true); assert.equal(session.session.planId, first.plans[0].id);
  assert.deepEqual(plain(session.session.data.originalPlan), original);
  assert.equal(validation.sessionSchema.safeParse(session.session.data).success, true);
  assert.equal(session.session.data.exercises[0].sets[0].loadKg, null);
  assert.equal(session.session.data.exercises[0].sets[0].reps, null);
  assert.equal(f.rows.userEvents.length, 0);
});
