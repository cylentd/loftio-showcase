// Look data for clay trees: smooth, rounded, matte. Lengths are shares of the tree's height H or leaf size L (as in
// tree-facets-data.mjs, whose RECIPES this style reuses). Numbers marked "by eye" are taste, tuned from the clay-pine reference.

/** `?crowns=clay` (the default). */
export const CROWN_MESH_CLAY = 'clay';

/** Detail levels: `high` (desktop) and `phone` (the mode table's `low` flag). */
export const LOD_HIGH = 'high', LOD_PHONE = 'phone';

/** Per detail level. crownTris: triangle budget of all leafy clumps of one tree; clumpMax: most one clump may take (a lone
 * ball does not need 5000); sides: trunk and branch tube sides; petalU/petalV: rings along a petal and sides around it. */
export const CLAY_LOD = {
  high: { crownTris: 3500, clumpMax: 900, clumpMin: 150, sides: 10, petalU: 8, petalV: 8, tiers: 5, petalsPerTier: [14, 12, 11, 9, 8], coreSides: 14, leaves: 350, leafTrade: 0 },
  phone: { crownTris: 1700, clumpMax: 500, clumpMin: 100, sides: 7, petalU: 6, petalV: 6, tiers: 4, petalsPerTier: [10, 9, 8, 7], coreSides: 9, leaves: 140, leafTrade: 1 },
};
// leaves: leaf count of a tree whose recipe has `leaves` (brief 2026-11-18: about 350 desktop, 140 phone). leafTrade: share of
// the leaf triangles taken out of the puff budget (phone: all, so the oak stays under the 2500 phone cap in tree-clay.test.mjs).

/** Leaves on a puffy crown (tree-leaves.mjs; `?leaves=off` drops them). Lengths in tree units.
 * PUFF_SHRINK: puffs shrink by this share so leaves standing off keep the crown's size (envelope checked before/after; it feeds
 * colliders). ENVELOPE_TOLERANCE: how far the envelope radius may stray from the leafless tree's (test bound).
 * BASE_IN: the base sits this share of the puff radius inside its surface (covers the clump's 0.07 bump, CLAY_CLUMP.BUMP).
 * BASE_REACH: test bound, a base lies within this distance of its puff surface. LEN: leaf length range; WIDTH: width share of
 * length; FOLD: how far the sides lift off the midrib (share of length), so a leaf
 * is a bent V and not a flat card. TILT: angle from the outward normal toward down (radians), shingles; SIDE: random sideways
 * turn (radians). UNDER: pick weight of a downward-facing spot against an upward one (1). POOL: candidate spots per leaf.
 * NORMAL_PUFF: share of the puff normal in a leaf's shading normal (so leaves light like the crown, not as cards). Tone:
 * per-leaf jitter, a lift toward the top of the crown, and a darker share. VERTS/TRIS: per leaf. NEAR/FAR: camera distance
 * where leaves start to fold onto their base and are gone (a leaf is about one pixel at 40). FLUTTER: tip sway (tree units)
 * and its speed (radians per second). All by eye unless stated. */
export const CLAY_LEAVES = {
  PUFF_SHRINK: 0.9, ENVELOPE_TOLERANCE: 0.05, BASE_IN: 0.04, BASE_REACH: 0.25,
  // spike 2026-11-18: 0.3-0.5 long 2-triangle darts tilted 0.6-1.0 read as sparse sharp flakes on a ball; longer, rounder
  // leaves lying closer to the surface read as foliage. ROWS: the two side pairs, [share along the leaf, share of WIDTH].
  // round 1: on the crown face, NORMAL_PUFF 0.5 and blunt [0.68, 1] tips lit each leaf as a pale pentagon decal; 0.75 and a
  // narrower, earlier widest row keep the face in the puff's light and leave the leaves to the outline
  LEN: [0.55, 0.85], WIDTH: 0.7, ROWS: [[0.28, 0.9], [0.6, 0.8]], FOLD: 0.12, TILT: [1.0, 1.35], SIDE: 0.6, UNDER: 0.25, POOL: 4, NORMAL_PUFF: 0.75,
  TONE_JITTER: 0.1, TOP_TONE: 0.14, DARK_SHARE: 0.25, DARK: 0.2, VERTS: 6, TRIS: 4,
  NEAR: 35, FAR: 70, FLUTTER: 0.05, FLUTTER_SPEED: 2.6,
};
export const LEAVES_PARAM = 'leaves', LEAVES_OFF = 'off';

/** Leafy clump: radial bump amplitude (share of radius), the number of low-frequency waves, their spatial frequency range
 * (radians per unit direction), and extra per-clump size variety (share). */
export const CLAY_CLUMP = { BUMP: 0.07, WAVES: 3, FREQ_LO: 1.2, FREQ_HI: 2.6, SIZE_VARIETY: 0.2, TONE_SPREAD: 0.1 };

/** Triangles of a UV sphere = 2 * seg * (rings - 1); seg is this many times rings, so cells stay near square. */
export const SPHERE_SEG_PER_RING = 1.5;

