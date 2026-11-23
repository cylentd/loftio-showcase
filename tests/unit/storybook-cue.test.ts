import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coverCue, type StorybookState } from '../../src/storybook/state.ts';

// Unit layer (#565, S3): the closed book's open cue runs only while G15 is `opening` and the page still shows the
// closed book (before the first tap, ArrowRight or swipe). Reduced motion holds the cover ajar instead of looping.

const opening: StorybookState = { kind: 'opening' };
const cases: [string, StorybookState, string | undefined, boolean, ReturnType<typeof coverCue>][] = [
  ['closed book shown, motion on', opening, 'closed', false, 'peek'],
  ['closed book shown, reduced motion', opening, 'closed', true, 'ajar'],
  ['cover swinging', opening, 'opening', false, null],
  ['cover swinging, reduced motion', opening, 'opening', true, null],
  ['G15 closed (page not up)', { kind: 'closed' }, 'closed', false, null],
  ['open', { kind: 'open', spread: 0, zoom: null }, 'open', false, null],
  ['turning', { kind: 'turning', from: 0, to: 1 }, 'turning', false, null],
  ['closing', { kind: 'closing', spread: 0 }, 'closing', false, null],
];

for (const [name, state, shown, reduced, want] of cases) {
  test(`cover cue: ${name}`, () => {
    assert.equal(coverCue(state, shown, reduced), want);
  });
}
