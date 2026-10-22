import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { pgTable, text, boolean, jsonb } from 'drizzle-orm/pg-core';
import * as orm from 'drizzle-orm';
import { loadModule, hookHarness, jsxRuntime, findNode, plain } from './helpers.mjs';
import { fixture, blueprint, events, dates, timing, logic, library, validation } from './gym-fixture.mjs';

const links = loadModule('lib/gym/event-links.ts');
const day = '2026-10-10', zone = 'Europe/Warsaw';
const board = event => [{ id: 'saturday', day: 'Saturday', tasks: [event] }];
const command = (before, data) => ({ week: events.weekKey(day), mutationId: crypto.randomUUID(), before, data });
async function schedule(state) {
  const result = await state.actions.scheduleGymWorkout({ operationId: crypto.randomUUID(), data: blueprint(library.slice(0, 3).map(exercise => exercise.id)), dates: [day], timezone: zone });
  assert.equal(result.success, true);
  return state.rows.gymPlans[0];
}

test('event links persist without changing date, time, notes or completion and survive the plan/session lifecycle', async () => {
  const state = fixture(), plan = await schedule(state);
  const event = { id: crypto.randomUUID(), title: 'Pack gym bag', completed: true, completedAt: '2026-10-10T08:00:00.000Z', category: 'Training prep', notes: 'Keep this note', timing: { start: '09:00', duration: null, overnight: false } };
  const initial = await state.planner.saveEventBoard(command([], board(event)));
  const linked = { ...initial.data[0].tasks[0], workoutLink: { kind: 'plan', id: plan.id } };
  const write = command(initial.data, board(linked));
  const saved = await state.planner.saveEventBoard(write, true, 'alice');
  assert.equal(saved.success, true);
  assert.deepEqual(plain(saved.data), board(linked));
  assert.equal((await state.planner.saveEventBoard(write, true, 'alice')).success, true);
  const started = await state.actions.startGymSession({ id: crypto.randomUUID(), planId: plan.id, data: null, date: day, timezone: zone, logged: false });
  assert.equal(started.success, true);
  assert.equal(links.eventLinksWorkout(linked, { session: started.session }), true);
  assert.deepEqual(plain(state.rows.userEvents[0].data), board(linked));
  state.rows.gymPlans[0].archived = true;
  const edited = await state.planner.saveEventBoard(command(saved.data, board({ ...linked, notes: 'Still editable after the plan is archived' })));
  assert.equal(edited.success, true);
  const unlinked = await state.planner.saveEventBoard(command(edited.data, board({ ...edited.data[0].tasks[0], workoutLink: null })));
  assert.equal(unlinked.success, true);
  assert.equal(unlinked.data[0].tasks[0].completed, true);
});

test('new foreign, archived and missing workout links are rejected before writing', async () => {
  const state = fixture(), own = await schedule(state);
  const foreign = { ...structuredClone(own), id: crypto.randomUUID(), userId: 'bob' };
  const archived = { ...structuredClone(own), id: crypto.randomUUID(), archived: true };
  state.rows.gymPlans.push(foreign, archived);
  for (const id of [foreign.id, archived.id, crypto.randomUUID()]) {
    const result = await state.planner.saveEventBoard(command([], board({ id: crypto.randomUUID(), title: 'Private link', completed: false, workoutLink: { kind: 'plan', id } })));
    assert.equal(result.success, false);
    assert.match(result.message, /^Workout/);
    assert.equal(state.rows.userEvents.length, 0);
  }
  assert.equal(events.eventSchema.safeParse({ id: 'event', title: 'Bad', completed: false, workoutLink: { kind: 'plan', id: 'not-a-workout-id' } }).success, false);
});

test('reusable event and week presets discard links to a particular workout', async () => {
  const state = fixture(), plan = await schedule(state);
  const event = { id: crypto.randomUUID(), title: 'Warm up', completed: true, workoutLink: { kind: 'plan', id: plan.id } };
  assert.equal(events.resetPreset(board(event), id => id)[0].tasks[0].workoutLink, null);
  assert.equal((await state.planner.saveEventPreset({ event })).success, true);
  assert.equal((await state.planner.getEventPresets())[0].workoutLink, null);
});

