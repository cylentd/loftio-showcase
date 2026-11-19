// Look data for faceted trees: shared numbers and the six archetype recipes. All lengths are shares of the tree's height H
// or of its leaf size L (a kind's own units); the per-instance size variety scales the finished tree afterwards.

/** Debug: `crowns=facets` (the default), `crowns=merged`, `crowns=blobs` in the URL. */
export const CROWN_MESH_FACETS = 'facets';
export const CROWN_MESH_MERGED = 'merged';

/** Normal lean toward the crown centre for faceted crowns: small, so each facet keeps its own light-to-dark step. Chosen by eye. */
export const CROWN_SOFT_NORMAL_FACETS = 0.1;

/** Share of clumps that lean toward the palette's accent, how far, and how much each clump's tone differs from its neighbours. */
export const FACET_WARM_SHARE = 0.22, FACET_WARM_MIX = 0.45, FACET_CLUMP_TONE = 0.18;
/** Tone added per unit of height share (higher in the tree is lighter). */
export const FACET_HEIGHT_TONE = 0.3;
/** Wood colour: darkest multiplier at the foot, and the range tone adds on top. */
export const FACET_WOOD_DARK = 0.55, FACET_WOOD_RANGE = 0.7;
/** Strength of the pale rim on faceted crowns as a share of CROWN_RIM (it softens facets at the silhouette, so it is halved). */
export const FACET_RIM_SHARE = 0.5;
/** The pine's palette: [dark, light, accent], the colours the teardrop pine used. */
export const PINE_COLORS = ['#356e63', '#7fb09c', '#7fb09c'];

export const FACETS = {
  /** Radial jitter of each clump vertex, share of its radius (0.16 = between 0.84 and 1.16 of the ellipsoid). Chosen by eye. */
  JITTER: 0.17,
  /** Spread of a face's tone around its clump's tone (0..1 scale the caller maps onto dark..light). */
  TONE_SPREAD: 0.3,
  /** How much a face turned upward is lighter, tone per unit of its normal's y. */
  TONE_UP: 0.22,
  /** Branch and trunk tone spread. */
  WOOD_TONE_SPREAD: 0.2,
  /** Sides of every trunk and branch tube (low poly). */
  SIDES: 6,
  /** Segments along a branch between the fork and the clump. */
  BRANCH_SEGMENTS: 3,
  /** A branch tip sits this share of the clump's smallest radius from its centre, so it is well inside the jittered surface. */
  TIP_DEPTH: 0.3,
  /** Lowest a branch may leave a spine trunk, share of H. */
  SPINE_BRANCH_MIN: 0.22,
  /** Trunk radius at its end as a share of its base radius. */
  TRUNK_TAPER: 0.55,
  /** Spine trunk radius at the top clump, share of its base radius. */
  SPINE_TIP_RADIUS: 0.22,
  /** A branch starts at this share of the trunk's end radius and ends at BRANCH_TAPER of its start. */
  BRANCH_START_RADIUS: 0.8,
  BRANCH_TAPER: 0.3,
  /** Sideways wobble of a branch, share of its length, and its upward bow. */
  BRANCH_WOBBLE: 0.12,
  BRANCH_BOW: 0.1,
  /** Collider top: the trunk's end, or this share of the way up the crown from its lowest point, whichever is lower. */
  COLLIDER_CROWN_SHARE: 0.25,
  /** Trunk base radius is the tree's girth times this (a gentle flare at the foot). */
  TRUNK_FLARE: 1.5,
  /** Collider radius as a share of the trunk's base radius. */
  COLLIDER_RADIUS_SHARE: 0.85,
};

/** Pine: stacked jagged tiers. */
export const PINE = {
  TIERS: 8,
  /** First tier's height and the top tier's height, shares of H. */
  BASE_Y: 0.2, TOP_Y: 0.93,
  /** Widest tier radius, share of H. */
  RADIUS: 0.27,
  /** Radius of the top tier relative to the widest. */
  TOP_RADIUS: 0.2,
  /** Spikes per tier; alternate spikes are shorter by SPIKE_SHORT. */
  SPIKES: 8, SPIKE_SHORT: 0.62,
  /** Tier thickness (apex rise) and underside dip, shares of the tier spacing. */
  RISE: 0.85, DIP: 0.25,
  /** Rim droop: spikes sit this much below the tier's plane, share of spacing. */
  DROOP: 0.22,
  JITTER: 0.14,
  /** Trunk: radius as a share of H and the height it reaches. */
  TRUNK_RADIUS: 0.032, TRUNK_TOP: 0.95,
};

/** The archetype recipes. `layout` picks the clump arrangement; `forks` the number of branches [min, max]; `spine` runs the
 * trunk up to the top clump (cone and column) instead of ending in a fork. */
export const RECIPES = {
  ball: { layout: 'ball', detail: 2, jitter: 0.15, forks: [2, 2], trunk: { top: 0.5, radius: 0.55, bend: 0.04, spine: false }, rx: 1.45, ry: 1.3 },
  canopy: { layout: 'canopy', detail: 1, jitter: 0.2, forks: [3, 4], trunk: { top: 0.46, radius: 0.8, bend: 0.06, spine: false }, count: [6, 8], ringY: 0.66, ring: 1.15, r: 0.95, squash: 0.78, topY: 0.8, topR: 1.1 },
  cone: { layout: 'cone', detail: 1, jitter: 0.17, forks: [2, 3], trunk: { top: 0.4, radius: 0.55, bend: 0.03, spine: true }, rows: [4, 3, 2, 1], baseY: 0.2, r: 0.8, shrink: 0.13, squash: 0.85, ringStep: 0.34 },
  bonsai: { layout: 'bonsai', detail: 1, jitter: 0.17, forks: [3, 4], trunk: { top: 0.5, radius: 0.8, bend: 0.22, spine: false }, y: [0.58, 0.98], reach: [1.9, 3.1], rx: 1.05, squash: 0.5 },
  column: { layout: 'column', detail: 1, jitter: 0.2, forks: [2, 3], trunk: { top: 0.3, radius: 0.5, bend: 0.03, spine: true }, count: [6, 7], baseY: 0.22, rx: 0.52, ry: 0.62, wobble: 0.3 },
  pine: { layout: 'pine' },
};
