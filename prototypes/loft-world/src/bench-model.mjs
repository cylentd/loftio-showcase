// Pure maths for the polish benchmark: frame statistics and the fixed camera flight.
import { MS_PER_SECOND, P95_FRACTION, BENCH_PARTS, BENCH_MIN_SECONDS, BENCH_OFF_SEPARATOR } from './bench-data.mjs';

/** Average, nearest-rank 95th percentile, worst and fps of a list of frame durations in milliseconds. */
export function summarise(frameMs) {
  const frames = frameMs.length;
  if (frames === 0) return { frames: 0, avgMs: 0, p95Ms: 0, worstMs: 0, fps: 0 };
  const sorted = [...frameMs].sort((a, b) => a - b);
  const avgMs = sorted.reduce((sum, ms) => sum + ms, 0) / frames;
  const p95Ms = sorted[Math.ceil(P95_FRACTION * frames) - 1];
  return { frames, avgMs, p95Ms, worstMs: sorted[frames - 1], fps: MS_PER_SECOND / avgMs };
}

/** Known part names from an `off` list such as "grass,water": order kept, repeats, blanks and unknown names dropped. */
export function parseOff(text) {
  const names = (text ?? '').split(BENCH_OFF_SEPARATOR).map((name) => name.trim().toLowerCase());
  return names.filter((name, i) => BENCH_PARTS.includes(name) && names.indexOf(name) === i);
}

/** Flight length from `?bench=<seconds>`; `fallback` for a bare `?bench` or a value that is not above zero. */
export function parseBenchSeconds(text, fallback) {
  const seconds = Number(text);
  return text && seconds > BENCH_MIN_SECONDS ? seconds : fallback;
}

const lerp3 = (a, b, f) => a.map((v, i) => v + (b[i] - v) * f);

/** Camera eye and look-at after `seconds` of a flight through `stops` ({p, t} each) lasting `duration` seconds. */
export function benchPath(seconds, stops, duration) {
  const legs = stops.length - 1;
  const along = Math.min(Math.max(seconds / duration, 0), 1) * legs;
  const leg = Math.min(Math.floor(along), legs - 1), f = along - leg;
  return {
    position: lerp3(stops[leg].p, stops[leg + 1].p, f),
    lookAt: lerp3(stops[leg].t, stops[leg + 1].t, f),
    done: seconds >= duration,
  };
}
