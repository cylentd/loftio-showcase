// The holo zoom (#477 U5, U7; #565): the big card a tapped card opens, in the storybook page and the `?binder` look
// test. It shows that resident's holo card big (the pop-out in holo-card-pop.ts): an original with its Normal, Cozy and
// Action cards behind a switch, a made resident with a Normal/Alt switch only when it has a ready alt. Each card wears
// the picker's holo. `done` fires when the dialog closes, so the caller's state machine leaves its zoom. Game entry
// only: `room.ts` and the showcase never import it.
import type { BinderCard } from '../binder/binder-cards-model';
import { ALT_VARIANT, ORIGINAL_SIDES } from '../binder/constants';
import { BINDER_COPY } from '../binder/binder-copy';
import { lookSeed, type CardZoom, type ZoomLook } from '../binder/binder-panel';
import { tiltOf } from '../binder/binder-pocket';
import { binderZoom, type ZoomSide } from '../binder/binder-zoom';
import { CARD_RESIDENTS, type OriginalId } from './holo-card-model';
import { cardSubjectFor } from './holo-card-made-model';
import { originalSubject, type CardSubject } from './holo-card-subject';

const GROVE_SIGN = 'brand/grove-sign.webp';

const isOriginal = (id: string): id is OriginalId => (CARD_RESIDENTS as readonly string[]).includes(id);

/** The subjects the big card draws: the normal card, the alt card only when the card has a ready alt, and every card
 *  the switch offers (`sides`; an original with an alt has Normal, Cozy and Action). `holo` is the picker's look. */
export function zoomSubjects(card: BinderCard, holo?: ZoomLook['holo']): { normal: CardSubject; alt: CardSubject | null; sides: ZoomSide[] } {
  const hasAlt = card.art.alt !== undefined;
  const dress = (subject: CardSubject, side: string): CardSubject => holo ? { ...subject, look: holo(lookSeed(card.id, side)) } : subject;
  if (card.kind === 'original' && isOriginal(card.id)) {
    const id = card.id;
    const shown = hasAlt ? ORIGINAL_SIDES : ORIGINAL_SIDES.slice(0, 1);
    const sides = shown.map(side => ({ key: side.key, label: BINDER_COPY[side.key], subject: dress(originalSubject(id, '', side.variant), side.key) }));
    return { normal: sides[0]!.subject, alt: hasAlt ? dress(originalSubject(id, '', ALT_VARIANT), 'action') : null, sides };
  }
  const { normal: idle, expression, alt: altArt } = card.art;
  const record = {
    id: card.id, ...(card.element === undefined ? {} : { rumble: { element: card.element } }),
    ...(expression === undefined ? {} : { expression: { status: 'ready' } }),
    ...(altArt === undefined ? {} : { alt: { slot: { status: 'ready' } } }),
  };
  const normal = dress(cardSubjectFor(record, { idle, ...(expression === undefined ? {} : { expression }) }, card.name), 'normal');
  const alt = altArt === undefined ? null : dress(cardSubjectFor(record, { idle, alt: altArt }, card.name), 'alt');
  const sides: ZoomSide[] = [{ key: 'normal', label: BINDER_COPY.normal, subject: normal },
    ...(alt === null ? [] : [{ key: 'alt', label: BINDER_COPY.alt, subject: alt }])];
  return { normal, alt, sides };
}

export type ZoomView = { open(): void; dialog: HTMLDialogElement; dispose(): void };
export type ZoomBuild = (normal: CardSubject, alt: CardSubject | null, small: HTMLButtonElement, reduced: boolean, sign: string,
  sides: readonly ZoomSide[], animate: boolean, start?: string) => ZoomView;

const buildZoom: ZoomBuild = (_normal, _alt, small, reduced, sign, sides, animate, start) =>
  binderZoom(sides, small, () => tiltOf(small), reduced, sign, animate, start);

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** The zoom with the visitor's motion setting read at each open, so a changed setting applies at once. */
export const liveHoloZoom: CardZoom = { open: (card, trigger, done, look) => holoZoom(matchMedia(REDUCED_MOTION).matches).open(card, trigger, done, look) };

/** The zoom for the binder. Each open builds the big card fresh and drops it on close, so no card idles unseen. */
export function holoZoom(reduced: boolean, build: ZoomBuild = buildZoom): CardZoom {
  return {
    open: (card, trigger, done, look) => {
      const { normal, alt, sides } = zoomSubjects(card, look?.holo);
      const view = build(normal, alt, trigger as HTMLButtonElement, reduced, new URL(GROVE_SIGN, document.baseURI).href, sides, look?.animate ?? false, look?.side);
      document.body.append(view.dialog);
      view.dialog.addEventListener('close', () => { done(); view.dispose(); });
      view.open();
    },
  };
}
