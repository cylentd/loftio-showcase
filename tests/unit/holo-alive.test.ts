// The opened card's generic art motion (look test #565, owner 2026-11-21): drift, mood motes, depth on tilt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOLO_ALIVE } from '../../src/holo-card/constants.ts';
import { ALIVE_PARTS, aliveInitial,coversFrame, depthOffset, driftFrames, moteKind, motePlan, overscanScale } from '../../src/holo-card/holo-alive-model.ts';
import { BOARD_CARDS, sideMood } from '../../src/holo-card/holo-compare-model.ts';

test('each card carries one mood tag: cozy alts fireflies, action alts embers, standard cards dust', () => {
  const moods = Object.fromEntries(BOARD_CARDS.map(card => [card.key, card.mood]));
  assert.deepEqual(moods, { normal: 'dust', cozy: 'firefly', action: 'ember' });
});

test('a big card side takes its mood by key; a made resident\'s alt side gets dust', () => {
  assert.deepEqual(['normal', 'cozy', 'action', 'alt'].map(sideMood), ['dust', 'firefly', 'ember', 'dust']);
});

test('mote kind follows the mood tag, and an unknown tag falls back to dust', () => {
  assert.equal(moteKind('firefly'), 'firefly');
  assert.equal(moteKind('ember'), 'ember');
  assert.equal(moteKind('dust'), 'dust');
  assert.equal(moteKind('glitter'), 'dust');
});

test('the mote plan is sparse, inside the painting, and the same every time for a card', () => {
  const a = motePlan(3, HOLO_ALIVE), b = motePlan(3, HOLO_ALIVE);
  assert.deepEqual(a, b);
  assert.equal(a.length, HOLO_ALIVE.motes);
  assert.ok(HOLO_ALIVE.motes <= 10, 'sparse');
  assert.ok(a.every(mote => mote.x >= 0 && mote.x <= 100 && mote.y >= 0 && mote.y <= 100), 'inside the painting');
  assert.ok(a.every(mote => mote.delayS <= 0), 'negative delay: already mid-flight when it fades in');
  assert.notDeepEqual(motePlan(4, HOLO_ALIVE), a);
});

test('drift: about 3% scale over about 12 s with a gentle pan, easing back on a loop', () => {
  const { from, to } = driftFrames(HOLO_ALIVE);
  assert.deepEqual(from, { x: 0, y: 0, scale: 1 });
  assert.ok(Math.abs(to.scale - 1.03) < 0.005);
  assert.ok(Math.abs(to.x) <= HOLO_ALIVE.driftPan && Math.abs(to.y) <= HOLO_ALIVE.driftPan);
  assert.ok(HOLO_ALIVE.driftMs >= 10000 && HOLO_ALIVE.driftMs <= 14000);
});

test('depth offset runs against the tilt and is clamped at the depth limit', () => {
  const d = HOLO_ALIVE.depth;
  assert.deepEqual(depthOffset(50, 50, 1, d), { x: 0, y: 0 });
  const right = depthOffset(100, 50, 1, d);
  assert.ok(right.x < 0, 'tilt right, the painting shifts left');
  assert.equal(right.x, -d);
  const far = depthOffset(400, -300, 1, d); // a pointer far outside the card
  assert.equal(far.x, -d);
  assert.equal(far.y, d);
  assert.deepEqual(depthOffset(100, 0, 0, d), { x: 0, y: 0 }, 'disengaged: no offset');
});

test('overscan hides every edge at the worst drift pan plus the clamped tilt offset', () => {
  const s = overscanScale(HOLO_ALIVE.driftPan, HOLO_ALIVE.depth, HOLO_ALIVE.margin);
  assert.ok(coversFrame(s, HOLO_ALIVE.driftPan, HOLO_ALIVE.depth));
  assert.ok(!coversFrame(1, HOLO_ALIVE.driftPan, HOLO_ALIVE.depth), 'no overscan shows an edge');
  assert.ok(!coversFrame(s, HOLO_ALIVE.driftPan, HOLO_ALIVE.depth * 3), 'an unclamped offset would show an edge');
  assert.ok(s < 1.1, 'crops little of the painting');
});

test('all three parts are on by default, and reduced motion holds all off', () => {
  assert.deepEqual(ALIVE_PARTS, ['drift', 'motes', 'depth']);
  assert.deepEqual(aliveInitial(false), { drift: true, motes: true, depth: true });
  assert.deepEqual(aliveInitial(true), { drift: false, motes: false, depth: false });
});
