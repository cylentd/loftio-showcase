// Card facts for the binder (G14, #477): the originals and the kept records, as the one shape the binder draws. Pure:
// the look is injected (the pool's `holoForResident` in the game), so a test places it exactly.
import type { HoloElement } from '../holo-card/holo-element-glyph-data';
import type { MadeArt } from '../holo-card/holo-card-made-model';
import type { HoloId } from '../holo-card/holo-type-data';

/** The alt painting's slot on a record. Only `ready` with an image shows; the others leave the pocket without an alt. */
export type AltSlot = { status: 'none' | 'pending' | 'ready' | 'failed'; image?: string };

/** What the binder reads from an original or a kept record. */
export type CardSource = {
  id: string; name: string; image: string; alt?: { slot: AltSlot };
  /** A made card's ready expression art and stored element; an original has neither. */
  expression?: string; element?: HoloElement;
};

/** The part of a kept `SavedCharacter` the binder reads; a `SavedCharacter` fits. */
export type KeptRecord = {
  id: string; alt?: { slot: { status: AltSlot['status'] } }; expression?: { status: string }; rumble?: { element?: HoloElement };
};

/** A kept record as a `CardSource`: the art URLs are the card's (`cardArtFor`), the alt only when its slot is ready (`altOf`). */
export function cardSourceFor(record: KeptRecord, art: MadeArt, name: string): CardSource {
  const status = record.alt?.slot.status;
  const expression = record.expression?.status === 'ready' ? art.expression : undefined;
  const element = record.rumble?.element;
  return {
    id: record.id, name, image: art.idle,
    ...(status === undefined ? {} : { alt: { slot: { status, image: art.alt } } }),
    ...(expression === undefined ? {} : { expression }),
    ...(element === undefined ? {} : { element }),
  };
}

export type BinderCard = {
  id: string;
  kind: 'original' | 'made';
  name: string;
  inLoft: boolean;
  art: { normal: string; alt?: string; expression?: string };
  element?: HoloElement;
  look: HoloId | null;
};

export type BinderCardInput = { originals: readonly CardSource[]; kept: readonly CardSource[]; loft: ReadonlySet<string> };

function altOf(source: CardSource): string | undefined {
  const slot = source.alt?.slot;
  return slot?.status === 'ready' ? slot.image : undefined;
}

/** Originals first, then kept records in the order given (registry order). */
export function binderCards(input: BinderCardInput, lookOf: (id: string) => HoloId | null): BinderCard[] {
  const make = (kind: BinderCard['kind']) => (source: CardSource): BinderCard => {
    const alt = altOf(source);
    return {
      id: source.id, kind, name: source.name, inLoft: input.loft.has(source.id),
      art: { normal: source.image, ...(alt === undefined ? {} : { alt }), ...(source.expression === undefined ? {} : { expression: source.expression }) },
      ...(source.element === undefined ? {} : { element: source.element }),
      look: lookOf(source.id),
    };
  };
  return [...input.originals.map(make('original')), ...input.kept.map(make('made'))];
}
