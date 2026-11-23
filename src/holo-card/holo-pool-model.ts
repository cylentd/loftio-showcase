// Which holo type a card wears (owner, 2026-11-21): the normal card wears Classic; an alt-art card wears one of all six,
// picked from the resident id so it is the same on every visit. Wiring into resident creation comes later.
import { seededRng } from '../loadout/loadout-model';
import { HOLO_TYPES, NORMAL_HOLO, type HoloId } from './holo-type-data';

/** The random pool: every holo type row (owner, 2026-11-21). */
export const HOLO_POOL: readonly HoloId[] = HOLO_TYPES.map(type => type.id);

/** One type from the pool, seeded by the resident id (the loadout's id-seeded generator: FNV-1a then mulberry32). */
export function holoForResident(residentId: string): HoloId {
  const draw = seededRng(residentId)();
  return HOLO_POOL[Math.min(Math.floor(draw * HOLO_POOL.length), HOLO_POOL.length - 1)]!;
}

/** The holo for a resident's card; `variant` is the alt art (null for the normal card). */
export function holoFor(residentId: string, variant: string | null): HoloId {
  return variant === null ? NORMAL_HOLO : holoForResident(residentId);
}
