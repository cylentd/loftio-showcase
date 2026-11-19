// Walking: WASD moves the leader relative to the camera; the others trot after it.

/** Move a resident along `dir` at `speed` and stand it on whatever is under it; walking off an edge starts a fall. */
export function stand(c, b, dt, dir, speed) {
  const { P, world, lake, right, floorAt, inWater, pushOut, puff, sfx, lead, tmp2 } = c;
  const wasGrounded = b.grounded;
  b.pos.addScaledVector(dir, speed * dt);
  pushOut(b, false);
  if (wasGrounded && !b.grounded) return;
  if (b.isle) {
    const lx = b.pos.x - b.isle.pos[0], lz = b.pos.z - b.isle.pos[2];
    if (b.isle.inside(lx, lz, 0)) b.pos.y = b.isle.heightAt(lx, lz) + b.isle.pos[1] + P.radius;
    else { b.grounded = false; b.vel.copy(dir).multiplyScalar(speed); }
  } else {
    const floor = floorAt(b.pos.x, b.pos.z, b.pos.y);
    b.wet = inWater(b.pos.x, b.pos.z) && floor <= lake.y;
    if (floor < b.pos.y - P.radius - P.stepUp) { b.grounded = false; b.vel.copy(dir).multiplyScalar(speed); return; } // walked off an edge: fall
    // on land, stand on it; in water, float low and bob
    b.pos.y = b.wet ? lake.y + P.radius * 0.3 + Math.sin(performance.now() * 0.004 + b.stride) * 0.07 : floor + P.radius;
    if (b.wet) {
      b.sloshIn = (b.sloshIn ?? 0) - dt;
      if (b.sloshIn < 0) { b.sloshIn = 0.34; puff(tmp2.copy(b.pos).setY(lake.y + 0.1), 4, '#c9e6ff'); if (b === lead) sfx.slosh(); }
    }
    // stepping off a bridge onto the sky island
    for (const isle of world.isles) {
      const lx = b.pos.x - isle.pos[0], lz = b.pos.z - isle.pos[2];
      if (isle.inside(lx, lz, 0) && Math.abs(b.pos.y - P.radius - isle.heightAt(lx, lz) - isle.pos[1]) < P.stepUp) b.isle = isle;
    }
  }
  b.stride += dt * 11;
  const side = dir.dot(right);
  if (Math.abs(side) > 0.3) b.face = side > 0 ? 1 : -1;
}

function hop(c, b, dir, speed) {
  b.grounded = false; b.vel.copy(dir).multiplyScalar(speed).setY(c.P.jump); b.squash = -0.5; b.dive = 0;
}

/** Space on the ground winds up a jump: hold to charge, let go to launch. Returns nothing; reads and writes `state`. */
function chargeJump(c, dt, pressed, moving, push, wish) {
  const { state, input, lead, P, toys, sfx, tmp } = c;
  state.chain = 0;
  if ((pressed || (state.jumpWant > 0 && input.jumpHeld)) && !state.charging) { state.charging = true; state.charge = 0; state.jumpWant = 0; }
  if (state.charging && input.jumpHeld) {
    state.charge = Math.min(state.charge + dt / P.chargeTime, 1);
    // press down like a spring: lower and lower, pumping faster as the charge fills
    state.pump = (state.pump || 0) + dt * (9 + state.charge * 16);
    lead.squash = 0.3 + state.charge * 0.5 + Math.sin(state.pump) * (0.1 + state.charge * 0.08);
    if (state.charge > 0.25 && Math.random() < dt * 22) toys.burst(tmp.copy(lead.pos).setY(lead.pos.y - 0.7), '#fff1b8', 1, 5, 2);
    sfx.charge(state.charge);
  }
  // ease toward the wanted speed instead of snapping to it; winding up slows you to a creep
  tmp.copy(wish).multiplyScalar(moving ? P.walk * push * (state.charging ? 0.2 : lead.wet ? P.wade : state.diving ? P.sprint : 1) : 0).sub(lead.walkVel);
  const gap = tmp.length(), rate = (moving ? P.walkAccel : P.walkStop) * dt;
  if (gap > rate) lead.walkVel.addScaledVector(tmp, rate / gap); else lead.walkVel.add(tmp);
  lead.walkSpeed = lead.walkVel.length();
  if (lead.walkSpeed > 0.05) stand(c, lead, dt, tmp.copy(lead.walkVel).divideScalar(lead.walkSpeed), lead.walkSpeed); else lead.stride = 0;
}

/** Launch: Space released after a wind-up, or pressed just after walking off an edge. */
function launchJump(c, moving, wish) {
  const { state, input, lead, P, sfx, puff, tmp, tmp2 } = c;
  const release = lead.grounded && state.charging && !input.jumpHeld;
  const late = !lead.grounded && state.jumpWant > 0 && lead.offGround < P.coyote && !lead.hopped && lead.vel.y <= 0.5;
  if (release || late) {
    const k = release ? state.charge : 0, power = k * k * (3 - 2 * k);
    const carry = lead.grounded ? lead.walkVel : tmp.copy(lead.vel).setY(0);
    const dir = moving ? tmp2.copy(wish) : carry.lengthSq() > 0.01 ? tmp2.copy(carry).normalize() : tmp2.set(0, 0, 0);
    hop(c, lead, dir, (moving ? P.walk : carry.length()) + (moving ? power * P.chargeLeap : 0));
    lead.vel.y = P.jump + (P.chargeJump - P.jump) * power;
    lead.squash = -0.5 - power * 0.5; // spring open: stretch tall as it leaves
    if (power > 0.3) { sfx.fling(power); state.pop = Math.max(state.pop, power * 0.8); puff(lead.pos, 8 + power * 12, '#fff1b8'); } else sfx.jump();
    lead.hopped = true; lead.walkVel.set(0, 0, 0); state.jumpWant = 0; state.charging = false; state.charge = 0;
  }
  if (lead.grounded) lead.hopped = false;
}

export function walk(c, dt) {
  const { camera, fwd, right, wish, state, input, support, P, lead } = c;
  camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
  right.crossVectors(fwd, camera.up).normalize();
  // while a fling is being aimed, WASD looks around instead of walking (see the camera section)
  // (the touch stick walks while aiming: it is not the keys, and the camera swing ignores it)
  const steer = state.aim && !input.pad ? 0 : 1;
  wish.set(0, 0, 0).addScaledVector(right, input.x * steer).addScaledVector(fwd, input.z * steer);
  const moving = wish.lengthSq() > 0.01;
  // keys give a push of 1 (1.41 on a diagonal); the touch stick gives 0..1, and that is the share of walk speed
  const push = Math.min(wish.length(), 1);
  if (moving) wish.normalize();
  const pressed = input.jump;
  support.jump(pressed); // pressed in the air, this calls Chomper up underneath you
  if (pressed) state.jumpWant = P.jumpBuffer;
  input.jump = false;
  state.jumpWant -= dt;
  lead.offGround = lead.grounded ? 0 : lead.offGround + dt;
  if (lead.grounded) chargeJump(c, dt, pressed, moving, push, wish);
  else {
    lead.walkSpeed = 0;
    state.charging = false;
    if (moving && lead.vel.x * wish.x + lead.vel.z * wish.z < P.walk * 1.2) lead.vel.addScaledVector(wish, P.airControl * push * dt);
  }
  launchJump(c, moving, wish);
  support.update(dt, fwd, right);
}
