import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { plain } from "./helpers.mjs";
import { blueprint, dates, fixture, library, logic, sessionHook, types, validation } from "./gym-fixture.mjs";
const today = dates.dateInZone(new Date(), "Europe/Warsaw");
const units = { weight: "kg", distance: "km" };
const actual = (data = blueprint()) => logic.newSession(data, today, "Europe/Warsaw", false, true);
const command = (data) => ({ id: crypto.randomUUID(), revision: null, mutationId: crypto.randomUUID(), kind: "template", data });

test("calendar weeks remain Monday–Sunday across year and both Warsaw DST boundaries", () => {
  for (const [day, first, last] of [["2026-03-29", "2026-03-23", "2026-03-29"], ["2026-10-25", "2026-10-19", "2026-10-25"], ["2027-01-01", "2026-12-28", "2027-01-03"]]) { const week = dates.weekDates(day); assert.equal(week[0], first); assert.equal(week[6], last); assert.equal(new Set(week).size, 7); }
  assert.equal(dates.addCalendarDays("2026-03-29", 1), "2026-03-30"); assert.equal(dates.addCalendarDays("2026-10-25", 1), "2026-10-26");
  assert.equal(dates.dateInZone(new Date("2026-03-28T23:30:00Z"), "Europe/Warsaw"), "2026-03-29"); assert.equal(dates.dateInZone(new Date("2026-10-24T23:30:00Z"), "Europe/Warsaw"), "2026-10-25");
});
test("focused exercise library is unique, schema-driven, and covers every tracking type and icon", () => {
  assert.equal(library.length, 26); assert.equal(new Set(library.map((item) => item.id)).size, 26);
  for (const exercise of library) assert.equal(validation.definitionSchema.safeParse(exercise).success, true, exercise.name);
  assert.deepEqual([...new Set(library.map((exercise) => exercise.tracking))].sort(), [...types.trackingTypes].sort());
  for (const exercise of library) for (const alternative of exercise.alternatives) assert.ok(library.some((item) => item.id === alternative));
});
test("starting snapshots targets but leaves actual values empty and incomplete", () => {
  const plan = blueprint(), session = actual(plan); plan.exercises[0].targets.loadKg = 100;
  assert.equal(session.originalPlan.exercises[0].targets.loadKg, null); assert.equal(session.exercises[0].planned.reps, 10); assert.equal(session.exercises[0].sets.length, 3);
  for (const set of session.exercises[0].sets) assert.deepEqual(plain({ load: set.loadKg, reps: set.reps, complete: set.completed }), { load: null, reps: null, complete: false });
  assert.equal(validation.sessionSchema.safeParse(session).success, true);
});
test("different actual sets and early ending never overwrite targets or count unfinished work", () => {
  const session = actual(); session.exercises[0].planned.loadKg = 60;
  session.exercises[0].sets = [[60, 10], [60, 9], [55, 10]].map(([loadKg, reps]) => ({ ...logic.blankSet(), loadKg, reps, completed: true }));
  session.exercises[0].skipped = true; session.exercises[0].sets[2].completed = false;
  session.status = "completed"; session.finishedAt = new Date().toISOString();
  assert.equal(validation.sessionSchema.safeParse(session).success, true); assert.equal(logic.sessionSummary(session).sets, 2); assert.equal(logic.sessionSummary(session).skipped, 1); assert.equal(session.exercises[0].planned.reps, 10); assert.equal(session.originalPlan.exercises[0].targets.reps, 10);
});
test("required actual fields distinguish empty, zero, negatives, cardio unknown distance and timed work", () => {
  const session = actual(blueprint(["bench-press", "push-up", "assisted-pull-up", "plank", "stationary-cycling"]));
  const [loaded, reps, assisted, timed, cardio] = session.exercises;
  loaded.sets[0] = { ...loaded.sets[0], loadKg: 0, reps: 1, completed: true }; reps.sets[0] = { ...reps.sets[0], reps: 10, completed: true }; assisted.sets[0] = { ...assisted.sets[0], loadKg: 25, reps: 8, completed: true }; timed.sets[0] = { ...timed.sets[0], seconds: 45, completed: true }; cardio.cardio = { seconds: 1500, distanceKm: null, completed: true, notes: "" };
  assert.equal(validation.sessionSchema.safeParse(session).success, true); assert.equal(reps.sets[0].loadKg, null); assert.equal(timed.sets[0].reps, null); assert.equal(logic.sessionSummary(session).cardio["Stationary cycling"].knownDistances, 0);
  for (const bad of [{ loadKg: -1 }, { reps: null }, { reps: 0 }, { reps: 2.5 }, { loadKg: null }]) { const draft = structuredClone(session); Object.assign(draft.exercises[0].sets[0], bad); assert.equal(validation.sessionSchema.safeParse(draft).success, false); }
  cardio.cardio.seconds = 0; assert.equal(validation.sessionSchema.safeParse(session).success, false); cardio.cardio.seconds = 1500; cardio.cardio.distanceKm = 0; assert.equal(validation.sessionSchema.safeParse(session).success, true); assert.equal(logic.speed(1500, 0), null); assert.equal(logic.pace(0, 8), null);
});
test("future actual dates, impossible calendar dates, incompatible fields and duplicate set IDs are rejected", () => {
  const session = actual(); session.date = dates.addCalendarDays(today, 1); assert.equal(validation.sessionSchema.safeParse(session).success, false);
  assert.equal(validation.calendarDay.safeParse("2026-02-30").success, false);
  session.date = today; session.exercises[0].sets[1].id = session.exercises[0].sets[0].id; assert.equal(validation.sessionSchema.safeParse(session).success, false);
  const wrong = { ...library[0], tracking: "reps" }; assert.equal(validation.definitionSchema.safeParse(wrong).success, false);
  const empty = actual(); empty.status = "completed"; empty.finishedAt = new Date().toISOString(); assert.equal(validation.sessionSchema.safeParse(empty).success, false);
});
test("unit conversion preserves canonical values and assistance is not a lifted-weight metric", () => {
  const imperial = { weight: "lb", distance: "mi" };
  assert.ok(Math.abs(logic.weightStore(logic.weightDisplay(60.25, imperial), imperial) - 60.25) < 1e-9); assert.ok(Math.abs(logic.distanceStore(logic.distanceDisplay(8.4, imperial), imperial) - 8.4) < 1e-9);
  assert.equal(logic.weightDisplay(0, units), 0); assert.equal(logic.speed(1500, 8.4), 20.16);
  const summary = logic.sessionSummary(actual(blueprint(["assisted-pull-up"]))); assert.equal(summary.volume, undefined);
});
test("linked plans render once and weekly summaries separate running and cycling", () => {
  const bp = blueprint(["stationary-cycling", "treadmill"]), session = actual(bp); session.status = "completed"; session.finishedAt = new Date().toISOString();
  for (const exercise of session.exercises) exercise.cardio = { seconds: 1500, distanceKm: exercise.definition.id === "treadmill" ? null : 8.4, completed: true, notes: "" };
  const record = { id: crypto.randomUUID(), planId: "plan", data: session, revision: 0 }, data = { templates: [], plans: [{ id: "plan", date: today, data: bp }], sessions: [record], restDays: [] };
  assert.equal(logic.dayItems(data, today).plans.length, 0); assert.equal(logic.dayItems(data, today).sessions.length, 1);
  const summary = logic.weeklySummary([record], dates.weekDates(today)); assert.equal(summary.workouts, 1); assert.equal(summary.cardioSeconds, 3000); assert.equal(summary.distance["Stationary cycling"].km, 8.4); assert.equal(summary.distance.Treadmill.known, 0);
});
test("template writes and scheduled snapshots are independent, and scheduling retries are idempotent", async () => {
  const { actions, rows } = fixture(), bp = blueprint(), cmd = command(bp);
  assert.equal((await actions.saveGymEntity(cmd)).success, true); assert.equal((await actions.saveGymEntity(cmd)).success, true); assert.equal(rows.gymEntities.length, 1);
  const schedule = { operationId: crypto.randomUUID(), dates: [today, today, dates.addCalendarDays(today, 1)], timezone: "Europe/Warsaw", data: bp };
  assert.equal((await actions.scheduleGymWorkout(schedule)).plans.length, 2); await actions.scheduleGymWorkout(schedule); assert.equal(rows.gymPlans.length, 2);
  const changed = structuredClone(bp); changed.exercises[0].targets.reps = 8;
  assert.equal((await actions.saveGymEntity({ ...cmd, revision: 0, mutationId: crypto.randomUUID(), data: changed })).success, true);
  assert.equal(rows.gymPlans[0].data.exercises[0].targets.reps, 10);
});
test("planned start is idempotent and server-owned targets survive actual edits", async () => {
  const { actions, rows } = fixture(), bp = blueprint(); bp.exercises[0].targets.loadKg = 60;
  const plan = (await actions.scheduleGymWorkout({ operationId: crypto.randomUUID(), dates: [today], timezone: "Europe/Warsaw", data: bp })).plans[0];
  const cmd = { id: crypto.randomUUID(), planId: plan.id, data: null, date: today, timezone: "Europe/Warsaw", logged: false };
  const first = await actions.startGymSession(cmd), retry = await actions.startGymSession({ ...cmd, id: crypto.randomUUID() }); assert.equal(first.session.id, retry.session.id); assert.equal(rows.gymSessions.length, 1);
  const data = structuredClone(first.session.data); data.exercises[0].planned.reps = 99; data.originalPlan.exercises[0].targets.loadKg = 999; data.exercises[0].sets[0] = { ...data.exercises[0].sets[0], loadKg: 55, reps: 9, completed: true };
  const save = { id: first.session.id, revision: 0, mutationId: crypto.randomUUID(), data };
  const result = await actions.saveGymSession(save); assert.equal(result.success, true); assert.equal(result.session.data.originalPlan.exercises[0].targets.loadKg, 60); assert.equal(result.session.data.exercises[0].planned.reps, 10); assert.equal(result.session.data.exercises[0].sets[0].loadKg, 55);
  assert.equal((await actions.saveGymSession(save)).session.revision, 1); assert.equal((await actions.saveGymSession({ ...save, mutationId: crypto.randomUUID() })).success, false);
});
test("starting now needs no schedule and direct logs have no fake planned targets or live timestamp", async () => {
  const { actions } = fixture();
  const start = await actions.startGymSession({ id: crypto.randomUUID(), planId: null, data: blueprint(), date: today, timezone: "Europe/Warsaw", logged: false }); assert.equal(start.success, true); assert.ok(start.session.data.exercises[0].planned); assert.equal(start.session.planId, null);
  const log = await actions.startGymSession({ id: crypto.randomUUID(), planId: null, data: blueprint(["push-up"]), date: dates.addCalendarDays(today, -3), timezone: "Europe/Warsaw", logged: true }); assert.equal(log.session.data.exercises[0].planned, null); assert.equal(log.session.data.startedAt, null);
});
test("copying a week copies only plans and never actual results or rest markers", async () => {
  const { actions, rows } = fixture(), bp = blueprint();
  const plan = (await actions.scheduleGymWorkout({ operationId: crypto.randomUUID(), dates: [today], timezone: "Europe/Warsaw", data: bp })).plans[0];
  await actions.startGymSession({ id: crypto.randomUUID(), planId: plan.id, data: null, date: today, timezone: "Europe/Warsaw", logged: false }); await actions.setGymRestDay({ date: today, timezone: "Europe/Warsaw", rest: true });
  const cmd = { operationId: crypto.randomUUID(), from: today, to: dates.addCalendarDays(today, 7), timezone: "Europe/Warsaw" };
  const result = await actions.copyGymWeek(cmd); assert.equal(result.success, true); assert.equal(result.plans[0].date, dates.addCalendarDays(today, 7)); assert.equal(result.plans[0].data.exercises[0].sets, undefined);
  await actions.copyGymWeek(cmd); assert.equal(rows.gymPlans.length, 2); assert.equal(rows.gymSessions.length, 1); assert.equal(rows.gymRestDays.length, 1);
});
test("removing a plan leaves its actual log intact and completed changes update totals", async () => {
  const { actions, rows } = fixture(), bp = blueprint(); const plan = (await actions.scheduleGymWorkout({ operationId: crypto.randomUUID(), dates: [today], timezone: "Europe/Warsaw", data: bp })).plans[0];
  const started = await actions.startGymSession({ id: crypto.randomUUID(), planId: plan.id, data: null, date: today, timezone: "Europe/Warsaw", logged: false });
  const data = structuredClone(started.session.data); data.exercises[0].sets[0] = { ...data.exercises[0].sets[0], loadKg: 60, reps: 10, completed: true }; data.status = "completed"; data.finishedAt = new Date().toISOString();
  const finished = await actions.saveGymSession({ id: started.session.id, revision: 0, mutationId: crypto.randomUUID(), data }); assert.equal(finished.success, true);
  await actions.archiveGymRecord({ id: plan.id, kind: "plan", archived: true }); assert.equal(rows.gymSessions[0].archived, false); assert.equal((await actions.getGymData()).sessions.length, 1);
  assert.equal((await actions.editGymPlan({ id: plan.id, revision: 0, mutationId: crypto.randomUUID(), date: today, timezone: "Europe/Warsaw", data: bp })).success, false);
  await actions.archiveGymRecord({ id: started.session.id, kind: "session", archived: true }); assert.equal(logic.weeklySummary((await actions.getGymData()).sessions, dates.weekDates(today)).workouts, 0);
});
test("all reads and mutations are owner-scoped; unauthenticated calls never access storage", async () => {
  const denied = fixture({ owner: null }); assert.equal((await denied.actions.saveGymEntity(command(blueprint()))).success, false); assert.equal(denied.calls.length, 0);
  const { actions, calls } = fixture(); await actions.getGymData(); const saved = await actions.saveGymEntity(command(blueprint())); await actions.archiveGymRecord({ id: saved.record.id, kind: "entity", archived: true });
  for (const call of calls) { if (call.operation === "insert") assert.ok(call.values.every((row) => row.userId === "alice")); else assert.ok(call.predicate.conditions.some((part) => part.column.key === "userId" && part.value === "alice")); }
  assert.equal(saved.record.userId, undefined);
});
test("autosave serializes revisions, retains new edits during slow saves, and replays a lost acknowledgement", async () => {
  const { actions } = fixture(); const initial = (await actions.startGymSession({ id: crypto.randomUUID(), planId: null, data: blueprint(), date: today, timezone: "Europe/Warsaw", logged: false })).session;
  const sent = []; let loseAck = true;
  const hook = sessionHook(initial, async (cmd) => { sent.push(cmd); const result = await actions.saveGymSession(cmd); if (loseAck) { loseAck = false; throw new Error("Lost acknowledgement"); } return result; });
  hook.render().update({ ...initial.data, notes: "first" }); await hook.runTimer(); assert.equal(hook.render().state, "failed");
  hook.render().update({ ...hook.render().data, notes: "second" }); await hook.render().flush();
  assert.equal(sent[0].mutationId, sent[1].mutationId); assert.equal(hook.render().state, "saved"); assert.equal(hook.callbacks.at(-1).data.notes, "second"); assert.equal(hook.callbacks.at(-1).revision, 2);
});
test("transparent icon assets are locally registered, tiny, and have no raster/filter payload", () => {
  let bytes = 0;
  for (const key of types.iconKeys) { const file = `public/gym/${key}.svg`, svg = readFileSync(file, "utf8"); bytes += statSync(file).size; assert.ok(svg.includes('viewBox="0 0 192 192"')); assert.equal(/<image|base64|<filter|<rect|<text/.test(svg), false); assert.ok(statSync(file).size < 15000); }
  assert.equal(bytes, 12388);
});

