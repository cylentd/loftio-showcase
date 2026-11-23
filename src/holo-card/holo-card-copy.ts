// Words on the holographic card (look test). Ability names and lines come from loadout-copy.ts; these are the labels around them.
export const HOLO_COPY = {
  /** The card's accessible name: it is a button that opens the card big. */
  open: (name: string) => `${name}'s card. Open it big.`,
  /** The opened card's dialog name. */
  dialog: (name: string) => `${name}'s card`,
  /** The popped card is a button that turns it over. */
  flip: (name: string) => `${name}'s card. Turn it over.`,
  /** The labels over the two moves (owner, round 4: "Ability and Special", not the burst or team-boost kind). */
  ability: 'Ability',
  special: 'Special',
  /** The trait line's accessible name (round 9): its icon and engraved word are presentation. */
  trait: (trait: string) => `Trait: ${trait}`,
  /** The element's accessible name (round 12): its glyph is presentation. */
  element: (element: string) => `Element: ${element}`,
  /** The five element words (owner, 2026-11-20). */
  elements: { bloom: 'Bloom', splash: 'Splash', ember: 'Ember', spark: 'Spark', chaos: 'Chaos' },
  art: (name: string) => `${name}, painted`,
  back: 'Loftio',
  /** The compare board (`&holocompare`, 2026-11-20): the tab group's name, the toggle, and each card's caption. */
  board: {
    holos: 'Holo type',
    animation: 'Animation',
    on: 'On',
    off: 'Off',
    cards: { normal: 'Standard', cozy: 'Cozy alt', action: 'Action alt' },
  },
};
