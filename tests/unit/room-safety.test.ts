import test from 'node:test';
import assert from 'node:assert/strict';
import { setRoomLayout } from '../../src/room-layout.ts';
import { floorBody, fitFloor, stepFloor } from '../../src/floor-play-model.ts';

test('desktop: 100px lift still intersects table props; 250px clears the complete painted silhouette', () => {
  const low = Object.assign(floorBody(950, 790, 40), { z: 100 }); fitFloor(low);
  assert.notDeepEqual([low.x, low.y], [950, 790]);
  const high = Object.assign(floorBody(950, 790, 40), { z: 250 }); fitFloor(high);
  assert.deepEqual([high.x, high.y], [950, 790]);
});

test('portrait: 80px lift still intersects lanterns; 200px clears the complete silhouette', () => {
  setRoomLayout('portrait');
  try {
    const low = Object.assign(floorBody(620, 645, 40), { z: 80 }); fitFloor(low);
    assert.notDeepEqual([low.x, low.y], [620, 645]);
    const high = Object.assign(floorBody(620, 645, 40), { z: 200 }); fitFloor(high);
    assert.deepEqual([high.x, high.y], [620, 645]);
  } finally { setRoomLayout('desktop'); }
});

test('a descending resident cannot sleep inside the table and never jumps to an edge', () => {
  const body = Object.assign(floorBody(950, 790, 40), { z: 500, asleep: false });
  let widest = 0;
  for (let frame = 0; frame < 400; frame++) {
    const before = { x: body.x, y: body.y }; stepFloor([body], 16);
    widest = Math.max(widest, Math.hypot(body.x - before.x, body.y - before.y));
  }
  assert.ok(widest > 0 && widest < 4);
  assert.equal(body.asleep, true); assert.equal(body.z, 0);
  assert.ok(body.y >= 841 || body.y <= 694 || body.x <= 695 || body.x >= 1175);
});

test('low resident collision transfers momentum; a high resident passes above the neighbor', () => {
  const moving = Object.assign(floorBody(1300, 850, 40), { vx: 300, asleep: false });
  const resting = floorBody(1370, 850, 40); stepFloor([moving, resting], 16);
  assert.ok(resting.vx > 0); assert.equal(resting.asleep, false);
  const high = Object.assign(floorBody(1300, 850, 40), { vx: 300, z: 300, asleep: false });
  const below = floorBody(1370, 850, 40); stepFloor([high, below], 16);
  assert.equal(below.vx, 0); assert.equal(below.asleep, true);
});
