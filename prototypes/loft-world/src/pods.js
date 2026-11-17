// Lantern pods: glowing balloons that drift in strings across the sky. They are the "other thing to hit":
// fling into one and it bursts, throws you upward and refills your air flings, so a string of pods is a
// route through the air. Each one grows back a few seconds later.
import * as THREE from 'three';
import { softMaterial } from './glsl.js';
import { merge, place, tint } from './util.js';

export const PODS = {
  radius: 1.5, // how close counts as a hit; also the size of the aim target
  lift: 21, // you leave a burst pod upward at least this fast: about 10 units of height
  keep: 1.05, // and keep this share of your sideways speed
  regrow: 8, // seconds before a burst pod is back
  bob: 0.5, // how far each one drifts up and down
};

/** strings: lists of points; each point gets one pod. */
export function createPods({ scene, strings, sfx, burst }) {
  const P = PODS;
  const geo = merge([
    place(tint(new THREE.SphereGeometry(1, 18, 14), '#ffb86b', 0.55, (c, _x, y) => c.lerp(new THREE.Color('#ff7fb0'), Math.max(-y, 0) * 0.7)), 0, 0, 0, 0, 0, 0, 1, 1.18, 1),
    place(tint(new THREE.ConeGeometry(0.34, 0.5, 8), '#6a4630'), 0, -1.3, 0, Math.PI),
    place(tint(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 4), '#f6e6c8'), 0, -2.05, 0),
    place(tint(new THREE.SphereGeometry(0.13, 8, 6), '#fff3c4', 1), 0, -2.65, 0),
  ]);
  const spots = strings.flat();
  const mesh = new THREE.InstancedMesh(geo, softMaterial({ fuzz: 0, gloss: 0.5 }), spots.length);
  mesh.frustumCulled = false;
  scene.add(mesh);
  const pods = spots.map((home, i) => ({ home, pos: home.clone(), alive: true, radius: P.radius, id: 'pod', at: i, away: 0, grow: 1, phase: i * 1.9 }));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3();
  let popped = 0;

  return {
    /** Spheres the aim can lock to. */
    get targets() { return pods; },
    get popped() { return popped; },
    /** Bursts any pod a flying resident touches. Returns true if it burst one (the caller refills flings). */
    touch(b, radius, isLead) {
      if (b.grounded) return false;
      for (const pod of pods) {
        if (!pod.alive || Math.abs(b.pos.x - pod.pos.x) > 4 || Math.abs(b.pos.y - pod.pos.y) > 4) continue;
        if (b.pos.distanceTo(pod.pos) > P.radius + radius) continue;
        pod.alive = false; pod.away = P.regrow; pod.grow = 0; popped++;
        b.vel.x *= P.keep; b.vel.z *= P.keep; b.vel.y = Math.max(b.vel.y, P.lift);
        burst(pod.pos, '#ffb86b', 22, 13, 7); burst(pod.pos, '#ff9fd8', 12, 8, 5);
        if (isLead) sfx.pod(popped);
        return true;
      }
      return false;
    },
    update(dt, time) {
      pods.forEach((pod, i) => {
        if (!pod.alive) { pod.away -= dt; if (pod.away <= 0) pod.alive = true; }
        else pod.grow = Math.min(pod.grow + dt * 1.6, 1);
        pod.pos.set(pod.home.x + Math.sin(time * 0.31 + pod.phase) * 0.6, pod.home.y + Math.sin(time * 0.7 + pod.phase) * P.bob, pod.home.z + Math.cos(time * 0.27 + pod.phase) * 0.6);
        const g = pod.alive ? pod.grow * pod.grow * (3 - 2 * pod.grow) : 0;
        m4.compose(pod.pos, q.setFromEuler(e.set(Math.sin(time * 0.9 + pod.phase) * 0.08, time * 0.2 + pod.phase, Math.cos(time * 0.8 + pod.phase) * 0.08)), s.setScalar(g * (1 + Math.sin(time * 2 + pod.phase) * 0.03)));
        mesh.setMatrixAt(i, m4);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
