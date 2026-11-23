// Pure model for a resident's Rumble combat loadout: roll, validate, backfill. No storage, no clock, no Math.random.
import {
  FNV_OFFSET_BASIS,
  FNV_PRIME,
  MULBERRY_INCREMENT,
  MULBERRY_ODD_MASK,
  MULBERRY_SHIFT_FIRST,
  MULBERRY_SHIFT_SECOND,
  MULBERRY_SHIFT_THIRD,
  ID_PATTERN,
  SPECIALS,
  SYNERGIES,
  SYNERGY_BY_TRAIT,
  TRAITS,
  UINT32_BITS,
} from './loadout-data.ts';
import type { Synergy, Trait } from './loadout-data.ts';
import { ELEMENTS } from './element-data.ts';
import type { Element } from './element-data.ts';
import { parseNamePack } from './loadout-name-model.ts';
import type { NamePack } from './loadout-name-model.ts';

export { ELEMENTS, TRAITS };
export type { Element, NamePack, Synergy, Trait };

/**
 * `synergy` and `special` are ids, not the known unions: a record from a newer build may carry an id this build has never
 * seen, and it is kept as it is (ICD.md, rumble). Trait and synergy are independent. `names` is the optional themed-name pack.
 * `element` is the optional stored element; a loadout without one gets it from `elementFor`, never from a stored roll.
 */
export type Loadout = {
  schemaVersion: 1; trait: Trait; synergy: string; special: string | null; names?: NamePack; element?: Element;
};
/** What a reroll costs. `free` is the one seam where a ticket cost goes later. */
export type RerollPrice = { kind: 'free' };

export const synergyFor = (trait: Trait): Synergy => SYNERGY_BY_TRAIT[trait];

const hashId = (id: string): number => {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < id.length; i++) {
    hash = Math.imul(hash ^ id.charCodeAt(i), FNV_PRIME);
  }
  return hash >>> 0;
};

/** Deterministic rng seeded from an id: same id, same sequence; every value in [0,1). */
export const seededRng = (id: string): (() => number) => {
  let state = hashId(id);
  return () => {
    state = (state + MULBERRY_INCREMENT) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> MULBERRY_SHIFT_FIRST), t | 1);
    t ^= t + Math.imul(t ^ (t >>> MULBERRY_SHIFT_SECOND), t | MULBERRY_ODD_MASK);
    return ((t ^ (t >>> MULBERRY_SHIFT_THIRD)) >>> 0) / 2 ** UINT32_BITS;
  };
};

/** One rng draw mapped over a list. Never retries. */
const pick = <T>(rng: () => number, list: readonly T[]): T =>
  list[Math.min(Math.floor(rng() * list.length), list.length - 1)] as T;

/**
 * Three rng draws, in this order and always three: the trait (as it has been since the first roll, so a seeded backfill keeps
 * its trait), the synergy over the eleven less the excluded one, then the special over the ten. A reroll excludes the
 * synergy the player sees now, so it always changes. Names are not rolled: a reroll picks from the pack, never calls GPT.
 */
export const rollLoadout = (rng: () => number, excludeTrait?: Trait, excludeSynergy?: string): Loadout => {
  const trait = pick(rng, TRAITS.filter((candidate) => candidate !== excludeTrait));
  const synergy = pick(rng, SYNERGIES.filter((entry) => entry.id !== excludeSynergy)).id;
  const special = pick(rng, SPECIALS).id;
  return { schemaVersion: 1, trait, synergy, special };
};

export const rerollPrice = (): RerollPrice => ({ kind: 'free' });

/**
 * True when every ability id in the loadout is one this build knows. A loadout with an id from a newer build is kept as it
 * is and never rerolled (TODO.md, #442 phase 2). A special of null is an older record's: it may be rerolled.
 */
export const isRerollable = (loadout: Loadout): boolean =>
  SYNERGIES.some((entry) => entry.id === loadout.synergy)
  && (loadout.special === null || SPECIALS.some((entry) => entry.id === loadout.special));

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Reads the fields once. A hostile getter that throws means the value is not a loadout. */
const readFields = (value: Record<string, unknown>): Record<string, unknown> | null => {
  try {
    const hasSpecial = 'special' in value;
    return {
      schemaVersion: value['schemaVersion'],
      trait: value['trait'],
      synergy: value['synergy'],
      special: hasSpecial ? value['special'] : undefined,
      names: value['names'],
    };
  } catch {
    return null;
  }
};

const isId = (value: unknown): value is string => typeof value === 'string' && ID_PATTERN.test(value);
const isElement = (value: unknown): value is Element => (ELEMENTS as readonly unknown[]).includes(value);

/** The stored element, or undefined when it is absent, not one of the five, or its getter throws: it never fails the loadout. */
const readElement = (value: Record<string, unknown>): Element | undefined => {
  try {
    const element = value['element'];
    return isElement(element) ? element : undefined;
  } catch {
    return undefined;
  }
};

/**
 * The Loadout for a valid value, null otherwise. Never throws. A synergy or special id this build does not know is kept
 * (a newer build's). `names` is kept when it is a valid pack, with a bad entry dropped alone, and absent otherwise.
 * `element` is kept when it is one of the five, and dropped alone otherwise.
 */
export const parseLoadout = (value: unknown): Loadout | null => {
  if (!isObject(value)) return null;
  const fields = readFields(value);
  if (fields === null) return null;
  const { schemaVersion, trait, synergy, special, names } = fields;
  if (schemaVersion !== 1) return null;
  if (typeof trait !== 'string' || !(TRAITS as readonly string[]).includes(trait)) return null;
  if (!isId(synergy)) return null;
  if (special !== null && !isId(special)) return null;
  const loadout: Loadout = { schemaVersion: 1, trait: trait as Trait, synergy, special };
  const pack = parseNamePack(names);
  if (pack !== null) loadout.names = pack;
  const element = readElement(value);
  if (element !== undefined) loadout.element = element;
  return loadout;
};

/**
 * The element a resident plays with: the stored one when valid, else a roll from the resident id (FNV-1a 32-bit over the
 * id's UTF-16 code units, then `hash % 5` into ELEMENTS). The roll is never stored: it is the same on every call for one id,
 * and if Rumble changes the rule a made resident's element changes with it (BUILDER-LOADOUT.md, "Element").
 */
export const elementFor = (loadout: Loadout, residentId: string): Element =>
  isElement(loadout.element) ? loadout.element : (ELEMENTS[hashId(residentId) % ELEMENTS.length] as Element);

/**
 * The loadout a resident saved before loadouts existed gets: the same one on every call, and the one its trait implied
 * (TODO.md, #442 phase 2: schema 1 records keep their synergy, so no saved resident changes). The trait comes from the
 * first draw of the id's rng, as it always has; the synergy is the trait's default; no special. A later reroll gives it
 * an independent synergy and a special.
 */
export const backfillLoadout = (id: string): Loadout => {
  const trait = pick(seededRng(id), TRAITS);
  return { schemaVersion: 1, trait, synergy: synergyFor(trait), special: null };
};

/** The loadout of a NEW build: trait, synergy and special rolled independently, the same on every call for one id. */
export const newLoadout = (id: string): Loadout => rollLoadout(seededRng(id));
