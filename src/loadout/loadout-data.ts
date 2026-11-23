// Data for the Rumble loadout model: the trait list, the synergy and special catalogs, the default synergy of a trait,
// the name rules and the seeded rng's constants. Design: TODO.md, "Eleven synergies and themed names" (2026-11-19).
import type { Element } from './element-data.ts';

export type Trait = 'springy' | 'heavy' | 'piercing';

/** Combat traits in their fixed order; a roll maps one draw over this list, so the order is part of the contract. */
export const TRAITS: readonly Trait[] = ['springy', 'heavy', 'piercing'];

/** What a stage wants: one boss, a few targets, a crowd or waves, or anything. */
export type ShinesVs = 'boss' | 'few' | 'crowd' | 'any';
export type SynergyKind = 'burst' | 'over-time' | 'zone' | 'boost' | 'heal' | 'guard';
export type SpecialKind = 'big-hit' | 'power-up' | 'team-boost' | 'chaos';
type CatalogEntry<Id extends string, Kind extends string> = { id: Id; kind: Kind; shinesVs: readonly ShinesVs[] };

/**
 * The eleven synergies in a fixed order; a roll maps one draw over this list, so the order is part of the contract.
 * Kind and shines-vs per the design table (owner decisions 2026-11-19); the ratings are estimates until the trait sim measures them.
 */
export const SYNERGIES = [
  { id: 'seed-burst', kind: 'burst', shinesVs: ['boss'] },
  { id: 'piercing-beam', kind: 'burst', shinesVs: ['few', 'crowd'] },
  { id: 'spread-shot', kind: 'burst', shinesVs: ['few', 'crowd'] },
  { id: 'shockwave', kind: 'burst', shinesVs: ['crowd'] },
  { id: 'ricochet', kind: 'burst', shinesVs: ['few', 'crowd'] },
  { id: 'chain-lightning', kind: 'burst', shinesVs: ['few', 'crowd'] },
  { id: 'poison-cloud', kind: 'over-time', shinesVs: ['boss'] },
  { id: 'power-field', kind: 'zone', shinesVs: ['any'] },
  { id: 'booster', kind: 'boost', shinesVs: ['any'] },
  { id: 'mend', kind: 'heal', shinesVs: ['any'] },
  { id: 'bubble-guard', kind: 'guard', shinesVs: ['any'] },
] as const satisfies readonly CatalogEntry<string, SynergyKind>[];
export type Synergy = (typeof SYNERGIES)[number]['id'];

/**
 * The ten specials in a fixed order (owner yes 2026-11-19). The design table rates synergies only; the shines-vs
 * values are the conductor's, set 2026-11-19, until the trait sim measures them.
 */
export const SPECIALS = [
  { id: 'meteor', kind: 'big-hit', shinesVs: ['boss', 'crowd'] },
  { id: 'stampede', kind: 'big-hit', shinesVs: ['few', 'crowd'] },
  { id: 'big-plush', kind: 'power-up', shinesVs: ['boss'] },
  { id: 'overdrive', kind: 'power-up', shinesVs: ['any'] },
  { id: 'triple-trouble', kind: 'power-up', shinesVs: ['few', 'crowd'] },
  { id: 'picnic', kind: 'team-boost', shinesVs: ['any'] },
  { id: 'pep-rally', kind: 'team-boost', shinesVs: ['boss'] },
  { id: 'bumpers', kind: 'chaos', shinesVs: ['crowd'] },
  { id: 'freeze-frame', kind: 'chaos', shinesVs: ['any'] },
  { id: 'gravity-well', kind: 'chaos', shinesVs: ['crowd'] },
] as const satisfies readonly CatalogEntry<string, SpecialKind>[];
export type KnownSpecial = (typeof SPECIALS)[number]['id'];

/** Longest id a record may carry for a synergy or special: a newer build's id is kept when it fits (ICD.md, rumble). */
export const ID_MAX_LENGTH = 32;
/** The shape of any synergy or special id: lowercase letters, digits and hyphens. */
export const ID_PATTERN = new RegExp(`^[a-z0-9-]{1,${ID_MAX_LENGTH}}$`);

