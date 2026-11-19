// Pure day model: dayState(t) interpolates the four keyframes of day-data.mjs, wrapping at midnight.
import { DAY, DAY_KEYS, KEY_ORDER } from './day-data.mjs';

const ease = (f) => f * f * (3 - 2 * f);
const lerp = (a, b, f) => a * (1 - f) + b * f;
const unit = ([x, y, z]) => { const k = 1 / Math.hypot(x, y, z); return [x * k, y * k, z * k]; };
const isDir = (key) => key.endsWith('Dir');

function mixKey(key, a, b, f) {
  const out = Array.isArray(a) ? a.map((v, i) => lerp(v, b[i], f)) : lerp(a, b, f);
  return isDir(key) ? unit(out) : out;
}

/** Everything that varies with the time of day, for t in any range (0 = midnight, .25 dawn, .5 noon, .75 dusk). */
export function dayState(t) {
  const u = ((t % 1) + 1) % 1;
  let i = KEY_ORDER.length - 1;
  while (KEY_ORDER[i][1] > u) i--;
  const [nameA, tA] = KEY_ORDER[i], [nameB, tB] = KEY_ORDER[(i + 1) % KEY_ORDER.length];
  const span = (tB > tA ? tB : tB + 1) - tA, f = ease((u - tA) / span);
  const A = DAY_KEYS[nameA], B = DAY_KEYS[nameB], s = {};
  for (const key of Object.keys(A)) s[key] = mixKey(key, A[key], B[key], f);
  const gap = Math.abs(s.sunPower - s.moonPower), k = Math.min(gap / DAY.handoverBand, 1);
  s.shadowCaster = s.sunPower > s.moonPower ? 'sun' : 'moon';
  s.shadowStrength = s.shadowMax * ease(k); // 0 exactly where the two lights are equal
  return s;
}

/** The clock after dt seconds. */
export const stepClock = (t, dt, lengthSeconds) => (t + dt / lengthSeconds) % 1;

/** Where the clock starts and whether it runs, from the page's URL parameters. A `time` that is not a finite number is ignored. */
export function startClock(params) {
  const asked = params.get('time')?.trim();
  const t = asked ? Number(asked) : NaN;
  if (Number.isFinite(t)) return { t, running: false };
  const frozen = params.get('cycle') === 'off' || params.has('capture') || params.has('shot');
  return { t: DAY.startT, running: !frozen };
}
