// Wires the performance mode into the page: the pixel ratio, the self-tuning resolution and `window.__valleyMode`.
// The decisions are pure and live in tune-model.mjs; this file only measures, applies a scale and publishes.
import { initialTuner, tunerStep, medianOf, thinFraction } from './tune-model.mjs';
import { THIN_STEPS, THIN_MODES } from './mode-data.mjs';
import { pixelRatioFor } from './mode-model.mjs';
import { GPU_EXTENSION } from './bench-data.mjs';

const MS_PER_NS = 1e-6;

/** GPU milliseconds of the most recent finished frame from timer queries; poll() gives null until one is ready.
 *  Null overall when the browser does not offer the extension. */
function createGpuTimer(gl) {
  const ext = gl.getExtension(GPU_EXTENSION);
  if (!ext) return null;
  const pending = [];
  return {
    begin() { const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); pending.push(q); },
    end() { gl.endQuery(ext.TIME_ELAPSED_EXT); },
    poll() {
      let latest = null;
      const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
      while (pending.length > 1 && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) {
        const q = pending.shift();
        if (!disjoint) latest = gl.getQueryParameter(q, gl.QUERY_RESULT) * MS_PER_NS;
        gl.deleteQuery(q);
      }
      return latest;
    },
  };
}

/** The tuner is off under `?bench` and `?shot=` (they must stay deterministic) and with `?tune=off`. */
export const tunerWanted = (params) => !params.has('bench') && !params.has('shot') && params.get('tune') !== 'off';

/** `resize` is the page's own resize path (renderer size, composer, uniforms); applying a scale calls it.
 *  `thinTo(share)` draws that share of the grass blades (the tuner's second quality step, phone only). */
export function createModeRuntime({ mode, params, renderer, resize, thinTo = () => {}, win = window, doc = document }) {
  const on = tunerWanted(params);
  const gpu = on ? createGpuTimer(renderer.getContext()) : null;
  let state = initialTuner(THIN_MODES.includes(mode.name) ? THIN_STEPS.length - 1 : 0), last = null, hiddenSent = false;
  const info = { mode: mode.name, aa: mode.aa, bloom: mode.bloom, low: mode.low, maxPixelRatio: mode.maxPixelRatio, tuner: on, gpuTimer: !!gpu };
  const publish = () => {
    info.scale = state.scale; info.thin = thinFraction(state); info.pixelRatio = renderer.getPixelRatio();
    info.frameMs = medianOf(state.cpu); info.gpuMs = medianOf(state.gpu); // what the tuner is deciding on; null while its window is empty
  };
  win.__valleyMode = info;
  const apply = () => { renderer.setPixelRatio(pixelRatioFor(mode, win.devicePixelRatio, state.scale)); resize(); publish(); };
  const feed = (sample) => {
    const before = state;
    state = tunerStep(state, sample);
    if (state.thin !== before.thin) thinTo(thinFraction(state));
    if (state.scale !== before.scale) apply(); else publish();
  };
  doc.addEventListener('visibilitychange', () => { if (doc.hidden) feed({ event: 'hidden' }); });
  publish();
  return {
    /** Around the frame's whole GPU work (shadows and composer). */
    begin() { gpu?.begin(); },
    end() { gpu?.end(); },
    /** The canvas size changed for a reason of the user's: wait out the settle time again. */
    resized() { if (on) feed({ event: 'resized' }); },
    /** Once per frame, after rendering. */
    frame(now = performance.now()) {
      if (!on) return;
      const dtMs = last === null ? 0 : now - last;
      last = now;
      if (doc.hidden) { hiddenSent = true; return; }
      if (hiddenSent) { hiddenSent = false; feed({ event: 'hidden' }); return; }
      feed({ dtMs, gpuMs: gpu?.poll() ?? null });
    },
  };
}
