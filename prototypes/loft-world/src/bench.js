// Polish benchmark and fixed viewpoints. `?shot=<name>` freezes the world and parks the camera on a viewpoint;
// `?bench` flies the camera through all three and records frame cost. Absent both, createBench returns null.
import { BENCH_VIEWS, STAGED_VIEWS, BENCH_ORDER, BENCH_SECONDS, BENCH_TIME_OF_DAY, GPU_DRAIN_FRAMES, GPU_EXTENSION, PANEL_STYLE, CLEAN_CSS, MS_PER_SECOND } from './bench-data.mjs';
const SHOT_VIEWS = { ...BENCH_VIEWS, ...STAGED_VIEWS };
import { summarise, benchPath, parseBenchSeconds } from './bench-model.mjs';
import { drawResidents } from './resident-view.js';
import { PLAY } from './play-constants.js';

const BUDDY_OFFSET = [-1.4, 2.2]; // x and z step of each following resident; the same spread play.reset() uses

const MS_PER_NS = 1e-6;

/** Average GPU milliseconds per frame from timer queries; null when the browser does not offer them. */
function createGpuTimer(gl) {
  const ext = gl.getExtension(GPU_EXTENSION);
  if (!ext) return null;
  const pending = [], samples = [];
  return {
    begin() { const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); pending.push(q); },
    end() { gl.endQuery(ext.TIME_ELAPSED_EXT); },
    poll() {
      const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
      while (pending.length > 1 && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) {
        const q = pending.shift();
        if (!disjoint) samples.push(gl.getQueryParameter(q, gl.QUERY_RESULT) * MS_PER_NS);
        gl.deleteQuery(q);
      }
    },
    average: () => (samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : null),
  };
}

function showPanel(result) {
  const panel = document.createElement('div');
  panel.dataset.benchPanel = '';
  panel.style.cssText = PANEL_STYLE;
  const gpu = result.gpuMs === null ? 'n/a' : result.gpuMs.toFixed(2);
  panel.textContent = `bench: ${result.fps.toFixed(1)} fps  avg ${result.avgMs.toFixed(2)} ms  p95 ${result.p95Ms.toFixed(2)} ms\n`
    + `worst ${result.worstMs.toFixed(2)} ms  gpu ${gpu} ms  ${result.triangles} tris  ${result.calls} calls`;
  document.body.append(panel);
}

export function createBench({ params, renderer, camera, look, play, world, scene, off = [], post = {} }) {
  const shotName = params.get('shot'), benching = params.has('bench');
  if (!benching && !SHOT_VIEWS[shotName]) return null;
  const flightSeconds = parseBenchSeconds(params.get('bench'), BENCH_SECONDS);
  // `?bench&off=<names>`: hide every object tagged with a switched-off part name (userData.part)
  scene.traverse((object) => { if (off.includes(object.userData.part)) object.visible = false; });
  const style = document.createElement('style');
  style.textContent = CLEAN_CSS;
  document.head.append(style);
  play.neighbours.setVisible(true); // Puff and Slime stand in the meadow, still, for every viewpoint
  // Sprout and Chomper stand where a play session starts them; play hides them until it starts.
  play.bodies.forEach((body, i) => {
    const x = world.start.x + BUDDY_OFFSET[0] * i, z = world.start.z + BUDDY_OFFSET[1] * i;
    body.pos.set(x, world.terrain.heightAt(x, z) + PLAY.radius, z);
    body.sprite.visible = true;
  });
  const gl = renderer.getContext(), gpu = benching ? createGpuTimer(gl) : null;
  const stops = BENCH_ORDER.map((name) => BENCH_VIEWS[name]);
  const frameMs = [];
  let startedAt = null, lastAt = null, peakTris = 0, peakCalls = 0, drain = 0, finished = false;

  function aim(position, lookAt) {
    camera.position.set(...position); look.set(...lookAt); camera.lookAt(look);
  }
  function finish() {
    finished = true;
    const result = {
      ...summarise(frameMs), triangles: peakTris, calls: peakCalls, pixelRatio: renderer.getPixelRatio(),
      off, aa: post.aa ?? null, bloom: post.bloom ?? null, mode: post.mode ?? null, seconds: flightSeconds, width: innerWidth, height: innerHeight, low: post.low ?? (innerWidth < 700 || params.has('low')), gpuMs: gpu?.average() ?? null,
    };
    window.__valleyBench = result;
    showPanel(result);
  }
  return {
    startTime: BENCH_TIME_OF_DAY,
    frozen: !benching,
    /** Parks or flies the camera; true when the bench owns it this frame. */
    drive(now = performance.now()) {
      play.neighbours.update(0, true);
      drawResidents(play.bodies, camera, play.support.state, 0, true);
      if (!benching) { const v = SHOT_VIEWS[shotName]; aim(v.p, v.t); return true; }
      startedAt ??= now;
      const path = benchPath((now - startedAt) / MS_PER_SECOND, stops, flightSeconds);
      aim(path.position, path.lookAt);
      if (path.done && !finished && drain === 0) drain = GPU_DRAIN_FRAMES;
      return true;
    },
    begin() { if (benching && !finished) gpu?.begin(); },
    end(now = performance.now()) {
      if (!benching || finished) return;
      gpu?.end(); gpu?.poll();
      if (lastAt !== null && drain === 0) frameMs.push(now - lastAt);
      lastAt = now;
      peakTris = Math.max(peakTris, renderer.info.render.triangles);
      peakCalls = Math.max(peakCalls, renderer.info.render.calls);
      if (drain > 0 && --drain === 0) finish();
    },
  };
}