test('workout history includes completed runs of this routine and excludes other routines and unfinished sessions', () => {
  const data = blueprint(library.slice(0, 3).map(exercise => exercise.id));
  const session = (id, date, patch = {}) => ({ id, planId: null, data: { ...logic.newSession(data, date, zone, false, true), status: 'completed', originalPlan: data, finishedAt: `${date}T12:00:00.000Z`, ...patch } });
  const current = session('current', day), previous = session('previous', '2026-10-03');
  const other = session('other', '2026-10-09', { originalPlan: { ...data, name: 'Different routine' } });
  const unfinished = session('active', '2026-10-08', { status: 'active' });
  assert.deepEqual(plain(links.workoutHistory({ session: current }, [other, previous, unfinished, current])).map(item => item.id), ['current', 'previous']);
});

function boardFixture(items) {
  const harness = hookHarness(), saves = [], details = [];
  const mocks = {
    react: { ...harness.react, useId: () => 'board' }, 'react/jsx-runtime': jsxRuntime,
    '@dnd-kit/core': { DndContext: 'DndContext', DragOverlay: 'DragOverlay', useSensors: (...sensors) => sensors, useSensor: () => ({}), PointerSensor: {}, KeyboardSensor: {}, useDroppable: () => ({ setNodeRef() {}, isOver: false }), pointerWithin: () => [{ id: 'day:' + day }, { id: 'workout-link:plan:workout' }], closestCenter: () => [] },
    '@dnd-kit/sortable': { SortableContext: 'SortableContext', verticalListSortingStrategy: {}, useSortable: () => ({ setNodeRef() {}, attributes: {}, listeners: {} }) }, '@dnd-kit/utilities': { CSS: { Transform: { toString: () => '' } } },
    'framer-motion': { useReducedMotion: () => false, motion: { div: 'motion.div', article: 'motion.article' } }, 'lucide-react': {},
    '@/hooks/use-account-calendar': { useAccountCalendar: () => ({ weekDates: () => [day] }) },
    '@/app/components/ui/card': { Card: 'Card' }, '@/app/components/ui/dropdown-menu': Object.fromEntries(['DropdownMenu', 'DropdownMenuTrigger', 'DropdownMenuContent', 'DropdownMenuItem'].map(key => [key, key])),
    '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') }, '@/lib/events': events, '@/lib/gym/dates': dates, '@/lib/planner-time': timing,
    '../gym/GymUI': { GymButton: 'GymButton' }, './EventCompletionCheckbox': { __esModule: true, default: 'EventCompletionCheckbox' },
  };
  const Board = loadModule('app/(main)/account/events/EventsBoard.tsx', mocks).default;
  const actions = { move: (...args) => { saves.push(['move', ...args]); return Promise.resolve(); }, link: (...args) => { saves.push(['link', ...args]); return Promise.resolve(); }, detail: item => details.push(item.id), complete() {} };
  const render = () => harness.render(() => Board({ items, selected: day, today: day, hour12: false, units: { weight: 'kg', distance: 'km' }, actions }));
  return { render, saves, details };
}

test('dropping an event on a workout creates a link, while cancellation and ordinary moves keep their own behavior', () => {
  const manual = { id: 'event', date: day, title: 'Prepare', completed: false, order: 0, manual: { id: 'event', title: 'Prepare', completed: false } };
  const workout = { id: 'plan:workout', date: day, title: 'Full body', completed: false, order: 1, plan: { id: 'workout', data: blueprint([]) } };
  const f = boardFixture([manual, workout]), context = () => findNode(f.render(), node => node.type === 'DndContext').props;
  context().onDragStart({ active: { id: manual.id } });
  assert.equal(context().collisionDetection({})[0].id, 'workout-link:plan:workout');
  context().onDragOver({ over: { id: 'workout-link:plan:workout' } });
  context().onDragEnd({ over: { id: 'workout-link:plan:workout' } });
  assert.deepEqual(f.saves.map(save => save[0]), ['link']);
  assert.equal(f.saves[0][1].date, day);
  assert.equal(f.saves[0][2].plan.id, workout.plan.id);
  context().onDragStart({ active: { id: manual.id } });
  context().onDragOver({ over: { id: 'workout-link:plan:workout' } });
  context().onDragCancel();
  assert.equal(f.saves.length, 1);
});

