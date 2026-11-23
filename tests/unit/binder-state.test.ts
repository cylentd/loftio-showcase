// G14 binder state machine: a table of event, from, to, including every refused transition.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextBinder, pageOf, pages, type BinderEvent, type BinderState } from '../../src/binder/binder-model.ts';
import type { BinderCard } from '../../src/binder/binder-cards-model.ts';

const browsing = (page: number): BinderState => ({ kind: 'browsing', page });
const turning = (from: number, to: number): BinderState => ({ kind: 'turning', from, to });
const zoomed = (page: number, id: string): BinderState => ({ kind: 'zoomed', page, id });
const options = (page: number, id: string, busy = false, error?: string): BinderState =>
  error === undefined ? { kind: 'options', page, id, busy } : { kind: 'options', page, id, busy, error };

type Row = [name: string, from: BinderState, event: BinderEvent, to: BinderState];

const TABLE: Row[] = [
  ['turn forward starts a turn', browsing(0), { type: 'turn', dir: 1, pageCount: 3 }, turning(0, 1)],
  ['turn back starts a turn', browsing(2), { type: 'turn', dir: -1, pageCount: 3 }, turning(2, 1)],
  ['turn back at the first page is held', browsing(0), { type: 'turn', dir: -1, pageCount: 3 }, browsing(0)],
  ['turn forward at the last page is held', browsing(2), { type: 'turn', dir: 1, pageCount: 3 }, browsing(2)],
  ['turn while turning is refused', turning(0, 1), { type: 'turn', dir: 1, pageCount: 3 }, turning(0, 1)],
  ['turn while zoomed is refused', zoomed(1, 'a'), { type: 'turn', dir: 1, pageCount: 3 }, zoomed(1, 'a')],
  ['turn in options is refused', options(1, 'a'), { type: 'turn', dir: 1, pageCount: 3 }, options(1, 'a')],
  ['turned lands on the target page', turning(0, 1), { type: 'turned' }, browsing(1)],
  ['turned while browsing is ignored', browsing(1), { type: 'turned' }, browsing(1)],
  ['open zooms a card', browsing(1), { type: 'open', id: 'a' }, zoomed(1, 'a')],
  ['open while turning is refused', turning(0, 1), { type: 'open', id: 'a' }, turning(0, 1)],
  ['open while zoomed is refused', zoomed(1, 'a'), { type: 'open', id: 'b' }, zoomed(1, 'a')],
  ['open in options is refused', options(1, 'a'), { type: 'open', id: 'b' }, options(1, 'a')],
  ['options from browsing opens the sheet', browsing(1), { type: 'options', id: 'a' }, options(1, 'a')],
  ['options from the zoom opens the sheet', zoomed(1, 'a'), { type: 'options', id: 'a' }, options(1, 'a')],
  ['options while turning is refused', turning(0, 1), { type: 'options', id: 'a' }, turning(0, 1)],
  ['options while in options is refused', options(1, 'a'), { type: 'options', id: 'b' }, options(1, 'a')],
  ['act starts the action', options(1, 'a'), { type: 'act' }, options(1, 'a', true)],
  ['act clears an earlier error', options(1, 'a', false, 'full'), { type: 'act' }, options(1, 'a', true)],
  ['act while busy is refused', options(1, 'a', true), { type: 'act' }, options(1, 'a', true)],
  ['act outside options is refused', browsing(1), { type: 'act' }, browsing(1)],
  ['acted ok closes the sheet', options(1, 'a', true), { type: 'acted', ok: true }, browsing(1)],
  ['acted failed keeps the sheet and shows the error', options(1, 'a', true), { type: 'acted', ok: false, error: 'full' }, options(1, 'a', false, 'full')],
  ['acted without an action is ignored', options(1, 'a'), { type: 'acted', ok: true }, options(1, 'a')],
  ['close leaves the zoom', zoomed(1, 'a'), { type: 'close' }, browsing(1)],
  ['close leaves the sheet', options(1, 'a'), { type: 'close' }, browsing(1)],
  ['close while busy is refused', options(1, 'a', true), { type: 'close' }, options(1, 'a', true)],
  ['close while browsing is ignored', browsing(1), { type: 'close' }, browsing(1)],
  ['roster that shrinks clamps the page', browsing(2), { type: 'roster', ids: ['a', 'b', 'c', 'd', 'e'], perPage: 4 }, browsing(1)],
  ['roster that fits changes nothing', browsing(1), { type: 'roster', ids: ['a', 'b', 'c', 'd', 'e'], perPage: 4 }, browsing(1)],
  ['roster honours the minimum pages', browsing(2), { type: 'roster', ids: ['a'], perPage: 4, minPages: 3 }, browsing(2)],
  ['empty roster falls to page 0', browsing(2), { type: 'roster', ids: [], perPage: 4 }, browsing(0)],
  ['roster that drops the zoomed card returns to browsing', zoomed(2, 'z'), { type: 'roster', ids: ['a'], perPage: 4 }, browsing(0)],
  ['roster that keeps the zoomed card keeps the zoom', zoomed(0, 'a'), { type: 'roster', ids: ['a'], perPage: 4 }, zoomed(0, 'a')],
  ['roster that drops the sheet card returns to browsing', options(1, 'z'), { type: 'roster', ids: ['a', 'b', 'c', 'd', 'e'], perPage: 4 }, browsing(1)],
  ['roster that shrinks mid-turn lands the turn on the last page', turning(2, 1), { type: 'roster', ids: ['a'], perPage: 4 }, browsing(0)],
];

for (const [name, from, event, to] of TABLE) {
  test(`nextBinder: ${name}`, () => assert.deepEqual(nextBinder(from, event), to));
}

const card = (id: string, kind: 'original' | 'made'): BinderCard =>
  ({ id, kind, name: id, inLoft: true, art: { normal: `${id}.webp` }, look: null });

test('pages: originals first, then made cards in registry order, perPage to a page', () => {
  const cards = [card('m1', 'made'), card('o1', 'original'), card('m2', 'made'), card('o2', 'original'), card('o3', 'original')];
  const result = pages(cards, 2).map(page => page.map(entry => entry.id));
  assert.deepEqual(result, [['o1', 'o2'], ['o3', 'm1'], ['m2']]);
});

test('pageOf finds the page that holds a card, null when absent', () => {
  const cards = [card('o1', 'original'), card('o2', 'original'), card('m1', 'made')];
  assert.equal(pageOf(cards, 'm1', 2), 1);
  assert.equal(pageOf(cards, 'o1', 2), 0);
  assert.equal(pageOf(cards, 'nope', 2), null);
});
