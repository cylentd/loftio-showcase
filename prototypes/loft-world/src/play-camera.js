// Chase camera: lags behind, widens with speed, shakes on impact, stays above the ground. It runs on real time.
import * as THREE from 'three';
import { enemyFrameDistance } from './creature-model.mjs';
import { CAMERA } from './control-constants.mjs';
import { clearCamera } from './camera-model.mjs';
import { CHOMP_COMBO } from './teamwork-constants.mjs';

/** You own the camera. Only after you leave it alone for a while does it drift back behind fast movement. */
function steerView(c, dt) {
  const { lead, state, input, P, sfx } = c;
  const speed = lead.vel.length(), flat = Math.hypot(lead.vel.x, lead.vel.z);
  state.speed += (speed - state.speed) * Math.min(dt * 4, 1);
  state.camIdle += dt;
  if (input.turn) { state.yaw -= input.turn * P.turn * dt; state.camIdle = 0; }
  if (state.aim && !input.pad && (input.x || input.z)) {
    // aiming: A/D swing the view, W/S tilt it
    state.yaw -= input.x * P.turn * dt;
    state.pitch = THREE.MathUtils.clamp(state.pitch - input.z * P.turn * 0.6 * dt, -0.12, 1.25);
    state.camIdle = 0;
  }
  if (flat > 9 && !state.aim && state.camIdle > P.camRecenter && !lead.grounded) {
    const diff = Math.atan2(lead.vel.x, lead.vel.z) - state.yaw;
    state.yaw += Math.atan2(Math.sin(diff), Math.cos(diff)) * Math.min(dt * 0.9, 1);
  }
  sfx.wind(THREE.MathUtils.smoothstep(state.speed, 8, 70), state.diving && !lead.grounded);
}

/** Where the camera wants to be, eased toward it, plus the impact shake. Returns the numbers the later steps reuse. */
function followLead(c, dt, time) {
  const { lead, state, P, monster, goal, camPos, camera, tmp, floorAt } = c;
  const fast = THREE.MathUtils.smoothstep(state.speed, 14, 55), fall = THREE.MathUtils.clamp(-lead.vel.y / 50, 0, 1);
  const dist = enemyFrameDistance((P.camDistance + fast * 7) * state.zoom, monster.states, lead.pos), pitch = Math.min(state.pitch + fall * 0.25, 1.35);
  goal.set(lead.pos.x - Math.sin(state.yaw) * Math.cos(pitch) * dist, lead.pos.y + 1.2 + Math.sin(pitch) * dist, lead.pos.z - Math.cos(state.yaw) * Math.cos(pitch) * dist);
  goal.y = Math.max(goal.y, floorAt(goal.x, goal.z) + 1.6);
  // follow tightly sideways and softly in height, so hops do not bob the view
  const kxz = 1 - Math.exp(-dt * 9), ky = 1 - Math.exp(-dt * (lead.grounded ? 4 : 6));
  camPos.x += (goal.x - camPos.x) * kxz; camPos.z += (goal.z - camPos.z) * kxz; camPos.y += (goal.y - camPos.y) * ky;
  camPos.y = Math.max(camPos.y, floorAt(camPos.x, camPos.z) + 1.5);
  state.shake = Math.max(state.shake - dt * 1.6, 0); state.pop = Math.max(state.pop - dt * 1.5, 0);
  const sh = Math.pow(state.shake, 1.5);
  camera.position.copy(camPos).add(tmp.set(Math.sin(time * 91) * sh * 0.5, Math.sin(time * 77 + 1) * sh * 0.5, 0));
  return { fast, dist, pitch };
}

