// Bakes the lamp light map once and hands it to the shared world uniforms. `?lamps=off` leaves the base gain at 0.
import * as THREE from 'three';
import { G } from './glsl.js';
import { bakeLampMap, lampHeightRange } from './lamp-map.mjs';
import { LAMP_MAP } from './lamp-map-data.mjs';

const urlParam = (name) => (typeof location !== 'undefined' ? new URLSearchParams(location.search).get(name) : null);

/** lamps: [{x, y, z}] ground positions. half: half the playable square (LAND.half). */
export function applyLampMap(lamps, half) {
  if (!lamps.length) return;
  const size = LAMP_MAP.size, [lo, hi] = lampHeightRange(lamps);
  const tex = new THREE.DataTexture(bakeLampMap(lamps, { half }), size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  G.uLampMap.value = tex;
  G.uLampBox.value.set(-half, -half, 2 * half, 0);
  G.uLampY.value.set(lo, Math.max(hi - lo, LAMP_MAP.minHeightSpan));
  G.uLampBase.value = urlParam('lamps') === 'off' ? 0 : LAMP_MAP.gain;
}