/** Baked light (1 = exposed, lower = tucked). A vertex within REACH (share of a neighbour's radius) of another clump's
 * surface, or inside it, is darkened by up to TUCK; neighbours above count more (ABOVE_WEIGHT..1); undersides lose UNDER. */
export const CLAY_LIGHT = { REACH: 0.45, TUCK: 0.75, ABOVE_WEIGHT: 0.6, UNDER: 0.25, FLOOR: 0.4, MIN: 0.15 };

/** How much of the baked light reaches the colour: colour *= FLOOR + (1 - FLOOR) * light. */
export const CLAY_LIGHT_FLOOR = 0.32;

/** Wood: flared foot. Foot radius share above the trunk radius, the height it fades out over (share of H), root toe
 * count range, toe strength (share of foot radius), and the extra rings put in the foot to keep it round. */
export const CLAY_WOOD = { FOOT: 0.55, FOOT_HEIGHT: 0.09, TOES: [3, 5], TOE_AMP: 0.5, FOOT_RINGS: 4, TOE_SPREAD: 0.9, BRANCH_FLARE: 0.45, BRANCH_FLARE_LEN: 0.35, LIGHT_UNDER_CROWN: 0.7 };

/** Pine, built from tiers of petals. BASE_Y/TOP_Y: height of the lowest/highest tier's petal tips (share of H). RADIUS: lowest
 * tier's tip radius (share of H); TOP_RADIUS: highest tier's, relative to it. TIER_REACH: how far up a petal starts under
 * the tier above, in tier spacings. ROOT_R: where it starts, share of its tip radius. DROP: extra droop of the tip, in
 * tier spacings. TIP_BIAS: rings crowd toward the tip (1 = even), so the tip is round and not a point. TIP_ROUND: width profile exponent (0.5 is a half circle; lower is blunter). OVERLAP: petal half-width relative to the arc spacing.
 * THICK: petal half-thickness relative to its half-width. */
export const CLAY_PINE = {
  BASE_Y: 0.17, TOP_Y: 0.74, RADIUS: 0.27, TOP_RADIUS: 0.34, TIER_REACH: 1.75, ROOT_R: 0.3, DROP: 0.35, TIP_BIAS: 1.8, TIP_ROUND: 0.36,
  OVERLAP: 0.62, THICK: 0.62, LENGTH_JITTER: 0.1, ANGLE_JITTER: 0.18, WIDTH_PEAK: 1.5, CAP_R: 0.1, CAP_H: 0.2, CAP_Y: 0.82,
  CORE_R: 0.55, TRUNK_R: 0.05, TRUNK_TOP: 0.3, ROOT_LIGHT: 0.35, UPPER_TUCK: 0.55, TONE_STEP: 0.06,
};

/** Clay overrides of the shared recipes (field by field), so every kind has a trunk under a lifted crown and a nameable shape.
 * cone: three tiers of puffs, clearly narrower going up. column: a poplar, a stack of one or two puffs per level, smaller toward the top. */
