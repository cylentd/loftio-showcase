// Performance modes (`?mode=`) and the numbers of the self-tuning render resolution (`?tune=off` switches it off).

/** One row per mode; every setting a mode controls is named here and nowhere else.
 *  maxPixelRatio caps devicePixelRatio. phone's 1.5 and the 2 of the others are the caps main.js used before modes
 *  existed (`low ? 1.5 : 2`); showpiece keeps 2 because that was already the desktop cap. low = everything the
 *  old `low` flag turned down (smaller shadow map, lighter world build, fewer batches). */
export const MODES = {
  phone: { aa: 'none', bloom: 'half', maxPixelRatio: 1.5, low: true },
  high: { aa: 'fxaa', bloom: 'half', maxPixelRatio: 2, low: false },
  showpiece: { aa: 'msaa', bloom: 'full', maxPixelRatio: 2, low: false },
};
export const MODE_NAMES = Object.keys(MODES);
/** Narrow viewports get phone; the cutoff the old `low` flag used. */
export const PHONE_MAX_WIDTH = 700;
export const DEFAULT_WIDE_MODE = 'high';
export const DEFAULT_NARROW_MODE = 'phone';

/** `?blades=<n>` overrides the fine grass blade count (a benchmark and tuning aid); outside this range it is ignored. */
export const BLADES_MIN = 1000; // below this the meadow is bare ground
export const BLADES_MAX = 600000; // twice the biggest count shipped (280000 on desktop); more only crashes weak GPUs

// ---- Resolution tuner ----
/** 60 fps, one frame in milliseconds (the owner's target in every mode), rounded as people quote it. */
export const TARGET_FRAME_MS = 16.7;
/** The scale is a fraction of the mode's pixel ratio (min of device ratio and maxPixelRatio). 1 = full. */
export const SCALE_MAX = 1;
/** Half the width and height is a quarter of the pixels: the lowest picture that still reads as the same scene. */
export const SCALE_MIN = 0.5;
/** One step of the scale: about 20 percent fewer pixels per step near full size, small enough to go unnoticed. */
export const SCALE_STEP = 0.1;
/** Frames in the "too slow" window: half a second at 60 fps, long enough to ignore one hitch. */
export const DOWN_WINDOW_FRAMES = 30;
/** Step down when the window's median frame is over target by this factor: 19.2 ms, about 52 fps, "clearly over". */
export const DOWN_OVER = 1.15;
/** Samples ignored after load, a resize or the tab coming back: the first second has long frames that are not load. */
export const SETTLE_MS = 1000;
/** Samples ignored after the tuner's own step: the render targets are reallocated, so the next frames are slow. */
export const STEP_SETTLE_MS = 500;
/** Stable time before the first step up. */
export const UP_STABLE_MS = 10000;
/** Predicted GPU time after a step up must be under this share of the target (spare room against the noise). */
export const UP_FILL = 0.85;
/** GPU samples needed before they decide a step up (about two seconds at 60 fps). */
export const GPU_MIN_SAMPLES = 120;
export const GPU_WINDOW_SAMPLES = 120;
/** Without GPU timer queries the frame time is vsync-capped and shows no headroom, so the tuner only probes up
 *  blindly, after this long stable; a probe that goes wrong steps straight back down. */
export const BLIND_PROBE_MS = 30000;
/** A step down within this long of a step up means the up was a mistake: wait longer next time. */
export const REGRET_MS = 10000;
/** Each regretted step up doubles the wait before the next try, up to this many times the base wait. */
export const BACKOFF_MAX = 8;
export const BACKOFF_FACTOR = 2;
/** Blade thinning: a cheaper quality step the tuner takes before the resolution falls below THIN_FLOOR_SCALE. Each entry is the
 *  share of grass blades drawn (1 = all). The soak run (2026-11-17) showed no leak, so sustained overload is plain cost; thinning
 *  blades costs the picture less than another resolution step down (blocky edges were the owner's complaint). */
export const THIN_STEPS = [1, 0.75, 0.5]; // 0.5 keeps the meadow thick: the phone draws 200000 blades wider than desktop's
/** Resolution below which thinning comes first: the owner's "holds 16.7 ms at scale 0.7 or above" line. */
export const THIN_FLOOR_SCALE = 0.7;
/** Modes whose tuner may thin blades. The desktop modes keep the old resolution-only tuner. */
export const THIN_MODES = ['phone'];

/** Decimal places the scale is kept to, so repeated steps do not drift (0.7000000001). */
export const SCALE_DIGITS = 2;
