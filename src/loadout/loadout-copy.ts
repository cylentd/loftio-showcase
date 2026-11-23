// What the Residents drawer says about a resident's Rumble abilities. Read to a child: what it does when thrown.
import type { KnownSpecial, ShinesVs, SpecialKind, Synergy, SynergyKind, Trait } from './loadout-data.ts';

export type TraitCopy = { name: string; ability: string; does: string };
/** The plain (base) name of an ability and one short line a child can read: what it does when thrown. */
export type AbilityCopy = { name: string; line: string };

/** Hand-written themed names for the six originals, keyed by cast id and slot (TODO.md, "Originals", owner 2026-11-19). */
export const ORIGINAL_NAMES: Readonly<Record<string, { synergy: string; special: string }>> = {
  sprout: { synergy: 'Seed Pop', special: 'Tea Party' },
  chomper: { synergy: 'Belly Boom', special: 'Chomp Crash' },
  puff: { synergy: 'Cloud Ray', special: 'Super Puff' },
  hoodie: { synergy: 'Static Shock', special: 'Pause Menu' },
  slime: { synergy: 'Jelly Dome', special: 'Star Pull' },
  burger: { synergy: 'Sesame Spray', special: 'Triple Stack' },
};

const SYNERGY_COPY: Record<Synergy, AbilityCopy> = {
  'seed-burst': { name: 'Seed burst', line: 'Pops seeds on a hit' },
  'piercing-beam': { name: 'Piercing beam', line: 'Zips right through foes' },
  'spread-shot': { name: 'Spread shot', line: 'Splits into a fan of shots' },
  shockwave: { name: 'Shockwave', line: 'Pounds out a shockwave' },
  ricochet: { name: 'Ricochet', line: 'Bounces off foes and walls' },
  'chain-lightning': { name: 'Chain lightning', line: 'Zaps from one foe to the next' },
  'poison-cloud': { name: 'Poison cloud', line: 'Leaves a cloud that hurts foes over time' },
  'power-field': { name: 'Power field', line: 'Leaves a glow that powers up friends inside' },
  booster: { name: 'Booster', line: 'Speeds up a friend it passes' },
  mend: { name: 'Mend', line: 'Heals the weakest friend nearby a little' },
  'bubble-guard': { name: 'Bubble shield', line: 'Wraps a friend in a bubble that blocks one hit' },
};

const SPECIAL_COPY: Record<KnownSpecial, AbilityCopy> = {
  meteor: { name: 'Meteor', line: 'Leaps and slams down' },
  stampede: { name: 'Stampede', line: 'Zips around, hitting everything it touches' },
  'big-plush': { name: 'Big Plush', line: 'Puffs up huge for a few seconds' },
  overdrive: { name: 'Overdrive', line: 'Moves faster and bounces harder' },
  'triple-trouble': { name: 'Triple Trouble', line: 'Splits into three for a few seconds' },
  picnic: { name: 'Picnic', line: 'Heals the whole team' },
  'pep-rally': { name: 'Pep Rally', line: 'Makes the whole team hit harder' },
  bumpers: { name: 'Bumpers', line: 'Pops up bumpers to bounce off' },
  'freeze-frame': { name: 'Freeze Frame', line: 'Freezes everything for a moment' },
  'gravity-well': { name: 'Gravity Well', line: 'Pulls little foes in' },
};

const KIND_COPY: Record<SynergyKind | SpecialKind, string> = {
  burst: 'Burst', 'over-time': 'Over time', zone: 'Zone', boost: 'Boost', heal: 'Heal', guard: 'Guard',
  'big-hit': 'Big hit', 'power-up': 'Power-up', 'team-boost': 'Team boost', chaos: 'Chaos',
};

const SHINES_VS_COPY: Record<ShinesVs, string> = { boss: 'Boss', few: 'A few foes', crowd: 'Crowds', any: 'Anything' };

export const LOADOUT_COPY = {
  /** The block's accessible name: whose abilities these are. */
  region: (name: string) => `${name} in Rumble`,
  reroll: 'Reroll',
  rerollName: (name: string) => `Reroll ${name}'s abilities`,
  rerolling: 'Rolling…', // short: it shares a phone row with the trait chip
  rerollingNote: (name: string) => `Rerolling ${name}…`,
  rerolled: (name: string, trait: string, ability: string) => `${name} is now ${trait}, with ${ability}.`,
  failed: 'The new abilities did not save. Try again.',
  original: 'Originals always keep their abilities.',
  /** Between the ability's name and what it does: "Seed burst — bounces…". */
  separator: ' — ',
  traits: {
    springy: { name: 'Springy', ability: 'Seed burst', does: 'bounces and pops seeds on a hit' },
    heavy: { name: 'Heavy', ability: 'Shockwave', does: 'lands with a thump that shakes foes' },
    piercing: { name: 'Piercing', ability: 'Piercing beam', does: 'zips right through foes' },
  } satisfies Record<Trait, TraitCopy>,
  /** Plain names and lines, keyed by id; a themed name is flavour and these stay readable under it. */
  synergies: SYNERGY_COPY,
  specials: SPECIAL_COPY,
  /** Card tag for the kind of an ability, and the stage tag for what it shines against. */
  kinds: KIND_COPY,
  shinesVs: SHINES_VS_COPY,
};