/** A themed name is 1 to 24 characters after NFC and trim (TODO.md design, owner decision 2026-11-19). */
export const NAME_MIN_LENGTH = 1;
export const NAME_MAX_LENGTH = 24;
/** Letters, combining marks, digits, space, apostrophe, curly apostrophe and hyphen: no markup, no emoji, no format characters. */
export const NAME_PATTERN = /^[\p{L}\p{M}\p{Nd} '’-]+$/u;
/** Characters a reader cannot see (Hangul filler, variation selectors, the combining grapheme joiner, zero-width marks): refused. */
export const NAME_INVISIBLE = /\p{Default_Ignorable_Code_Point}/u;
/** A name must show at least one letter or digit: spaces, apostrophes and hyphens alone are not a name. */
export const NAME_VISIBLE = /[\p{L}\p{Nd}]/u;
/**
 * Most combining marks in a row after one base character. Two covers legitimate scripts (a Devanagari vowel sign plus a
 * nasal mark, a Thai vowel plus a tone mark, Vietnamese letters built from parts); more stacks into a smear (a "zalgo" name).
 */
export const NAME_MAX_MARKS_IN_A_ROW = 2;
export const NAME_MARK_FLOOD = new RegExp(`\\p{M}{${NAME_MAX_MARKS_IN_A_ROW + 1},}`, 'u');

/** The default synergy of a trait: what a legacy record gets when it has no better answer. Trait and synergy are otherwise independent. */
export const SYNERGY_BY_TRAIT: Readonly<Record<Trait, Synergy>> = {
  springy: 'seed-burst',
  heavy: 'shockwave',
  piercing: 'piercing-beam',
};

/** The loadout an original resident is published with. Originals are fixed: never rolled, never rerolled. */
export type OriginalLoadout = { schemaVersion: 1; trait: Trait; synergy: Synergy; special: KnownSpecial; element: Element };
const fixedLoadout = (trait: Trait, synergy: Synergy, special: KnownSpecial, element: Element): OriginalLoadout =>
  ({ schemaVersion: 1, trait, synergy, special, element });

/**
 * The six originals' fixed loadouts, keyed by cast id. The owner chose them on 2026-11-19 ("pick for me", TODO.md, Originals
 * table). Sprout, Chomper and Puff keep the traits and abilities Rumble has today; Hoodie, Slime and Burger become active
 * as the Rumble engine builds their abilities (#462). The elements are the owner's lock of 2026-11-20 (VISION.md). The
 * hand-written themed names are in loadout-copy.ts.
 */
export const ORIGINAL_LOADOUTS: Readonly<Record<string, OriginalLoadout>> = {
  sprout: fixedLoadout('springy', 'seed-burst', 'picnic', 'bloom'),
  chomper: fixedLoadout('heavy', 'shockwave', 'meteor', 'chaos'),
  puff: fixedLoadout('piercing', 'piercing-beam', 'big-plush', 'spark'),
  hoodie: fixedLoadout('springy', 'chain-lightning', 'freeze-frame', 'spark'),
  slime: fixedLoadout('heavy', 'bubble-guard', 'gravity-well', 'splash'),
  burger: fixedLoadout('piercing', 'spread-shot', 'triple-trouble', 'ember'),
};

// The seeded rng hashes the id with the 32-bit FNV-1a steps over its UTF-16 code units (charCodeAt), not over its UTF-8 bytes,
// so a non-ASCII id hashes differently from a byte-wise FNV-1a. It then runs mulberry32 (Tommy Ettinger's public-domain generator).
/** FNV-1a 32-bit offset basis. */
export const FNV_OFFSET_BASIS = 0x811c9dc5;
/** FNV-1a 32-bit prime. */
export const FNV_PRIME = 0x01000193;
/** mulberry32 state increment (the golden-ratio-derived odd constant from the reference implementation). */
export const MULBERRY_INCREMENT = 0x6d2b79f5;
/** mulberry32 xor-shift amounts, in the order the reference implementation applies them. */
export const MULBERRY_SHIFT_FIRST = 15;
export const MULBERRY_SHIFT_SECOND = 7;
export const MULBERRY_SHIFT_THIRD = 14;
/** mulberry32 mask that forces the second multiplier odd. */
export const MULBERRY_ODD_MASK = 61;
/** Output width: a 32-bit unsigned result divided by 2^32 lands in [0,1). */
export const UINT32_BITS = 32;
