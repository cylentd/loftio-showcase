// The two faces of a holographic resident card (look test, round 2). Front, bottom to top: code-drawn backdrop,
// foil, the resident, scrim, words, glare. The foil sits under the resident, so it never covers them. Back: the
// blind-box painting with the Loftio wordmark. Round 12: the front is built from the resident's id (name, loadout,
// element), and the element sits in one of three places the owner compares (`?holoplace=a|b|c`).
import { LOADOUT_COPY } from '../loadout/loadout-copy';
import { abilityIcon } from '../loadout/ability-icon';
import type { AbilityIconName } from '../loadout/ability-icon-data';
import { HOLO_COPY } from './holo-card-copy';
import { HOLO_NO_OFFSET } from './constants';
import { cardPlace, type HoloElement, type Place } from './holo-card-model';
import { DEFAULT_FOIL, type CardSubject } from './holo-card-subject';
import { ELEMENT_GLYPH_PATHS } from './holo-element-glyph-data';
import { foilBands } from './holo-foil-tint-model';
import { holoCreature, type ResidentArt } from './holo-creature';

const SVG = 'http://www.w3.org/2000/svg';

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); node.className = className; node.textContent = text; return node;
}

/** The trait line: the trait's small icon, then its word, engraved in gold. At the right end of the name row
 *  (placements b and c, round 10) or on its own line under the name (placement a, where the element takes the
 *  right end). The line carries one accessible name; its icon and word are presentation. */
function traitLine(trait: AbilityIconName, word: string): HTMLElement {
  const line = el('span', 'holo-trait');
  line.dataset.trait = trait;
  line.setAttribute('role', 'img');
  line.setAttribute('aria-label', HOLO_COPY.trait(word));
  line.append(abilityIcon(trait), el('span', 'holo-trait-word', word));
  return line;
}

/** An element's glyph: an inline SVG in the shared icon family, coloured by the surrounding text. */
function elementGlyph(element: HoloElement): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  for (const [key, value] of [['viewBox', '0 0 24 24'], ['fill', 'none'], ['stroke', 'currentColor'], ['stroke-width', '2'],
    ['stroke-linecap', 'round'], ['stroke-linejoin', 'round'], ['aria-hidden', 'true'], ['class', 'holo-glyph']]) svg.setAttribute(key!, value!);
  const path = document.createElementNS(SVG, 'path'); path.setAttribute('d', ELEMENT_GLYPH_PATHS[element]); svg.append(path);
  return svg;
}

/** The element in its placement: a medallion (a), a gem in the top border (b) or an engraved word on the bottom
 *  border (c). Each carries the element's name as its accessible name; c also shows the word. */
function elementMark(element: HoloElement, place: Place): HTMLElement {
  const word = HOLO_COPY.elements[element];
  const mark = el('span', `holo-element holo-element-${place}`);
  mark.setAttribute('role', 'img');
  mark.setAttribute('aria-label', HOLO_COPY.element(word));
  if (place === 'b') {
    const gem = el('span', 'holo-gem');
    gem.append(elementGlyph(element));
    mark.append(gem);
  } else mark.append(elementGlyph(element));
  if (place === 'c') mark.append(el('span', 'holo-element-word', word));
  return mark;
}

/** One move: its icon on a medallion, its label ("Ability" or "Special") over its name, then its line. `kind`
 *  styles the two apart: the ability is gold, the special berry (round 6). The icon comes from the shared set by
 *  move id, so the card and the Residents drawer draw the same one. */
function ability(kind: 'ability' | 'special', move: AbilityIconName, name: string, label: string, line: string): HTMLElement {
  const row = el('span', 'holo-ability');
  row.dataset.kind = kind;
  const medal = el('span', 'holo-medal');
  medal.append(abilityIcon(move));
  const head = el('span', 'holo-ability-head');
  head.append(el('span', 'holo-ability-kind', label), el('span', 'holo-ability-name', name));
  row.append(medal, head, el('span', 'holo-ability-line', line));
  return row;
}

/** The title row and the words under it: the name, the trait line, the element, and the two moves when the subject has them. */
function nameAndWords(subject: CardSubject, place: Place): { head: HTMLElement; words: HTMLElement; mark: HTMLElement } {
  const { moves } = subject;
  const trait = moves ? traitLine(moves.trait, LOADOUT_COPY.traits[moves.trait].name) : null;
  const head = el('span', 'holo-head');
  const mark = elementMark(subject.element, place);
  if (place === 'a') {
    // The name with the trait engraved under it, the element medallion at the right end of the row.
    const title = el('span', 'holo-title');
    title.append(el('span', 'holo-name', subject.name), ...(trait ? [trait] : []));
    head.append(title, mark);
  } else head.append(el('span', 'holo-name', subject.name), ...(trait ? [trait] : [])); // the title row: the name left, the trait right (round 10)
  const words = el('span', 'holo-words');
  if (moves) words.append(
    ability('ability', moves.synergy, moves.synergyName, HOLO_COPY.ability, LOADOUT_COPY.synergies[moves.synergy].line),
    ability('special', moves.special, moves.specialName, HOLO_COPY.special, LOADOUT_COPY.specials[moves.special].line),
  );
  return { head, words, mark };
}

