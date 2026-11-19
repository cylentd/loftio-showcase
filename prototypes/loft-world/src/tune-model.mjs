// Pure state machine for the self-tuning render resolution. One transition: (state, sample) -> state.
// sample = { dtMs, gpuMs } (gpuMs null without timer queries) or { event: 'hidden' | 'resized' }.
// state = { scale, thin, thinMax, settleMs, cpu, gpu, gpuSeen, stableMs, backoff, sinceUpMs }. thin indexes THIN_STEPS (0 = all blades), up to thinMax.
import {
  TARGET_FRAME_MS, SCALE_MAX, SCALE_MIN, SCALE_STEP, DOWN_WINDOW_FRAMES, DOWN_OVER, SETTLE_MS, STEP_SETTLE_MS,
  UP_STABLE_MS, UP_FILL, GPU_MIN_SAMPLES, GPU_WINDOW_SAMPLES, BLIND_PROBE_MS, REGRET_MS, BACKOFF_MAX, BACKOFF_FACTOR, SCALE_DIGITS,
  THIN_STEPS, THIN_FLOOR_SCALE,
} from './mode-data.mjs';

/** thinMax: how many thin steps this mode may use (0 = none, the resolution-only tuner). */
export const initialTuner = (thinMax = 0) => ({
  scale: SCALE_MAX, thin: 0, thinMax, settleMs: SETTLE_MS, cpu: [], gpu: [], gpuSeen: false, stableMs: 0, backoff: 1, sinceUpMs: null,
});

const median = (list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
/** Median of a window, or null while it is empty (for the published debug state). */
export const medianOf = (list) => (list.length ? median(list) : null);
const round = (x) => Number(x.toFixed(SCALE_DIGITS));
const keepLast = (list, add, max) => [...list, add].slice(-max);

/** Windows empty, settle time restarts: the tab was hidden or the canvas was resized, so frames after it are not load. */
const settleAgain = (state, ms) => ({ ...state, cpu: [], gpu: [], stableMs: 0, settleMs: ms });

/** A full window whose median is clearly over target. Used for frame times and for GPU times: a GPU running behind
 *  can still show vsync-capped frame times (measured 27 ms GPU with 16.9 ms frames, 2026-11-17), so both count. */
const isSlow = (window) => window.length >= DOWN_WINDOW_FRAMES && median(window) > TARGET_FRAME_MS * DOWN_OVER;

/** The share of blades to draw at the state's thin step. */
export const thinFraction = (state) => THIN_STEPS[state.thin];

/** Thinning comes before the scale would fall below the floor. */
const thinsFirst = (state) => state.thin < state.thinMax && round(state.scale - SCALE_STEP) < THIN_FLOOR_SCALE;

/** A step down soon after a step up (of either kind) was a mistake: the wait before the next try doubles. */
function backoffAfterDown(state) {
  const regret = state.sinceUpMs !== null && state.sinceUpMs < REGRET_MS;
  return regret ? Math.min(state.backoff * BACKOFF_FACTOR, BACKOFF_MAX) : state.backoff;
}

/** by +1 thins one more step; by -1 brings a step of blades back. */
function stepThin(state, by) {
  const backoff = by > 0 ? backoffAfterDown(state) : state.backoff;
  return { ...settleAgain(state, STEP_SETTLE_MS), thin: state.thin + by, backoff, sinceUpMs: by < 0 ? 0 : null };
}

function stepDown(state) {
  const backoff = backoffAfterDown(state);
  return { ...settleAgain(state, STEP_SETTLE_MS), scale: round(Math.max(state.scale - SCALE_STEP, SCALE_MIN)), backoff, sinceUpMs: null };
}

function stepUp(state) {
  return { ...settleAgain(state, STEP_SETTLE_MS), scale: round(Math.min(state.scale + SCALE_STEP, SCALE_MAX)), sinceUpMs: 0 };
}

/** Which step up comes next: back to the floor resolution, then the blades, then the rest of the resolution. */
const upKind = (state) => (state.scale < THIN_FLOOR_SCALE || state.thin === 0 ? 'scale' : 'thin');

/** Headroom: the GPU time, grown by the extra pixels (or blades) the next step adds, still fits under the target. Without
 *  any GPU timing (frame times are vsync-capped and never show headroom) only a rare blind probe is allowed. */
function mayStepUp(state) {
  if (state.scale >= SCALE_MAX && state.thin === 0) return false;
  if (!state.gpuSeen) return state.stableMs >= BLIND_PROBE_MS * state.backoff;
  if (state.stableMs < UP_STABLE_MS * state.backoff || state.gpu.length < GPU_MIN_SAMPLES) return false;
  const growth = upKind(state) === 'thin' ? THIN_STEPS[state.thin - 1] / THIN_STEPS[state.thin] : ((state.scale + SCALE_STEP) / state.scale) ** 2;
  return median(state.gpu) * growth <= TARGET_FRAME_MS * UP_FILL;
}

export function tunerStep(state, sample) {
  if (sample.event) return settleAgain(state, SETTLE_MS);
  if (state.settleMs > 0) return { ...state, settleMs: Math.max(state.settleMs - sample.dtMs, 0) };
  const survived = state.sinceUpMs !== null && state.sinceUpMs + sample.dtMs >= REGRET_MS;
  const next = {
    ...state,
    cpu: keepLast(state.cpu, sample.dtMs, DOWN_WINDOW_FRAMES),
    gpu: sample.gpuMs === null ? state.gpu : keepLast(state.gpu, sample.gpuMs, GPU_WINDOW_SAMPLES),
    gpuSeen: state.gpuSeen || sample.gpuMs !== null,
    stableMs: state.stableMs + sample.dtMs,
    sinceUpMs: survived || state.sinceUpMs === null ? null : state.sinceUpMs + sample.dtMs,
    backoff: survived ? 1 : state.backoff,
  };
  const slow = isSlow(next.cpu) || isSlow(next.gpu.slice(-DOWN_WINDOW_FRAMES));
  if (slow) return thinsFirst(next) ? stepThin(next, 1) : next.scale > SCALE_MIN ? stepDown(next) : next; // at the floor there is nothing left to give
  if (!mayStepUp(next)) return next;
  return upKind(next) === 'thin' ? stepThin(next, -1) : stepUp(next);
}
