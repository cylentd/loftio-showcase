// Code-drawn icons for the Rumble abilities, 24 x 24 stroke paths in the same family as icon-data.ts.
// One icon per mechanic id, never per themed name: the name is flavour, the icon says what it does.
import type { KnownSpecial, Synergy, Trait } from './loadout-data.ts';

export type AbilityIconName = Trait | Synergy | KnownSpecial | 'reroll';

export const ABILITY_ICON_PATHS: Readonly<Record<AbilityIconName, string>> = {
  // A coiled spring on the ground, with seeds popping off the top.
  springy: 'M5 21h14M8 18h8a1.5 1.5 0 0 0 0-3H8a1.5 1.5 0 0 1 0-3h8a1.5 1.5 0 0 0 0-3H8M12 6V4M8 5.5 7 4M16 5.5 17 4',
  // A heavy stone landing, with the ground rippling out.
  heavy: 'M7 15a5 5 0 0 1 10 0zM3 18.5h18M5.5 21.5h3M15.5 21.5h3M4.5 12l-2-1M19.5 12l2-1',
  // A beam that runs straight through a target.
  piercing: 'M2.5 12h16M14.5 8l4 4-4 4M21.5 6v12',
  // Two arrows chasing round: roll again.
  reroll: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 3.5v3.7h-3.7',

  // Synergies.
  // A seed with four sparks popping off it.
  'seed-burst': 'M12 7c-3 2-3 7 0 10 3-3 3-8 0-10zM5 5l2 2M19 5l-2 2M5 19l2-2M19 19l-2-2',
  // A beam that runs straight through a target.
  'piercing-beam': 'M2.5 12h16M14.5 8l4 4-4 4M21.5 6v12',
  // Three shots fanning out from one point.
  'spread-shot': 'M3 12h13M3 12l11-7M3 12l11 7M20 12h.01M18 4h.01M18 20h.01',
  // A thump on the ground, two rings rolling out.
  shockwave: 'M2 19h20M9 19a3 3 0 0 1 6 0M5 19a7 7 0 0 1 14 0',
  // A shot bouncing between two walls.
  ricochet: 'M3 4h18M3 20h18M5 17l3.5-10 3.5 10 3.5-10 3.5 10',
  // A lightning bolt.
  'chain-lightning': 'M13 2 5 13h6l-1 9 9-12h-6z',
  // A cloud dripping two bubbles.
  'poison-cloud': 'M7 14a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 6.5a3.75 3.75 0 0 1 0 7.5zM8.5 18.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0M14.5 20.5a1 1 0 1 0 2 0 1 1 0 1 0-2 0',
  // A glowing patch on the ground with power rising out of it.
  'power-field': 'M3 18a9 3 0 1 0 18 0 9 3 0 1 0-18 0M12 15V5M8.5 8.5 12 5l3.5 3.5',
  // Two chevrons: go faster.
  booster: 'M5 6l6 6-6 6M13 6l6 6-6 6',
  // A heart with a plus: a small heal.
  mend: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10zM12 9.5v5M9.5 12h5',
  // A round bubble with a shine on it.
  'bubble-guard': 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 10a4 4 0 0 1 3-3.5',

  // Specials.
  // A rock falling, its trail behind it.
  meteor: 'M11 16a4 4 0 1 0 8 0 4 4 0 1 0-8 0M3 3l8 8M8 3l4.5 4.5M3 8l4.5 4.5',
  // A friend rushing right, speed lines behind it.
  stampede: 'M13 12a4.5 4.5 0 1 0 9 0 4.5 4.5 0 1 0-9 0M2 8h8M4 12h6M2 16h8',
  // A round friend with arrows pushing out: grows huge.
  'big-plush': 'M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  // A speed dial pushed toward the top.
  overdrive: 'M4 17a8 8 0 1 1 16 0M12 17l4.5-5M4 17h2M18 17h2',
  // Three of the same friend.
  'triple-trouble': 'M5 8a3 3 0 1 0 6 0 3 3 0 1 0-6 0M13 8a3 3 0 1 0 6 0 3 3 0 1 0-6 0M9 16a3 3 0 1 0 6 0 3 3 0 1 0-6 0',
  // A picnic basket with a handle.
  picnic: 'M4 11h16l-2 9H6zM8 11a4 4 0 0 1 8 0M9 15.5h6',
  // A megaphone cheering.
  'pep-rally': 'M3 10v4h3l9 5V5l-9 5zM18.5 9a4 4 0 0 1 0 6M21 7a7 7 0 0 1 0 10',
  // Two round bumpers and the bounce between them.
  bumpers: 'M3 17a3 3 0 1 0 6 0 3 3 0 1 0-6 0M15 7a3 3 0 1 0 6 0 3 3 0 1 0-6 0M9 12.5l2.5-5 1.5 3',
  // A snowflake: everything stops.
  'freeze-frame': 'M12 2v20M3.3 7l17.4 10M20.7 7 3.3 17M9 4l3 2 3-2M9 20l3-2 3 2',
  // A spiral pulling inward.
  'gravity-well': 'M12 12a1.5 1.5 0 0 1 3 0 3 3 0 0 1-6 0 4.5 4.5 0 0 1 9 0 6 6 0 0 1-12 0',
};
