// Names and numbers for the post chain: edge smoothing (`?aa=`) and bloom size (`?bloom=`).

/** Edge smoothing modes. msaa = multisampled composer target (today's look); fxaa and smaa = no samples plus an
 *  addon pass; none = raw edges. */
export const AA_MODES = ['msaa', 'fxaa', 'smaa', 'none'];
export const DEFAULT_AA = 'msaa';
/** Samples the composer target gets in msaa mode; the value the target had before the switch existed. */
export const MSAA_SAMPLES = 4;

/** Bloom runs at the composer size (full) or a fraction of it (half). */
export const BLOOM_MODES = ['full', 'half'];
export const DEFAULT_BLOOM = 'full';
/** Half the composer width and height, so a quarter of the pixels. */
export const BLOOM_HALF_SCALE = 0.5;
