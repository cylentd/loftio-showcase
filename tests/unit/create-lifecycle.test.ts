import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLifecycle } from '../../src/residents/create-lifecycle.ts';

// The driver owns the timers for the Create panel's lifecycle. Timers are fake; the tick is the only clock.
const HOLD_MS = 320;
const ARM_MS = 600;

function driver(t: { mock: { timers: { enable(options: { apis: ['setTimeout'] }): void } } }) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const log: string[] = [];
  const life = createLifecycle({ holdMs: () => HOLD_MS, armMs: ARM_MS, onArmed: () => log.push('armed') });
  const hold = (kind: 'pick' | 'roll' | 'forMe' = 'pick', name = kind as string) =>
    life.hold(kind, () => log.push('run ' + name), () => log.push('release ' + name));
  return { life, log, hold };
}

test('a hold runs once after its delay, then releases and returns to choosing', (t) => {
  const { life, log, hold } = driver(t);
  assert.equal(hold(), true);
  t.mock.timers.tick(HOLD_MS - 1);
  assert.deepEqual(log, []);
  t.mock.timers.tick(1);
  assert.deepEqual(log, ['release pick', 'run pick']);
  assert.equal(life.state.kind, 'choosing');
});

test('a second hold while one is running is refused and never runs', (t) => {
  const { log, hold } = driver(t);
  hold('pick', 'first');
  assert.equal(hold('roll', 'second'), false);
  t.mock.timers.tick(HOLD_MS * 3);
  assert.deepEqual(log, ['release first', 'run first']);
});

test('a build starting cancels the running hold: it never runs and releases once', (t) => {
  const { life, log, hold } = driver(t);
  hold();
  life.send({ type: 'busy', generating: true });
  t.mock.timers.tick(HOLD_MS * 3);
  assert.deepEqual(log, ['release pick']);
  assert.equal(life.state.kind, 'creating');
});

test('moving the wizard (show) cancels the running hold', (t) => {
  const { life, log, hold } = driver(t);
  hold('forMe');
  life.send({ type: 'show' });
  t.mock.timers.tick(HOLD_MS * 3);
  assert.deepEqual(log, ['release forMe']);
});

test('a hold can start again once the first was cancelled', (t) => {
  const { life, log, hold } = driver(t);
  hold('pick', 'first');
  life.send({ type: 'show' });
  hold('pick', 'second');
  t.mock.timers.tick(HOLD_MS);
  assert.deepEqual(log, ['release first', 'release second', 'run second']);
});

test('submit arms after the arm delay and reports it once', (t) => {
  const { life, log } = driver(t);
  assert.equal(life.send({ type: 'submit' }), true);
  t.mock.timers.tick(ARM_MS - 1);
  assert.equal(life.state.kind, 'unarmed');
  t.mock.timers.tick(1);
  assert.equal(life.state.kind, 'armed');
  assert.deepEqual(log, ['armed']);
  t.mock.timers.tick(ARM_MS * 3);
  assert.deepEqual(log, ['armed']);
});

test('No cancels the arm timer: it never arms', (t) => {
  const { life, log } = driver(t);
  life.send({ type: 'submit' });
  life.send({ type: 'no' });
  t.mock.timers.tick(ARM_MS * 3);
  assert.deepEqual(log, []);
  assert.equal(life.state.kind, 'choosing');
});

test('a submit after No gets a fresh window, so the first timer cannot arm the second question', (t) => {
  const { life, log } = driver(t);
  life.send({ type: 'submit' });
  t.mock.timers.tick(100);
  life.send({ type: 'no' });
  life.send({ type: 'submit' });
  t.mock.timers.tick(ARM_MS - 100);
  assert.equal(life.state.kind, 'unarmed');
  t.mock.timers.tick(100);
  assert.deepEqual(log, ['armed']);
});

test('a repeated submit while the question is open is refused and keeps its window', (t) => {
  const { life } = driver(t);
  life.send({ type: 'submit' });
  t.mock.timers.tick(ARM_MS - 1);
  assert.equal(life.send({ type: 'submit' }), false);
  t.mock.timers.tick(1);
  assert.equal(life.state.kind, 'armed');
});

test('dispose cancels a running hold', (t) => {
  const { life, log, hold } = driver(t);
  hold();
  life.dispose();
  t.mock.timers.tick(HOLD_MS * 3);
  assert.deepEqual(log, ['release pick']);
});

test('dispose cancels a running arm window', (t) => {
  const { life, log } = driver(t);
  life.send({ type: 'submit' });
  life.dispose();
  t.mock.timers.tick(ARM_MS * 3);
  assert.deepEqual(log, []);
});

test('after dispose every event is refused, a second dispose too', (t) => {
  const { life, hold } = driver(t);
  life.dispose();
  assert.equal(life.state.kind, 'disposed');
  assert.equal(hold(), false);
  assert.equal(life.send({ type: 'submit' }), false);
  assert.equal(life.send({ type: 'dispose' }), false);
});
