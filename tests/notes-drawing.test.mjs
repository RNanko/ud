import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule, plain } from './helpers.mjs';
const drawing = loadModule('lib/notes/drawing.ts');
const stroke = (id, tool = 'pen') => ({ id, tool, color: '#172033', width: 5, points: [{ x: .1, y: .2 }, { x: .4, y: .5 }] });

test('pointer coordinates normalize relative to the paper at different viewport sizes and clamp captured pointers outside it', () => {
  assert.deepEqual(plain(drawing.drawingPoint(160, 270, { left: 10, top: 60, width: 300, height: 420 })), { x: .5, y: .5 });
  assert.deepEqual(plain(drawing.drawingPoint(510, 410, { left: 10, top: 60, width: 1000, height: 700 })), { x: .5, y: .5 });
  assert.deepEqual(plain(drawing.drawingPoint(-20, 900, { left: 10, top: 60, width: 300, height: 210 })), { x: 0, y: 1 });
  for (const rect of [{ left: 0, top: 0, width: 0, height: 700 }, { left: NaN, top: 0, width: 1000, height: 700 }]) assert.equal(drawing.drawingPoint(1, 1, rect), null);
  assert.equal(drawing.drawingPoint(Infinity, 1, { left: 0, top: 0, width: 1000, height: 700 }), null);
});

test('coalesced sampling preserves endpoints, filters noise and invalid coordinates, respects point budget and does not mutate committed points', () => {
  const first = Object.freeze({ x: .1, y: .1 }), points = Object.freeze([first]);
  const tiny = { x: .10001, y: .1 };
  assert.equal(drawing.extendDrawingPoints(points, [tiny], 2000), points);
  assert.deepEqual(plain(drawing.extendDrawingPoints(points, [tiny], 2000, true)), [first, tiny]);
  const next = drawing.extendDrawingPoints(points, [{ x: NaN, y: 0 }, { x: 2, y: 0 }, { x: .2, y: .2 }, { x: .3, y: .3 }, { x: .4, y: .4 }], 3);
  assert.deepEqual(plain(next), [first, { x: .2, y: .2 }, { x: .3, y: .3 }]);
  assert.equal(points.length, 1);
});

test('DPR backing store preserves paper aspect and bounds extreme density/allocation', () => {
  assert.deepEqual(plain(drawing.drawingSurface(500, 2)), { width: 1000, height: 700 });
  assert.deepEqual(plain(drawing.drawingSurface(500, 1)), { width: 500, height: 350 });
  const huge = drawing.drawingSurface(100000, 100);
  assert.equal(huge.width, 4096); assert.ok(Math.abs(huge.height / huge.width - .7) < .001);
  assert.equal(drawing.drawingSurface(NaN, NaN).width, 1);
});

test('undo and redo retain stroke identities and eraser ordering; a new edit replaces the redo branch', () => {
  const ink = stroke('ink'), eraser = stroke('eraser', 'eraser');
  let history = drawing.createDrawingHistory([]);
  history = drawing.commitDrawing(history, [ink]);
  history = drawing.commitDrawing(history, [ink, eraser]);
  const undone = drawing.undoDrawing(history);
  assert.equal(undone.present[0], ink); assert.deepEqual(plain(undone.present).map(s => s.id), ['ink']);
  assert.equal(drawing.redoDrawing(undone).present[1], eraser);
  const branch = drawing.commitDrawing(undone, [ink, stroke('new')]);
  assert.equal(branch.future.length, 0); assert.equal(drawing.redoDrawing(branch), branch);
  assert.deepEqual(plain(history.present).map(s => s.id), ['ink', 'eraser']);
});

test('clear is undoable, unchanged controlled echoes add no history, and history stays bounded', () => {
  let history = drawing.createDrawingHistory([stroke('first')]);
  assert.equal(drawing.commitDrawing(history, plain(history.present)), history);
  const cleared = drawing.commitDrawing(history, []);
  assert.equal(cleared.present.length, 0); assert.equal(drawing.undoDrawing(cleared).present[0].id, 'first');
  for (let index = 0; index < 80; index++) history = drawing.commitDrawing(history, [stroke(String(index))]);
  assert.equal(history.past.length, drawing.DRAWING_HISTORY_LIMIT);
  for (let index = 0; index < 80; index++) history = drawing.undoDrawing(history);
  assert.equal(history.future.length, drawing.DRAWING_HISTORY_LIMIT);
  assert.equal(history.present[0].id, '49');
  assert.equal(drawing.createDrawingHistory([stroke('other-note')]).past.length, 0);
});

test('canvas replay scales logical vectors, renders tap dots and restores pen composition after erasing', () => {
  const calls = [], context = { setTransform(...args) { calls.push(['transform', ...args]); }, clearRect(...args) { calls.push(['clear', ...args]); }, beginPath() {}, moveTo(...args) { calls.push(['move', ...args]); }, lineTo(...args) { calls.push(['line', ...args]); }, arc(...args) { calls.push(['dot', ...args]); }, fill() { calls.push(['fill', this.globalCompositeOperation]); }, stroke() { calls.push(['stroke', this.globalCompositeOperation]); } };
  drawing.renderDrawing(context, [stroke('a'), { ...stroke('erase', 'eraser'), points: [{ x: .5, y: .5 }] }, stroke('b')], 2000, 1400);
  assert.deepEqual(calls[2], ['transform', 2, 0, 0, 2, 0, 0]);
  assert.ok(calls.some(call => call[0] === 'move' && call[1] === 100 && call[2] === 140));
  assert.ok(calls.some(call => call[0] === 'dot' && call[1] === 500 && call[2] === 350));
  assert.ok(calls.some(call => call[0] === 'fill' && call[1] === 'destination-out'));
  assert.equal(context.globalCompositeOperation, 'source-over');
});
