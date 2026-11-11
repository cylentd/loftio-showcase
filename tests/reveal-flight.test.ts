import assert from 'node:assert/strict';
import { test } from 'node:test';
import { frameBox } from '../src/residents/reveal-flight-geometry.ts';

test('desktop contain maps the box to its measured opening-frame bounds', () => {
  const box = frameBox({ x: 0, y: 0, width: 1280, height: 920 }, false);
  assert.deepEqual(box, { x: 478, y: 370, width: 330, height: 346 });
});

test('portrait cover includes the horizontal video crop, not the whole viewport', () => {
  const box = frameBox({ x: 0, y: 227, width: 390, height: 390 }, true);
  assert.ok(Math.abs(box.x - 107.25) < 0.001);
  assert.ok(Math.abs(box.y - 373.25) < 0.001);
  assert.ok(Math.abs(box.width - 178.75) < 0.001);
  assert.ok(Math.abs(box.height - 187.4166666667) < 0.001);
});
