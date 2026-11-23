// Where a made resident's card art comes from (G4). A view-layer file: `builder/image-source.ts` is the one resolver of a
// stored image to a URL, and the model files may not import it. The URL is the record's own: a webp is its stored url (an
// artifact path online, the mock's own in mock mode), a png is a data URL. Nothing here fetches or draws.
import { imageSource } from '../builder/image-source';
import type { GeneratedImage } from '../builder/records';
import type { FollowUpSlot } from '../builder/follow-up-model';
import type { MadeArt } from './holo-card-made-model';

/** The part of a `SavedCharacter` whose images the card shows; a `SavedCharacter` fits. */
export type ArtRecord = { image: GeneratedImage; expression?: FollowUpSlot; alt?: { slot: FollowUpSlot } };

const readyUrl = (slot: FollowUpSlot | undefined): string | undefined =>
  slot?.status === 'ready' ? imageSource(slot.image) : undefined;

/** The idle always; the expression and the alt only from a ready slot. Feed it, with the record, to `cardSubjectFor`. */
export function cardArtFor(record: ArtRecord): MadeArt {
  const expression = readyUrl(record.expression), alt = readyUrl(record.alt?.slot);
  return {
    idle: imageSource(record.image),
    ...(expression === undefined ? {} : { expression }),
    ...(alt === undefined ? {} : { alt }),
  };
}
