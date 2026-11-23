// Storybook binder look test: the pure rules. Cards into pages of pockets, which pages a view shows, page turns
// clamped at the covers, and the loft mark after an options-sheet action. No DOM, so the unit test runs bare.

import type { BinderCard } from './binder-cards-model';
import type { SheetAction } from './constants';

export type Slot = { readonly kind: 'card'; readonly id: string } | { readonly kind: 'empty' };

/** Cards in order, then empty pockets, `perPage` to a page, never fewer than `minPages` pages. */
export function binderPages(ids: readonly string[], perPage: number, minPages: number): Slot[][] {
  const count = Math.max(minPages, Math.ceil(ids.length / perPage));
  return Array.from({ length: count }, (_, page) => Array.from({ length: perPage }, (_, pocket): Slot => {
    const id = ids[page * perPage + pocket];
    return id === undefined ? { kind: 'empty' } : { kind: 'card', id };
  }));
}

/** How many views (single pages or spreads) the binder turns through. */
export const viewCount = (pageCount: number, perView: number): number => Math.ceil(pageCount / perView);

/** The page indexes one view shows, left to right; null is the blank endpaper after the last page. */
export function viewPages(view: number, perView: number, pageCount: number): (number | null)[] {
  return Array.from({ length: perView }, (_, side) => {
    const page = view * perView + side;
    return page < pageCount ? page : null;
  });
}

/** The view after a turn, held at the first and last. */
export const turnView = (view: number, dir: 1 | -1, count: number): number => Math.min(count - 1, Math.max(0, view + dir));

/** The view that shows `page`: used when the layout switches between one page and a spread. */
export const viewOfPage = (page: number, perView: number): number => Math.floor(page / perView);

/** Cards in pages: stable order, originals first, then made cards in the order given (registry order). */
export function pages(cards: readonly BinderCard[], perPage: number): BinderCard[][] {
  const ordered = [...cards.filter(card => card.kind === 'original'), ...cards.filter(card => card.kind === 'made')];
  return Array.from({ length: Math.ceil(ordered.length / perPage) }, (_, page) => ordered.slice(page * perPage, (page + 1) * perPage));
}

/** The page that holds `id`, or null. */
export function pageOf(cards: readonly BinderCard[], id: string, perPage: number): number | null {
  const page = pages(cards, perPage).findIndex(list => list.some(card => card.id === id));
  return page === -1 ? null : page;
}

// G14, the binder's one lifecycle (STATE-MACHINES.md). A page here is whatever the view turns by: a page on a phone,
// a spread on a desktop.
export type BinderState =
  | { kind: 'browsing'; page: number }
  | { kind: 'turning'; from: number; to: number }
  | { kind: 'zoomed'; page: number; id: string }
  | { kind: 'options'; page: number; id: string; busy: boolean; error?: string };

export type BinderEvent =
  | { type: 'turn'; dir: 1 | -1; pageCount: number }
  | { type: 'turned' }
  | { type: 'open'; id: string }
  | { type: 'options'; id: string }
  | { type: 'act' }
  | { type: 'acted'; ok: boolean; error?: string }
  | { type: 'close' }
  | { type: 'roster'; ids: readonly string[]; perPage: number; minPages?: number };

const clampPage = (page: number, count: number): number => Math.max(0, Math.min(page, count - 1));

function onRoster(state: BinderState, event: Extract<BinderEvent, { type: 'roster' }>): BinderState {
  const count = Math.max(event.minPages ?? 1, Math.ceil(event.ids.length / event.perPage));
  if (state.kind === 'turning') return { kind: 'browsing', page: clampPage(state.to, count) };
  const page = clampPage(state.page, count);
  const gone = (state.kind === 'zoomed' || state.kind === 'options') && !event.ids.includes(state.id);
  if (gone) return { kind: 'browsing', page };
  return page === state.page ? state : { ...state, page };
}

/** The next state. A refused event returns `state` itself. */
export function nextBinder(state: BinderState, event: BinderEvent): BinderState {
  switch (event.type) {
    case 'turn': {
      if (state.kind !== 'browsing') return state;
      const to = clampPage(state.page + event.dir, event.pageCount);
      return to === state.page ? state : { kind: 'turning', from: state.page, to };
    }
    case 'turned': return state.kind === 'turning' ? { kind: 'browsing', page: state.to } : state;
    case 'open': return state.kind === 'browsing' ? { kind: 'zoomed', page: state.page, id: event.id } : state;
    case 'options':
      return state.kind === 'browsing' || state.kind === 'zoomed' ? { kind: 'options', page: state.page, id: event.id, busy: false } : state;
    case 'act': return state.kind === 'options' && !state.busy ? { kind: 'options', page: state.page, id: state.id, busy: true } : state;
    case 'acted': {
      if (state.kind !== 'options' || !state.busy) return state;
      if (event.ok) return { kind: 'browsing', page: state.page };
      const failed: BinderState = { kind: 'options', page: state.page, id: state.id, busy: false };
      return event.error === undefined ? failed : { ...failed, error: event.error };
    }
    case 'close':
      return state.kind === 'zoomed' || (state.kind === 'options' && !state.busy) ? { kind: 'browsing', page: state.page } : state;
    case 'roster': return onRoster(state, event);
  }
}

export type { SheetAction };

/** The options sheet's actions, the loft move first. */
export const sheetActions = (inLoft: boolean): SheetAction[] => [inLoft ? 'home' : 'invite', 'invitation', 'abilities', 'reroll'];

/** Who is in the loft after an action. Only Send home and Invite in move anyone; the old set is never changed. */
export function applyAction(loft: ReadonlySet<string>, id: string, action: SheetAction): ReadonlySet<string> {
  if (action !== 'home' && action !== 'invite') return loft;
  const next = new Set(loft);
  if (action === 'home') next.delete(id); else next.add(id);
  return next;
}
