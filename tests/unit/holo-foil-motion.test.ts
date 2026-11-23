import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foilOffset, holoVars, idlePoint } from '../../src/holo-card/holo-card-model.ts';

const tune = { tiltMax: 14, shineTravel: 30 };
const idle = { periodS: 10, spanX: 30, spanY: 20, active: 0.5 };

test('the foil offset is +1 at the right edge and -1 at the top edge, fully engaged', () => {
  assert.deepEqual(foilOffset(holoVars(100, 0, 1, tune), tune), { mx: 1, my: -1 });
});

test('the foil offset scales with engagement and is 0 at rest', () => {
  assert.deepEqual(foilOffset(holoVars(75, 50, 0.5, tune), tune), { mx: 0.25, my: 0 });
  assert.deepEqual(foilOffset(holoVars(90, 10, 0, tune), tune), { mx: 0, my: 0 });
});

test('no foil travel reads as no offset, never a division by zero', () => {
  assert.deepEqual(foilOffset(holoVars(100, 0, 1, { tiltMax: 14, shineTravel: 0 }), { tiltMax: 14, shineTravel: 0 }), { mx: 0, my: 0 });
});

test('the idle path starts at the right of its ellipse and passes the bottom a quarter period later', () => {
  assert.deepEqual(idlePoint(0, idle), { px: 80, py: 50, active: 0.5 });
  const quarter = idlePoint(2.5, idle);
  assert.ok(Math.abs(quarter.px - 50) < 1e-9);
  assert.ok(Math.abs(quarter.py - 70) < 1e-9);
});

test('the idle path repeats each period, so the loop has no seam', () => {
  const a = idlePoint(3.3, idle), b = idlePoint(13.3, idle);
  assert.ok(Math.abs(a.px - b.px) < 1e-9);
  assert.ok(Math.abs(a.py - b.py) < 1e-9);
});

test('a tiny time step moves the idle point a tiny distance: the path never jumps', () => {
  const a = idlePoint(4, idle), b = idlePoint(4.016, idle);
  assert.ok(Math.hypot(a.px - b.px, a.py - b.py) < 0.5);
});
