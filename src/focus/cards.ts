/** The eight cards, in LOFTIO-COMPANION.md's order ("Focus cards"). */
export const FOCUS_CARD_IDS = ['move', 'outside', 'tidy', 'organize', 'rest', 'people', 'make', 'wishlist'] as const;
export type FocusCardId = typeof FOCUS_CARD_IDS[number];
/** "Pick up to 3 focus cards, or skip": LOFTIO-COMPANION.md, "First 60 seconds". */
export const MAX_FOCUS_CARDS = 3;
const STORAGE_KEY = 'loftio-focus-cards-v1';
type Storage = { getItem(key: string): string | null; setItem(key: string, value: string): void };
// Card ids only: the cards belong to the person, and no resident is assigned to one.
type Saved = { version: 1; cards: FocusCardId[]; answered: boolean };

const known = (value: unknown): value is FocusCardId => FOCUS_CARD_IDS.includes(value as FocusCardId);

// A damaged record must never block the room: keep the known cards, once each, and otherwise start fresh.
function restore(raw: string | null): Saved {
  const fresh: Saved = { version: 1, cards: [], answered: false };
  if (raw === null) return fresh;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return fresh; }
  if (!value || typeof value !== 'object' || (value as Saved).version !== 1 || !Array.isArray((value as Saved).cards)) return fresh;
  const cards = [...new Set((value as Saved).cards.filter(known))].slice(0, MAX_FOCUS_CARDS);
  return { version: 1, cards, answered: (value as Saved).answered === true };
}

/** The person's focus cards. Every call re-reads storage, so a second tab sees a change at once. */
export function focusCards(storage: Storage, key = STORAGE_KEY) {
  const read = () => restore(storage.getItem(key));
  const write = (saved: Saved) => storage.setItem(key, JSON.stringify(saved));
  return {
    chosen: () => read().cards,
    /** Picked or skipped once; the first-run picker never asks again after that. */
    answered: () => read().answered,
    full: () => read().cards.length >= MAX_FOCUS_CARDS,
    /** Picks or puts back one card. Refuses an unknown card, and a fourth pick while three are held. */
    toggle(id: FocusCardId) {
      if (!known(id)) return false;
      const saved = read();
      if (saved.cards.includes(id)) { write({ ...saved, cards: saved.cards.filter(card => card !== id) }); return true; }
      if (saved.cards.length >= MAX_FOCUS_CARDS) return false;
      write({ ...saved, cards: [...saved.cards, id] });
      return true;
    },
    /** Done or skip: the picks stay as they are. */
    finish() { write({ ...read(), answered: true }); },
  };
}
export type FocusCards = ReturnType<typeof focusCards>;