test("invalid unsaved fields can be corrected without replaying an invalid save forever", async () => {
  const { actions } = fixture(); const initial = (await actions.startGymSession({ id: crypto.randomUUID(), planId: null, data: blueprint(), date: today, timezone: "Europe/Warsaw", logged: false })).session;
  const hook = sessionHook(initial, actions.saveGymSession);
  hook.render().update({ ...initial.data, name: "" }); await hook.runTimer(); assert.equal(hook.render().state, "failed"); assert.equal(hook.callbacks.length, 0);
  hook.render().update({ ...hook.render().data, name: "Corrected workout" }); await hook.render().flush(); assert.equal(hook.render().state, "saved"); assert.equal(hook.callbacks.at(-1).data.name, "Corrected workout");
});

test("slow acknowledgements cannot reset a newer current draft or reverse its save status", async () => {
  const { actions } = fixture(); const initial = (await actions.startGymSession({ id: crypto.randomUUID(), planId: null, data: blueprint(), date: today, timezone: "Europe/Warsaw", logged: false })).session;
  let release; const gate = new Promise((resolve) => { release = resolve; }); let first = true;
  const hook = sessionHook(initial, async (cmd) => { if (first) { first = false; await gate; } return actions.saveGymSession(cmd); });
  hook.render().update({ ...initial.data, notes: "Older snapshot" }); await hook.runTimer(); hook.render().update({ ...hook.render().data, notes: "Latest actual notes" }); release(); await hook.render().flush();
  assert.equal(hook.render().data.notes, "Latest actual notes"); assert.equal(hook.callbacks.at(-1).data.notes, "Latest actual notes"); assert.equal(hook.render().state, "saved");
});

