// Storybook binder look test (`?mode=mock&binder`, 2026-11-20): every size, timing and mock fact in one place.
import type { HoloId } from '../holo-card/holo-type-data';

export const BINDER = {
  /** Pockets on one page: a 2x2 grid (brief, U1). */
  perPage: 4,
  /** Pages the binder always has, so empty pockets wait for new friends (brief: 3 pages). */
  minPages: 3,
  /** Pages in view: one on a phone, a two-page spread on a desktop. */
  perViewPhone: 1,
  perViewDesktop: 2,
  /** The phone layout below this width, the same break the holo card uses. */
  phoneQuery: '(max-width: 640px)',
  /** One page turn, ms. Long enough to read as paper, short enough not to wait on. */
  turnMs: 720,
  /** Reduced motion: the crossfade that replaces the turn, ms. */
  fadeMs: 260,
  turnEasing: 'cubic-bezier(0.45, 0.05, 0.25, 1)',
  /** Pixels a horizontal swipe travels before it turns the page. */
  swipePx: 48,
  /** A half turn of the leaf, degrees. */
  halfTurn: 180,
} as const;

/** The options sheet's actions (the type lives here so the copy file can key on it without importing the model). */
export type SheetAction = 'home' | 'invite' | 'invitation' | 'abilities' | 'reroll';

/** The alt painting each pocket peeks and the big card switches to. Every original has variant a. */
export const ALT_VARIANT = 'a';

/** An original's cards in the big view, left to right (#477 U7): the standard card, the cozy alt (b), the action alt (a). */
export const ORIGINAL_SIDES = [
  { key: 'normal', variant: null },
  { key: 'cozy', variant: 'b' },
  { key: 'action', variant: ALT_VARIANT },
] as const;

/** LOOK-TEST MOCK: who is away from the loft when the binder opens (brief: a fixed 4 in, 2 away split). */
export const MOCK_AWAY: readonly string[] = ['puff', 'chomper'];

/** LOOK-TEST MOCK: one holo per original, all six types shown once (holo-types.ts). */
export const MOCK_HOLO: Readonly<Record<string, HoloId>> = {
  sprout: 'classic', slime: 'rainbow', burger: 'radiant', hoodie: 'cosmos', puff: 'reverse', chomper: 'etched',
};
