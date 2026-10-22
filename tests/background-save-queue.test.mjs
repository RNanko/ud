import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule, plain } from './helpers.mjs';

function fixture() {
  const listeners = new Set();
  const { BackgroundSaveQueue, BackgroundSaveError, getDetachedSaves } = loadModule('lib/background-save-queue.ts', {}, {
    window: { addEventListener: (_name, listener) => listeners.add(listener), removeEventListener: (_name, listener) => listeners.delete(listener) },
  });
  const requests = [];
  const queue = new BackgroundSaveQueue({ revision: 0, items: { a: 'Monday', b: 'Monday' } }, {
    owner: 'alice',
    reduce: (snapshot, move) => ({ ...snapshot, items: { ...snapshot.items, [move.id]: move.date } }),
    prepare: (base, move) => ({ operationId: crypto.randomUUID(), revision: base.revision, move }),
    save: command => new Promise((resolve, reject) => requests.push({ command: plain(command), resolve, reject })),
  });
  const success = (index, revision, items) => requests[index].resolve({ revision, items });
  return { queue, requests, success, listeners, BackgroundSaveError, getDetachedSaves };
}

test('rapid moves remain interactive, save sequentially and do not snap back on an earlier acknowledgement', async () => {
  const f = fixture();
  const first = f.queue.enqueue({ id: 'a', date: 'Tuesday' });
  const input = { id: 'b', date: 'Wednesday' };
  const second = f.queue.enqueue(input);
  input.date = 'Never saved';
  const third = f.queue.enqueue({ id: 'a', date: 'Friday' });
  assert.equal(f.requests.length, 1);
  assert.deepEqual(plain(f.queue.getState().snapshot.items), { a: 'Friday', b: 'Wednesday' });
  assert.equal(f.listeners.size, 1);
  f.success(0, 1, { a: 'Tuesday', b: 'Monday' }); await first;
  assert.equal(f.requests[1].command.revision, 1);
  assert.deepEqual(plain(f.queue.getState().snapshot.items), { a: 'Friday', b: 'Wednesday' });
  f.success(1, 2, { a: 'Tuesday', b: 'Wednesday' }); await second;
  assert.equal(f.requests[2].command.revision, 2);
  f.success(2, 3, { a: 'Friday', b: 'Wednesday' }); await third;
  assert.equal(f.queue.getState().phase, 'idle');
  assert.equal(f.listeners.size, 0);
});

test('lost response pauses later writes and retries the exact operation before draining later intentions', async () => {
  const f = fixture();
  const first = f.queue.enqueue({ id: 'a', date: 'Tuesday' });
  const second = f.queue.enqueue({ id: 'b', date: 'Friday' });
  const rejected = Promise.all([assert.rejects(first, /confirm/), assert.rejects(second, /confirm/)]);
  f.requests[0].reject(Error('Network dropped')); await rejected;
  assert.equal(f.requests.length, 1);
  assert.equal(f.queue.discard(), false);
  assert.equal(f.listeners.size, 1);
  assert.deepEqual(plain(f.queue.getState().snapshot.items), { a: 'Tuesday', b: 'Friday' });
  const retry = f.queue.retry();
  assert.deepEqual(f.requests[1].command, f.requests[0].command);
  f.success(1, 1, { a: 'Tuesday', b: 'Monday' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.requests[2].command.revision, 1);
  f.success(2, 2, { a: 'Tuesday', b: 'Friday' }); await retry;
  assert.equal(f.listeners.size, 0);
});

test('a known conflict shows saved data and needs review instead of silently overwriting another device', async () => {
  const f = fixture();
  const first = f.queue.enqueue({ id: 'a', date: 'Tuesday' });
  const second = f.queue.enqueue({ id: 'b', date: 'Friday' });
  const rejected = Promise.all([assert.rejects(first, /elsewhere/), assert.rejects(second, /elsewhere/)]);
  f.requests[0].reject(new f.BackgroundSaveError('Changed elsewhere', 'conflict', { revision: 9, items: { a: 'Sunday', b: 'Monday' } })); await rejected;
  assert.deepEqual(plain(f.queue.getState().snapshot.items), { a: 'Sunday', b: 'Monday' });
  await assert.rejects(f.queue.retry(), /elsewhere/);
  assert.equal(f.requests.length, 1);
  assert.equal(f.queue.discard(), true);
  const reviewed = f.queue.enqueue({ id: 'b', date: 'Tuesday' });
  assert.equal(f.requests[1].command.revision, 9);
  f.success(1, 10, { a: 'Sunday', b: 'Tuesday' }); await reviewed;
});

test('queued writes continue through a board unmount and refresh protection lasts until every write is acknowledged', async () => {
  const f = fixture(); let updates = 0;
  const unsubscribe = f.queue.subscribe(() => { updates++; });
  const first = f.queue.enqueue({ id: 'a', date: 'Tuesday' });
  const second = f.queue.enqueue({ id: 'b', date: 'Friday' });
  const mountedUpdates = updates;
  unsubscribe();
  const flushed = f.queue.flush();
  f.success(0, 1, { a: 'Tuesday', b: 'Monday' }); await first;
  assert.equal(updates, mountedUpdates);
  assert.equal(f.listeners.size, 1);
  f.success(1, 2, { a: 'Tuesday', b: 'Friday' }); await second; await flushed;
  assert.equal(f.listeners.size, 0);
});

test('a failure after navigation exposes account-scoped recovery instead of losing its retry controls', async () => {
  const f=fixture();
  const unsubscribe=f.queue.subscribe(()=>{});
  const save=f.queue.enqueue({id:'a',date:'Friday'});
  unsubscribe();
  const rejected=assert.rejects(save,/confirm/);
  f.requests[0].reject(Error('Lost response'));await rejected;
  assert.equal(f.getDetachedSaves().length,1);
  assert.equal(f.getDetachedSaves()[0].owner,'alice');
  const retry=f.getDetachedSaves()[0].retry();
  assert.deepEqual(f.requests[1].command,f.requests[0].command);
  f.success(1,1,{a:'Friday',b:'Monday'});await retry;
  assert.equal(f.getDetachedSaves().length,0);
});