/** Slow-motion aim: the view tightens and leans toward what you are aiming at, and everything else softens. */
function leanView(c, dt) {
  const { state, lead, P, support, tmp, tmp2, focusSpot, look, monster, reducedMotion } = c;
  const focusing = state.aim && !lead.grounded ? 1 : 0;
  state.focus = (state.focus || 0) + (focusing - (state.focus || 0)) * Math.min(dt * (focusing ? 9 : 5), 1);
  tmp.copy(lead.pos).addScaledVector(lead.vel, 0.08).setY(lead.pos.y + 1.4 + (state.reticle ? P.reticleLift : 0));
  const strikeAt = support.strikeFocus();
  if (state.aim?.target) { state.focusPoint = focusSpot.copy(state.aim.target); tmp.lerp(tmp2.copy(focusSpot), P.focusLean * state.focus); }
  else if (strikeAt) {
    // Chomper strike: the view swings behind Sprout and frames the enemy he was sent at
    tmp.lerp(tmp2.copy(strikeAt), CHOMP_COMBO.frameLean);
    if (!reducedMotion.matches) {
      const diff = Math.atan2(strikeAt.x - lead.pos.x, strikeAt.z - lead.pos.z) - state.yaw;
      state.yaw += Math.atan2(Math.sin(diff), Math.cos(diff)) * Math.min(dt * CHOMP_COMBO.frameTurn, 1);
    }
  } else {
    state.focusPoint = null; // no locked target: the aim blur centres on the lead, not on a target from an earlier aim
    // in a fight the view leans toward the nearest monster, so both of you stay in frame
    let foe = null, gap = P.fightFrame;
    for (const m of monster.states) { const g = m.alive && m.engaged ? m.pos.distanceTo(lead.pos) : Infinity; if (g < gap) { foe = m; gap = g; } }
    if (foe) tmp.lerp(tmp2.copy(foe.pos), P.fightLean * (1 - gap / P.fightFrame));
  }
  look.lerp(tmp, 1 - Math.exp(-dt * 10));
}

/** Something is in the way. Do not push in to a close-up of the leader's face: rise over the obstacle instead. */
function clearView(c, pitch, dist) {
  const { camera, focusAt, obstacles, floorAt, P, tmp2, state } = c;
  let safe = clearCamera(focusAt, camera.position, obstacles, floorAt);
  if (Math.hypot(safe.x - focusAt.x, safe.y - focusAt.y, safe.z - focusAt.z) < P.camMin) {
    let found = false;
    for (const lift of [0.4, 0.8, 1.2]) {
      const p2 = Math.min(pitch + lift, 1.45);
      tmp2.set(focusAt.x - Math.sin(state.yaw) * Math.cos(p2) * dist, focusAt.y + Math.sin(p2) * dist, focusAt.z - Math.cos(state.yaw) * Math.cos(p2) * dist);
      const tried = clearCamera(focusAt, tmp2, obstacles, floorAt);
      if (Math.hypot(tried.x - focusAt.x, tried.y - focusAt.y, tried.z - focusAt.z) >= P.camMin) { safe = tried; found = true; break; }
    }
    // nothing clear: stay where the camera wanted to be and look through the leaves, never into the face
    if (!found) safe = { x: camera.position.x, y: Math.max(camera.position.y, focusAt.y + 2), z: camera.position.z };
  }
  return safe;
}

/** Glide to the chosen spot so a block or an unblock is a move, not a cut, then set the lens. */
function placeCamera(c, dt, safe, fast) {
  const { camera, camPos, look, state, P, tmp2 } = c;
  if (!state.camShown) state.camShown = new THREE.Vector3().copy(safe);
  state.camShown.lerp(tmp2.copy(safe), 1 - Math.exp(-dt * 11));
  camera.position.copy(state.camShown);
  state.camera = { position: { ...safe }, desired: { ...camPos }, blocked: Math.hypot(safe.x - camPos.x, safe.y - camPos.y, safe.z - camPos.z) > 1 };
  camera.lookAt(look);
  const fovGoal = (camera.aspect < 0.8 ? 66 : 52) + fast * 12 * (1 - state.focus) + state.pop * 7 - state.focus * P.focusZoom;
  camera.fov += (fovGoal - camera.fov) * Math.min(dt * (fovGoal > camera.fov ? 5 : 1.25), 1);
  camera.updateProjectionMatrix();
}

export function updateCamera(c, dt, time) {
  const { lead, focusAt, camera, fader, aim } = c;
  steerView(c, dt);
  const { fast, dist, pitch } = followLead(c, dt, time);
  leanView(c, dt);
  focusAt.copy(lead.pos).setY(lead.pos.y + CAMERA.focusHeight);
  placeCamera(c, dt, clearView(c, pitch, dist), fast);
  fader.update(camera.position, focusAt, dt); // scenery that hides the lead goes see-through, whole; the aim target and Chomper never cause it
  aim.refresh();
}

export function snapCamera(c) {
  const { state, camPos, lead, look } = c;
  state.camShown = null;
  camPos.set(lead.pos.x - Math.sin(state.yaw) * 15, lead.pos.y + 5.5, lead.pos.z - Math.cos(state.yaw) * 15);
  look.copy(lead.pos);
}
