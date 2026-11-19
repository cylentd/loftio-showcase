// Shockwaves: the Pop special and the Skyfall crash. Each is a ground ring and a dome of pure light, plus a ripple through the meadow.
import * as THREE from 'three';
import { slamPower, slamReach } from './creature-model.mjs';
import { PLAY, SLAM_VIEW } from './play-constants.js';

const waveMat = () => new THREE.MeshBasicMaterial({ color: new THREE.Color(.5, 1.6, 1.3), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });

export function createWave(scene) {
  const wave = { at: new THREE.Vector3(), age: 9, floor: 0, range: PLAY.popRange,
    ring: new THREE.Mesh(new THREE.RingGeometry(.82, 1, 72), waveMat()),
    dome: new THREE.Mesh(new THREE.SphereGeometry(1, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), waveMat()) };
  wave.ring.rotation.x = -Math.PI / 2; wave.ring.visible = wave.dome.visible = false; wave.ring.renderOrder = wave.dome.renderOrder = 4;
  scene.add(wave.ring, wave.dome);
  return wave;
}

export function updateWave(c, dt) {
  const { wave, world, P } = c;
  const U = world.terrain.uniforms;
  wave.age += dt;
  const f = wave.age / P.popTime, on = f < 1;
  wave.ring.visible = wave.dome.visible = on;
  U.uPopPower.value = on ? (1 - f) * (1 - f) : 0;
  if (!on) return;
  const reach = wave.range * (1 - (1 - f) * (1 - f)); // fast at first, easing out
  U.uPop.value.set(wave.at.x, wave.at.y, wave.at.z, reach);
  wave.ring.position.set(wave.at.x, wave.floor + .25, wave.at.z); wave.ring.scale.setScalar(reach);
  wave.ring.material.opacity = (1 - f) * .9;
  wave.dome.position.set(wave.at.x, wave.floor, wave.at.z); wave.dome.scale.setScalar(reach);
  wave.dome.material.opacity = (1 - f) * (1 - f) * .22;
}

/** Start the wave at `at`, colour it, and set how far it runs. */
function startWave(c, at, range, rgb) {
  const { wave, floorAt } = c;
  wave.at.copy(at); wave.age = 0; wave.floor = floorAt(at.x, at.z, at.y); wave.range = range;
  for (const part of [wave.ring, wave.dome]) part.material.color.setRGB(...rgb);
}

// The gold crash of a high dive: bursts and a puff that grow with the drop, and the camera shakes (owner, 2026-11-18)
export function slamFlourish(c, at, power) {
  const { puff, toys, state } = c;
  if (!(power > 0)) return;
  const reach = slamReach(power);
  puff(at, reach * SLAM_VIEW.puff, SLAM_VIEW.gold);
  toys.burst(at, SLAM_VIEW.gold, SLAM_VIEW.burst * power + SLAM_VIEW.burstMin, SLAM_VIEW.speed, SLAM_VIEW.life);
  toys.burst(at, SLAM_VIEW.white, SLAM_VIEW.burst * power / 2 + SLAM_VIEW.burstMin, SLAM_VIEW.speed * SLAM_VIEW.coreSpread, SLAM_VIEW.life * SLAM_VIEW.coreSpread);
  state.shake = Math.max(state.shake, SLAM_VIEW.shakeMin + (1 - SLAM_VIEW.shakeMin) * power); state.pop = 1;
}

/** A Skyfall onto the ground sends a shockwave out along it, as far as the drop was high. */
export function slamHit(c, b, fall) {
  const { toys, monster, world, hud } = c;
  const power = slamPower(fall);
  if (!(power > 0)) return;
  const reach = slamReach(power);
  startWave(c, b.pos, reach, SLAM_VIEW.waveRGB);
  slamFlourish(c, b.pos, power);
  toys.pop(b.pos, reach);
  const damage = monster.slam(b.pos, power);
  for (const k of world.canopies) if (Math.hypot(k[0] - b.pos.x, k[2] - b.pos.z) < reach + k[3]) world.shake(k[4], SLAM_VIEW.canopyShake, Math.atan2(k[2] - b.pos.z, k[0] - b.pos.x));
  hud.flash(damage ? `Skyfall! ${damage}` : 'Skyfall!');
}

/** The special move, "Pop": a shockwave. It staggers and shoves monsters, flattens the grass in a ring,
 *  rattles everything loose nearby, and throws you upward with your air flings refilled. */
export function popSpecial(c) {
  const { state, P, lead, puff, toys, monster, world, hud, sfx } = c;
  if (!state.active || state.popCool > 0) return;
  state.popCool = P.popCooldown;
  // the wave itself: a ring racing out along the ground, a dome of light, and a ripple through the grass
  startWave(c, lead.pos, P.popRange, SLAM_VIEW.popRGB);
  puff(lead.pos, P.popRange * 2.2, '#8ff5e0'); puff(lead.pos, P.popRange * 1.1, '#ffffff');
  toys.burst(lead.pos, '#8ff5e0', 46, 26, 9); toys.burst(lead.pos, '#fff1b8', 30, 17, 14);
  toys.pop(lead.pos, P.popRange);
  const hits = monster.pop(lead.pos, P.popRange);
  for (const k of world.canopies) if (Math.hypot(k[0] - lead.pos.x, k[2] - lead.pos.z) < P.popRange + k[3]) world.shake(k[4], 1.4, Math.atan2(k[2] - lead.pos.z, k[0] - lead.pos.x));
  // you ride it: straight up from the ground, or a strong second wind in the air
  lead.propulsion = 0; lead.dive = 0;
  if (lead.grounded) { lead.grounded = false; lead.isle = null; lead.vel.copy(lead.walkVel).setY(P.popLaunch); lead.walkVel.set(0, 0, 0); }
  else lead.vel.y = Math.max(lead.vel.y, P.popLift);
  lead.squash = -0.8; state.air = P.airFlings; state.cool = 0;
  state.pop = 1; state.shake = Math.max(state.shake, hits ? 1 : 0.7);
  if (hits) hud.flash(hits > 1 ? 'Pop! ×' + hits : 'Pop!');
  sfx.pop(hits);
}
