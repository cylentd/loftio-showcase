// A baked light map for the path lamps: one RGBA grid over the playable square, read by shade() in one texture fetch.
// RGB = warm light summed over lamps (capped at 255). A = the ground height of the strongest lamp, over the lamp height range.
import { LAMP_MAP } from './lamp-map-data.mjs';

const BYTE = 255;
const clampByte = (v) => Math.min(BYTE, Math.round(v));

/** Cell index of a world coordinate (x or z) on the grid. */
export const cellOf = (w, { size, half }) => Math.min(size - 1, Math.max(0, Math.floor(((w + half) / (2 * half)) * size)));
/** World coordinate of the middle of a cell. */
export const cellCentre = (i, { size, half }) => ((i + 0.5) / size) * 2 * half - half;
/** [min, max] ground height over the lamps. */
export const lampHeightRange = (lamps) => [Math.min(...lamps.map((l) => l.y)), Math.max(...lamps.map((l) => l.y))];

/** Smooth 1 at the lamp, 0 at the radius. */
const falloff = (d, radius) => { const t = Math.max(0, 1 - d / radius); return t * t * (3 - 2 * t); };

/** lamps: [{x, y, z}] (y = ground height). Returns a Uint8Array of size*size*4. */
export function bakeLampMap(lamps, options = {}) {
  const o = { ...LAMP_MAP, ...options }, { size, radius, color } = o;
  const out = new Uint8Array(size * size * 4), best = new Float32Array(size * size);
  const [lo, hi] = lamps.length ? lampHeightRange(lamps) : [0, 0], span = Math.max(hi - lo, LAMP_MAP.minHeightSpan);
  const cellSize = (2 * o.half) / size, reach = Math.ceil(radius / cellSize) + 1;
  for (const l of lamps) {
    const ci = cellOf(l.x, o), cj = cellOf(l.z, o), a = clampByte(((l.y - lo) / span) * BYTE);
    for (let j = Math.max(0, cj - reach); j <= Math.min(size - 1, cj + reach); j++) {
      for (let i = Math.max(0, ci - reach); i <= Math.min(size - 1, ci + reach); i++) {
        const s = falloff(Math.hypot(cellCentre(i, o) - l.x, cellCentre(j, o) - l.z), radius);
        if (s <= 0) continue;
        const n = j * size + i, k = n * 4;
        for (let c = 0; c < 3; c++) out[k + c] = clampByte(out[k + c] + color[c] * s);
        if (s > best[n]) { best[n] = s; out[k + 3] = a; }
      }
    }
  }
  return out;
}
