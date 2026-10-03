import test from "node:test";
import assert from "node:assert/strict";
import { plain } from "./helpers.mjs";
import { blueprint, logic as gymLogic, dates } from "./gym-fixture.mjs";
import { types, content, logic, validation, reduce, fixture, emptySources, todo, scheduling } from "./momentum-fixture.mjs";
const command = (revision, value, mutationId = crypto.randomUUID()) => ({ revision, mutationId, timezone: "Europe/Warsaw", command: value });
const load = app => app.actions.getMomentumBundle({ timezone: "Europe/Warsaw" });
test("daily thoughts are stable, account-specific, local-date keyed and avoid recent repeats", () => {
  let data = types.emptyMomentum();
  for (let index = 0; index < 12; index++) { const date = dates.addCalendarDays("2026-10-01", index); data = logic.assignThought(data, date, "alice"); assert.deepEqual(plain(logic.assignThought(data, date, "alice")), plain(data)); const recent = data.thoughts.slice(-8); assert.equal(new Set(recent.map(item => item.index)).size, recent.length); }
  assert.equal(content.thoughts.length, 12);
  assert.equal(dates.dateInZone(new Date("2026-10-02T22:30:00Z"), "Europe/Warsaw"), "2026-10-03");
  assert.deepEqual(plain(dates.weekDates("2026-10-25")), ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"]);
  assert.equal(dates.weekStart("2027-01-01"), "2026-12-28");
});
test("the daily loop selects a canonical task, survives reload, completes once and unselects without deleting it", async () => {
  const app = fixture(), initial = await load(app);
  const request = command(initial.record.revision, { type: "select", slot: "main", selection: { source: { kind: "task", id: "alice-task" }, why: "My direction", minutes: 10, journeyId: null } });
  assert.equal((await app.actions.mutateMomentum(request)).success, true); assert.equal((await app.actions.mutateMomentum(request)).success, true);
  assert.equal((await load(app)).record.data.days[0].main.source.id, "alice-task");
  assert.equal((await app.actions.momentumTask({ action: "complete", id: "alice-task" })).success, true);
  await app.actions.momentumTask({ action: "complete", id: "alice-task" });
  const loaded = await load(app); assert.equal(loaded.activities.filter(item => item.key === "task:alice-task").length, 1); assert.equal(loaded.activities[0].status, "completed"); assert.equal(loaded.summary.tasks, 1);
  await app.actions.mutateMomentum(command(loaded.record.revision, { type: "select", slot: "main", selection: null }));
  assert.equal(app.sources.alice.todo[3].items.length, 1);
});
test("owner-scoped reads, writes, focus and export never expose another account", async () => {
  const app = fixture(); await load(app); app.owner("bob"); const bob = await load(app);
  assert.equal(bob.activities.some(item => item.title === "My next action"), false);
  const foreign = await app.actions.mutateMomentum(command(bob.record.revision, { type: "select", slot: "main", selection: { source: { kind: "task", id: "alice-task" }, why: "", minutes: null, journeyId: null } })); assert.equal(foreign.success, false);
  assert.equal((await app.actions.momentumTask({ action: "complete", id: "alice-task" })).success, false);
  assert.equal((await app.actions.exportMomentum()).data.days.length, 0);
  const count = app.calls.length; app.owner(null); assert.equal((await app.actions.mutateMomentum(command(0, { type: "delete-all" }))).success, false); assert.equal(app.calls.length, count); await assert.rejects(() => app.actions.getMomentumFocus(), /Unauthorized/); await assert.rejects(() => app.actions.exportMomentum(), /Unauthorized/);
});
test("concurrent tabs use revision compare-and-swap and permit only one running or paused timer", async () => {
  const app = fixture(), { record } = await load(app);
  const first = command(record.revision, { type: "focus-start", id: crypto.randomUUID(), source: { kind: "task", id: "alice-task" }, minutes: 10 });
  const second = command(record.revision, { type: "focus-start", id: crypto.randomUUID(), source: null, minutes: 25 });
  const results = await Promise.all([app.actions.mutateMomentum(first), app.actions.mutateMomentum(second)]); assert.equal(results.filter(item => item.success).length, 1);
  const winner = results.find(item => item.success); assert.equal(winner.record.data.focus.length, 1);
  assert.equal((await app.actions.mutateMomentum(command(winner.record.revision, second.command))).success, false);
  assert.equal((await app.actions.mutateMomentum(first)).success, true); assert.equal((await app.actions.getMomentumFocus()).plannedSeconds, 600);
});
test("focus pauses, resumes, recovers timestamps, caps sleep time, saves corrected actual time and leaves its task open", () => {
  const sources = emptySources(); sources.todo[1].items.push({ id: "task", content: "Read" });
  let data = reduce(types.emptyMomentum(), { type: "focus-start", id: crypto.randomUUID(), source: { kind: "task", id: "task" }, minutes: 10 }, sources);
  const id = data.focus[0].id;
  data = reduce(data, { type: "focus-control", id, action: "pause" }, sources, "2026-10-03T10:02:00Z");
  assert.equal(logic.elapsedFocus(data.focus[0], Date.parse("2026-10-03T10:40:00Z")), 120);
  data = reduce(data, { type: "focus-control", id, action: "resume" }, sources, "2026-10-03T10:04:00Z");
  assert.equal(logic.elapsedFocus(data.focus[0], Date.parse("2026-10-03T19:00:00Z")), 600);
  data = reduce(data, { type: "focus-control", id, action: "finish" }, sources, "2026-10-03T19:00:00Z");
  assert.equal(data.focus[0].intervals[1].end, "2026-10-03T10:12:00.000Z");
  assert.throws(() => reduce(data, { type: "focus-save", id, seconds: 601, notes: "" }, sources, "2026-10-03T19:00:00Z"), /time actually recorded/);
  data = reduce(data, { type: "focus-save", id, seconds: 300, notes: "Optional" }, sources, "2026-10-03T19:00:00Z");
  assert.equal(data.focus[0].confirmedSeconds, 300); assert.equal(sources.todo[1].items.length, 1); assert.equal(sources.todo[3].items.length, 0);
});
test("focus extensions are explicit, discarded timers add no logged time, and timer retries never add duplicate intervals", () => {
  let data = reduce(types.emptyMomentum(), { type: "focus-start", id: crypto.randomUUID(), source: null, minutes: 10 }); const id = data.focus[0].id;
  data = reduce(data, { type: "focus-control", id, action: "finish" }, undefined, "2026-10-03T10:30:00Z");
  data = reduce(data, { type: "focus-control", id, action: "extend", minutes: 10 }, undefined, "2026-10-03T10:30:00Z");
  assert.equal(data.focus[0].plannedSeconds, 1200); assert.equal(logic.elapsedFocus(data.focus[0], Date.parse("2026-10-03T10:31:00Z")), 660);
  data = reduce(data, { type: "focus-control", id, action: "discard" }, undefined, "2026-10-03T10:31:00Z");
  assert.equal(data.focus[0].status, "discarded"); assert.equal(data.focus[0].confirmedSeconds, null);
});
test("source projections count a linked Gym session once, use actual workout dates and never infer event attendance or metrics", () => {
  const sources = emptySources(), bp = blueprint(), session = gymLogic.newSession(bp, "2026-09-10", "Europe/Warsaw", true, () => crypto.randomUUID()); session.status = "completed"; session.completionMode = "confirmation"; session.finishedAt = "2026-10-03T10:00:00Z";
  sources.gym.plans.push({ id: "plan", data: bp, date: "2026-10-03", timezone: "Europe/Warsaw", revision: 0 }); sources.gym.sessions.push({ id: "session", planId: "plan", data: session, revision: 0 });
  sources.weeks.push({ week: "2026-WK40", data: [{ id: "mon", day: "Monday", tasks: [{ id: "meeting", title: "Meeting", completed: false, timing: { start: "08:00", duration: 30, overnight: false } }] }] });
  const activities = logic.sourceActivities(sources, "Europe/Warsaw"), summary = logic.buildSummary(sources, activities, types.emptyMomentum(), "2026-10-03", "Europe/Warsaw", "2026-10-03T10:00:00Z");
  assert.equal(activities.filter(item => item.ref.kind === "workout").length, 1); assert.equal(activities[0].date, "2026-09-10"); assert.equal(activities[0].detail, "Completed — no details logged"); assert.equal(summary.workouts, 0); assert.equal(summary.strengthSets, 0); assert.equal(summary.events, 0);
});
test("journey templates snapshot edits, criteria use live evidence, reopening/deletion removes current progress without re-awarding", () => {
  const sources = emptySources(); sources.todo[3].items.push({ id: "task", content: "Draft", completedAt: "2026-10-03T10:00:00Z" });
  const journey = content.journeyDraft("project", () => crypto.randomUUID()); journey.chapters[0].links = [{ kind: "task", id: "task" }];
  let data = reduce(types.emptyMomentum(), { type: "journey", value: journey }, sources); const activities = logic.sourceActivities(sources, "Europe/Warsaw");
  assert.equal(logic.chapterDone(data.journeys[0].chapters[0], activities), true);
  data = logic.addAwards(data, activities, "2026-10-03T10:00:00Z"); assert.equal(data.awards.length, 1);
  sources.todo = todo.moveTodoTask(sources.todo, "task", { groupId: "todo", beforeId: null }); assert.equal(logic.chapterDone(data.journeys[0].chapters[0], logic.sourceActivities(sources, "Europe/Warsaw")), false);
  sources.todo = todo.moveTodoTask(sources.todo, "task", { groupId: "done", beforeId: null }); assert.equal(logic.addAwards(data, logic.sourceActivities(sources, "Europe/Warsaw"), "2026-10-04T10:00:00Z").awards.length, 1);
  const original = content.journeyTemplates[2].chapters[0]; data.journeys[0].chapters[0].title = "Edited by user"; assert.equal(content.journeyTemplates[2].chapters[0], original);
  data = reduce(data, { type: "delete-journey", id: journey.id }, sources); assert.equal(sources.todo[3].items.length, 1); assert.equal(data.awards.length, 0);
});
test("smaller steps do not finish their parent, pinned choices win and rest/paused journeys retain progress", () => {
  const sources = emptySources(); sources.todo[1].items.push({ id: "parent", content: "Finish project" }, { id: "child", content: "Outline" });
  sources.todo = todo.moveTodoTask(sources.todo, "child", { groupId: "done", beforeId: null });
  assert.equal(sources.todo[1].items[0].id, "parent");
  const journey = content.journeyDraft("routine", () => crypto.randomUUID()); journey.status = "paused";
  let data = reduce(types.emptyMomentum(), { type: "journey", value: journey }, sources); data = reduce(data, { type: "rest", value: true }, sources);
  assert.equal(data.days[0].rest, true); assert.equal(data.journeys[0].status, "paused");
  assert.equal(logic.suggestion(data, logic.sourceActivities(sources, "Europe/Warsaw"), "2026-10-03", true).activity.ref.id, "parent");
});
test("at most two distinct support actions are saved and changing a selection never removes the source", () => {
  const sources = emptySources(); sources.todo[1].items = ["a", "b", "c"].map(id => ({ id, content: id })); let data = types.emptyMomentum();
  for (const id of ["a", "b"]) data = reduce(data, { type: "select", slot: "supporting", selection: { source: { kind: "task", id }, why: "", minutes: null, journeyId: null } }, sources);
  assert.throws(() => reduce(data, { type: "select", slot: "supporting", selection: { source: { kind: "task", id: "c" }, why: "", minutes: null, journeyId: null } }, sources), /two supporting/);
  assert.equal(sources.todo[1].items.length, 3);
});
test("saved reviews retain personal writing and as-of summaries until an explicit version refresh", () => {
  const sources = emptySources(); let data = types.emptyMomentum(); const id = crypto.randomUUID();
  const value = { type: "review", id, week: "2026-10-03", worthwhile: "My own words", obstacle: "", change: "One change", manageable: "Manageable", draft: true, refreshSummary: false };
  data = reduce(data, value, sources); const asOf = data.reviews[0].summary.asOf;
  sources.todo[3].items.push({ id: "task", content: "Finished", completedAt: "2026-10-03T10:10:00Z" });
  data = reduce(data, { ...value, draft: false }, sources, "2026-10-03T11:00:00Z"); assert.equal(data.reviews[0].summary.tasks, 0); assert.equal(data.reviews[0].summary.asOf, asOf); assert.equal(data.reviews[0].worthwhile, "My own words");
  data = reduce(data, { ...value, draft: false, refreshSummary: true }, sources, "2026-10-03T12:00:00Z"); assert.equal(data.reviews[0].summary.tasks, 1); assert.equal(data.reviews[0].version, 2); assert.equal(data.reviews[0].worthwhile, "My own words");
});
test("savings use exact currency-specific minor units with corrections, withdrawals, and unique allocation references", () => {
  assert.equal(logic.parseMoney("0.10", "PLN") + logic.parseMoney("0.20", "PLN"), 30); assert.equal(logic.parseMoney("1.234", "KWD"), 1234); assert.equal(logic.parseMoney("120", "JPY"), 120);
  for (const value of ["-1", "1.001", "", "NaN", "1e4"]) assert.throws(() => logic.parseMoney(value, "PLN"));
  const goal = { id: crypto.randomUUID(), name: "My purpose", currency: "PLN", targetMinor: 100000, openingMinor: 10000, openingDate: "2026-10-01", targetDate: null, entries: [] };
  let data = reduce(types.emptyMomentum(), { type: "savings", value: goal });
  const entry = { id: crypto.randomUUID(), allocationRef: "transfer-one", date: "2026-10-03", type: "contribution", amountMinor: 2500, note: "" };
  data = reduce(data, { type: "entry", goalId: goal.id, value: entry }); data = reduce(data, { type: "entry", goalId: goal.id, value: entry }); assert.equal(logic.savingsBalance(data.savings[0]), 12500); assert.equal(data.savings[0].entries.length, 1);
  data = reduce(data, { type: "entry", goalId: goal.id, value: { ...entry, type: "withdrawal", amountMinor: 1000 } }); assert.equal(logic.savingsBalance(data.savings[0]), 9000);
  assert.throws(() => reduce(data, { type: "savings", value: { ...goal, currency: "USD" } }), /different currency/);
  const other = { ...goal, id: crypto.randomUUID(), currency: "USD" }; data = reduce(data, { type: "savings", value: other });
  assert.throws(() => reduce(data, { type: "entry", goalId: other.id, value: { ...entry, id: crypto.randomUUID() } }), /reference is already used/);
  data = reduce(data, { type: "delete-entry", goalId: goal.id, id: entry.id }); assert.equal(logic.savingsBalance(data.savings.find(item => item.id === goal.id)), 10000);
});
test("server validation rejects negative amounts, impossible dates, forged fields, future journal entries and duplicate identifiers", () => {
  assert.equal(validation.commandSchema.safeParse({ type: "focus-start", id: crypto.randomUUID(), source: null, minutes: -1 }).success, false);
  assert.equal(validation.commandSchema.safeParse({ type: "rest", value: true, owner: "bob" }).success, false);
  const goal = { id: crypto.randomUUID(), name: "Goal", currency: "PLN", targetMinor: 100, openingMinor: 0, openingDate: "2026-10-01", targetDate: null, entries: [] }; let data = reduce(types.emptyMomentum(), { type: "savings", value: goal });
  assert.throws(() => reduce(data, { type: "entry", goalId: goal.id, value: { id: crypto.randomUUID(), allocationRef: "future", date: "2026-10-04", type: "contribution", amountMinor: 1, note: "" } }), /current or past/);
  data.savings.push(goal); assert.throws(() => validation.validateCollections(data), /unique record/);
});
test("failed reads never return a fake empty account; failed saves preserve saved records for an exact retry", async () => {
  const app = fixture(), bundle = await load(app), request = command(bundle.record.revision, { type: "preferences", value: { ...bundle.record.data.preferences, thoughts: false } });
  app.failNext(); const result = await app.actions.mutateMomentum(request); assert.equal(result.success, false); assert.equal(app.rows.momentumState[0].data.preferences.thoughts, true);
  assert.equal((await app.actions.mutateMomentum(request)).success, true); app.failNext(); await assert.rejects(() => load(app), /offline/);
});
test("rescheduling previews local-time overlaps across overnight and DST dates, keeping unknown end times explicit", () => {
  const ref = { kind: "workout", id: "moving" }, base = { status: "planned", date: "2026-10-25", title: "Meeting", key: "event:meeting", ref: { kind: "event", id: "meeting", week: "2026-WK43" } };
  const activities = [{ ...base, timing: { start: "00:15", duration: 30, overnight: false } }, { ...base, key: "event:other", title: "Check duration", timing: { start: "00:30", duration: null, overnight: false } }];
  const preview = scheduling.scheduleConflicts(activities, ref, "2026-10-24", { start: "23:45", duration: 60, overnight: true });
  assert.equal(preview.overlaps.length, 1); assert.equal(preview.uncertain.length, 1); assert.equal(scheduling.scheduleConflicts(activities, ref, "2026-10-25", { start: null, duration: null, overnight: false }).untimed, true);
});
test("changing a personally confirmed criterion requires fresh confirmation and leaves linked sources intact", () => {
  let journey = content.journeyDraft("reading", () => crypto.randomUUID()), data = reduce(types.emptyMomentum(), { type: "journey", value: journey });
  data = reduce(data, { type: "chapter", journeyId: journey.id, chapterId: journey.chapters[0].id, confirm: true });
  journey = structuredClone(data.journeys[0]); journey.chapters[0].criterion = "A new outcome I chose";
  data = reduce(data, { type: "journey", value: journey }); assert.equal(data.journeys[0].chapters[0].confirmedAt, null);
});
