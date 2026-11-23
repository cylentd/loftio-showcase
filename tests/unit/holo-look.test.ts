import { test } from 'node:test';
import assert from 'node:assert/strict';
import { holoLook } from '../../src/holo-card/holo-card-model.ts';

// The look test never reaches a real visit: every case without ?mode=mock reads as off.
const CASES: [string, string, 'card' | 'compare' | null][] = [
  ['?mode=mock&holocard', 'the card', 'card'],
  ['?mode=mock&holocard&holocompare', 'the compare board', 'compare'],
  ['?holocard', 'nothing without mock mode', null],
  ['?holocard&holocompare', 'nothing without mock mode, board included', null],
  ['?mode=mock', 'nothing without ?holocard', null],
  ['?mode=local&holocard', 'nothing in local mode', null],
  ['', 'nothing on a plain visit', null],
];

for (const [search, what, expected] of CASES) {
  test(`holoLook(${JSON.stringify(search)}) is ${what}`, () => {
    assert.equal(holoLook(search), expected);
  });
}
