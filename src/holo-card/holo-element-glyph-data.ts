// PROTOTYPE (holo card look test, round 12, 2026-11-20): code-drawn element glyphs, 24 x 24 stroke paths in the same
// family as loadout/ability-icon-data.ts (round caps and joins, stroke 2). They move to the shared icon set if the
// owner keeps an element on the card.

/** The five elements, locked by the owner 2026-11-20: bloom > splash > ember > bloom, spark and chaos strong against each other. */
export const ELEMENTS = ['bloom', 'splash', 'ember', 'spark', 'chaos'] as const;
export type HoloElement = (typeof ELEMENTS)[number];

export const ELEMENT_GLYPH_PATHS: Readonly<Record<HoloElement, string>> = {
  // A leaf with its midrib.
  bloom: 'M5 19C5 10 10 4.5 20 4c-.5 10-6 15-15 15zM5 19l8.5-8.5',
  // A droplet with a shine.
  splash: 'M12 3s-6.5 7.2-6.5 11.5a6.5 6.5 0 0 0 13 0C18.5 10.2 12 3 12 3zM9 15a3 3 0 0 0 2.5 2.8',
  // A flame with an inner tongue.
  ember: 'M12 21.5a6.5 6.5 0 0 1-6.5-6.5c0-4 3.5-6 4-10 2.5 1.5 4 4 4 6 1-1 1.5-2 1.5-3.5 2 2 3.5 4.5 3.5 7.5a6.5 6.5 0 0 1-6.5 6.5zM12 21.5c-1.7 0-3-1.3-3-3 0-1.8 1.5-2.5 3-4.5 1.5 2 3 2.7 3 4.5 0 1.7-1.3 3-3 3z',
  // A four-point spark with two small glints.
  spark: 'M11 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7zM19 16v4M17 18h4M19 3.5v2M18 4.5h2',
  // A pinwheel swirl: four arms curling one way (round 12's first spiral read as a 6 at medallion size).
  chaos: 'M12 12c0-4 2.5-7 7-7M12 12c0 4-2.5 7-7 7M12 12c4 0 7 2.5 7 7M12 12c-4 0-7-2.5-7-7',
};