test("completed exercise snapshots survive definition edits and deleting actual entries recalculates totals", async () => {
  const { actions } = fixture(); const initial = (await actions.startGymSession({ id: crypto.randomUUID(), planId: null, data: blueprint(), date: today, timezone: "Europe/Warsaw", logged: false })).session;
  const data = structuredClone(initial.data); data.status = "completed"; data.finishedAt = new Date().toISOString(); data.exercises[0].sets[0] = { ...data.exercises[0].sets[0], loadKg: 60, reps: 10, completed: true }; data.exercises[0].sets[1] = { ...data.exercises[0].sets[1], loadKg: 55, reps: 9, completed: true };
  const saved = (await actions.saveGymSession({ id: initial.id, revision: 0, mutationId: crypto.randomUUID(), data })).session;
  const edit = structuredClone(saved.data); edit.exercises[0].definition.name = "Renamed definition"; edit.exercises[0].sets = edit.exercises[0].sets.slice(0, 1);
  const changed = await actions.saveGymSession({ id: saved.id, revision: saved.revision, mutationId: crypto.randomUUID(), data: edit }); assert.equal(changed.success, true); assert.equal(changed.session.data.exercises[0].definition.name, "Bench press"); assert.equal(logic.weeklySummary([changed.session], dates.weekDates(today)).sets, 1);
  assert.equal(changed.session.data.originalPlan.exercises[0].targets.sets, 3);
});

