import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deliveryMotion } from '../../src/residents/delivery-motion.ts';
import { floorPosition, placementPosition, surfaceAt } from '../../src/resident-movement.ts';

const floor = (point: { x: number; y: number }) => ({ x: Math.max(50, Math.min(350, point.x)), y: 400 });
const settle = (box: ReturnType<typeof deliveryMotion>) => { for (let frame = 0; frame < 600; frame++) box.step(1 / 60); };
const surfaces = (point: { x: number; y: number }, anchor = point) => floorPosition(point, surfaceAt(anchor));

test('dropping from above the loft lands on support instead of saving an airborne position', () => {
  const box = deliveryMotion({ x: 700, y: 850 }, (point, anchor) => anchor ? surfaces(point, anchor) : point, placementPosition);
  box.hold(); box.move({ x: 700, y: 0 }, 100);
  assert.equal(box.state().ground.y, 0);
  box.release(500, true, 70);
  assert.ok(box.state().point.y < box.state().ground.y);
  settle(box);
  assert.deepEqual(box.state().point, placementPosition({ x: 700, y: 0 }));
  assert.ok(box.state().ground.y > 0);
});

test('stored airborne placements and reduced-motion drops resolve onto support', () => {
  const box = deliveryMotion({ x: 700, y: 0 }, point => point, placementPosition);
  assert.deepEqual(box.state().point, placementPosition({ x: 700, y: 0 }));
  box.hold(); box.move({ x: 500, y: 850 }, 100); box.release(500, false);
  assert.deepEqual(box.state().point, placementPosition({ x: 500, y: 850 }));
  box.hold(); box.move({ x: 700, y: 0 }, 600); box.release(1000, false);
  assert.deepEqual(box.state().point, placementPosition({ x: 700, y: 0 }));
});

test('dragging a box upstairs settles on the chosen loft floor', () => {
  const box = deliveryMotion({ x: 1000, y: 900 }, surfaces);
  box.hold(); box.move({ x: 700, y: 390 }, 100); box.release(110, true);
  settle(box);
  assert.deepEqual(box.state().point, { x: 700, y: 390 });
});

test('an upstairs fling cannot teleport across the stairwell to another loft', () => {
  const box = deliveryMotion({ x: 800, y: 390 }, surfaces);
  box.hold(); box.move({ x: 805, y: 390 }, 100); box.move({ x: 835, y: 390 }, 120);
  box.release(125, true);
  for (let frame = 0; frame < 600; frame++) {
    box.step(1 / 60);
    assert.equal(surfaceAt(box.state().ground), 'loft-left');
    assert.ok(box.state().ground.x <= 840);
  }
  assert.equal(box.state().phase, 'resting');
});

test('a fling stays on its selected tabletop instead of snapping downstairs', () => {
  const box = deliveryMotion({ x: 460, y: 640 }, surfaces);
  box.hold(); box.move({ x: 470, y: 640 }, 100); box.move({ x: 495, y: 640 }, 120);
  box.release(125, true); settle(box);
  assert.equal(surfaceAt(box.state().ground), 'table');
  assert.equal(box.state().ground.y, 640);
});

test('a delivery falls, bounces, then rests at its floor spot', () => {
  const box = deliveryMotion({ x: 200, y: 400 }, floor);
  box.arrive(true);
  assert.ok(box.state().point.y < 400);
  settle(box);
  assert.deepEqual(box.state().point, { x: 200, y: 400 });
  assert.equal(box.state().phase, 'resting');
  assert.ok(box.state().impacts > 0);
});

test('a fling keeps moving after release and bounces inside the room', () => {
  const box = deliveryMotion({ x: 200, y: 400 }, floor);
  box.hold(); box.move({ x: 220, y: 300 }, 100); box.move({ x: 250, y: 280 }, 120);
  box.release(125, true); box.step(1 / 60);
  assert.ok(box.state().point.x > 250);
  assert.ok(box.state().point.y < 280);
  settle(box);
  assert.equal(box.state().phase, 'resting');
  assert.ok(box.state().point.x >= 50 && box.state().point.x <= 350);
  assert.equal(box.state().point.y, 400);
});

test('a box toss moves in floor depth independently of its airborne height', () => {
  const box = deliveryMotion({ x: 1000, y: 900 }, point => point);
  box.hold(); box.move({ x: 1000, y: 890 }, 100); box.move({ x: 1000, y: 870 }, 120);
  box.release(125, true); box.step(1 / 60);
  assert.ok(box.state().ground.y < 870);
  assert.ok(box.state().point.y < box.state().ground.y);
});

test('hand carrying and a gentle drop never project through loft or furniture bounds', () => {
  const box = deliveryMotion({ x: 500, y: 390 }, (point, anchor) => anchor ? surfaces(point, anchor) : point);
  box.hold(); box.move({ x: 500, y: 500 }, 100);
  assert.deepEqual(box.state().ground, { x: 500, y: 500 });
  box.release(500, false);
  assert.deepEqual(box.state().ground, { x: 500, y: 500 });
  box.hold(); box.move({ x: 500, y: 850 }, 600); box.release(1000, false);
  assert.deepEqual(box.state().point, { x: 500, y: 850 });
});

test('holding still before release does not fling using an old sample', () => {
  const box = deliveryMotion({ x: 200, y: 400 }, floor);
  box.hold(); box.move({ x: 220, y: 400 }, 100); box.move({ x: 250, y: 400 }, 120);
  box.release(500, true); settle(box);
  assert.equal(box.state().point.x, 250);
});

test('Still and reduced motion place immediately without flight or bounce', () => {
  const box = deliveryMotion({ x: 200, y: 400 }, floor);
  box.arrive(false);
  assert.equal(box.state().phase, 'resting');
  box.hold(); box.move({ x: 250, y: 200 }, 100); box.release(110, false);
  assert.deepEqual(box.state().point, { x: 250, y: 400 });
  assert.equal(box.state().impacts, 0);
});

test('cancellation restores the pre-drag resting position', () => {
  const box = deliveryMotion({ x: 200, y: 400 }, floor);
  box.hold(); box.move({ x: 250, y: 200 }, 100); box.cancel();
  assert.deepEqual(box.state().point, { x: 200, y: 400 });
  assert.equal(box.state().phase, 'resting');
});

test('a long paused frame remains bounded and settling stays finite', () => {
  const box = deliveryMotion({ x: 200, y: 400 }, floor);
  box.arrive(true); box.step(1000); settle(box);
  assert.deepEqual(box.state().point, { x: 200, y: 400 });
  assert.equal(box.state().phase, 'resting');
});
