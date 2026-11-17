// Things that answer when touched: springy mushroom pads, kickable puffballs, chime flowers, boost hoops,
// and a pool of loose particles (leaves, sparkles) for anything that wants to burst.
import * as THREE from 'three';
import { softMaterial } from './glsl.js';
import { mushrooms } from './flora.js';
import { blob, merge, place, rng, tint } from './util.js';
import { sweepSphere } from './contact-model.mjs';

export const TOYS = {
  padLaunch: 30, // a pad sends you about 20 units up
  padCooldown: 0.25,
  puffRadius: 1.15,
  puffKick: 1.15, // share of the resident's speed a puffball takes
  puffLift: 6,
  puffBounce: 0.55,
  chimeReach: 1.9,
  chimeCooldown: 0.6,
  hoopRadius: 3.4,
  hoopSpeed: 30, // how fast a hoop carries you to the next one
  hoopCooldown: 0.5,
  gravity: 22,
};

const m4 = new THREE.Matrix4(), quat = new THREE.Quaternion(), euler = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(), n = new THREE.Vector3();

export function createToys({ scene, world, sfx, glow }) {
  const T = TOYS, R = rng(404), H = world.terrain.heightAt, lake = world.lake;
  const instanced = (geo, count, mat = softMaterial()) => { const m = new THREE.InstancedMesh(geo, mat, count); m.frustumCulled = false; scene.add(m); return m; };
  const put = (mesh, i, x, y, z, ry, sx, sy = sx, sz = sx, rx = 0, rz = 0) => mesh.setMatrixAt(i, m4.compose(v.set(x, y, z), quat.setFromEuler(euler.set(rx, ry, rz)), s.set(sx, sy, sz)));

  // ---- Loose particles ----
  const N = 260, pPos = new Float32Array(N * 3).fill(-9999), pCol = new Float32Array(N * 3), pVel = new Float32Array(N * 3), pLife = new Float32Array(N);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ map: glow, size: 0.75, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  particles.frustumCulled = false;
  scene.add(particles);
  let pAt = 0;
  const hue = new THREE.Color();
  function burst(p, color, count, speed = 7, up = 4) {
    hue.set(color);
    for (let k = 0; k < count; k++) {
      const i = pAt++ % N;
      pPos[i * 3] = p.x; pPos[i * 3 + 1] = p.y; pPos[i * 3 + 2] = p.z;
      pVel[i * 3] = (Math.random() - 0.5) * speed; pVel[i * 3 + 1] = Math.random() * up + 1; pVel[i * 3 + 2] = (Math.random() - 0.5) * speed;
      pCol[i * 3] = hue.r * 1.6; pCol[i * 3 + 1] = hue.g * 1.6; pCol[i * 3 + 2] = hue.b * 1.6;
      pLife[i] = 0.7 + Math.random() * 0.7;
    }
  }

  // ---- Pads: giant mushrooms that squash and spring ----
  const pads = world.padSpots.map((p) => ({ p, hit: 9, cool: 0 }));
  const padMesh = instanced(mushrooms([[0, 0, 0, 6]], '#b86e43').geometry, pads.length, softMaterial({ fuzz: 0, gloss: 0.7 }));
  padMesh.material.uniforms.uOccluder.value = 1;

  // ---- Puffballs: soft balls you can kick around ----
  const puffGeo = tint(blob(3, 0.08, 2.2, 2), '#ffe1ee', 0.12, (c, x, y, z) => c.lerp(hue.set('#bfe8ff'), Math.max(Math.sin(x * 5 + z * 4), 0) * 0.7).multiplyScalar(0.7 + 0.3 * (y + 1) / 2));
  const puffs = [];
  for (let tries = 0; puffs.length < 7 && tries < 400; tries++) {
    const x = (R() * 2 - 1) * 110, z = (R() * 2 - 1) * 110, m = world.terrain.maskAt(x, z);
    if (m.wet > 0.05 || Math.hypot(x, z) < 12) continue;
    puffs.push({ pos: new THREE.Vector3(x, H(x, z) + T.puffRadius, z), vel: new THREE.Vector3(), rot: new THREE.Euler(R() * 6, R() * 6, 0), size: 0.85 + R() * 0.5, squash: 0, still: true });
  }
  const puffMesh = instanced(puffGeo, puffs.length);

  // ---- Chime flowers: ring a note and flare when brushed ----
  const chimeGeo = merge([
    place(tint(new THREE.CylinderGeometry(0.05, 0.08, 2.4, 6), '#3f8a4a'), 0, 1.2, 0),
    place(tint(new THREE.ConeGeometry(0.55, 0.9, 10, 1, true), '#ffe6a0', 0.75), 0, 2.5, 0, Math.PI),
    place(tint(new THREE.SphereGeometry(0.16, 8, 6), '#fff6d8', 1), 0, 2.2, 0),
  ]);
  const chimes = [];
  for (let tries = 0; chimes.length < 8 && tries < 500; tries++) {
    const x = (R() * 2 - 1) * 100, z = (R() * 2 - 1) * 100, m = world.terrain.maskAt(x, z);
    if (m.wet + m.path + m.sand > 0.05) continue;
    chimes.push({ x, y: H(x, z), z, note: chimes.length % 8, ring: 9, cool: 0, lean: R() * 6 });
  }
  const chimeMesh = instanced(chimeGeo, chimes.length);

  return {
    burst,
    /** The special move: everything loose within range is shoved away and every chime rings. */
    pop(p, range) {
      for (const c of chimes) {
        if (Math.hypot(c.x - p.x, c.z - p.z) > range) continue;
        c.ring = 0; c.lean = Math.atan2(c.x - p.x, c.z - p.z);
        sfx.bell(c.note);
      }
      for (const b of puffs) {
        const d = b.pos.distanceTo(p);
        if (d > range) continue;
        n.subVectors(b.pos, p).setY(0).normalize();
        b.vel.copy(n).multiplyScalar(22 * (1 - d / range) + 8).setY(13);
        b.still = false; b.squash = 1;
      }
    },
    /** Called for each airborne resident each physics step. Returns true if a toy changed its velocity. */
    touchFlying(b, radius, isLead, fx) {
      let hit = false;
      for (const pad of pads) {
        v.copy(pad.p).setY(pad.p.y + 1.7);
        const contact=sweepSphere(b.previous??b.pos,b.pos,v,1.8+radius);
        if(contact) {
          const response=b.traversal.contact(`pad:${pads.indexOf(pad)}`,'spring',contact.normal);
          if(!response.qualifying||pad.cool>0)continue;
          b.vel.copy(response.outgoing);b.pos.copy(contact.point);
          pad.hit = 0; pad.cool = T.padCooldown; hit = true;
          burst(v, '#b86e43', 10, 6, 6);
          if (isLead) { sfx.pad(); fx.pop(0.6); }
        }
      }
      return hit;
    },
    /** Called for every resident every frame, walking or flying. */
    touch(b, radius, isLead) {
      for (const c of chimes) {
        if (c.cool > 0 || Math.abs(b.pos.x - c.x) > 3 || Math.abs(b.pos.z - c.z) > 3 || b.pos.y - c.y > 4.5) continue;
        if (Math.hypot(b.pos.x - c.x, b.pos.z - c.z) < T.chimeReach) {
          c.ring = 0; c.cool = T.chimeCooldown; c.lean = Math.atan2(c.x - b.pos.x, c.z - b.pos.z);
          burst(v.set(c.x, c.y + 2.4, c.z), '#fff1b8', 6, 3, 3);
          sfx.bell(c.note);
        }
      }
      for (const p of puffs) {
        const reach = T.puffRadius * p.size + radius;
        const contact=sweepSphere(b.previous??b.pos,b.pos,p.pos,reach);
        if(!contact)continue;
        const velocity=b.grounded?b.walkVel:b.vel;
        const response=b.traversal.contact(`puff:${puffs.indexOf(p)}`,'foliage',contact.normal,velocity,p.vel);
        if(!response.qualifying)continue;
        n.subVectors(p.pos, b.pos).setY(0);
        if (n.lengthSq() < 0.0001) n.set(1, 0, 0);
        n.normalize();
        const speed = response.incomingNormalSpeed;
        if(!b.grounded){b.vel.copy(response.outgoing);b.propulsion=0;}
        p.vel.copy(n).multiplyScalar(4 + speed * T.puffKick).setY(T.puffLift + speed * 0.25);
        if (!b.grounded) p.vel.addScaledVector(b.vel, 0.4);
        p.pos.addScaledVector(n, reach - p.pos.distanceTo(b.pos) + 0.05);
        p.still = false; p.squash = 1;
        if (isLead) sfx.boop(p.size);
      }
    },
    update(dt, time) {
      pads.forEach((pad, i) => {
        pad.hit += dt; pad.cool -= dt;
        const k = Math.exp(-pad.hit * 5) * Math.cos(pad.hit * 20);
        put(padMesh, i, pad.p.x, pad.p.y, pad.p.z, i * 1.7, 1 + k * 0.25, 1 - k * 0.45);
      });
      padMesh.instanceMatrix.needsUpdate = true;

      puffs.forEach((p, i) => {
        if (!p.still) {
          p.vel.y -= T.gravity * dt;
          p.pos.addScaledVector(p.vel, dt);
          const rad = T.puffRadius * p.size, wet = Math.hypot(p.pos.x - lake.x, p.pos.z - lake.z) < lake.r * 1.4;
          const gy = Math.max(H(p.pos.x, p.pos.z), wet ? lake.y - rad * 0.5 : -1e9);
          if (p.pos.y - rad < gy) {
            world.terrain.normalAt(p.pos.x, p.pos.z, n);
            p.pos.y = gy + rad;
            const vn = p.vel.dot(n);
            if (vn < 0) { if (vn < -5) p.squash = Math.min(-vn / 20, 1); p.vel.addScaledVector(n, -(1 + (vn < -3 ? T.puffBounce : 0)) * vn); }
            p.vel.multiplyScalar(1 - 1.4 * dt);
            if (p.vel.lengthSq() < 0.3 && n.y > 0.9) { p.vel.set(0, 0, 0); p.still = true; }
          }
          const far = Math.hypot(p.pos.x, p.pos.z);
          if (far > 200) p.vel.addScaledVector(v.set(-p.pos.x / far, 0, -p.pos.z / far), 30 * dt);
          p.rot.x += p.vel.z * dt * 0.8; p.rot.z -= p.vel.x * dt * 0.8;
        }
        p.squash += (0 - p.squash) * Math.min(dt * 8, 1);
        const q = 1 - p.squash * 0.3;
        m4.compose(p.pos, quat.setFromEuler(p.rot), s.set(T.puffRadius * p.size / q, T.puffRadius * p.size * q, T.puffRadius * p.size / q));
        puffMesh.setMatrixAt(i, m4);
      });
      puffMesh.instanceMatrix.needsUpdate = true;

      chimes.forEach((c, i) => {
        c.ring += dt; c.cool -= dt;
        const k = Math.exp(-c.ring * 3) * Math.sin(c.ring * 16), flare = 1 + Math.exp(-c.ring * 4) * 0.5;
        const sway = Math.sin(time * 1.2 + i) * 0.05;
        put(chimeMesh, i, c.x, c.y - 0.1, c.z, c.lean, flare, 1, flare, k * 0.5 + sway, 0);
      });
      chimeMesh.instanceMatrix.needsUpdate = true;

      for (let i = 0; i < N; i++) {
        if (pLife[i] <= 0) continue;
        pLife[i] -= dt;
        pVel[i * 3 + 1] -= 9 * dt;
        pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
        if (pLife[i] <= 0) pPos[i * 3 + 1] = -9999;
      }
      pGeo.attributes.position.needsUpdate = true;
      pGeo.attributes.color.needsUpdate = true;
    },
  };
}
