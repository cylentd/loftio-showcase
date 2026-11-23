// The five elements a resident can have in Loft Rumble: the only list of them. Ids locked by the owner on 2026-11-20
// (game/prototypes/loft-rumble/VISION.md). The order is part of the contract: a made resident's element is rolled by indexing
// this list (loadout-model.ts, `elementFor`), so a reorder changes the element of every made resident that stores none.
export const ELEMENTS = ['bloom', 'splash', 'ember', 'spark', 'chaos'] as const;
export type Element = (typeof ELEMENTS)[number];
