// The compare board's state (look test `?holocard&holocompare`): which tab is picked and whether the foil animates.
// Pure, so the unit test runs without a browser; holo-compare.ts renders from it.
import { seededRng } from '../loadout/loadout-model';
import { HOLO_TABS, MIX, MIX_TAB, type HoloId, type HoloTab } from './holo-type-data';

/** The board's three Sprout cards, left to right: the standard card, the cozy alt (B), the action alt (A). `art` is
 *  the alt variant (holo-card-scenes.ts), null for the standard card. `mood` is the card's one motion tag: which motes
 *  float over its painting when it is opened (holo-alive-model.ts; look test #565). */
export const BOARD_CARDS = [
  { key: 'normal', art: null, mood: 'dust' },
  { key: 'cozy', art: 'b', mood: 'firefly' },
  { key: 'action', art: 'a', mood: 'ember' },
] as const;

/** The mood of a card side by its key (the storybook's big cards, #565); a side the board does not name gets dust. */
export const sideMood = (key: string): string => BOARD_CARDS.find(card => card.key === key)?.mood ?? 'dust';

export type BoardState = { readonly tab: HoloTab; readonly animate: boolean };
export type BoardAction = { kind: 'tab'; tab: string } | { kind: 'toggle' };

export const initialBoard = (reduced: boolean): BoardState => ({ tab: HOLO_TABS[0]!, animate: !reduced });

const isTab = (tab: string): tab is HoloTab => (HOLO_TABS as readonly string[]).includes(tab);

/** The next state. Reduced motion holds animation off whatever the toggle says. */
export function boardStep(state: BoardState, action: BoardAction, reduced: boolean): BoardState {
  if (action.kind === 'toggle') return { ...state, animate: !reduced && !state.animate };
  return isTab(action.tab) ? { ...state, tab: action.tab } : state;
}

/** The holo on each board card for a tab: the tab's holo on all three, or Mix's three. */
export function cardHolos(tab: HoloTab): HoloId[] {
  return BOARD_CARDS.map((_, index) => (tab === MIX_TAB ? MIX[index]! : tab));
}

/** The holo one card wears for a tab, where the cards are not a fixed three (the storybook binder, #477 U7): the tab's
 *  holo, or under Mix one of Mix's holos seeded by `seed` (the card's id and art), so a card keeps its look across page
 *  turns and reopens (the loadout's id-seeded generator, as holo-pool-model.ts uses). */
export function tabHolo(tab: HoloTab, seed: string): HoloId {
  if (tab !== MIX_TAB) return tab;
  return MIX[Math.min(Math.floor(seededRng(seed)() * MIX.length), MIX.length - 1)]!;
}
