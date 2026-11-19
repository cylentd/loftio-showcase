// Airborne physics for one resident: gravity, then every thing a body can hit on the way. The tests run the
// source between the step declaration and the end marker at the foot of this file, so keep that run self-contained:
// it may use only the context `c`, imports and its own functions.
import { slamPower } from './creature-model.mjs';
import { TEAM } from './teamwork-constants.mjs';
import { treeKick } from './aim-model.mjs';
import { leashPull, rescueSpot, RESCUE } from './shore.mjs';
import { slamFlourish } from './play-wave.js';
import { chompCombo } from './play-team.js';
import { planReturn } from './play-buddy.js';

/** Space held at the moment of landing turns it into a bounce that keeps its height and adds a little. */
export function chainBounce(c, b, hard) {
  const { input, state, sfx, hud, lead, puff, P } = c;
  if (!input.jumpHeld || hard < 2.5) return 0;
  if (b === lead) {
    state.chain++;
    sfx.bounce(state.chain);
    if (state.chain >= 2) hud.flash(`Bounce ×${state.chain}`);
    state.pop = Math.max(state.pop, 0.4); state.shake = Math.max(state.shake, 0.3);
  }
  b.squash = 1;
  puff(b.pos, 8 + Math.min(state.chain, 6) * 2, '#fff1b8');
  return Math.min(Math.max(hard * P.bounceKeep + P.bounceBonus, 14), P.bounceMax);
}

function step(c, b, dt, diving) {
  const { P, world, lead, hitIsle, pushOut, toys, fx, pods, state, hud, right } = c;
  if (b.grounded) { b.peak = b.pos.y; return; }
  b.supportFloor = false;
  b.propulsion = Math.max((b.propulsion || 0) - dt, 0);
  if (diving) b.propulsion = 0;
  if (!b.propulsion) b.vel.y -= (P.gravity + (diving && b.vel.y < 8 ? P.diveGravity : 0)) * dt;
  b.vel.multiplyScalar(1 - P.drag * dt);
  if (diving && b.vel.y < 0) { b.vel.x *= 1 - 1.2 * dt; b.vel.z *= 1 - 1.2 * dt; b.dive += dt; }
  b.vel.y = Math.max(b.vel.y, -75);
  b.pos.addScaledVector(b.vel, dt);
  // the top of this fall, so a dive knows how far it dropped: rising resets it
  if (b.vel.y > 0 || b.peak === undefined || b.pos.y > b.peak) b.peak = b.pos.y;
  for (const isle of world.isles) hitIsle(b, isle);
  pushOut(b, true);
  if (toys.touchFlying(b, P.radius, b === lead, fx)) b.propulsion = 0;
  // lantern pods: burst one and it throws you up with your flings refilled
  if (pods.touch(b, P.radius, b === lead)) {
    b.propulsion = 0; b.dive = 0; b.squash = -0.6;
    if (b === lead) { state.air = P.airFlings; state.cool = 0; state.pop = Math.max(state.pop, 0.6); hud.flash('Pop!'); }
  }
  hitMonsters(c, b);
  bounceRocks(c, b);
  bounceCrowns(c, b);
  c.hitGround(b, dt);
  landOnDeck(c, b);
  leashAndRescue(c, b, dt);
  // curl up and spin like a ball: faster travel, faster spin
  b.spin += Math.min(b.vel.length() * P.spin, 16) * dt * (b.vel.dot(right) < 0 ? 1 : -1);
}

