import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { loadModule, plain } from "./helpers.mjs";
import { library, logic, validation, fixture, dates } from "./gym-fixture.mjs";
const assets = JSON.parse(readFileSync("lib/gym/catalogue-assets.json", "utf8"));
const recipes = JSON.parse(readFileSync("lib/gym/strength-presets.json", "utf8"));
const catalogue = loadModule("lib/gym/catalogue.ts", {"./catalogue-assets.json": assets, "./library": {exerciseLibrary: library}});
const presets = loadModule("lib/gym/presets.ts", {"./strength-presets.json": recipes, "./catalogue": catalogue, "./logic": logic}, {structuredClone});
const today = dates.dateInZone(new Date(), "Europe/Warsaw");
function completed(draft, date = today) {
  const data = logic.newSession(draft, date, "Europe/Warsaw", false, true);
  data.status = "completed"; data.finishedAt = new Date().toISOString();
  for (const exercise of data.exercises) if (exercise.definition.tracking === "weight-reps") exercise.sets = exercise.sets.map(set => ({...set, loadKg: 20, reps: 12, rir: 3, controlled: true, pain: false, completed: true}));
  return {id: crypto.randomUUID(), revision: 0, planId: null, data};
}
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
test("strength selections contain only exercises and blank personal targets across historical profile IDs", () => {
  assert.equal(presets.strengthPresets.length, 20);
  assert.equal(presets.cardioPresets.length, 6); assert.equal(presets.cardioAddons.length, 3);
  assert.equal(new Set(catalogue.gymExercises.map(exercise => exercise.id)).size, catalogue.gymExercises.length);
  for (const preset of presets.strengthPresets) for (const profile of ["foundation", "regular", "advanced", "expert"]) {
    const draft = presets.resolveStrength(preset, profile), strength = draft.exercises.filter(item => item.phase === "strength");
    assert.equal(strength.length, preset.blocks.length);
    assert.equal(validation.blueprintSchema.safeParse(draft).success, true, `${preset.name} ${profile}`);
    assert.equal(draft.preset.reviewStatus, "draft");
    for (const [index, item] of strength.entries()) {
      assert.equal(item.definition.catalogueId, `exercise:${preset.blocks[index].exercise}`);
      assert.equal(item.targets.sets, 1);
      for (const key of ["reps", "loadKg", "seconds", "restSeconds"]) assert.equal(item.targets[key], null);
      assert.equal(item.targets.repRange, undefined); assert.equal(item.targets.rir, undefined);
      assert.equal(draft.estimatedMinutes, null); assert.ok(!preset.blocks.some(block => "range" in block));
      assert.equal(item.targets.loadKg, null); assert.equal(item.targets.distanceKm, null);
      assert.equal(catalogue.catalogueById.get(item.definition.catalogueId).type, "exercise");
    }
    const session = logic.newSession(draft, today, "Europe/Warsaw", false, true);
    assert.equal(validation.sessionSchema.safeParse(session).success, true);
    assert.equal(logic.sessionSummary(session).sets, 0);
    for (const item of session.exercises) {assert.equal(item.cardio?.completed || false, false); for (const set of item.sets) {assert.equal(set.loadKg, null); assert.equal(set.reps, null); assert.equal(set.completed, false);}}
  }
});
test("expert is Pro without silently increasing loads, volume or shortening rest", () => {
  for (const preset of presets.strengthPresets) {
    const advanced = presets.resolveStrength(preset, "advanced"), expert = presets.resolveStrength(preset, "expert");
    assert.deepEqual(plain(advanced.exercises.map(item => item.targets)), plain(expert.exercises.map(item => item.targets)));
  }
});

test("personal routines can persist Favorites without built-in preset metadata", () => {
  const draft = presets.resolveStrength(presets.strengthPresets[0], "foundation");
  delete draft.preset;
  const parsed = validation.blueprintSchema.parse({...draft, favorite: true});
  assert.equal(parsed.favorite, true);
  assert.equal(parsed.preset, undefined);
});

