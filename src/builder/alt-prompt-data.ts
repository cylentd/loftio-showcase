// Copy for the alt prompt: the wording lives here, the rules it must carry are tested in tests/unit/builder-alt-prompt.test.ts.
// No franchise or character names, ever: the test checks every string against the loadout brand blocklist.
export const ALT_PROMPT_VERSION = 'alt-v1'; // owner, 2026-11-20: "action was better", so the goofy rewrite (alt-v2) was dropped and v1 is back

export const ALT_PROMPT_BLOCKS = {
  identity: 'The attached images are references for identity only: keep this character\'s colours, markings, proportions, features and art style exactly, and draw nothing else from them.',
  novelty: 'Draw a new illustration of the same character with a new pose, a new expression, a new camera angle and new lighting; do not copy the framing of the references.',
  kind: {
    A: 'Show a dynamic action moment: the character mid-motion, full of energy, with a strong sense of movement.',
    B: 'Show a calm everyday moment: the character relaxed in a small quiet scene, at ease and unhurried.',
  },
  trait: {
    springy: 'The character is light on its feet and bouncy.',
    heavy: 'The character is sturdy and weighty, solid on the ground.',
    piercing: 'The character is sharp and focused, with a keen gaze.',
  },
  element: {
    bloom: 'Let soft leaves and petals colour the scene.',
    splash: 'Let water and bright droplets colour the scene.',
    ember: 'Let warm glowing embers colour the scene.',
    spark: 'Let crackling sparks of light colour the scene.',
    chaos: 'Let swirling, unpredictable shapes colour the scene.',
  },
  background: 'Paint a full, opaque background that suits the moment, with no transparency, text or borders.',
  output: 'Generate exactly one illustration of this one character: not a sheet, a grid or several panels.',
} as const;

/** Order the single blocks are joined in; the kind, trait and element blocks are picked by the context and sit after `novelty`. */
export const ALT_PROMPT_ORDER = ['identity', 'novelty', 'kind', 'trait', 'element', 'background', 'output'] as const;
