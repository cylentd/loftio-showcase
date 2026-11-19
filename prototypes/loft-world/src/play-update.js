// One frame of Explore mode: clock, physics substeps, the world around the residents, then the camera.
import * as THREE from 'three';
import { counterOpen } from './creature-model.mjs';
import { drawResidents } from './resident-view.js';
import { TRAVERSAL } from './traversal-constants.mjs';
import { updateWisps, updateTrail, updateRings } from './play-effects.js';
import { updateBuddy, updateReturn } from './play-buddy.js';
import { updateCamera } from './play-camera.js';
import { updateWave } from './play-wave.js';
import { step } from './play-step.js';
import { walk } from './play-walk.js';

/** Slow motion and hit-stop: returns the simulation's dt. `real` is the untouched frame time. */
function scaleTime(c, dt) {
  const { state, lead, P } = c;
  // Only an available airborne aim slows simulation; release and hit use real dt.
  const real = dt;
  // a landed hit freezes the world for a beat; aiming in the air with a fling left slows it
  state.slow = 0; state.freeze = Math.max((state.freeze || 0) - real, 0);
  // air flings refill on the ground and on any real contact (a bounce, a tree, a rock, a monster)
  const impact = lead.traversal.lastImpact?.id ?? 0;
  if (lead.grounded || impact !== state.seenImpact) state.air = P.airFlings;
  state.seenImpact = impact;
  dt *= state.freeze > 0 ? P.hitStopRate : state.aim && !lead.grounded ? P.aimSlow : 1;
  state.simTime = (state.simTime || 0) + dt; state.realTime = (state.realTime || 0) + real;
  state.cool = Math.max(state.cool - dt, 0);
  state.popCool = Math.max(state.popCool - real, 0);
  return dt;
}

/** The physics, in as many substeps as the fastest body needs not to skip through a collider. */
function simulate(c, dt, time) {
  const { bodies, monster, support, state, toys, P } = c;
  const fastest = Math.max(...bodies.map((b) => b.vel.length()));
  const sub = Math.min(TRAVERSAL.maxSubsteps, Math.max(1, Math.ceil(dt / TRAVERSAL.maxStep), Math.ceil(fastest * dt / TRAVERSAL.maxTravel)));
  for (let s = 0; s < sub; s++) {
    monster.update(dt / sub, time, bodies);
    support.steerZip(dt / sub);
    for (const b of bodies) {
      b.traversal.begin(); b.previous = { ...b.pos };
      if (!b.hover) step(c, b, dt / sub, b === c.lead && state.diving && !b.grounded);
      toys.touch(b, P.radius, b === c.lead); b.traversal.end();
    }
    support.afterPhysics();
  }
}

/** An encounter is on while a living monster that has noticed you is within reach. The battle music
 *  holds a few seconds past the end, so a monster dropping or a brief retreat does not flick it off and on. */
function updateSound(c, real) {
  const { monster, lead, P, state, sfx, lake } = c;
  let fighting = false;
  for (const m of monster.states) if (m.alive && m.engaged && m.pos.distanceTo(lead.pos) < P.encounterRange) fighting = true;
  state.calm = fighting ? 0 : (state.calm ?? 99) + real;
  state.encounter = fighting || state.calm < P.encounterLinger;
  sfx.encounter?.(state.encounter);
  // open water nearby is heard: the lake, and faintly the creek
  const shore = Math.hypot(lead.pos.x - lake.x, lead.pos.z - lake.z) - lake.r;
  sfx.water?.(THREE.MathUtils.clamp(1 - shore / 38, 0, 1) * (lead.wet && lead.grounded ? 1 : 0.7));
}

/** Everything in the world that moves on its own, after the residents have. */
function updateScenery(c, dt, time, real) {
  const { bodies, monster, P, world, toys, pods, life, lead, neighbours, reducedMotion, camera, support, state, floorAt } = c;
  bodies.forEach((b, i) => { if (b.grounded) monster.touch(b, P.radius, false, false); world.terrain.bodies[i].copy(b.pos); });
  toys.update(dt, time);
  pods.update(dt, time);
  life.update(dt, time, lead.pos);
  monster.draw(state.aim, lead); neighbours.update(dt, reducedMotion.matches);
  drawResidents(bodies, camera, support.state, real, reducedMotion.matches, { aiming: !!state.aim, charging: state.charging, floorAt });
}

export function updateFrame(c, dt, time) {
  const { state, lead, hud, support, monster, P, driftShots, counterCue } = c;
  if (!state.active) return;
  const real = dt;
  dt = scaleTime(c, dt);
  const bankTarget = lead.grounded ? null : support.bankTarget(monster.lastLeadHit);
  // the button turns gold while F would counter its target, matching the sparks over the monster
  hud.special(lead.grounded ? 1 - state.popCool / P.popCooldown : Number(!!bankTarget), !lead.grounded, counterOpen(bankTarget));
  walk(c, dt);
  simulate(c, dt, time);
  driftShots.update(dt); counterCue.update(state.simTime);
  updateBuddy(c, dt); updateReturn(c, dt); updateWave(c, real);
  updateSound(c, real);
  updateScenery(c, dt, time, real);
  updateWisps(c, dt, time);
  updateTrail(c, real);
  updateRings(c, dt);
  updateCamera(c, real, time); // the camera runs on real time, so slow motion still feels smooth
}
