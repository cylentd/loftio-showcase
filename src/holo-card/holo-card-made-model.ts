// A made resident's card subject, from its saved record (G4). Pure: the art URLs are resolved by the caller (`cardArtFor`
// in card-art.ts), so this file reads no builder code. The look and the seeded element use the pool's seeding, no second hash.
import { seededRng } from '../loadout/loadout-model';
import type { HoloId } from './holo-type-data';
import { ELEMENTS, type HoloElement } from './holo-card-model';
import { holoFor } from './holo-pool-model';

/**
 * What a made card draws: a `CardSubject` without moves or scene. Declared here, not imported, because `holo-card-subject.ts`
 * is a view to the layer gate; the test assigns it to `CardSubject`, so the two cannot drift apart.
 */
export type MadeSubject = {
  name: string; idle: string; expression?: string; alt?: string; element: HoloElement; look: HoloId | null; made: true;
};

/** A follow-up slot as the card reads it: only `ready` shows. A `FollowUpSlot` fits. */
type SlotLike = { status: string };

/** The part of a `SavedCharacter` the card reads; a `SavedCharacter` fits. */
export type MadeRecord = {
  id: string;
  rumble?: { element?: HoloElement };
  expression?: SlotLike;
  alt?: { slot: SlotLike };
};

/** The art URLs for a record: the idle always, the others only when their slot is ready (`cardArtFor`). */
export type MadeArt = { idle: string; expression?: string; alt?: string };

/** The alt's variant tag: any non-null variant means the alt card (`holoFor` seeds on the id, not the tag). */
const ALT_VARIANT = 'alt';

/** The stored element, else one from the element list seeded by the id (the pool's `seededRng`). */
function elementOf(record: MadeRecord): HoloElement {
  const stored = record.rumble?.element;
  if (stored !== undefined && ELEMENTS.includes(stored)) return stored;
  return ELEMENTS[Math.min(Math.floor(seededRng(record.id)() * ELEMENTS.length), ELEMENTS.length - 1)]!;
}

/** The card a made resident wears. The expression and the alt are in only when their slot is `ready` and the art resolved. */
export function cardSubjectFor(record: MadeRecord, art: MadeArt, name: string): MadeSubject {
  const expression = record.expression?.status === 'ready' ? art.expression : undefined;
  const alt = record.alt?.slot.status === 'ready' ? art.alt : undefined;
  return {
    name, idle: art.idle, made: true,
    ...(expression === undefined ? {} : { expression }),
    ...(alt === undefined ? {} : { alt }),
    element: elementOf(record),
    look: holoFor(record.id, alt === undefined ? null : ALT_VARIANT),
  };
}
