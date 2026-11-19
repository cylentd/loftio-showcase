// Small effects of Explore mode: wisps to collect, the flight trail and the bounce rings.
import * as THREE from 'three';
import { softMaterial } from './glsl.js';
import { merge, place, tint } from './util.js';
import { trailOpacity } from './trail.mjs';
import { CHOMPER_BANK } from './teamwork-constants.mjs';
import { createComet } from './comet-view.js';

const TRAIL_HIDDEN = -9999; // far-away coordinate for unused trail points
const TRAIL = 40;
const TRAIL_OPACITY = 0.2; // flight trail opacity while airborne
const TRAIL_FLARE = 0.6; // extra trail opacity at the start of a Chomper spit, fading over the strike
const RING_COUNT = 6;

export function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, 'rgba(255,255,255,.45)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** Wisps to collect: one instanced mesh, one record per spot. */
export function createWisps({ scene, world }) {
  const wispGeo = merge([tint(new THREE.IcosahedronGeometry(0.3, 2), '#ffe6a0', 0.6), place(tint(new THREE.TorusGeometry(0.52, 0.04, 5, 20), '#8ff5e0', 0.45), 0, 0, 0, 0.5)]);
  const mesh = new THREE.InstancedMesh(wispGeo, softMaterial(), world.wispSpots.length);
  mesh.frustumCulled = false;
  mesh.visible = false;
  scene.add(mesh);
  return { mesh, list: world.wispSpots.map((p, i) => ({ p, got: 0, phase: i * 1.3 })), collected: 0 };
}

/** Pick up any wisp a resident touches, then spin and shrink the ones being collected. */
export function updateWisps(c, dt, time) {
  const { wisps, bodies, P, sfx, hud, tmp, tmp2, m4, q, e, puff } = c;
  const list = wisps.list;
  for (let i = 0; i < list.length; i++) {
    const w = list[i];
    if (!w.got) for (const b of bodies) if (b.pos.distanceToSquared(w.p) < P.wispRadius * P.wispRadius) { w.got = 1; wisps.collected++; sfx.wisp(); hud.count(wisps.collected, list.length); puff(w.p, 7, '#ffe6a0'); break; }
    if (w.got && w.got < 2) w.got = Math.min(w.got + dt * 4, 2);
    const s = w.got ? Math.max(2 - w.got, 0) : 1 + Math.sin(time * 2 + w.phase) * 0.12;
    m4.compose(tmp.copy(w.p).setY(w.p.y + Math.sin(time * 1.3 + w.phase) * 0.5), q.setFromEuler(e.set(time * 0.8 + w.phase, time * 1.1, 0)), tmp2.setScalar(s));
    wisps.mesh.setMatrixAt(i, m4);
  }
  wisps.mesh.instanceMatrix.needsUpdate = true;
}

/** The flight trail and the comet that rides it. `level` is the trail's own opacity; the spit flare is added on top. */
export function createTrail({ scene, glow }) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 3).fill(TRAIL_HIDDEN), 3));
  const mat = new THREE.PointsMaterial({ map: glow, size: .65, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(0.9, 1.4, 1.2), opacity: TRAIL_OPACITY });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false; points.visible = false;
  scene.add(points);
  return { geo, mat, points, level: TRAIL_OPACITY, at: 0, comet: createComet({ scene, glow }) };
}

export function updateTrail(c, real) {
  const { trail, lead, state, P, support } = c;
  const tr = trail.geo.attributes.position;
  if (!lead.grounded && trail.level <= 0) tr.array.fill(TRAIL_HIDDEN); // a new flight starts a fresh trail
  if (!lead.grounded) { tr.setXYZ(trail.at++ % TRAIL, lead.pos.x, lead.pos.y, lead.pos.z); tr.needsUpdate = true; }
  state.spitGlow = Math.max((state.spitGlow || 0) - real / CHOMPER_BANK.strikeTime, 0);
  trail.level = trailOpacity(trail.level, !lead.grounded, real, TRAIL_OPACITY, P.trailFade); // grounded: fade out, never hang in the grass
  trail.mat.opacity = trail.level + state.spitGlow * TRAIL_FLARE;
  trail.points.visible = trail.mat.opacity > 0;
  trail.comet.update(!!support.strikeFocus(), lead.pos, real);
}

/** Bounce rings: a few glow sprites reused round-robin. `puff` is the way to start one. */
export function createRings({ scene, glow }) {
  const rings = Array.from({ length: RING_COUNT }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    s.visible = false; scene.add(s);
    return { s, life: 0, size: 1 };
  });
  let ringAt = 0;
  function puff(p, size, color) {
    const r = rings[ringAt++ % rings.length];
    r.s.position.copy(p); r.life = 1; r.size = size; r.s.material.color.set(color).multiplyScalar(.35); r.s.visible = true;
  }
  return { rings, puff };
}

export function updateRings(c, dt) {
  for (const r of c.rings) {
    if (r.life <= 0) continue;
    r.life -= dt * 1.8;
    r.s.scale.setScalar(r.size * (1.3 - r.life)); r.s.material.opacity = Math.max(r.life, 0) * 0.8; r.s.visible = r.life > 0;
  }
}
