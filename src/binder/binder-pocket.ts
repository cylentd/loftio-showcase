// One pocket in the binder: a resident's holo card in a clear sleeve, its alt card peeking out behind, and the loft
// mark on the corner (filled house in the loft, faint outline away). Tap the card: the zoom, or the sheet where there
// is no zoom. Tap the mark: the options sheet. An empty pocket holds a soft "a new friend goes here" slot.
import { HOLO_COPY } from '../holo-card/holo-card-copy';
import { el } from '../holo-card/holo-card-faces';
import { cardButton, tapGuard } from '../holo-card/holo-card-pop';
import type { CardSubject } from '../holo-card/holo-card-subject';
import { HoloTilt } from '../holo-card/holo-tilt';
import { BINDER_COPY } from './binder-copy';

const SVG = 'http://www.w3.org/2000/svg';
/** A house with a door, on the shared 24-unit icon grid. */
const HOUSE_PATH = 'M3.5 10.6 12 3.5l8.5 7.1V20a1 1 0 0 1-1 1h-4.8v-5.6H9.3V21H4.5a1 1 0 0 1-1-1z';

function houseIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg') as SVGSVGElement;
  for (const [key, value] of [['viewBox', '0 0 24 24'], ['aria-hidden', 'true'], ['class', 'binder-house']]) svg.setAttribute(key!, value!);
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', HOUSE_PATH);
  svg.append(path);
  return svg;
}

export function emptyPocket(): HTMLElement {
  const slot = el('div', 'binder-pocket binder-pocket-empty');
  const sleeve = el('div', 'binder-sleeve');
  sleeve.append(houseIcon(), el('span', 'binder-empty-word', BINDER_COPY.empty));
  slot.append(sleeve);
  return slot;
}

/** The small card in a pocket: its button, whether a click was a tap (not a tilt drag), and its teardown. */
export type CardFace = {
  button: HTMLButtonElement; isTap: (event: MouseEvent) => boolean; tilt?: Pick<HoloTilt, 'setIdle' | 'rest'>;
  /** The layer whose `data-holo` picks the foil (holo-types.css); the binder's picker writes it. */
  look?: HTMLElement;
  dispose: () => void;
};

const TILTS = new WeakMap<HTMLElement, HoloTilt>();
/** The tilt of the small card on `button`, so the zoom can settle it before the big card flies out of it. */
export const tiltOf = (button: HTMLElement): HoloTilt | undefined => TILTS.get(button);

/** The real holo card face. Tests pass a plain one instead, since the card paints with canvas and animation. */
export function holoFace(subject: CardSubject, reduced: boolean): CardFace {
  const sign = new URL('brand/grove-sign.webp', document.baseURI).href;
  const card = cardButton(subject, 'holo-card binder-card', HOLO_COPY.open(subject.name), sign, reduced);
  const tilt = new HoloTilt(card.button, card.tilt, reduced);
  TILTS.set(card.button, tilt);
  return { button: card.button, isTap: tapGuard(card.button), tilt, look: card.tilt, dispose: () => { tilt.dispose(); card.creature.dispose(); } };
}

export type CardPocket = {
  root: HTMLElement;
  face: CardFace;
  mark: HTMLButtonElement;
  setInLoft: (inLoft: boolean) => void;
  dispose: () => void;
};

/** A pocket around `face`. `alt` is the alt painting's URL, peeking behind; left out, no peek. */
export function cardPocket(id: string, name: string, face: CardFace, alt: string | undefined,
  onTap: (trigger: HTMLButtonElement) => void, onMark: (trigger: HTMLButtonElement) => void): CardPocket {
  const root = el('div', 'binder-pocket');
  root.dataset.resident = id;
  const sleeve = el('div', 'binder-sleeve');
  if (alt !== undefined) {
    const peek = el('span', 'binder-peek');
    peek.setAttribute('style', `--binder-peek-art: url("${alt}")`);
    peek.setAttribute('aria-hidden', 'true');
    sleeve.append(peek);
  }
  face.button.addEventListener('click', event => { if (face.isTap(event as MouseEvent)) onTap(face.button); });
  const mark = el('button', 'binder-mark');
  mark.type = 'button';
  mark.append(houseIcon());
  mark.addEventListener('click', () => onMark(mark));
  sleeve.append(face.button);
  root.append(sleeve, mark);
  return {
    root, face, mark,
    setInLoft: inLoft => {
      root.dataset.loft = inLoft ? 'in' : 'away';
      mark.setAttribute('aria-label', BINDER_COPY.mark(name, inLoft));
    },
    dispose: face.dispose,
  };
}