test('finished workout cards have a checked checkbox, two exercise names, an ellipsis and a details action', () => {
  const data = blueprint(library.slice(0, 3).map(exercise => exercise.id));
  const item = { id: 'session:done', date: day, title: data.name, completed: true, order: 0, session: { id: 'done', data: { ...logic.newSession(data, day, zone, false, true), status: 'completed' } } };
  const f = boardFixture([item]);
  const dayNode = findNode(f.render(), node => typeof node.type === 'function' && node.type.name === 'Day');
  const cardNode = findNode(dayNode.type(dayNode.props), node => typeof node.type === 'function' && node.type.name === 'EventCard');
  const card = cardNode.type(cardNode.props);
  assert.equal(findNode(card, node => node.type === 'EventCompletionCheckbox').props.checked, true);
  const preview = findNode(card, node => node.type === 'button' && node.props['aria-label']?.startsWith('Open '));
  assert.equal(findNode(preview, node => node.props.children === data.exercises[2].definition.name), undefined);
  assert.ok(findNode(preview, node => node.props.children === '...'));
  preview.props.onClick();
  assert.deepEqual(f.details, [item.id]);
});

test('linked-event lookup uses PostgreSQL JSONB, includes the plan/session links across weeks and isolates owners', async t => {
  const pg = new PGlite();
  t.after(() => pg.close());
  await pg.exec('CREATE TABLE gym_plans(id text primary key,user_id text,archived boolean); CREATE TABLE gym_sessions(id text primary key,user_id text,plan_id text,archived boolean); CREATE TABLE user_events(id text primary key,user_id text,week text,data jsonb);');
  const gymPlans = pgTable('gym_plans', { id: text('id'), userId: text('user_id'), archived: boolean('archived') });
  const gymSessions = pgTable('gym_sessions', { id: text('id'), userId: text('user_id'), planId: text('plan_id'), archived: boolean('archived') });
  const userEvents = pgTable('user_events', { id: text('id'), userId: text('user_id'), week: text('week'), data: jsonb('data') });
  const db = drizzle(pg), planId = crypto.randomUUID(), sessionId = crypto.randomUUID();
  await db.insert(gymPlans).values({ id: planId, userId: 'alice', archived: false });
  await db.insert(gymSessions).values({ id: sessionId, userId: 'alice', planId, archived: false });
  const event = (id, kind, target) => ({ id, title: id, completed: false, workoutLink: { kind, id: target } });
  await db.insert(userEvents).values([
    { id: 'alice-plan', userId: 'alice', week: '2026-WK41', data: board(event('Prep', 'plan', planId)) },
    { id: 'alice-session', userId: 'alice', week: '2026-WK42', data: board(event('Follow up', 'session', sessionId)) },
    { id: 'bob', userId: 'bob', week: '2026-WK41', data: board(event('Bob secret', 'plan', planId)) },
    { id: 'preset', userId: 'alice', week: 'event-presets', data: [event('Never show a preset', 'plan', planId)] },
  ]);
  let owner = 'alice';
  const action = loadModule('lib/actions/workout-events.actions.ts', { 'drizzle-orm': orm, '../db/drizzle': db, '../db/schema': { gymPlans, gymSessions, userEvents }, '../session': { requireUserId: async () => owner }, '../events': events, '../gym/dates': dates });
  for (const reference of [{ kind: 'plan', id: planId }, { kind: 'session', id: sessionId }]) {
    const result = await action.getWorkoutEvents(reference);
    assert.deepEqual(plain(result).map(row => row.event.title), ['Prep', 'Follow up']);
    assert.deepEqual(plain(result).map(row => row.date), ['2026-10-10', '2026-10-17']);
  }
  owner = 'bob';
  await assert.rejects(action.getWorkoutEvents({ kind: 'plan', id: planId }), /no longer available/);
});

