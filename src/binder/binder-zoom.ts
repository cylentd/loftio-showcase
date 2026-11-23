// The big card a pocket opens: the holo pop-out from holo-card-pop.ts, plus the resident's other cards in the same
// dialog behind a switch under them. An original has three (Normal, Cozy, Action, #477 U7); a made resident has Normal
// and its ready alt; with one card there is no switch. It opens on the tapped card, and closing goes back to that card,
// so the pocket and the big card agree on which card is in front.
import { addMotes, aliveDialog, aliveOnLand } from '../holo-card/holo-alive';
import { HOLO_COPY } from '../holo-card/holo-card-copy';
import { sideMood } from '../holo-card/holo-compare-model';
import { el } from '../holo-card/holo-card-faces';
import { cardButton, poppedCard } from '../holo-card/holo-card-pop';
import type { CardSubject } from '../holo-card/holo-card-subject';
import { HoloTilt } from '../holo-card/holo-tilt';
import { BINDER_COPY } from './binder-copy';

/** One card the big view can show: its switch key and label, and what it draws. The first is the normal card. */
export type ZoomSide = { key: string; label: string; subject: CardSubject };

/** The switch: it shows one of the big cards and marks its option pressed. Starts on the first. */
export function sideSwitch(cards: readonly { key: string; label: string; card: HTMLElement }[], onSide: (key: string) => void) {
  const group = el('div', 'binder-art-switch');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', BINDER_COPY.art);
  const choose = (key: string) => {
    for (const side of cards) side.card.hidden = side.key !== key;
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.side === key));
    onSide(key);
  };
  const buttons = cards.map(side => {
    const button = el('button', 'binder-art-option', side.label);
    button.type = 'button';
    button.dataset.side = side.key;
    button.addEventListener('click', () => choose(side.key));
    return button;
  });
  group.append(...buttons);
  choose(cards[0]!.key);
  return { group, choose };
}

/** The Normal/Alt switch of a made resident's two cards. */
export function artSwitch(normal: HTMLElement, alt: HTMLElement, onSide: (side: 'normal' | 'alt') => void) {
  return sideSwitch([{ key: 'normal', label: BINDER_COPY.normal, card: normal }, { key: 'alt', label: BINDER_COPY.alt, card: alt }],
    key => onSide(key as 'normal' | 'alt'));
}

/** The big cards of `sides` behind a switch when there are two or more. `start` is the tapped card's side: that card
 *  pops out of the pocket and its option is pressed (unset or unknown: the first). The switch keeps the order of
 *  `sides`. `animate` is the picker's foil animation. */
export function binderZoom(sides: readonly ZoomSide[], small: HTMLButtonElement, smallTilt: () => Pick<HoloTilt, 'rest'> | undefined,
  reduced: boolean, sign: string, animate = false, start?: string) {
  const first = sides.find(side => side.key === start) ?? sides[0], rest = sides.filter(side => side !== first);
  const popped = poppedCard(first!.subject, small, smallTilt, reduced, sign);
  popped.dialog.classList.add('binder-zoom');
  popped.tilt.setIdle(animate);
  // The gallery's art motion (#565, owner 2026-11-22): each painting drifts, carries its side's motes and sits deeper
  // on tilt, once the open flight lands. Reduced motion builds no motes and leaves every part off.
  aliveDialog(popped.dialog, reduced);
  const comeAlive = (front: Element, key: string, seed: number, tilt: HoloTilt) => {
    if (!reduced) tilt.addDepthLayers(addMotes(front, sideMood(key), seed));
  };
  // Seeded by the resident's name, so each resident's motes scatter their own way and a reopen repeats them.
  const seed = [...first!.subject.name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  comeAlive(popped.big.tilt.querySelector('.holo-front')!, first!.key, seed, popped.tilt);
  const open = () => { popped.open(); aliveOnLand(popped.big.button, popped.dialog, reduced); };
  if (rest.length === 0) return { open, dialog: popped.dialog, dispose: popped.dispose };
  const others = rest.map((side, index) => {
    const card = cardButton(side.subject, 'holo-card holo-card-big', `${HOLO_COPY.dialog(side.subject.name)} ${side.label}`, sign, reduced);
    const tilt = new HoloTilt(card.button, card.tilt, reduced);
    tilt.setIdle(animate);
    comeAlive(card.tilt.querySelector('.holo-front')!, side.key, seed + index + 1, tilt);
    return { side, card, tilt };
  });
  const cardOf = (side: ZoomSide) => side === first ? popped.big.button : others.find(other => other.side === side)!.card.button;
  const ui = sideSwitch(sides.map(side => ({ key: side.key, label: side.label, card: cardOf(side) })),
    key => popped.big.creature.setLive(key === first!.key && popped.dialog.open));
  ui.choose(first!.key);
  popped.dialog.append(...others.map(other => other.card.button), ui.group);
  popped.dialog.addEventListener('close', () => ui.choose(first!.key));
  const dispose = () => { for (const other of others) { other.tilt.dispose(); other.card.creature.dispose(); } popped.dispose(); };
  return { open, dialog: popped.dialog, dispose };
}
