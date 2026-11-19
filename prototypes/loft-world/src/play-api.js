// The methods main.js and the QA scripts call on the play object: aiming, the view, and start/stop.
import * as THREE from 'three';
import { AIM, TREE_BANK } from './control-constants.mjs';
import { carryLaunch } from './traversal-model.mjs';
import { snapCamera } from './play-camera.js';
import { endReturn } from './play-buddy.js';
import { popSpecial } from './play-wave.js';

/** Aiming and the release of a fling. */
export function createAimApi(c) {
  const { lead, state, P, monster, puff, aim, support, sfx, lockable } = c;
  return {
    aimMove(x, y, w, h, power, pixels) { aim.move(x, y, w, h, power, pixels, lockable()); },
    /** What a fling from this screen point would lock on to, without starting an aim. Used by the reticle. */
    targetAt(x, y, w, h) {
      const held = state.aim;
      aim.move(x, y, w, h, 1, AIM.deadPixels + 1, lockable());
      const target = state.aim?.target ?? null;
      state.aim = held; aim.refresh();
      return target;
    },
    aimCancel() { aim.cancel(); support.cancel(); },
    aimEnd() {
      let v = aim.velocity(); const selected = state.aim;
      const bank = v && selected?.target.bankId && aim.bankPreview(v);
      aim.cancel();
      if (!state.active || !v) return;
      support.cancelBankStrike?.();
      // speed you already have in the fling's direction carries into it
      v = carryLaunch(lead.grounded ? lead.walkVel : lead.vel, v) ?? v;
      const distance = lead.pos.distanceTo(new THREE.Vector3().copy(selected.target));
      state.cool = P.flingCooldown;
      state.lastRelease = { origin: { ...lead.pos }, target: { ...selected.target }, velocity: { ...v } };
      lead.vel.copy(v);
      lead.propulsion = bank ? TREE_BANK.propulsion : Math.min(AIM.propulsion, distance / lead.vel.length());
      lead.grounded = false; lead.dive = 0; lead.squash = -0.7;
      // Chomper floats out ahead as something to bump off, unless he is what you just aimed at
      // flinging at Chomper is the only thing that makes him solid: he holds still for it
      state.lockBuddy = selected.target.enemyId === 'chomper';
      // flung at a monster: Chomper follows your shot in for a second hit
      if (monster.states.some((m) => m.id === selected.target.enemyId)) support.fling(selected);
      state.pop = 0.5; state.flings = (state.flings || 0) + 1;
      puff(lead.pos, 9, '#fff1b8');
      sfx.fling(selected.power);
    },
  };
}

/** Looking around and screen-to-world helpers. */
export function createViewApi(c) {
  const { state, camera, lead, P } = c;
  return {
    screenPoint(p, w, h) { const v = new THREE.Vector3().copy(p).project(camera); return { x: (v.x + 1) * w / 2, y: (1 - v.y) * h / 2, visible: v.z < 1 }; },
    setDive(on) { state.diving = on; },
    snapCamera() { snapCamera(c); },
    /** Drag to look around: pixels moved. */
    orbit(dx, dy) {
      state.yaw -= dx * 0.0055;
      state.pitch = THREE.MathUtils.clamp(state.pitch + dy * 0.004, -0.12, 1.25);
      state.camIdle = 0;
    },
    zoom(factor) { state.zoom = THREE.MathUtils.clamp(state.zoom * factor, 0.45, 2.4); },
    /** True when a press at these screen pixels is on or near the leader, so it should start a fling. */
    nearLead(x, y, w, h) {
      const t = c.tmp.copy(lead.pos).project(camera);
      if (t.z > 1) return false;
      return Math.hypot((t.x * 0.5 + 0.5) * w - x, (-t.y * 0.5 + 0.5) * h - y) < Math.min(w, h) * P.flingGrab;
    },
  };
}

function resetBodies(c) {
  const { world, H, P, bodies, state, lead } = c;
  const s = world.start;
  bodies.forEach((b, i) => {
    const x = s.x - i * 1.4, z = s.z + i * 2.2;
    b.pos.set(x, H(x, z) + P.radius, z); b.vel.set(0, 0, 0);
    b.propulsion = 0; b.walkVel.set(0, 0, 0);
    b.grounded = true; b.spin = 0; b.dive = 0; b.isle = null; b.dizzy = 0; b.away = false; b.hover = false;
  });
  state.air = P.airFlings; state.lockBuddy = false; state.seenImpact = 0;
  state.yaw = Math.atan2(s.faceX - lead.pos.x, s.faceZ - lead.pos.z);
}

function reset(c) {
  const { monster, neighbours, support, state, bodies, input, aim, P } = c;
  monster.reset(); neighbours.reset();
  c.resetFeedback(); support.reset(); state.simTime = 0; state.realTime = 0; state.freeze = state.slow = 0; for (const b of bodies) { b.traversal.reset(); b.previous = null; } input.jump = input.jumpHeld = false;
  aim.cancel(); state.cool = 0; state.charging = false; state.charge = 0;
  state.pitch = P.camPitch; state.zoom = 1; state.lastRelease = null;
  resetBodies(c);
}

function setVisible(c, on) {
  const { monster, neighbours, bodies, wisps, trail, aim } = c;
  monster.setVisible(on); neighbours.setVisible(on);
  for (const b of bodies) b.sprite.visible = on;
  wisps.mesh.visible = trail.points.visible = on; trail.comet.setVisible(on);
  aim.cancel();
}

/** Start, stop and the two special moves. */
export function createLifeApi(c) {
  const { state, driftShots, counterCue, hud, wisps, fader, sfx, support, bodies, lead, monster, aim } = c;
  const api = {
    start() { driftShots.reset(); counterCue.reset(); state.active = true; reset(c); setVisible(c, true); hud.show(true); hud.count(wisps.collected, wisps.list.length); },
    stop() { driftShots.reset(); counterCue.reset(); fader.reset(); sfx.encounter?.(false); state.calm = 99; state.active = false; support.reset(); for (const b of bodies) b.traversal.reset(); setVisible(c, false); hud.show(false); state.aim = null; },
    pressSpecial() {
      if (!state.active) return;
      if (lead.grounded) { api.special(); return; }
      if (!support.bank({ x: Math.sin(state.yaw), y: 0, z: Math.cos(state.yaw) }, monster.lastLeadHit)) return;
      if (c.ret) endReturn(c);
      aim.cancel(); state.lockBuddy = false;
    },
    special() { popSpecial(c); },
  };
  return api;
}
