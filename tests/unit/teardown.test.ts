import assert from 'node:assert/strict';
import { test } from 'node:test';
import { onPageExit, roomTeardown, teardownAll } from '../../src/teardown.ts';

// Unit layer: the hook runner the room, the residents panel and the builder page share. No DOM: the page event is
// an EventTarget the test owns.
const counter = () => { const calls: string[] = []; return { calls, hook: (name: string) => () => { calls.push(name); } }; };

test('teardownAll runs each hook once, in order, and ignores a second call', () => {
  const { calls, hook } = counter();
  const run = teardownAll([hook('a'), hook('b')]);
  run();
  run();
  assert.deepEqual(calls, ['a', 'b']);
});

test('teardownAll skips a missing hook', () => {
  const { calls, hook } = counter();
  teardownAll([undefined, hook('a'), undefined])();
  assert.deepEqual(calls, ['a']);
});

test('a hook that throws is reported and does not stop the hooks after it', (t) => {
  const logged = t.mock.method(console, 'error', () => {});
  const { calls, hook } = counter();
  const boom = () => { throw new Error('boom'); };
  teardownAll([hook('a'), boom, hook('b')])();
  assert.deepEqual(calls, ['a', 'b']);
  assert.equal(logged.mock.callCount(), 1);
});

test('roomTeardown runs every feature hook once, tolerates a feature with none, then the room hooks', () => {
  const { calls, hook } = counter();
  const installed = [{ ready() {}, teardown: hook('focus') }, undefined, { ready() {} }, { teardown: hook('play') }];
  const run = roomTeardown(installed, hook('residents'));
  run();
  run();
  assert.deepEqual(calls, ['focus', 'play', 'residents']);
});

test('roomTeardown with no features and no room hooks does nothing', () => {
  assert.doesNotThrow(() => roomTeardown([])());
});

test('onPageExit tears down when the page is really leaving', () => {
  const { calls, hook } = counter();
  const page = new EventTarget();
  onPageExit(hook('exit'), page);
  page.dispatchEvent(Object.assign(new Event('pagehide'), { persisted: false }));
  assert.deepEqual(calls, ['exit']);
});

test('onPageExit keeps everything alive when the page goes into the back-forward cache', () => {
  const { calls, hook } = counter();
  const page = new EventTarget();
  onPageExit(hook('exit'), page);
  page.dispatchEvent(Object.assign(new Event('pagehide'), { persisted: true }));
  assert.deepEqual(calls, []);
});