function mobileFixture(state) {
  let revision = 0, writes = 0;
  const accountSql = async (parts, ...values) => {
    const query = parts.join('?');
    if (query.startsWith('SELECT fingerprint')) return [];
    if (query.startsWith('SELECT revision')) return [{ revision }];
    if (query.startsWith('SELECT week,data')) return state.rows.userEvents.filter(row => row.userId === values[0] && values[1].includes(row.week));
    if (query.startsWith('SELECT 1')) return [];
    if (query.startsWith('SELECT b1_mobile_save_events')) {
      writes++; revision++;
      for (const patch of JSON.parse(values[4])) {
        const row = state.rows.userEvents.find(row => row.userId === values[0] && row.week === patch.week);
        if (row) row.data = patch.data;
        else state.rows.userEvents.push({ id: crypto.randomUUID(), userId: values[0], week: patch.week, data: patch.data });
      }
      return [{ outcome: 'saved' }];
    }
    throw Error('Unexpected mobile SQL');
  };
  class MobileError extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } }
  const contract = loadModule('lib/mobile/event-contract.ts', { '../events': events, '../gym/validation': validation, '../planner-time': timing });
  const mobile = loadModule('lib/mobile/events.ts', {
    'node:crypto': { createHash },
    '../account/store': { accountSql, accountSettings: async () => ({ preferences: { weekStart: 'monday', timezone: zone } }) },
    '../notifications/store': { afterNotificationSourceChange: async () => {} }, 'next/cache': { revalidateTag() {}, revalidatePath() {} },
    '../events': events, '../gym/dates': dates, '../gym/event-link-store': state.eventLinks,
    '../actions/gym.actions': state.actions, '../actions/planner.actions': state.planner,
    './event-contract': contract, './http': { MobileError },
  }, { structuredClone });
  return { mobile, writes: () => writes, revision: () => revision };
}

test('older mobile clients preserve a saved workout link when editing an event, while presets remove it', async () => {
  const state = fixture(), plan = await schedule(state);
  const event = { id: crypto.randomUUID(), title: 'Pack bag', completed: false, workoutLink: { kind: 'plan', id: plan.id } };
  assert.equal((await state.planner.saveEventBoard(command([], board(event)))).success, true);
  plan.archived = true;
  const f = mobileFixture(state);
  const result = await f.mobile.writeMobileEvents('alice', { operationId: crypto.randomUUID(), revision: 0, data: { kind: 'upsert', anchor: day, sourceDate: day, date: day, event: { id: event.id, title: 'Edited on mobile', completed: false } } });
  const edited = result.board.flatMap(day => day.tasks).find(item => item.id === event.id);
  assert.deepEqual(plain(edited.workoutLink), event.workoutLink);
  const preset = await f.mobile.writeMobileEvents('alice', { operationId: crypto.randomUUID(), revision: f.revision(), data: { kind: 'save-event-preset', anchor: day, event: edited } });
  assert.equal(preset.eventPresets[0].workoutLink, null);
});

test('mobile upserts reject a new foreign workout link before the atomic save', async () => {
  const state = fixture(), plan = await schedule(state);
  plan.userId = 'bob';
  const f = mobileFixture(state);
  await assert.rejects(f.mobile.writeMobileEvents('alice', { operationId: crypto.randomUUID(), revision: 0, data: { kind: 'upsert', anchor: day, sourceDate: null, date: day, event: { id: crypto.randomUUID(), title: 'Bad link', completed: false, workoutLink: { kind: 'plan', id: plan.id } } } }), error => error.status === 409 && error.code === 'conflict');
  assert.equal(f.writes(), 0);
  assert.equal(state.rows.userEvents.length, 0);
});
