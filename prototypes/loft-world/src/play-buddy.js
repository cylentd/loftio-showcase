// Chomper's own movement: the combo return that bats Sprout back in, and how he follows and potters about.
import * as THREE from 'three';
import { AIM } from './control-constants.mjs';
import { bumpOff, teamBump } from './play-team.js';

// ---- Combo return: sometimes, when you bounce off a monster, Chomper pops up in your path and bats you back in.
export function planReturn(c) {
  const { state, P, support, monster, lead, buddy, puff, sfx } = c;
  if (c.ret || state.returnCool > 0 || Math.random() > P.returnChance || support.state.phase !== 'idle' || state.lockBuddy) return;
  let foe = null, gap = Infinity;
  for (const m of monster.states) { const g = m.alive ? m.pos.distanceTo(lead.pos) : Infinity; if (g < gap) { foe = m; gap = g; } }
  if (!foe) return;
  state.returnCool = P.returnEvery; c.ret = { foe, t: 0 };
  puff(buddy.pos, 6, '#ffd0f0'); sfx.poof();
  buddy.grounded = false; buddy.hover = true; buddy.vel.set(0, 0, 0); buddy.propulsion = 0; buddy.isle = null;
}

export function endReturn(c) { c.ret = null; c.buddy.hover = false; }

export function updateReturn(c, dt) {
  const { state, P, lead, buddy, floorAt, tmp, tmp2 } = c;
  const ret = c.ret;
  state.returnCool = Math.max((state.returnCool || 0) - dt, 0);
  if (!ret) return;
  ret.t += dt;
  // he heads for where you will be a moment from now, so the two of you always meet
  tmp.copy(lead.pos).addScaledVector(lead.vel, Math.max(P.returnLead - ret.t, 0));
  tmp.y = Math.max(tmp.y, floorAt(tmp.x, tmp.z) + 2.5);
  buddy.pos.lerp(tmp, 1 - Math.exp(-dt * 20)); buddy.excited = .4;
  if (!lead.grounded && ret.t > P.returnLead * .6 && lead.pos.distanceTo(buddy.pos) < P.buddyRadius + .8) {
    if (ret.foe.alive) {
      // batted straight back at the monster, a little faster than you left it
      tmp2.subVectors(ret.foe.pos, lead.pos);
      const far = tmp2.length(), speed = Math.max(lead.vel.length() * 1.1, P.returnSpeed);
      lead.vel.copy(tmp2).setLength(speed); lead.propulsion = Math.min(AIM.propulsion * 1.4, far / speed); lead.dive = 0;
    }
    state.returns = (state.returns || 0) + 1;
    teamBump(c, 'Combo!');
    endReturn(c);
  } else if (ret.t > P.returnWait || lead.grounded) endReturn(c);
}

export function updateBuddy(c, dt) {
  const { state, lead, buddy, P, tmp, tmp2, support, floorAt, puff, sfx } = c;
  // you flung at him: the touch is the bump
  if (state.lockBuddy && !lead.grounded && lead.pos.distanceTo(buddy.pos) < P.buddyRadius) bumpOff(c);
  if (lead.grounded) state.lockBuddy = false;
  // Where he wants to be. While you walk: a loose spot well behind your path (in the world, so turning the
  // camera does not make him shuffle). While you stand: he potters about nearby, picking a new spot every few seconds.
  buddy.slot ||= new THREE.Vector3(-P.buddyBack, 0, P.buddySlotSide); buddy.followTarget ||= new THREE.Vector3();
  if (lead.grounded && lead.walkSpeed > 1) {
    tmp.copy(lead.walkVel).setY(0).normalize(); tmp2.set(-tmp.z, 0, tmp.x);
    buddy.slot.lerp(tmp.multiplyScalar(-P.buddyBack).addScaledVector(tmp2, P.buddySlotSide), Math.min(dt * 1.4, 1));
    buddy.roamIn = P.buddyRoamEvery[0];
  } else if (lead.grounded) {
    buddy.roamIn = (buddy.roamIn ?? P.buddyRoamEvery[0]) - dt;
    if (buddy.roamIn <= 0) {
      buddy.roamIn = P.buddyRoamEvery[0] + Math.random() * (P.buddyRoamEvery[1] - P.buddyRoamEvery[0]);
      const a = Math.random() * Math.PI * 2, r = P.buddyRoam[0] + Math.random() * (P.buddyRoam[1] - P.buddyRoam[0]);
      buddy.slot.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    }
  }
  buddy.followTarget.copy(lead.pos).add(buddy.slot);
  // Left behind by a fling: once you have landed he takes one easy leap over to you. No teleporting unless
  // you are a very long way off.
  buddy.leapIn = Math.max((buddy.leapIn || 0) - dt, 0);
  const gap = buddy.pos.distanceTo(lead.pos);
  if (buddy.grounded && lead.grounded && support.state.phase === 'idle' && !c.ret && buddy.leapIn <= 0 && gap > P.buddyLeapFrom) {
    buddy.leapIn = P.buddyLeapEvery; buddy.isle = null; buddy.propulsion = 0; buddy.dive = 0;
    tmp.copy(buddy.followTarget); tmp.y = floorAt(tmp.x, tmp.z, lead.pos.y + 2) + P.radius;
    if (gap > P.buddyLeapMax) {
      puff(buddy.pos, 5, '#ffd0f0'); buddy.pos.copy(tmp).setY(tmp.y + 2.5); buddy.vel.set(0, 2, 0); puff(buddy.pos, 5, '#ffd0f0'); sfx.poof();
    } else {
      // one arc that lands on his spot: longer leaps take a little longer and go a little higher
      const time = Math.min(Math.max(gap / P.buddyLeapSpeed, .75), 1.7);
      buddy.vel.subVectors(tmp, buddy.pos).divideScalar(time); buddy.vel.y += .5 * P.gravity * time; buddy.squash = -.5;
    }
    buddy.grounded = false;
  }
}