function front(subject: CardSubject, creature: HTMLElement): HTMLElement {
  const place = cardPlace(location.search);
  const face = el('span', 'holo-face holo-front');
  face.dataset.foil = subject.moves?.foil ?? DEFAULT_FOIL;
  face.dataset.edge = 'gold';
  face.dataset.element = subject.element; // the backdrop's palette (owner, round 12: by element, replacing round 10's by trait)
  face.dataset.place = place;
  const backdrop = el('span', 'holo-backdrop'); // the burst alone: the leaves read muddy beside it (owner, round 8)
  const image = subject.alt ?? subject.scene?.image; // a painting replaces the burst (look test, 2026-11-20)
  if (image) {
    backdrop.dataset.scene = subject.alt ? 'alt' : subject.scene!.id;
    backdrop.style.setProperty('--holo-scene', `url("${image}")`);
  }
  if (subject.alt) face.dataset.art = 'alt'; // the painting holds the resident, so the living cut-out hides (CSS)
  const { head, words, mark } = nameAndWords(subject, place);
  face.append(backdrop, foil('holo-foil'), foil('holo-foil holo-foil-lift'), creature, el('span', 'holo-scrim'), head, words, foil('holo-foil holo-foil-edge'));
  if (place !== 'a') face.append(mark); // b and c sit on the gold border, above its foil
  face.append(glare());
  void tintFrom(face, image ?? subject.idle);
  return face;
}

/** A foil layer: gradients that move with the tilt's custom properties (holo-card.css, holo-types.css). */
const foil = (className: string): HTMLElement => el('span', className);

/** The glare: a soft spot painted at the pointer from the same properties. */
const glare = (): HTMLElement => el('span', 'holo-glare');

/** Pixels the painting is read at for its tint: enough for its colour families, cheap enough to run on mount. */
const TINT_SAMPLE = 48;

/** Tints the face's foil from the painting it shows. Until the image is read, the CSS fallback hues hold. */
async function tintFrom(face: HTMLElement, src: string): Promise<void> {
  const image = new Image();
  image.src = src;
  try { await image.decode(); } catch { return; }
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TINT_SAMPLE;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return;
  context.drawImage(image, 0, 0, TINT_SAMPLE, TINT_SAMPLE);
  foilBands(context.getImageData(0, 0, TINT_SAMPLE, TINT_SAMPLE).data)
    .forEach((colour, index) => face.style.setProperty(`--holo-t${index + 1}`, colour));
}

/** The back: the blind box's front panel (`--art-box-front`, set on the root by world-art.ts) and the painted
 *  grove sign, the same sign the title card hangs (round 3: the flat wordmark did not fit the painted card). */
function back(sign: string): HTMLElement {
  const face = el('span', 'holo-face holo-back');
  face.dataset.edge = 'gold';
  const mark = el('img', 'holo-sign');
  Object.assign(mark, { src: sign, alt: HOLO_COPY.back, draggable: false });
  face.append(el('span', 'holo-back-scrim'), mark, foil('holo-foil holo-foil-edge'), glare());
  return face;
}

/** The subject's two images as the creature draws them; a made resident's are cutouts, framed to fit (G4). */
export const artOf = (subject: CardSubject): ResidentArt =>
  ({ idle: subject.idle, expression: subject.expression, offset: subject.offset ?? HOLO_NO_OFFSET, ...(subject.made ? { fit: 'cutout' as const } : {}) });

/**
 * One card of `subject`: `tilt` carries the pointer variables and the pointer tilt; `flipper` inside it turns between
 * the faces. Tilt sits outside the flip, so a pointer on the right tips the right edge away on either face. A null look
 * leaves `data-holo` off: a plain card. `sign` is the back's painted grove sign.
 */
export function cardFaces(subject: CardSubject, sign: string, reduced: boolean) {
  const tilt = el('span', 'holo-tilt');
  const flipper = el('span', 'holo-flipper');
  if (subject.look !== null) tilt.dataset.holo = subject.look; // the compare board rewrites it per tab
  const creature = holoCreature(artOf(subject), HOLO_COPY.art(subject.name), reduced);
  flipper.append(front(subject, creature.root), back(sign));
  tilt.append(flipper);
  return { tilt, flipper, creature };
}
