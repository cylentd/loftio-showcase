// Who a card shows (#477 U3). The card draws a `CardSubject`, not a named resident, so the binder can pass any resident,
// original or made. The look is pluggable: a holo type, or null for a plain card with no foil type. `originalSubject`
// builds the six originals' subjects from their facts; a made resident's subject comes from its record (U4).
import { NAMES } from '../copy';
import { ORIGINAL_NAMES } from '../loadout/loadout-copy';
import { ORIGINAL_LOADOUTS, SYNERGIES, type KnownSpecial, type Synergy, type Trait } from '../loadout/loadout-data';
import type { ExpressionOffset } from './constants';
import { cardArt, cardElement, cardScene, type HoloElement, type OriginalId } from './holo-card-model';
import { ALT_ART_IMAGES, SCENE_ART } from './holo-card-scenes';
import { residentArt } from './holo-card-residents';
import { holoFor } from './holo-pool-model';
import type { HoloId } from './holo-type-data';

/** A holo type the card can wear. */
export type HoloLookId = HoloId;

/** No look: a plain card. */
export const PLAIN_LOOK = null;

/** The moves printed on the card: the trait line, the ability (synergy) and the special, each by icon id. */
export type CardMoves = {
  trait: Trait; synergy: Synergy; special: KnownSpecial;
  synergyName: string; specialName: string;
  /** The foil's burst kind, from the synergy. */
  foil: string;
};

export type CardSubject = {
  name: string;
  idle: string;
  expression?: string;
  /** Where the expression sits against the idle pose. */
  offset?: ExpressionOffset;
  /** The alt painting; present means this is the alt card. */
  alt?: string;
  element: HoloElement;
  look: HoloLookId | null;
  moves?: CardMoves;
  /** A painted scene that replaces the drawn burst. */
  scene?: { id: string; image: string };
  /** A made resident: its idle is a cutout sprite, framed to fit the art slot instead of cropped to a painting's ratio. */
  made?: true;
};

/** The foil burst a subject without moves wears. */
export const DEFAULT_FOIL = 'burst';

function movesOf(id: OriginalId): CardMoves {
  const loadout = ORIGINAL_LOADOUTS[id]!, themed = ORIGINAL_NAMES[id]!;
  const foil = SYNERGIES.find(entry => entry.id === loadout.synergy)?.kind ?? DEFAULT_FOIL;
  return { trait: loadout.trait, synergy: loadout.synergy, special: loadout.special, synergyName: themed.synergy, specialName: themed.special, foil };
}

/**
 * An original's card. `variant` picks the alt painting outright (the compare board, the binder); left out, `?holoart=`
 * decides in mock mode. The look follows the alt, as `holoFor` says: Classic on the normal card, the seeded one on an alt.
 */
export function originalSubject(id: OriginalId, search: string, variant?: string | null): CardSubject {
  const chosen = variant === undefined ? cardArt(id, search) : variant;
  const art = residentArt(id);
  const sceneId = cardScene(id, search);
  const alt = chosen ? ALT_ART_IMAGES[`${id}-${chosen}`] : undefined;
  return {
    name: NAMES[id]!, idle: art.idle, expression: art.expression, offset: art.offset,
    ...(alt === undefined ? {} : { alt }),
    element: cardElement(id, search),
    look: holoFor(id, alt === undefined ? null : chosen!),
    moves: movesOf(id),
    ...(sceneId === null ? {} : { scene: { id: sceneId, image: SCENE_ART[sceneId] } }),
  };
}
