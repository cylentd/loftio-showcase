// The book the binder draws (#477): the two page sides on their rings, the nav under them (in thumb reach on a phone),
// swipe to turn, and the pager that runs G14 (binder-model.ts) for turning, the zoom and the options sheet. The panel
// (binder-panel.ts) uses all of it; the storybook page (#565) reuses `onSwipe`.
import { el } from '../holo-card/holo-card-faces';
import { BINDER } from './constants';
import { BINDER_COPY } from './binder-copy';
import { nextBinder, viewCount, viewOfPage, viewPages, type BinderEvent, type BinderState } from './binder-model';
import { playFade, playTurn, snapshot, turnPlan } from './binder-turn';

const ARROW_PATH = { prev: 'M15 5l-7 7 7 7', next: 'M9 5l7 7-7 7' };

function arrow(side: 'prev' | 'next'): HTMLButtonElement {
  const button = el('button', `binder-arrow binder-${side}`);
  button.type = 'button';
  button.setAttribute('aria-label', BINDER_COPY[side]);
  button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ARROW_PATH[side]}"/></svg>`;
  return button;
}

export type BookChrome = ReturnType<typeof bookChrome>;

/** The album: the book with its two page sides and rings, and the nav under it. `title` is left out in the drawer. */
export function bookChrome(title: string | null) {
  const root = el('section', 'binder');
  root.setAttribute('aria-label', BINDER_COPY.title);
  root.tabIndex = -1; // focus lands here when the resident a sheet was open for leaves
  const book = el('div', 'binder-book');
  const sides = [el('div', 'binder-side'), el('div', 'binder-side')];
  book.append(...sides, el('span', 'binder-rings'));
  const prev = arrow('prev'), next = arrow('next');
  const counter = el('p', 'binder-counter');
  counter.setAttribute('aria-live', 'polite');
  const nav = el('nav', 'binder-nav');
  nav.append(prev, counter, next);
  if (title !== null) root.append(el('h1', 'binder-title', title));
  root.append(book, nav);
  return { root, book, sides, prev, next, counter };
}

/** Turns one swipe across the binder into a page turn. Taps fall through to the cards. */
export function onSwipe(target: HTMLElement, turn: (dir: 1 | -1) => void): void {
  let start: { x: number; y: number } | null = null;
  target.addEventListener('pointerdown', event => { start = { x: event.clientX, y: event.clientY }; });
  target.addEventListener('pointerup', event => {
    if (!start) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    start = null;
    if (Math.abs(dx) >= BINDER.swipePx && Math.abs(dx) > Math.abs(dy)) turn(dx < 0 ? 1 : -1);
  });
  target.addEventListener('pointercancel', () => { start = null; });
}

/** The width test the pager reads: one page below it, a spread above. */
export type Layout = { matches: boolean; addEventListener(type: 'change', listener: () => void): void; removeEventListener(type: 'change', listener: () => void): void };

/** Which pages are in view, the G14 state, and turning between views. `setPages` swaps the pages on a roster change. */
export function pager(ui: BookChrome, blank: HTMLElement, layout: Layout, reduced: boolean) {
  let pages: HTMLElement[] = [];
  const perView = () => layout.matches ? BINDER.perViewPhone : BINDER.perViewDesktop;
  let state: BinderState = { kind: 'browsing', page: 0 };
  const send = (event: BinderEvent) => { state = nextBinder(state, event); return state; };
  const view = () => state.kind === 'turning' ? state.to : state.page; // G14: the page the book shows
  const shown = () => viewPages(view(), perView(), pages.length).map(page => page === null ? blank : pages[page]!);
  const show = () => {
    const per = perView();
    ui.root.dataset.view = per > 1 ? 'spread' : 'page';
    ui.sides[1]!.replaceChildren();
    shown().forEach((page, side) => { page.dataset.side = per > 1 ? (side === 0 ? 'left' : 'right') : 'single'; ui.sides[side]!.replaceChildren(page); });
    const visible = viewPages(view(), per, pages.length).filter((page): page is number => page !== null);
    ui.counter.textContent = BINDER_COPY.page(visible[0]! + 1, visible[visible.length - 1]! + 1, pages.length);
    ui.prev.disabled = view() === 0;
    ui.next.disabled = view() === viewCount(pages.length, per) - 1;
  };
  const turn = async (dir: 1 | -1) => {
    const per = perView(), previous = state;
    const before = shown(), old = before.map(snapshot), covers = before.map(snapshot);
    send({ type: 'turn', dir, pageCount: viewCount(pages.length, per) });
    if (state === previous) return; // G14 refuses a turn while zoomed, in the sheet or mid-turn
    show();
    if (reduced) await playFade(ui.sides, old);
    else {
      const plan = turnPlan(dir, per, old, shown().map(snapshot));
      await playTurn(ui.sides, plan, plan.coverSide === null ? null : covers[plan.coverSide]!);
    }
    send({ type: 'turned' });
  };
  /** The layout switched between one page and a spread: keep the first page that was in view. */
  const relayout = () => {
    const was = layout.matches ? BINDER.perViewDesktop : BINDER.perViewPhone;
    const first = viewPages(view(), was, pages.length)[0] ?? 0;
    state = state.kind === 'turning' ? { kind: 'browsing', page: viewOfPage(first, perView()) } : { ...state, page: viewOfPage(first, perView()) };
    show();
  };
  layout.addEventListener('change', relayout);
  /** New pages after a roster change; `ids` are the cards in order, so G14 can clamp the page and drop a gone resident. */
  const setPages = (next: HTMLElement[], ids: readonly string[]) => {
    pages = next;
    send({ type: 'roster', ids, perPage: BINDER.perPage * perView(), minPages: Math.ceil(BINDER.minPages / perView()) });
    show();
  };
  return { show, turn, send, setPages, state: () => state, dispose: () => layout.removeEventListener('change', relayout) };
}

/** Wires the arrows, a swipe and the arrow keys (on `keys`) to the pager. Returns the teardown for the key listener. */
export function bindTurns(ui: BookChrome, turn: (dir: 1 | -1) => Promise<void>, keys: EventTarget): () => void {
  ui.prev.addEventListener('click', () => void turn(-1));
  ui.next.addEventListener('click', () => void turn(1));
  onSwipe(ui.book, dir => void turn(dir));
  const onKey = (event: Event) => {
    const key = (event as KeyboardEvent).key;
    if (key === 'ArrowRight') void turn(1);
    if (key === 'ArrowLeft') void turn(-1);
  };
  keys.addEventListener('keydown', onKey);
  return () => keys.removeEventListener('keydown', onKey);
}
