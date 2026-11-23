// The storybook's book (#565): the boards, the two page sides, the cover leaf, and the code motion that opens it and
// turns its pages. Every motion uses live elements (no cloned copies) and ends with each side holding only its new
// page. Reduced motion: every flip is a crossfade and no element is rotated.
import { el } from '../holo-card/holo-card-faces';
import { STORYBOOK } from './constants';
import { STORYBOOK_COPY } from './copy';

export type BookDom = ReturnType<typeof bookDom>;

/** The book: two sides on the boards, the cover over them with its painted front and the endpaper inside. */
export function bookDom() {
  const book = el('div', 'storybook-book');
  const sides = [el('div', 'storybook-side storybook-left'), el('div', 'storybook-side storybook-right')];
  const cover = el('div', 'storybook-cover');
  const front = el('button', 'storybook-cover-front');
  front.type = 'button';
  front.setAttribute('aria-label', STORYBOOK_COPY.open);
  const titles = el('span', 'storybook-cover-titles');
  titles.append(el('span', 'storybook-cover-title', STORYBOOK_COPY.coverTitle));
  front.append(titles);
  cover.append(front, el('div', 'storybook-cover-back'));
  book.append(...sides, cover);
  return { book, sides, cover, front };
}

const ARROW_PATH = { prev: 'M15 5l-7 7 7 7', next: 'M9 5l7 7-7 7' };

/** A round wood arrow under the book. */
export function arrow(side: 'prev' | 'next'): HTMLButtonElement {
  const button = el('button', `storybook-arrow storybook-${side}`);
  button.type = 'button';
  button.setAttribute('aria-label', STORYBOOK_COPY[side]);
  button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ARROW_PATH[side]}"/></svg>`;
  return button;
}

/** Plays one animation and resolves when it ends or is cancelled. With no animation API it resolves at once. */
const running = new Set<Animation>();

function play(target: HTMLElement, frames: Keyframe[], duration: number, direction: PlaybackDirection = 'normal'): Promise<void> {
  if (typeof target.animate !== 'function') return Promise.resolve();
  const run = target.animate(frames, { duration, easing: STORYBOOK.easing, direction, fill: 'both' });
  running.add(run);
  return run.finished.then(() => { run.cancel(); }, () => undefined).finally(() => running.delete(run));
}

/** Jumps every book motion still playing to its end (a close mid-flip), so each lands and cleans up. The cards' own
 *  endless foil animations are not the book's and are left alone. */
export function finishMotion(): void {
  for (const run of [...running]) run.finish();
}

const fade = (from: number, to: number): Keyframe[] => [{ opacity: from }, { opacity: to }];
/** Visible until `at` of the run, then gone: a page the leaf has covered. */
const goneAt = (at: number): Keyframe[] => [{ opacity: 1 }, { opacity: 1, offset: at }, { opacity: 0, offset: at }, { opacity: 0 }];
/** Hidden until `at`, then fades in: the first page once the cover has landed on its other side. */
const inAt = (at: number): Keyframe[] => [{ opacity: 0 }, { opacity: 0, offset: at }, { opacity: 1 }];

/** The cover swinging open (`normal`) or shut (`reverse`) over the first spread. On a desktop the closed book sits
 *  centred, so it also slides by half a page as it opens. */
export function swingCover(ui: BookDom, spread: boolean, reduced: boolean, direction: PlaybackDirection): Promise<void> {
  if (reduced) return play(ui.cover, fade(1, 0), STORYBOOK.fadeMs, direction);
  const half = STORYBOOK.halfTurn, ms = STORYBOOK.openMs;
  const turn: Keyframe[] = spread ? [{ transform: 'rotateY(0deg)' }, { transform: `rotateY(${-half}deg)` }]
    : [{ transform: 'rotateY(0deg)', opacity: 1 }, { opacity: 1, offset: STORYBOOK.leafFadeAt }, { transform: `rotateY(${-half}deg)`, opacity: 0 }];
  const runs = [play(ui.cover, turn, ms, direction)];
  if (spread) {
    runs.push(play(ui.book, [{ translate: 'var(--sb-closed-shift) 0' }, { translate: '0 0' }], ms, direction));
    runs.push(play(ui.sides[0]!, inAt(STORYBOOK.leafFadeAt), ms, direction)); // the left board and page, over the endpaper
  }
  return Promise.all(runs).then(() => undefined);
}

function leaf(page: HTMLElement, origin: 'left' | 'right'): HTMLElement {
  const wrap = el('div', 'storybook-leaf');
  wrap.style.transformOrigin = `${origin} center`;
  const front = el('div', 'storybook-leaf-face');
  front.append(page, el('span', 'storybook-leaf-shade'));
  wrap.append(front, el('div', 'storybook-leaf-face storybook-leaf-back'));
  return wrap;
}

/** One turn. `old` and `fresh` are the pages in view before and after, left to right (null: no page there). */
export async function turnPages(sides: HTMLElement[], dir: 1 | -1, old: (HTMLElement | null)[], fresh: (HTMLElement | null)[], reduced: boolean): Promise<void> {
  const singlePage = old.length === STORYBOOK.perViewPhone;
  const ms = singlePage ? STORYBOOK.phoneTurnMs : reduced ? STORYBOOK.fadeMs : STORYBOOK.turnMs;
  const half = STORYBOOK.halfTurn, runs: Promise<void>[] = [];
  const over = (side: number, page: HTMLElement | null, frames: Keyframe[]) => {
    if (!page) return;
    page.classList.add('storybook-over');
    sides[side]!.append(page);
    runs.push(play(page, frames, ms));
  };
  fresh.forEach((page, side) => sides[side]!.replaceChildren(...(page ? [page] : [])));
  if (reduced || singlePage) old.forEach((page, side) => over(side, page, fade(1, 0)));
  else {
    const [from, under] = dir > 0 ? [1, 0] : [0, 1];
    over(under, old[under]!, goneAt(STORYBOOK.coverAt));
    const turning = old[from];
    if (turning) {
      const flap = leaf(turning, dir > 0 ? 'left' : 'right');
      sides[from]!.append(flap);
      runs.push(play(flap, [{ transform: 'rotateY(0deg)', opacity: 1 }, { opacity: 1, offset: STORYBOOK.leafFadeAt }, { transform: `rotateY(${dir > 0 ? -half : half}deg)`, opacity: 0 }], ms));
    }
  }
  await Promise.all(runs);
  for (const page of [...old, ...fresh]) page?.classList.remove('storybook-over');
  fresh.forEach((page, side) => sides[side]!.replaceChildren(...(page ? [page] : [])));
}
