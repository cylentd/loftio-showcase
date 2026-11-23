// The page turn (binder look test, our digital touch). The new view is already in place underneath; a leaf made of
// still copies of the pages turns over it on the spine. Forward, the leaf leaves the right page and lands on the
// left, showing the new left page on its back. On a phone the single page lifts away to the left. Reduced motion:
// the old view fades out over the new one instead.
import { el } from '../holo-card/holo-card-faces';
import { BINDER } from './constants';

/** One turn: which side the leaf sits on, its two faces, the hinge, the angles, and the side a still copy covers. */
export type TurnPlan = {
  leafSide: number;
  coverSide: number | null;
  front: HTMLElement;
  back: HTMLElement;
  origin: 'left' | 'right';
  from: number;
  to: number;
};

/** A still, inert copy of a page, so the turn never moves the live cards. */
export function snapshot(page: HTMLElement): HTMLElement {
  const copy = page.cloneNode(true) as HTMLElement;
  copy.inert = true;
  copy.setAttribute('aria-hidden', 'true');
  copy.classList.add('binder-snap');
  return copy;
}

const paperBack = () => el('div', 'binder-page binder-page-reverse');

/** `old` and `fresh` are still copies of the pages in view before and after, left to right. */
export function turnPlan(dir: 1 | -1, perView: number, old: HTMLElement[], fresh: HTMLElement[]): TurnPlan {
  const half = BINDER.halfTurn;
  if (perView > 1) {
    return dir > 0
      ? { leafSide: 1, coverSide: 0, front: old[1]!, back: fresh[0]!, origin: 'left', from: 0, to: -half }
      : { leafSide: 0, coverSide: 1, front: old[0]!, back: fresh[1]!, origin: 'right', from: 0, to: half };
  }
  return dir > 0
    ? { leafSide: 0, coverSide: null, front: old[0]!, back: paperBack(), origin: 'left', from: 0, to: -half }
    : { leafSide: 0, coverSide: 0, front: fresh[0]!, back: paperBack(), origin: 'left', from: -half, to: 0 };
}

function face(content: HTMLElement, side: 'front' | 'back'): HTMLElement {
  const wrap = el('div', `binder-leaf-face binder-leaf-${side}`);
  wrap.append(content, el('span', 'binder-leaf-shade'));
  return wrap;
}

const done = (animation: Animation) => animation.finished.then(() => undefined, () => undefined);

export async function playTurn(sides: HTMLElement[], plan: TurnPlan, cover: HTMLElement | null): Promise<void> {
  if (cover && plan.coverSide !== null) sides[plan.coverSide]!.append(cover);
  const leaf = el('div', 'binder-leaf');
  leaf.style.transformOrigin = `${plan.origin} center`;
  leaf.append(face(plan.front, 'front'), face(plan.back, 'back'));
  sides[plan.leafSide]!.append(leaf);
  const timing = { duration: BINDER.turnMs, easing: BINDER.turnEasing };
  const shades = [...leaf.querySelectorAll<HTMLElement>('.binder-leaf-shade')]
    .map(shade => done(shade.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], timing)));
  await Promise.all([done(leaf.animate([{ transform: `rotateY(${plan.from}deg)` }, { transform: `rotateY(${plan.to}deg)` }], timing)), ...shades]);
  leaf.remove();
  cover?.remove();
}

/** Reduced motion: still copies of the old pages fade out over the new ones. */
export async function playFade(sides: HTMLElement[], old: HTMLElement[]): Promise<void> {
  const fades = old.map((copy, side) => {
    sides[side]!.append(copy);
    return done(copy.animate([{ opacity: 1 }, { opacity: 0 }], { duration: BINDER.fadeMs, easing: BINDER.turnEasing }));
  });
  await Promise.all(fades);
  for (const copy of old) copy.remove();
}