export const CLAY_RECIPES = {
  cone: { rows: [4, 3, 1], baseY: 0.36, r: 0.78, shrink: 0.2, squash: 0.62, ringStep: 0.42, trunk: { top: 0.4, radius: 0.6, bend: 0.03, spine: true } },
  column: { layout: 'cone', rows: [2, 2, 2, 1, 1], baseY: 0.26, r: 0.45, shrink: 0.12, squash: 1.4, ringStep: 0.4, forks: [2, 3], trunk: { top: 0.3, radius: 0.5, bend: 0.03, spine: true } },
  // oak: the crown sits higher on a longer trunk, in more, smaller puffs, every other one raised and pulled in (by eye)
  canopy: { trunk: { top: 0.55, radius: 0.8, bend: 0.07, spine: false }, count: [9, 11], ringY: 0.7, ring: 1.2, r: 0.72, squash: 0.85, topY: 0.86, topR: 0.85, stagger: 0.07, inset: 0.3, leaves: true },
  // cherry: forks at a third of the height (trunk.top) into 4-5 long arms; y and reach place each arm's end puff (shares of
  // H and L); count is all puffs; satellite: bunched puff size relative to an end puff; spread: their azimuth offset
  // (radians); inner: their distance relative to the arm's reach; lift: their height offset (share of L); twig: where on its
  // arm a bunched puff's twig starts (share of the arm) and its radius (share of the arm's). All by eye.
  // Owner 2026-11-18, "don't look like cherry blossom": smaller puffs (r) that overlap into one cloud along each arm (wider
  // spread, inner from nearer the trunk, lift either side), each a lumpy cluster (lumps: CLAY_CLUMP fields; 6 short waves
  // strayed 0.3 from round read as bunched blossom, not an egg). squash 0.6 is flatter than round because world.js stretches
  // a puff upright by height^0.5 / shape: round at tall and giant sizes (0.8 left them upright eggs), a flat cloud at medium.
  // Owner 2026-11-18, cherry problems "havent been fixed": 13-14 puffs still read as separate balls. 22-25 smaller puffs (r 0.4)
  // spread across the gap between arms (spread 0.75 is about half the arm spacing of 4-5 forks) overlap into one cloud.
  // puffTris: triangles asked per puff, decided before the count so the tree fits the cap (6276 high, 3396 phone). The sphere
  // grid rounds 160 up to 168 (8 rings x 12) and 90 to 90 (6 x 9): 25 puffs x 168 + about 1020 wood is 5220 on high, 25 x 90 +
  // about 714 wood is 2964 on phone. The next grid step (224, 132) would break the cap at 25 puffs. Coarser puffs need longer lumps (FREQ 2-3.4, was 3-5), or the
  // lumps break into facets; BUMP 0.35 (was 0.3) keeps the longer lumps as far from round. twig.every: a twig to every second bunched puff; the rest touch a twigged neighbour in the cloud,
  // and a twig per puff (60 wood triangles each) would not fit the cap.
  cherry: { layout: 'cherry', detail: 1, jitter: 0.17, forks: [4, 5], trunk: { top: 0.33, radius: 0.8, bend: 0.14, spine: false }, count: [22, 25], y: [0.7, 0.78], reach: [1.4, 1.85], r: 0.4, squash: 0.6, satellite: 1.0, spread: 0.75, inner: [0.25, 1.05], lift: [-0.15, 0.35], twig: { from: 0.45, radius: 0.5, every: 2 },
    lumps: { BUMP: 0.35, WAVES: 5, FREQ_LO: 2, FREQ_HI: 3.4 }, puffTris: { high: 160, phone: 90 } },
  // umbrella (stone pine): a bare trunk to trunk.top (share of H), forks pads at y (share of H) and reach (share of L), each
  // rx wide and squash flat, plus one pad over the middle at topY, topR wide. The trunk ends inside the middle pad. By eye.
  umbrella: { layout: 'umbrella', detail: 1, jitter: 0.17, forks: [4, 5], trunk: { top: 0.8, radius: 0.6, bend: 0.1, spine: false }, y: [0.78, 0.86], reach: [0.9, 1.35], rx: 1.0, squash: 0.36, topY: 0.88, topR: 1.15 },
};

/** Cherry crown look (flora.js), by eye from noon and dusk captures. topWhite: how far a puff's upward face lerps to the
 * palette's near-white accent, from normal.y topFrom to topTo. lightFloor: the baked-light floor for this crown (CLAY_LIGHT_FLOOR
 * is 0.32; deep tucked pink went mauve-grey under the blue ambient). Blossom speckle, object space: cell size in tree units
 * (about 0.18 brief), petal blob radius range and centre dot radius range (shares of a cell), petal and centre strength,
 * the share of cells with a deep pink centre, petal and centre colours (linear 0..1), and the camera distance it fades over:
 * full until near, gone by far, so a cell is never near one pixel (brief: fade from 12, gone by 25). */
export const CHERRY_LOOK = {
  topWhite: 0.5, topFrom: 0.2, topTo: 0.9, lightFloor: 0.65, // 0.55 until round 2 of the dusk fix (2026-11-18)
  // cell was 0.18 with hard, strong blobs: it read as polka dots on a mushroom cap. Finer, softer and weaker reads as a mottle of flowers.
  cell: 0.1, petal: [0.3, 0.72], dot: [0.05, 0.12], petalMix: 0.4, dotMix: 0.5, dotShare: 0.3,
  petalColour: [1, 0.96, 0.95], dotColour: [0.85, 0.28, 0.45], near: 12, far: 25,
  // Dusk (owner 2026-11-18, cherry problems "havent been fixed"): the crown went lilac under the blue ambient. warm: share of
  // the way red moves to the brightest channel after lighting; blueCap: blue is at most this share of red. Pass rule from the
  // brief: on dusk crown pixels red beats blue by 25 of 255, lit red at least 200. By eye from the dusk grove capture.
  // round 1 (0.6, 0.8): fog and the post pass add blue after this hook, so shaded crown still came out r < b; capped harder.
  // round 2 (0.8, 0.5, floor 0.55): lit red 190-211, shaded r-b 15-23; redGain lifts red alone by 8% (well under bloom), a
  // harder cap and a higher light floor keep the tucked puffs rose, not plum.
  // round 3: at noon the same lift turned the crowns salmon, so it now runs only in low sun: full below duskSun[0], none
  // above duskSun[1] (height of the sun direction, glsl.js uSun). By eye.
  warm: 0.8, blueCap: 0.4, redGain: 1.08, duskSun: [0.1, 0.45],
  // Camera fade: a faded cherry crown keeps this opacity (other kinds keep PLAY.fadeOpacity, 0.35). The player walks under
  // cherry crowns all the time, so a nearly clear ghost read as broken (brief: about 55%).
  fadeOpacity: 0.55,
};

/** A tree smaller than this share of the usual height is always a canopy tree: the stacked kinds look like heaps when small. */
export const SAPLING_HEIGHT = 0.85;
