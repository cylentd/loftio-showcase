// Pure: which performance mode a page runs in, and the pixel ratio a mode and scale give.
import { MODES, MODE_NAMES, PHONE_MAX_WIDTH, DEFAULT_WIDE_MODE, DEFAULT_NARROW_MODE, BLADES_MIN, BLADES_MAX } from './mode-data.mjs';
import { MEADOW_LOOK } from './terrain-look-data.mjs';
import { AA_MODES, BLOOM_MODES } from './post-data.mjs';

const RATIO_DIGITS = 3;
const clean = (text) => (text ?? '').trim().toLowerCase();
const known = (text, names, fallback) => (names.includes(clean(text)) ? clean(text) : fallback);

/** Mode and post-chain settings from the URL values. An explicit ?mode= wins, then ?low, then the screen width.
 *  An explicit ?aa= or ?bloom= (a known value) overrides the mode's own; an unknown one is ignored. */
export function resolveMode({ mode, aa, bloom, low, width }) {
  const screenMode = low || width < PHONE_MAX_WIDTH ? DEFAULT_NARROW_MODE : DEFAULT_WIDE_MODE;
  const name = known(mode, MODE_NAMES, screenMode);
  const row = MODES[name];
  return { name, ...row, aa: known(aa, AA_MODES, row.aa), bloom: known(bloom, BLOOM_MODES, row.bloom) };
}

/** The `?blades=` value as a whole count inside the allowed range, else null (use the look data's count). */
export function parseBlades(text) {
  const n = Number(clean(text));
  return clean(text) !== '' && Number.isInteger(n) && n >= BLADES_MIN && n <= BLADES_MAX ? n : null;
}

/** The meadow numbers a mode builds with: blade counts, tile and noise octave shares, the phone's or the desktop's. */
export function meadowSettings(low, look = MEADOW_LOOK) {
  return low
    ? { count: look.phoneCount, tile: look.phoneTile, ringCount: look.phoneRingCount, width: look.width * look.phoneWidthScale, gustDetail: look.phoneGustDetail, streakDetail: look.phoneStreakDetail }
    : { count: look.desktopCount, tile: look.desktopTile, ringCount: look.ringCount, width: look.width, gustDetail: look.gustDetail, streakDetail: look.streakDetail };
}

/** Render pixel ratio: the device ratio capped by the mode, times the tuner's scale (a fraction of that). */
export function pixelRatioFor(row, deviceRatio, scale) {
  return Number((Math.min(deviceRatio, row.maxPixelRatio) * scale).toFixed(RATIO_DIGITS));
}