function hitMonsters(c, b) {
  const { P, lead, monster, state, support } = c;
  const dropped = b.peak - b.pos.y, dived = b.dive > P.skyfallAfter;
  if (!monster.touch(b, P.radius, b === lead, dived, dropped)) return;
  b.propulsion = 0; b.dive = 0; b.squash = 1;
  if (b === lead && dived) slamFlourish(c, b.pos, slamPower(dropped)); // a high dive onto a monster lands with the same gold crash
  // Impact feedback never scales released flight time.
  if (b === lead) { state.shake = Math.max(state.shake, 0.7); state.pop = Math.max(state.pop, 0.7); state.cool = 0; state.freeze = P.hitStop; state.air = P.airFlings; planReturn(c); const link = support.claimCombo(monster.lastLeadHit); if (link) chompCombo(c, link === 'counter'); }
  b.dizzy = TEAM.dizzyTime;
  if (b !== lead) support.impact();
}

function bounceRocks(c, b) {
  const { world, tmp2, puff, lead, sfx, hitRound } = c;
  for (const r of world.rocks) {
    if (hitRound(b, tmp2.copy(r.g.position).setY(r.g.position.y - r.r * 0.5), r.r * 1.05, 'rock', `rock:${world.rocks.indexOf(r)}`)) { puff(b.pos, 6, '#8ff5e0'); if (b === lead) sfx.rock(); }
  }
}

// tree crowns are springy again: you ricochet off them, the tree rocks and sheds leaves
function bounceCrowns(c, b) {
  const { world, tmp2, hitRound, P, toys, puff, lead, sfx, state } = c;
  for (let ci = 0; ci < world.canopies.length; ci++) {
    const k = world.canopies[ci];
    if (Math.abs(b.pos.x - k[0]) > k[3] + 3 || Math.abs(b.pos.z - k[2]) > k[3] + 3 || Math.abs(b.pos.y - k[1]) > k[3] + 3) continue;
    const power = b.vel.length() / 25, lean = Math.atan2(b.vel.z, b.vel.x);
    if (hitRound(b, tmp2.set(k[0], k[1], k[2]), k[3] * P.canopySize, 'foliage', `canopy:${ci}`)) {
      world.shake(k[4], power, lean);
      toys.burst(b.pos, '#8fe08a', 14, 8, 2); puff(b.pos, 7, '#c8f5b0');
      // a bank off a crown kicks Sprout up, so the bank opens a dive from a new angle
      if (b === lead) { b.vel.copy(treeKick(b.vel)); sfx.rustle(); state.shake = Math.max(state.shake, 0.25); }
    }
  }
}

// bridge decks: land on them from above
function landOnDeck(c, b) {
  const { rampAt, P, input, lead, sfx } = c;
  const deck = rampAt(b.pos.x, b.pos.z, b.pos.y);
  if (deck > -1e8 && b.vel.y <= 0 && b.pos.y - P.radius < deck) {
    b.pos.y = deck + P.radius; b.propulsion = 0; b.dive = 0;
    if (-b.vel.y > 12 || input.jumpHeld) { b.vel.y = Math.max(-b.vel.y * 0.55, 6); b.squash = 0.7; if (b === lead) sfx.thump(0.4); }
    else { b.walkVel.copy(b.vel).setY(0); b.vel.set(0, 0, 0); b.grounded = true; b.isle = null; }
  }
}

// the wind leash follows the island's shore (shore.mjs): free over the cliff edge, then a growing pull home
function leashAndRescue(c, b, dt) {
  const { P, H } = c;
  const far = Math.hypot(b.pos.x, b.pos.z), pull = leashPull(b.pos.x, b.pos.z);
  if (pull > 0) { b.vel.x -= (b.pos.x / far) * pull * dt; b.vel.z -= (b.pos.z / far) * pull * dt; }
  // fell into the cloud sea: lifted back onto the island, just inside the lip, rising; the clouds hide the swap
  if (b.pos.y < RESCUE.below) {
    const [rx, rz] = rescueSpot(b.pos.x, b.pos.z);
    b.pos.set(rx, H(rx, rz) + P.radius + RESCUE.lift, rz); b.vel.set(0, RESCUE.up, 0); b.walkVel.set(0, 0, 0);
    b.grounded = false; b.isle = null; b.propulsion = 0; b.dive = 0;
  }
}
// ---- end of the step functions

export { step };