test("active cardio choices preserve planned snapshots and actual results without duplicate phases", () => {
  const session = logic.newSession(presets.resolveStrength(presets.strengthPresets[0], "foundation"), today, "Europe/Warsaw", false, true);
  const original = plain(session.originalPlan);
  const added = presets.applySessionCardio(session, "bike", 10);
  const cardio = added.exercises.find(item => item.phase === "cardio");
  assert.equal(cardio.planned.seconds, 600); assert.equal(cardio.cardio.seconds, null); assert.equal(cardio.cardio.distanceKm, null);
  cardio.cardio.seconds = 300; cardio.cardio.completed = true;
  const repeated = presets.applySessionCardio(added, "bike", 15);
  assert.equal(repeated.exercises.length, added.exercises.length);
  assert.equal(repeated.exercises.find(item => item.id === cardio.id).cardio.seconds, 300);
  const skipped = presets.applySessionCardio(repeated, "none");
  assert.equal(skipped.exercises.find(item => item.id === cardio.id).skipped, true);
  assert.equal(skipped.exercises.find(item => item.id === cardio.id).cardio.completed, true);
  assert.deepEqual(plain(skipped.originalPlan), original);
  const replaced = presets.applySessionCardio(skipped, "walk", 20);
  assert.equal(replaced.exercises.filter(item => item.phase === "cardio" && !item.skipped).length, 1);
  assert.equal(validation.sessionSchema.safeParse(replaced).success, true);
  assert.throws(() => presets.applySessionCardio({...replaced, status: "completed"}, "walk"), /Reopen/);
});
test("catalogue tracking keeps timed, per-side, assisted, bodyweight and machine calf variants separate", () => {
  assert.equal(catalogue.exerciseFor("forearm_plank").tracking, "duration");
  assert.equal(catalogue.exerciseFor("side_plank").tracking, "duration");
  assert.equal(catalogue.exerciseFor("dead_bug").tracking, "reps"); assert.equal(catalogue.exerciseFor("dead_bug").perSide, true);
  assert.equal(catalogue.exerciseFor("assisted_pull_up").tracking, "assistance-reps");
  assert.equal(catalogue.exerciseFor("standing_calf_raise").tracking, "reps");
  assert.equal(catalogue.exerciseFor("machine_standing_calf_raise").tracking, "weight-reps");
  assert.notEqual(catalogue.canonicalId("horizontal_leg_press_exercise"), "leg-press");
  assert.equal(catalogue.canonicalId("incline_dumbbell_press"), "incline-dumbbell-press");
  const hardware = catalogue.equipmentFor(presets.resolveStrength(presets.strengthPresets[19], "foundation").exercises);
  assert.ok(hardware.some(item => item.id === "equipment:flat_bench"));
});
test("all cardio variants sum correctly and jogging is an explicit different exercise", () => {
  for (const cardio of presets.cardioPresets) for (const minutes of cardio.variants) for (const jog of [true, false]) {
    const segments = cardio.segments(minutes, jog);
    assert.equal(segments.reduce((sum, segment) => sum + segment.minutes, 0), minutes);
    const draft = presets.resolveCardio(cardio, minutes, jog);
    assert.equal(validation.blueprintSchema.safeParse(draft).success, true, cardio.name);
    assert.equal(draft.exercises.reduce((sum, item) => sum + item.targets.seconds, 0), minutes * 60);
    assert.ok(draft.exercises.every(item => item.definition.tracking === "cardio" && item.targets.distanceKm === null));
    if (cardio.id === "cardio-walk-run") assert.equal(draft.exercises.some(item => item.definition.catalogueId === "exercise:treadmill_running"), jog);
  }
});
test("explicit cardio choices remain separate from blank strength targets", () => {
  const draft = presets.resolveStrength(presets.strengthPresets[0], "regular");
  for (const addon of presets.cardioAddons) for (const minutes of [10,15,20]) {
    const once = presets.appendCardio(draft, addon.id, minutes), twice = presets.appendCardio(once, addon.id, minutes);
    assert.equal(twice.exercises.filter(item => item.phase === "cardio").length, 1);
    assert.equal(twice.exercises.filter(item => item.phase === "cardio")[0].targets.seconds, minutes * 60);
    const session = logic.newSession(twice, today, "Europe/Warsaw", false, true);
    const cardio = session.exercises.find(item => item.phase === "cardio"); cardio.skipped = true;
    assert.equal(logic.sessionSummary(session).exercises, 0); assert.equal(cardio.cardio.distanceKm, null);
  }
  const compact = presets.resolveStrength(presets.strengthPresets[0], "regular", true);
  assert.equal(compact.exercises[0].phase, "strength"); assert.ok(!compact.exercises.some(item => item.phase === "preparation"));
  for (const item of compact.exercises.filter(item => item.phase === "strength")) assert.equal(item.targets.restSeconds, draft.exercises.find(original => original.definition.id === item.definition.id).targets.restSeconds);
});
test("substitutions clear weights and repetitions and require an explicit mapped candidate", () => {
  const item = presets.resolveStrength(presets.strengthPresets[6], "regular").exercises[0];
  item.targets.reps = 12; item.targets.repRange = [8,12]; item.targets.loadKg = 20; item.targets.perSetLoadsKg = [20,22,20]; item.targets.apparatus = "Gym machine";
  const swap = presets.substitute(item, "machine_chest_press");
  assert.equal(swap.targets.reps, null); assert.equal(swap.targets.repRange, undefined); assert.equal(swap.targets.loadKg, null); assert.equal(swap.targets.perSetLoadsKg, undefined); assert.equal(swap.targets.apparatus, null);
  assert.equal(item.targets.loadKg, 20); assert.throws(() => presets.substitute(item, "dead_bug"));
});
test("previous weights need comparable real working sets and matching apparatus; warmups do not qualify", () => {
  const draft = presets.resolveStrength(presets.strengthPresets[6], "regular"), item = draft.exercises[0];
  item.targets.reps = 12; const record = completed(draft);
  assert.equal(presets.previousWeights(item, [record], today).compatible, true);
  record.data.exercises[0].sets[0].warmup = true;
  assert.equal(presets.previousWeights(item, [record], today).compatible, false);
  record.data.exercises[0].sets[0].warmup = false; record.data.date = dates.addCalendarDays(today, -60);
  assert.equal(presets.previousWeights(item, [record], today).compatible, false);
  const machineDraft = presets.resolveStrength(presets.strengthPresets[18], "foundation"), machine = machineDraft.exercises[1];
  machine.targets.reps = 12; const machineRecord = completed(machineDraft);
  assert.equal(presets.previousWeights(machine, [machineRecord], today).compatible, false);
  machine.targets.apparatus = "Gym A / chest press"; machineRecord.data.exercises[1].planned.apparatus = machine.targets.apparatus;
  assert.equal(presets.previousWeights(machine, [machineRecord], today).compatible, true);
});
test("existing performance never fills a new selection or prescribes a heavier weight", () => {
  const draft = presets.resolveStrength(presets.strengthPresets[6], "regular"), item = draft.exercises[0];
  const records = [completed(draft), completed(draft)], before = JSON.stringify(records);
  const previous = presets.previousWeights(item, records, today);
  assert.equal(previous.compatible, false); assert.equal(item.targets.loadKg, null); assert.equal(item.targets.reps, null);
  const fresh = presets.resolveStrength(presets.strengthPresets[6], "regular");
  assert.ok(fresh.exercises.every(exercise => exercise.targets.reps === null && exercise.targets.loadKg === null));
  assert.equal(presets.progressionSuggestion, undefined); assert.equal(JSON.stringify(records), before);
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

test("saved/scheduled preset snapshots and resumed logs use existing owned persistence, without creating Events data", async () => {
  const f = fixture(), draft = presets.resolveStrength(presets.strengthPresets[11], "regular"), id = crypto.randomUUID(), mutationId = crypto.randomUUID();
  assert.equal((await f.actions.saveGymEntity({id, mutationId, revision: null, kind: "template", data: draft})).success, true);
  const schedule = {operationId: crypto.randomUUID(), data: draft, dates: [today], timezone: "Europe/Warsaw"};
  const first = await f.actions.scheduleGymWorkout(schedule), retry = await f.actions.scheduleGymWorkout(schedule);
  assert.equal(first.success, true); assert.equal(retry.success, true); assert.equal(f.rows.gymPlans.length, 1);
  const session = await f.actions.startGymSession({id: crypto.randomUUID(), planId: first.plans[0].id, data: null, date: today, timezone: "Europe/Warsaw", logged: false});
  assert.equal(session.success, true); assert.equal(session.session.planId, first.plans[0].id); assert.equal(session.session.data.originalPlan.preset.id, "strength-12");
  draft.exercises[1].targets.loadKg = 999;
  assert.equal(session.session.data.originalPlan.exercises[1].targets.loadKg, null);
  assert.equal(f.rows.userEvents.length, 0);
  const actual = session.session.data.exercises[1]; Object.assign(actual.sets[0], {loadKg: 12, reps: 8, completed: true});
  actual.sets.push({...logic.blankSet(), loadKg: 5, reps: 8, completed: true, warmup: true});
  assert.equal(logic.sessionSummary(session.session.data).sets, 1);
});
