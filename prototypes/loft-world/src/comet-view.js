// Comet: while Chomper's strike carries Sprout at an enemy, glowing pink afterimages trail behind and fade.
import * as THREE from 'three';
import {COMET} from './teamwork-constants.mjs';

const HIDDEN = -9999; // off-screen parking spot for an unused slot

export function createComet({scene, glow}) {
  const position = new Float32Array(COMET.count * 3).fill(HIDDEN), color = new Float32Array(COMET.count * 3);
  const age = new Float32Array(COMET.count).fill(Infinity), base = new THREE.Color(COMET.color);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(color, 3));
  // additive blending: a darker vertex colour reads as a fainter afterimage
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({map: glow, size: COMET.size, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true}));
  points.frustumCulled = false; points.visible = false;
  scene.add(points);
  let next = 0, since = 0;
  return {
    points,
    setVisible(on) { points.visible = on; },
    /** active: a strike is under way. at: Sprout's position. dt: real seconds. */
    update(active, at, dt) {
      since += dt;
      for (let i = 0; i < COMET.count; i++) age[i] += dt;
      if (active && since >= COMET.every) {
        since = 0;
        const i = next++ % COMET.count;
        position[i * 3] = at.x; position[i * 3 + 1] = at.y; position[i * 3 + 2] = at.z; age[i] = 0;
      }
      for (let i = 0; i < COMET.count; i++) {
        const k = Math.max(1 - age[i] / COMET.life, 0);
        color[i * 3] = base.r * k; color[i * 3 + 1] = base.g * k; color[i * 3 + 2] = base.b * k;
      }
      geometry.attributes.position.needsUpdate = geometry.attributes.color.needsUpdate = true;
    },
  };
}
