// Title-screen ambience. Positions are percentages of the sign; motion distances are cqw (percent of the sign's width).

/** The "click to enter" hint appears once the sign is fully lit (wake ends at 3.5 s, lantern settles by 3.2 s). */
export const HINT_AT_MS = 3600;

/** Dust motes: gathered around the lantern (right) with a few strays over the board. Drift up and slightly left. */
export const MOTES = [
  { x: 84, y: 60, size: 1.8, dx: -2, dy: -14, duration: 6.5, delay: 2.4, peak: 0.9 },
  { x: 88, y: 78, size: 1.2, dx: -3, dy: -12, duration: 7.2, delay: 3.1, peak: 0.8 },
  { x: 93, y: 66, size: 1.4, dx: -1, dy: -16, duration: 5.8, delay: 2.9, peak: 0.85 },
  { x: 80, y: 84, size: 1, dx: -4, dy: -10, duration: 8.0, delay: 3.6, peak: 0.7 },
  { x: 96, y: 52, size: 1.2, dx: -2, dy: -11, duration: 6.9, delay: 4.2, peak: 0.75 },
  { x: 86, y: 46, size: 0.8, dx: -3, dy: -9, duration: 7.6, delay: 4.8, peak: 0.6 },
  { x: 62, y: 70, size: 1, dx: -2, dy: -12, duration: 8.4, delay: 3.3, peak: 0.55 },
  { x: 41, y: 76, size: 0.8, dx: 1, dy: -10, duration: 9.0, delay: 4.5, peak: 0.5 },
  { x: 24, y: 62, size: 1, dx: 2, dy: -11, duration: 8.6, delay: 3.9, peak: 0.5 },
  { x: 74, y: 58, size: 0.8, dx: -1, dy: -13, duration: 7.8, delay: 5.1, peak: 0.6 },
];

/** Sign size in px (public/brand/grove-sign.webp), the frame the vine garland was fitted in. */
const SIGN = { width: 1520, height: 537 };

/**
 * The designer's vine garland, laid exactly over the vines painted into the sign so it can move on its own.
 * Fitted by overlaying the two images: 4 px right, 18 px up, 1480 px wide, in sign pixels; stored as percent of the sign.
 */
export const VINE = {
  art: "brand/vine-garland.webp",
  x: (4 / SIGN.width) * 100,
  y: (-18 / SIGN.height) * 100,
  width: (1480 / SIGN.width) * 100,
  aspect: "1400 / 519",
};

/** A box in percent of the garland image, and the point (also percent) it hangs from. */
type VinePart = { name: string; box: [number, number, number, number]; hang: [number, number]; breeze: { deg: number; seconds: number; delay: number } };

/**
 * The run along the top is tied to the board and stays put; only the two hanging ends move, each swinging from where it
 * hangs, on its own uneven breeze (owner 2026-11-05: rocking the whole garland looked unnatural). Boxes were drawn on
 * public/brand/vine-garland.webp; the hang points sit on the stem where each end leaves the run.
 * `deg` is the breeze's largest swing. 2° (tips ~4 px) was invisible to the owner; 5-6° moves the tips ~10 px.
 */
export const VINE_PARTS: [left: VinePart, right: VinePart] = [
  { name: "left", box: [0, 46, 18, 100], hang: [8, 46], breeze: { deg: 5, seconds: 7, delay: 0 } },
  { name: "right", box: [90, 32, 100, 100], hang: [92, 30], breeze: { deg: 6, seconds: 8.5, delay: 2 } },
];

/** Clip polygon for the still run: the whole garland minus the hanging boxes. */
export function runClip([left, right]: [VinePart, VinePart]): string {
  const points = [[0, 0], [100, 0], [100, right.box[1]], [right.box[0], right.box[1]], [right.box[0], 100],
    [left.box[2], 100], [left.box[2], left.box[1]], [0, left.box[1]]];
  return `polygon(${points.map(([x, y]) => `${x}% ${y}%`).join(", ")})`;
}

/**
 * Percent of the garland's height each hanging end reaches above its cut, over the still run. At full swing the cut
 * opened a dark hairline across a leaf; the overlap keeps the join covered. Near the hang point both copies line up.
 */
export const VINE_SEAM_OVERLAP = 4;

/** Clip polygon for one hanging end, reaching VINE_SEAM_OVERLAP above its box. */
export function partClip({ box: [x0, y0, x1, y1] }: VinePart): string {
  const top = y0 - VINE_SEAM_OVERLAP;
  return `polygon(${x0}% ${top}%, ${x1}% ${top}%, ${x1}% ${y1}%, ${x0}% ${y1}%)`;
}

/** The designer's painted leaves, paths under public/. `scripts/prepare_leaves.py` derives them from art/brand. */
export const LEAF_ART = ["brand/leaf-1.webp", "brand/leaf-2.webp", "brand/leaf-3.webp"] as const;

/** Leaves: start at the vines along the top edge, fall past the sign and fade. Long cycles so they stay occasional. */
export const LEAVES: { art: (typeof LEAF_ART)[number]; x: number; y: number; size: number; sway: number; duration: number; delay: number }[] = [
  { art: LEAF_ART[0], x: 14, y: 22, size: 5.6, sway: 3, duration: 12, delay: 3.0 },
  { art: LEAF_ART[2], x: 47, y: 8, size: 5, sway: -4, duration: 14, delay: 6.5 },
  { art: LEAF_ART[1], x: 78, y: 12, size: 5.3, sway: 3.5, duration: 13, delay: 9.5 },
];
