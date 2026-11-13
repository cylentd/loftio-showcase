import assert from 'node:assert/strict';
import { test } from 'node:test';
import { motionFor } from '../../src/residents/motion.ts';

test('resident anatomy selects presentation without changing navigation', () => {
  assert.equal(motionFor('cloud'), 'float');
  assert.equal(motionFor('little-ghost'), 'float');
  assert.equal(motionFor('moth'), 'float');
  assert.equal(motionFor('bunny'), 'hop');
  assert.equal(motionFor('frog'), 'hop');
  assert.equal(motionFor('cat'), 'walk');
  assert.equal(motionFor('snail'), 'walk');
});
