// The storybook's cards and pages (#565 S4, LFT-088): one flat card list (each original's standard, cozy and action
// card, in card order), packed into 3x3 pages in list order, and the spread math for one page (phone) or two
// (desktop) per view. A resident with more alts only adds cards to the list; its row wraps. Pure.
import { ORIGINAL_SIDES } from '../binder/constants';
import type { BinderCard } from '../binder/binder-cards-model';
import { CARD_RESIDENTS, type OriginalId } from '../holo-card/holo-card-model';

export type StorybookCard = { id: OriginalId; side: string; variant: string | null; named: boolean };
export type PageCardData = StorybookCard | { id: string; side: 'normal'; named: true; made: BinderCard };

/** Every card in the book, in order. `named`: the resident's first card, which carries its name under it. */
export const storybookCards = (): StorybookCard[] =>
  CARD_RESIDENTS.flatMap(id => ORIGINAL_SIDES.map((side, i) => ({ id, side: side.key, variant: side.variant, named: i === 0 })));

export const collectionCards = (made: readonly BinderCard[]): PageCardData[] => [
  ...storybookCards(), ...made.map((card): PageCardData => ({ id: card.id, side: 'normal', named: true, made: card })),
];

export const spreadCount = (pages: number, perView: number): number => Math.ceil(pages / perView);

/** The page indexes in `spread`, left to right; a short last spread pads with null. */
export const spreadPages = (spread: number, perView: number, pages: number): (number | null)[] =>
  Array.from({ length: perView }, (_, side) => {
    const page = spread * perView + side;
    return page < pages ? page : null;
  });

/** Fills `slots` per page in list order, then groups the pages into spreads of `perView`. No cards, no pages. */
export function packPages<T>(cards: readonly T[], slots: number, perView: number): { pages: T[][]; spreads: (number | null)[][] } {
  const pages = Array.from({ length: Math.ceil(cards.length / slots) }, (_, page) => cards.slice(page * slots, (page + 1) * slots));
  const spreads = Array.from({ length: spreadCount(pages.length, perView) }, (_, spread) => spreadPages(spread, perView, pages.length));
  return { pages, spreads };
}
