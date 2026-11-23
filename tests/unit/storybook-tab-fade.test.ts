import assert from 'node:assert/strict';
import { test } from 'node:test';
import { moreToRight } from '../../src/storybook/tab-fade.ts';

// Unit layer (#565 QA r2): the phone's tab strip fades its right edge only while tabs still sit off to the right.

const cases: [string, number, number, number, boolean][] = [
  ['at the start of a strip wider than its box', 0, 300, 520, true],
  ['part way along', 120, 300, 520, true],
  ['scrolled to the very end', 220, 300, 520, false],
  ['at the end with a sub-pixel scroll position', 219.4, 300, 520, false],
  ['one whole pixel short of the end', 218, 300, 520, true],
  ['a strip that fits its box', 0, 300, 300, false],
  ['not laid out yet', 0, 0, 0, false],
];

for (const [name, left, client, width, expected] of cases) {
  test(`moreToRight: ${name}`, () => assert.equal(moreToRight(left, client, width), expected));
}