test("a future same-day result cannot be labeled Previous for an earlier workout", () => {
  const current = { id: crypto.randomUUID(), data: actual(), revision: 0, planId: null }; current.data.startedAt = "2026-01-01T10:00:00Z";
  const previous = { ...current, id: crypto.randomUUID(), data: structuredClone(current.data) }; previous.data.status = "completed"; previous.data.finishedAt = "2026-01-01T09:00:00Z"; previous.data.exercises[0].sets[0] = { ...logic.blankSet(), loadKg: 50, reps: 10, completed: true };
  const later = { ...previous, id: crypto.randomUUID(), data: structuredClone(previous.data) }; later.data.finishedAt = "2026-01-01T11:00:00Z"; later.data.exercises[0].sets[0].loadKg = 100;
  assert.equal(logic.previousExercise([previous, later], current, "bench-press").exercise.sets[0].loadKg, 50); assert.equal(dates.dateLabel(""), "Choose a date");
});

test("foreign plans and sessions cannot be opened, changed, or removed", async () => {
  const { actions, rows } = fixture(), planId = crypto.randomUUID(), sessionId = crypto.randomUUID();
  rows.gymPlans.push({ id: planId, userId: "bob", archived: false, date: today, timezone: "Europe/Warsaw", data: blueprint(), revision: 0 }); rows.gymSessions.push({ id: sessionId, userId: "bob", archived: false, data: actual(), revision: 0 });
  assert.equal((await actions.startGymSession({ id: crypto.randomUUID(), planId, data: null, date: today, timezone: "Europe/Warsaw", logged: false })).success, false);
  assert.equal((await actions.saveGymSession({ id: sessionId, revision: 0, mutationId: crypto.randomUUID(), data: actual() })).success, false); assert.equal((await actions.archiveGymRecord({ id: planId, kind: "plan", archived: true })).success, false);
  const owned = await actions.getGymData(); assert.equal(owned.plans.length, 0); assert.equal(owned.sessions.length, 0); assert.equal(rows.gymPlans[0].archived, false);
});
