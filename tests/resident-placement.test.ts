import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ARRIVAL, arrivalPlace, destinationGrid, pickDestination } from '../src/residents/placement.ts';

const candidates = [{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 300, y: 100 }];
const round = { x: 100, y: 100 };

test('the first candidate clear of every claim is chosen', () => {
  assert.deepEqual(pickDestination(candidates, [{ x: 100, y: 100 }], round), { x: 200, y: 100 });
});

test('when furniture claims every candidate, the least crowded one is used instead of reporting the room full', () => {
  const claims = [{ x: 100, y: 100 }, { x: 200, y: 130 }, { x: 300, y: 160 }];
  assert.deepEqual(pickDestination(candidates, claims, round), { x: 300, y: 100 });
});

test('no candidates is a programming error, not a capacity message', () => {
  assert.throws(() => pickDestination([], [], round), /candidate/);
});

test('a spot just behind a neighbour is crowded, because the neighbour is drawn over its feet', () => {
  const clearance = { x: 190, y: 240 };
  const behind = { x: 500, y: 800 }; const beside = { x: 700, y: 1000 };
  assert.deepEqual(pickDestination([behind, beside], [{ x: 500, y: 1000 }], clearance), beside);
});

test('a newcomer is not set down shoulder to shoulder with the sprout (QA repro, 2026-11-06)', () => {
  // Desktop door and the sprout's home; the old 100 px circle chose x 1180, half a sprite away.
  const clearance = { x: 190, y: 240 };
  const grid = destinationGrid({ x: 1380, y: 1020 }, { step: 95, columns: 12, rows: [-100, -220, -340] }, point => point);
  const pick = pickDestination(grid, [{ x: 1290, y: 1000 }], clearance);
  assert.ok(Math.abs(pick.x - 1290) >= clearance.x || Math.abs(pick.y - 1000) >= clearance.y, JSON.stringify(pick));
});

test('at the desktop layout, the arrival basket is set down clear of every resident (QA, 2026-11-06)', () => {
  // The originals' desktop homes (cast.ts); the door spot itself sat on Sprout and Chomper.
  const homes = [{ x: 1290, y: 1000 }, { x: 750, y: 965 }, { x: 1010, y: 895 }, { x: 1490, y: 945 }, { x: 650, y: 400 }, { x: 1700, y: 770 }];
  const spot = arrivalPlace(ARRIVAL.entry.desktop, homes, point => point);
  for (const home of homes) {
    const distance = Math.hypot((spot.x - home.x) / ARRIVAL.clearance.x, (spot.y - home.y) / ARRIVAL.clearance.y);
    assert.ok(distance >= 1, `${JSON.stringify(spot)} crowds ${JSON.stringify(home)}`);
  }
});

test('the grid walks away from the door row by row, through the floor projection', () => {
  const grid = destinationGrid({ x: 1000, y: 900 }, { step: 100, columns: 2, rows: [-100, -200] }, point => ({ x: point.x, y: Math.max(750, point.y) }));
  assert.deepEqual(grid, [{ x: 900, y: 800 }, { x: 800, y: 800 }, { x: 900, y: 750 }, { x: 800, y: 750 }]);
});
