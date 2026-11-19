// Chomper, the teammate: Sprout's bumps off him, his charge at a monster, and the payoff of a combo.
import { AIM } from './control-constants.mjs';
import { createSupport } from './companion-runtime.js';
import { CHOMP_COMBO } from './teamwork-constants.mjs';
import { TEAM_COPY } from './teamwork-copy.mjs';
import { stand } from './play-walk.js';

/** The companion support (jump boost, follow-up fling, flank zip) wired to Sprout's body, the hud and the effects. */
export function createTeamSupport(c) {
  const { lead, bodies, monster, sfx, floorAt, state, puff, tmp } = c;
  return createSupport({ lead, buddy: bodies[1], monster, stand: (...args) => stand(c, ...args), sfx, floorAt, onContact: (event) => {
    lead.traversal.support(event);
    if (event.bank) state.diving = false;
    // the bump says whether F was timed: a counter, or a zip the monster saw coming
    teamBump(c, event.bank ? (event.counter ? TEAM_COPY.counter : TEAM_COPY.read) : 'Boost!');
  }, onSpit: () => {
    // Chomper slings Sprout around to the enemy's back; the trail flares for the zip and the hit is yours.
    lead.squash = -.8; bodies[1].squash = -.6; state.spitGlow = 1;
    state.pop = Math.max(state.pop, CHOMP_COMBO.spitPop);
    puff(lead.pos, CHOMP_COMBO.spitPuff, CHOMP_COMBO.color); sfx.fling(1);
  }, onBlink: ({ from, to }) => {
    // a far-off Chomper poofs out and back in beside Sprout, like his catch-up teleport
    puff(tmp.set(from.x, from.y, from.z), CHOMP_COMBO.blinkOut, CHOMP_COMBO.color); puff(tmp.set(to.x, to.y, to.z), CHOMP_COMBO.blinkIn, CHOMP_COMBO.color); sfx.poof();
  } });
}

/** Payoff: a counter or new-angle hit lands heavier than an ordinary hit and re-arms F for the next link. */
export function chompCombo(c, counter) {
  const { state, support, toys, lead, hud, sfx } = c;
  const chain = support.chain;
  state.shake = Math.max(state.shake, CHOMP_COMBO.payoffShake); state.pop = Math.max(state.pop, CHOMP_COMBO.payoffPop);
  toys.burst(lead.pos, CHOMP_COMBO.color, CHOMP_COMBO.payoffBurst, CHOMP_COMBO.payoffSpeed, CHOMP_COMBO.payoffUp);
  toys.burst(lead.pos, CHOMP_COMBO.coreColor, CHOMP_COMBO.payoffBurst / 2, CHOMP_COMBO.coreSpeed, CHOMP_COMBO.coreUp);
  if (counter) toys.burst(lead.pos, CHOMP_COMBO.counterColor, CHOMP_COMBO.payoffBurst, CHOMP_COMBO.counterSpeed, CHOMP_COMBO.counterUp);
  state.spitGlow = 0; state.chomps = (state.chomps || 0) + 1;
  const label = counter ? TEAM_COPY.counterHit : chain > 1 ? TEAM_COPY.chain : TEAM_COPY.combo;
  hud.flash(chain > 1 ? `${label} ×${chain}` : label); sfx.chompCombo?.(chain);
}

/** He flings himself at the nearest monster that has noticed you. Returns true if there was one. */
export function buddyCharge(c) {
  const { monster, buddy, P, puff } = c;
  let foe = null, gap = P.buddyAttackRange;
  for (const m of monster.states) { const g = m.alive && m.engaged ? m.pos.distanceTo(buddy.pos) : Infinity; if (g < gap) { foe = m; gap = g; } }
  if (!foe) return false;
  buddy.grounded = false; buddy.dive = 0; buddy.isle = null;
  buddy.vel.subVectors(foe.pos, buddy.pos).setLength(P.flingSpeed * 1.15);
  buddy.propulsion = Math.min(AIM.propulsion * 1.6, gap / buddy.vel.length()); buddy.squash = -.6; buddy.excited = .6;
  puff(buddy.pos, 8, '#ffd0f0');
  return true;
}

/** Shared by every kind of bump: your flings come back and the moment is marked. */
export function teamBump(c, label) {
  const { state, P, lead, buddy, puff, toys, hud, sfx } = c;
  state.air = P.airFlings; state.cool = 0; state.bumps = (state.bumps || 0) + 1;
  lead.squash = 1; buddy.squash = 1; buddy.excited = .6;
  puff(buddy.pos, 16, '#ffe6a0'); toys.burst(buddy.pos, '#ffe6a0', 18, 12, 5);
  state.pop = Math.max(state.pop, .7); state.shake = Math.max(state.shake, .4);
  hud.flash(label); sfx.bump();
}

export function bumpOff(c) {
  const { tmp2, lead, buddy, P, state } = c;
  const gap = tmp2.subVectors(lead.pos, buddy.pos), d = Math.max(gap.length(), .001);
  gap.divideScalar(d);
  const into = lead.vel.dot(gap), speed = Math.max(lead.vel.length() * P.buddyBoost, P.buddyMin);
  if (into < 0) lead.vel.addScaledVector(gap, -2 * into);
  lead.vel.setLength(speed); lead.vel.y = Math.max(lead.vel.y, P.buddyUp);
  if (lead.vel.length() < P.buddyMin) lead.vel.setLength(P.buddyMin);
  lead.propulsion = 0; lead.dive = 0; state.lockBuddy = false;
  teamBump(c, buddyCharge(c) ? 'Bump! Chomper charges' : 'Bump!');
}
