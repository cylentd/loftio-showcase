// One card button and its pop-out (look test, round 2), shared by the single card (`?holocard`) and the compare board
// (`&holocompare`). Tap it: it lifts, flies to the centre turning once so its back shows mid-flight, and settles. Tap
// the big card to turn it over; the backdrop or Escape puts it back. Motion is transform-only, and pointer tilt is
// held while a flight or flip runs.
import { dismissOnBackdrop } from '../world-ui';
import { HOLO_POP, HOLO_TAP_SLOP } from './constants';
import { HOLO_COPY } from './holo-card-copy';
import { cardFaces, el } from './holo-card-faces';
import { flightKeyframes } from './holo-card-model';
import type { CardSubject } from './holo-card-subject';
import { HoloTilt } from './holo-tilt';

const HALF = 2;

const remPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize);
const centre = (box: DOMRect) => ({ x: box.left + box.width / HALF, y: box.top + box.height / HALF });
const settle = (animation: Animation) => animation.finished.then(() => undefined, () => undefined);

/** A click that is a tap: a keyboard click, or a pointer that did not travel (a touch drag tilts, it does not tap). */
export function tapGuard(target: HTMLElement): (event: MouseEvent) => boolean {
  let down = { x: 0, y: 0 };
  target.addEventListener('pointerdown', event => { down = { x: event.clientX, y: event.clientY }; });
  return event => event.detail === 0 || Math.hypot(event.clientX - down.x, event.clientY - down.y) <= HOLO_TAP_SLOP;
}

/** A card button for `subject`; `sign` is the back's painted grove sign. */
export function cardButton(subject: CardSubject, className: string, label: string, sign: string, reduced: boolean) {
  const button = el('button', className);
  button.type = 'button';
  button.setAttribute('aria-label', label);
  const faces = cardFaces(subject, sign, reduced);
  button.append(faces.tilt);
  return { button, ...faces };
}

/** The flight from the small card's box to the big card's place (a fade under reduced motion). */
export async function flyIn(card: HTMLElement, from: DOMRect, reduced: boolean): Promise<void> {
  if (reduced) { await settle(card.animate([{ opacity: 0 }, { opacity: 1 }], { duration: HOLO_POP.fadeMs })); return; }
  const to = card.getBoundingClientRect(), a = centre(from), b = centre(to);
  const frames = flightKeyframes(a.x - b.x, a.y - b.y, from.width / to.width, HOLO_POP.liftRem * remPx(), HOLO_POP);
  await settle(card.animate(frames, { duration: HOLO_POP.flyMs, easing: HOLO_POP.easing }));
}

/** The big card in its dialog: the flight in, the flip, and closing back to the card in the room. */
export function poppedCard(subject: CardSubject, small: HTMLButtonElement, smallTilt: () => Pick<HoloTilt, 'rest'> | undefined, reduced: boolean, sign: string) {
  const name = subject.name;
  const dialog = el('dialog', 'holo-dialog');
  dialog.setAttribute('aria-label', HOLO_COPY.dialog(name));
  const big = cardButton(subject, 'holo-card holo-card-big', HOLO_COPY.flip(name), sign, reduced);
  big.button.autofocus = true;
  dialog.append(big.button);
  dismissOnBackdrop(dialog);
  const tilt = new HoloTilt(big.button, big.tilt, reduced);
  let flipped = false, busy = false;
  const showFace = (back: boolean) => { flipped = back; big.flipper.style.transform = back ? `rotateY(${HOLO_POP.halfTurn}deg)` : ''; };
  const fade = (to: number) => settle(big.button.animate([{ opacity: 1 - to }, { opacity: to }], { duration: HOLO_POP.fadeMs / HALF }));
  /** Runs one motion with the pointer tilt held, so the two never write the card's transform at once. */
  const hold = async (motion: () => Promise<void>) => {
    busy = true; tilt.suspend();
    await motion();
    busy = false; tilt.resume();
  };

  const open = () => {
    if (dialog.open) return;
    const from = small.getBoundingClientRect();
    smallTilt()?.rest();
    showFace(false);
    dialog.showModal();
    small.classList.add('is-away');
    void hold(async () => {
      await flyIn(big.button, from, reduced);
      if (dialog.open) big.creature.setLive(true); // the resident says hello once the card has landed, then every few seconds
    });
  };

  const flip = () => {
    if (busy) return;
    void hold(async () => {
      if (reduced) { await fade(0); showFace(!flipped); await fade(1); return; }
      const start = flipped ? HOLO_POP.halfTurn : 0;
      showFace(!flipped); // the end state, under the animation; back to front ends at a full turn, which looks the same as none
      const turn = [{ transform: `rotateY(${start}deg)` }, { transform: `rotateY(${start + HOLO_POP.halfTurn}deg)` }];
      await settle(big.flipper.animate(turn, { duration: HOLO_POP.flipMs, easing: HOLO_POP.easing }));
    });
  };

  const isTap = tapGuard(big.button);
  // A tap on the resident's body greets; anywhere else on the card (the words, the backdrop) turns it over.
  const onBody = (event: MouseEvent) => !flipped && event.target instanceof Element && event.target.closest('.holo-pat') !== null;
  big.button.addEventListener('click', event => {
    if (!isTap(event)) return;
    if (onBody(event)) big.creature.poke(); else flip();
  });
  dialog.addEventListener('close', () => {
    big.creature.setLive(false);
    for (const animation of dialog.getAnimations({ subtree: true })) if (!(animation instanceof CSSAnimation)) animation.cancel();
    showFace(false);
    small.classList.remove('is-away');
    small.focus();
    if (!reduced) small.animate([{ opacity: 0 }, { opacity: 1 }], { duration: HOLO_POP.returnMs, easing: HOLO_POP.easing });
  });
  return { dialog, open, big, tilt, dispose: () => { tilt.dispose(); big.creature.dispose(); dialog.remove(); } };
}
