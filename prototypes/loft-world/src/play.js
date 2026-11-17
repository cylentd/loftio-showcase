// Explore mode: walk, hop and fling residents across the valley; bounce off ground, trunks, pads and rocks.
import * as THREE from 'three';
import { softMaterial, G } from './glsl.js';
import { createToys } from './toys.js';
import { createPods } from './pods.js';
import { createLife } from './life.js';
import { createEnemies,createNeighbours } from './creature-runtime.js';
import {enemyFrameDistance} from './creature-model.mjs';
import { merge, place, tint } from './util.js';

import { PLAY } from './play-constants.js';
export { PLAY } from './play-constants.js';
import { AIM, CAMERA } from './control-constants.mjs';
import { createAim } from './aim-view.js';
import { clearCamera } from './camera-model.mjs';

import { createResidents, drawResidents } from './resident-view.js';
import { createSupport } from './companion-runtime.js';
import { createCollisions } from './play-collisions.js';
import { createTraversal } from './traversal-runtime.mjs';
import { TRAVERSAL } from './traversal-constants.mjs';
import { carryLaunch } from './traversal-model.mjs';
import { TEAM } from './teamwork-constants.mjs';
import { createDriftShots } from './drift-shots.js';

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, 'rgba(255,255,255,.45)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function createPlay({ scene, camera, world, hud, sfx }) {
  const P = PLAY, glow = glowTexture();
  const H = world.terrain.heightAt, lake = world.lake;
  const input = { x: 0, z: 0, turn: 0, jump: false, jumpHeld: false };
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), nrm = new THREE.Vector3(), right = new THREE.Vector3(), fwd = new THREE.Vector3(), wish = new THREE.Vector3();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const goal = new THREE.Vector3(), camPos = new THREE.Vector3(), look = new THREE.Vector3(), focusAt = new THREE.Vector3();
  /** Ground a resident can stand on at x,z: the valley floor, or the lake surface when wading. */
  /** Height of a bridge deck under x,z, if the caller at height y is on or above it; otherwise very low. */
  function rampAt(x, z, y) {
    let best = -1e9;
    for (const r of world.ramps ?? []) {
      if (x < r.box[0] || x > r.box[1] || z < r.box[2] || z > r.box[3]) continue;
      for (let i = 0; i < r.points.length - 1; i++) {
        const a = r.points[i], b = r.points[i + 1], dx = b.x - a.x, dz = b.z - a.z;
        const t = Math.min(Math.max(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz), 0), 1);
        if (Math.hypot(x - a.x - dx * t, z - a.z - dz * t) > r.width) continue;
        const deck = a.y + (b.y - a.y) * t;
        if (y > deck - P.stepUp) best = Math.max(best, deck);
      }
    }
    return best;
  }
  const inWater = (x, z) => Math.hypot(x - lake.x, z - lake.z) < lake.r * 1.4 && H(x, z) < lake.y - 0.6;
  /** Ground under x,z. Pass your own height y to also count bridge decks you are standing on or above. */
  const floorAt = (x, z, y) => Math.max(H(x, z), Math.hypot(x - lake.x, z - lake.z) < lake.r * 1.4 ? lake.y - 0.5 : -1e9, y === undefined ? -1e9 : rampAt(x, z, y));

  // ---- Residents: painted sprites with a round collider ----
  const bodies = createResidents(scene);
  const lead = bodies[0];
  for(const b of bodies)b.traversal=createTraversal(b);

  const toys = createToys({ scene, world, sfx, glow });
  const fx = { pop(k) { state.pop = Math.max(state.pop, k); } };
  const pods = createPods({ scene, strings: world.podStrings, sfx, burst: toys.burst });
  const life = createLife({ scene, world, low: innerWidth < 700, burst: toys.burst, sfx });
  /** Everything a fling can lock on to: monsters, Chomper, and pods that are up. */
  const lockable = () => [...monster.states, ...(lead.grounded ? [] : [buddyTarget]), ...pods.targets.filter((t) => t.alive)];

  // ---- Wisps to collect ----
  const wispGeo = merge([tint(new THREE.IcosahedronGeometry(0.3, 2), '#ffe6a0', 0.6), place(tint(new THREE.TorusGeometry(0.52, 0.04, 5, 20), '#8ff5e0', 0.45), 0, 0, 0, 0.5)]);
  const wispMesh = new THREE.InstancedMesh(wispGeo, softMaterial(), world.wispSpots.length);
  wispMesh.frustumCulled = false;
  wispMesh.visible = false;
  scene.add(wispMesh);
  const wisps = world.wispSpots.map((p, i) => ({ p, got: 0, phase: i * 1.3 }));
  let collected = 0;

  // ---- Small effects: aim dots, a trail, bounce rings ----
  const TRAIL = 40, trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 3).fill(-9999), 3));
  const trail = new THREE.Points(trailGeo, new THREE.PointsMaterial({ map: glow, size: .65, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(0.9, 1.4, 1.2), opacity: 0.2 }));
  trail.frustumCulled = false; trail.visible = false;
  scene.add(trail);
  let trailAt = 0;

  const rings = [0, 1, 2, 3, 4, 5].map(() => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    s.visible = false; scene.add(s);
    return { s, life: 0, size: 1 };
  });
  let ringAt = 0;
  function puff(p, size, color) {
    const r = rings[ringAt++ % rings.length];
    r.s.position.copy(p); r.life = 1; r.size = size; r.s.material.color.set(color).multiplyScalar(.35); r.s.visible = true;
  }

  const state = { active: false, diving: false, speed: 0, shake: 0, pop: 0, yaw: Math.PI, pitch: P.camPitch, zoom: 1, camIdle: 9, aim: null, skyfalls: 0, cool: 0, jumpWant: 0, charging: false, charge: 0, chain: 0, freeze: 0, slow: 0, popCool: 0 };
  const monster = createEnemies({ scene, world, sfx, toys, puff, hud: { ...hud, shake(k) { state.shake = Math.max(state.shake, k); } } });
  const driftShots = createDriftShots({scene,glow,lead,monster,world,floorAt,puff,sfx});
  const neighbours=createNeighbours({scene,world});
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const support = createSupport({lead,buddy:bodies[1],monster,stand,sfx,floorAt,onContact:e=>{lead.traversal.support(e);teamBump('Boost!');}});
  // Flings are unlimited again (owner, 2026-11-17): the charge gate is off, so nothing reads state.traversal.
  state.traversal=null;

  // ---- Chomper: a teammate, as in Loft Rumble. He walks with you and stays out of the way until you call on him:
  //  1. Jump again in the air and he rockets up underneath you and bumps you higher.
  //  2. Fling at a monster and he follows your shot in for a second hit.
  //  3. Fling into Chomper himself and you bounce off him, higher, while he charges the nearest monster.
  // Every bump refills your air flings.
  const buddy=bodies[1],offer={on:true};
  const buddyTarget={alive:true,pos:buddy.pos,radius:P.buddyRadius,id:'chomper',at:0};
  /** He flings himself at the nearest monster that has noticed you. Returns true if there was one. */
  function buddyCharge() {
    let foe=null,gap=P.buddyAttackRange;
    for(const m of monster.states){const g=m.alive&&m.engaged?m.pos.distanceTo(buddy.pos):Infinity;if(g<gap){foe=m;gap=g;}}
    if(!foe)return false;
    buddy.grounded=false;buddy.dive=0;buddy.isle=null;
    buddy.vel.subVectors(foe.pos,buddy.pos).setLength(P.flingSpeed*1.15);
    buddy.propulsion=Math.min(AIM.propulsion*1.6,gap/buddy.vel.length());buddy.squash=-.6;buddy.excited=.6;
    puff(buddy.pos,8,'#ffd0f0');
    return true;
  }
  /** Shared by every kind of bump: your flings come back and the moment is marked. */
  function teamBump(label) {
    state.air=P.airFlings;state.cool=0;state.bumps=(state.bumps||0)+1;
    lead.squash=1;buddy.squash=1;buddy.excited=.6;
    puff(buddy.pos,16,'#ffe6a0');toys.burst(buddy.pos,'#ffe6a0',18,12,5);
    state.pop=Math.max(state.pop,.7);state.shake=Math.max(state.shake,.4);
    hud.flash(label);sfx.bump();
  }
  function bumpOff() {
    const gap=tmp2.subVectors(lead.pos,buddy.pos),d=Math.max(gap.length(),.001);
    gap.divideScalar(d);
    const into=lead.vel.dot(gap),speed=Math.max(lead.vel.length()*P.buddyBoost,P.buddyMin);
    if(into<0)lead.vel.addScaledVector(gap,-2*into);
    lead.vel.setLength(speed);lead.vel.y=Math.max(lead.vel.y,P.buddyUp);
    if(lead.vel.length()<P.buddyMin)lead.vel.setLength(P.buddyMin);
    lead.propulsion=0;lead.dive=0;state.lockBuddy=false;
    teamBump(buddyCharge()?'Bump! Chomper charges':'Bump!');
  }
  // ---- Combo return: sometimes, when you bounce off a monster, Chomper pops up in your path and bats you back in.
  let ret=null;
  function planReturn() {
    if(ret||state.returnCool>0||Math.random()>P.returnChance||support.state.phase!=='idle'||state.lockBuddy)return;
    let foe=null,gap=Infinity;
    for(const m of monster.states){const g=m.alive?m.pos.distanceTo(lead.pos):Infinity;if(g<gap){foe=m;gap=g;}}
    if(!foe)return;
    state.returnCool=P.returnEvery;ret={foe,t:0};
    puff(buddy.pos,6,'#ffd0f0');sfx.poof();
    buddy.grounded=false;buddy.hover=true;buddy.vel.set(0,0,0);buddy.propulsion=0;buddy.isle=null;
  }
  function endReturn(){ret=null;buddy.hover=false;}
  function updateReturn(dt) {
    state.returnCool=Math.max((state.returnCool||0)-dt,0);
    if(!ret)return;
    ret.t+=dt;
    // he heads for where you will be a moment from now, so the two of you always meet
    tmp.copy(lead.pos).addScaledVector(lead.vel,Math.max(P.returnLead-ret.t,0));
    tmp.y=Math.max(tmp.y,floorAt(tmp.x,tmp.z)+2.5);
    buddy.pos.lerp(tmp,1-Math.exp(-dt*20));buddy.excited=.4;
    if(!lead.grounded&&ret.t>P.returnLead*.6&&lead.pos.distanceTo(buddy.pos)<P.buddyRadius+.8) {
      if(ret.foe.alive) {
        // batted straight back at the monster, a little faster than you left it
        tmp2.subVectors(ret.foe.pos,lead.pos);
        const far=tmp2.length(),speed=Math.max(lead.vel.length()*1.1,P.returnSpeed);
        lead.vel.copy(tmp2).setLength(speed);lead.propulsion=Math.min(AIM.propulsion*1.4,far/speed);lead.dive=0;
      }
      state.returns=(state.returns||0)+1;
      teamBump('Combo!');
      endReturn();
    } else if(ret.t>P.returnWait||lead.grounded)endReturn();
  }
  function updateBuddy(dt) {
    // you flung at him: the touch is the bump
    if(state.lockBuddy&&!lead.grounded&&lead.pos.distanceTo(buddy.pos)<P.buddyRadius)bumpOff();
    if(lead.grounded)state.lockBuddy=false;
    // Where he wants to be. While you walk: a loose spot well behind your path (in the world, so turning the
    // camera does not make him shuffle). While you stand: he potters about nearby, picking a new spot every few seconds.
    buddy.slot||=new THREE.Vector3(-P.buddyBack,0,P.buddySlotSide);buddy.followTarget||=new THREE.Vector3();
    if(lead.grounded&&lead.walkSpeed>1) {
      tmp.copy(lead.walkVel).setY(0).normalize();tmp2.set(-tmp.z,0,tmp.x);
      buddy.slot.lerp(tmp.multiplyScalar(-P.buddyBack).addScaledVector(tmp2,P.buddySlotSide),Math.min(dt*1.4,1));
      buddy.roamIn=P.buddyRoamEvery[0];
    } else if(lead.grounded) {
      buddy.roamIn=(buddy.roamIn??P.buddyRoamEvery[0])-dt;
      if(buddy.roamIn<=0) {
        buddy.roamIn=P.buddyRoamEvery[0]+Math.random()*(P.buddyRoamEvery[1]-P.buddyRoamEvery[0]);
        const a=Math.random()*Math.PI*2,r=P.buddyRoam[0]+Math.random()*(P.buddyRoam[1]-P.buddyRoam[0]);
        buddy.slot.set(Math.cos(a)*r,0,Math.sin(a)*r);
      }
    }
    buddy.followTarget.copy(lead.pos).add(buddy.slot);
    // Left behind by a fling: once you have landed he takes one easy leap over to you. No teleporting unless
    // you are a very long way off.
    buddy.leapIn=Math.max((buddy.leapIn||0)-dt,0);
    const gap=buddy.pos.distanceTo(lead.pos);
    if(buddy.grounded&&lead.grounded&&support.state.phase==='idle'&&!ret&&buddy.leapIn<=0&&gap>P.buddyLeapFrom) {
      buddy.leapIn=P.buddyLeapEvery;buddy.isle=null;buddy.propulsion=0;buddy.dive=0;
      tmp.copy(buddy.followTarget);tmp.y=floorAt(tmp.x,tmp.z,lead.pos.y+2)+P.radius;
      if(gap>P.buddyLeapMax) {
        puff(buddy.pos,5,'#ffd0f0');buddy.pos.copy(tmp).setY(tmp.y+2.5);buddy.vel.set(0,2,0);puff(buddy.pos,5,'#ffd0f0');sfx.poof();
      } else {
        // one arc that lands on his spot: longer leaps take a little longer and go a little higher
        const time=Math.min(Math.max(gap/P.buddyLeapSpeed,.75),1.7);
        buddy.vel.subVectors(tmp,buddy.pos).divideScalar(time);buddy.vel.y+=.5*P.gravity*time;buddy.squash=-.5;
      }
      buddy.grounded=false;
    }
  }

  const aim = createAim({scene,camera,lead,state,floorAt,radius:P.radius,speed:P.flingSpeed,glow,props:world.terrainProps});
  const obstacles = [];

  /** Space held at the moment of landing turns it into a bounce that keeps its height and adds a little. */
  function chainBounce(b, hard) {
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

  function reset() {
    monster.reset();neighbours.reset();
    resetFeedback(); support.reset(); state.simTime=0;state.realTime=0;state.freeze=state.slow=0; for(const b of bodies){b.traversal.reset();b.previous=null;} input.jump = input.jumpHeld = false;
    aim.cancel(); state.cool = 0; state.charging = false; state.charge = 0;
    state.pitch = P.camPitch; state.zoom = 1; state.lastRelease = null;
    const s = world.start;
    bodies.forEach((b, i) => {
      const x = s.x - i * 1.4, z = s.z + i * 2.2;
      b.pos.set(x, H(x, z) + P.radius, z); b.vel.set(0, 0, 0);
      b.propulsion = 0; b.walkVel.set(0,0,0);
      b.grounded = true; b.spin = 0; b.dive = 0; b.isle = null; b.dizzy = 0; b.away = false; b.hover = false;
    });
    state.air = P.airFlings; state.lockBuddy = false; state.seenImpact = 0;
    state.yaw = Math.atan2(s.faceX - lead.pos.x, s.faceZ - lead.pos.z);
  }

  function setVisible(on) {
    monster.setVisible(on);neighbours.setVisible(on);
    for (const b of bodies) b.sprite.visible = on;
    wispMesh.visible = trail.visible = on;
    aim.cancel();
  }

  const {hitGround,hitIsle,hitRound,pushOut,hitTerrain,resetFeedback}=createCollisions({world,lake,lead,state,input,support:{landed:()=>support.landed()},sfx,puff,hud,chainBounce,
    splash:(p,hard)=>{toys.burst(p,'#dff2ff',14+Math.min(hard,30)*.6,9,7+hard*.25);}});

  function step(b, dt, diving) {
    if (b.grounded) return;
    b.supportFloor = false;
    b.propulsion = Math.max((b.propulsion || 0) - dt, 0);
    if (diving) b.propulsion = 0;
    if (!b.propulsion) b.vel.y -= (P.gravity + (diving && b.vel.y < 8 ? P.diveGravity : 0)) * dt;
    b.vel.multiplyScalar(1 - P.drag * dt);
    if (diving && b.vel.y < 0) { b.vel.x *= 1 - 1.2 * dt; b.vel.z *= 1 - 1.2 * dt; b.dive += dt; }
    b.vel.y = Math.max(b.vel.y, -75);
    b.pos.addScaledVector(b.vel, dt);
    for (const isle of world.isles) hitIsle(b, isle);
    pushOut(b, true);
    if (toys.touchFlying(b, P.radius, b === lead, fx)) b.propulsion = 0;
    // lantern pods: burst one and it throws you up with your flings refilled
    if (pods.touch(b, P.radius, b === lead)) {
      b.propulsion = 0; b.dive = 0; b.squash = -0.6;
      if (b === lead) { state.air = P.airFlings; state.cool = 0; state.pop = Math.max(state.pop, 0.6); hud.flash('Pop!'); }
    }
    if (monster.touch(b, P.radius, b === lead, b.dive > P.skyfallAfter)) {
      b.propulsion = 0; b.dive = 0; b.squash = 1;
      // Impact feedback never scales released flight time.
      if (b === lead) { state.shake = Math.max(state.shake, 0.7); state.pop = Math.max(state.pop, 0.7); state.cool = 0; state.freeze = P.hitStop; state.air = P.airFlings; planReturn(); }
      b.dizzy = TEAM.dizzyTime;
      if (b !== lead) support.impact();
    }
    for (const r of world.rocks) {
      if (hitRound(b, tmp2.copy(r.g.position).setY(r.g.position.y - r.r * 0.5), r.r * 1.05, 'rock', `rock:${world.rocks.indexOf(r)}`)) { puff(b.pos, 6, '#8ff5e0'); if (b === lead) sfx.rock(); }
    }
    // tree crowns are springy again: you ricochet off them, the tree rocks and sheds leaves
    for (let ci = 0; ci < world.canopies.length; ci++) {
      const c = world.canopies[ci];
      if (Math.abs(b.pos.x - c[0]) > c[3] + 3 || Math.abs(b.pos.z - c[2]) > c[3] + 3 || Math.abs(b.pos.y - c[1]) > c[3] + 3) continue;
      const power = b.vel.length() / 25, lean = Math.atan2(b.vel.z, b.vel.x);
      if (hitRound(b, tmp2.set(c[0], c[1], c[2]), c[3] * P.canopySize, 'foliage', `canopy:${ci}`)) {
        world.shake(c[4], power, lean);
        toys.burst(b.pos, '#8fe08a', 14, 8, 2); puff(b.pos, 7, '#c8f5b0');
        if (b === lead) { sfx.rustle(); state.shake = Math.max(state.shake, 0.25); }
      }
    }
    hitGround(b, dt);
    // bridge decks: land on them from above
    const deck = rampAt(b.pos.x, b.pos.z, b.pos.y);
    if (deck > -1e8 && b.vel.y <= 0 && b.pos.y - P.radius < deck) {
      b.pos.y = deck + P.radius; b.propulsion = 0; b.dive = 0;
      if (-b.vel.y > 12 || input.jumpHeld) { b.vel.y = Math.max(-b.vel.y * 0.55, 6); b.squash = 0.7; if (b === lead) sfx.thump(0.4); }
      else { b.walkVel.copy(b.vel).setY(0); b.vel.set(0, 0, 0); b.grounded = true; b.isle = null; }
    }
    const far = Math.hypot(b.pos.x, b.pos.z);
    if (far > P.leash) { b.vel.x -= (b.pos.x / far) * 60 * dt; b.vel.z -= (b.pos.z / far) * 60 * dt; }
    // curl up and spin like a ball: faster travel, faster spin
    b.spin += Math.min(b.vel.length() * P.spin, 16) * dt * (b.vel.dot(right) < 0 ? 1 : -1);
  }

  // ---- Walking: WASD moves the leader relative to the camera; the others trot after it ----
  function stand(b, dt, dir, speed) {
    const wasGrounded=b.grounded;
    b.pos.addScaledVector(dir, speed * dt);
    pushOut(b, false);
    if(wasGrounded&&!b.grounded)return;
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

  function hop(b, dir, speed) {
    b.grounded = false; b.vel.copy(dir).multiplyScalar(speed).setY(P.jump); b.squash = -0.5; b.dive = 0;
  }

  function walk(dt) {
    camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    right.crossVectors(fwd, camera.up).normalize();
    // while a fling is being aimed, WASD looks around instead of walking (see the camera section)
    const steer = state.aim ? 0 : 1;
    wish.set(0, 0, 0).addScaledVector(right, input.x * steer).addScaledVector(fwd, input.z * steer);
    const moving = wish.lengthSq() > 0.01;
    if (moving) wish.normalize();
    const pressed = input.jump;
    support.jump(pressed); // pressed in the air, this calls Chomper up underneath you
    if (pressed) state.jumpWant = P.jumpBuffer;
    input.jump = false;
    state.jumpWant -= dt;
    lead.offGround = lead.grounded ? 0 : lead.offGround + dt;
    if (lead.grounded) {
      state.chain = 0;
      // Space on the ground winds up a jump: hold to charge, let go to launch
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
      tmp.copy(wish).multiplyScalar(moving ? P.walk * (state.charging ? 0.2 : lead.wet ? P.wade : state.diving ? P.sprint : 1) : 0).sub(lead.walkVel);
      const gap = tmp.length(), rate = (moving ? P.walkAccel : P.walkStop) * dt;
      if (gap > rate) lead.walkVel.addScaledVector(tmp, rate / gap); else lead.walkVel.add(tmp);
      lead.walkSpeed = lead.walkVel.length();
      if (lead.walkSpeed > 0.05) stand(lead, dt, tmp.copy(lead.walkVel).divideScalar(lead.walkSpeed), lead.walkSpeed); else lead.stride = 0;
    } else {
      lead.walkSpeed = 0;
      state.charging = false;
      if (moving && lead.vel.x * wish.x + lead.vel.z * wish.z < P.walk * 1.2) lead.vel.addScaledVector(wish, P.airControl * dt);
    }
    // launch: Space released after a wind-up, or pressed just after walking off an edge
    const release = lead.grounded && state.charging && !input.jumpHeld;
    const late = !lead.grounded && state.jumpWant > 0 && lead.offGround < P.coyote && !lead.hopped && lead.vel.y <= 0.5;
    if (release || late) {
      const c = release ? state.charge : 0, power = c * c * (3 - 2 * c);
      const carry = lead.grounded ? lead.walkVel : tmp.copy(lead.vel).setY(0);
      const dir = moving ? tmp2.copy(wish) : carry.lengthSq() > 0.01 ? tmp2.copy(carry).normalize() : tmp2.set(0, 0, 0);
      hop(lead, dir, (moving ? P.walk : carry.length()) + (moving ? power * P.chargeLeap : 0));
      lead.vel.y = P.jump + (P.chargeJump - P.jump) * power;
      lead.squash = -0.5 - power * 0.5; // spring open: stretch tall as it leaves
      if (power > 0.3) { sfx.fling(power); state.pop = Math.max(state.pop, power * 0.8); puff(lead.pos, 8 + power * 12, '#fff1b8'); } else sfx.jump();
      lead.hopped = true; lead.walkVel.set(0, 0, 0); state.jumpWant = 0; state.charging = false; state.charge = 0;
    }
    if (lead.grounded) lead.hopped = false;

    support.update(dt,fwd,right);
  }

  // ---- Pop shockwave: a ground ring and a dome, both pure light, plus a ripple pushed through the meadow ----
  const waveMat=()=>new THREE.MeshBasicMaterial({color:new THREE.Color(.5,1.6,1.3),transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
  const wave={at:new THREE.Vector3(),age:9,floor:0,
    ring:new THREE.Mesh(new THREE.RingGeometry(.82,1,72),waveMat()),
    dome:new THREE.Mesh(new THREE.SphereGeometry(1,40,16,0,Math.PI*2,0,Math.PI/2),waveMat())};
  wave.ring.rotation.x=-Math.PI/2;wave.ring.visible=wave.dome.visible=false;wave.ring.renderOrder=wave.dome.renderOrder=4;
  scene.add(wave.ring,wave.dome);
  function updateWave(dt) {
    const U=world.terrain.uniforms;
    wave.age+=dt;
    const f=wave.age/P.popTime,on=f<1;
    wave.ring.visible=wave.dome.visible=on;
    U.uPopPower.value=on?(1-f)*(1-f):0;
    if(!on)return;
    const reach=P.popRange*(1-(1-f)*(1-f)); // fast at first, easing out
    U.uPop.value.set(wave.at.x,wave.at.y,wave.at.z,reach);
    wave.ring.position.set(wave.at.x,wave.floor+.25,wave.at.z);wave.ring.scale.setScalar(reach);
    wave.ring.material.opacity=(1-f)*.9;
    wave.dome.position.set(wave.at.x,wave.floor,wave.at.z);wave.dome.scale.setScalar(reach);
    wave.dome.material.opacity=(1-f)*(1-f)*.22;
  }

  const api = {
    state, lead, input, monster, bodies, support, neighbours, tuning: P, pods, driftShots,
    screenPoint(p, w, h) { const v = new THREE.Vector3().copy(p).project(camera); return {x:(v.x+1)*w/2,y:(1-v.y)*h/2,visible:v.z<1}; },
    get active() { return state.active; },
    get collected() { return collected; },
    total: wisps.length,
    start() { driftShots.reset(); state.active = true; reset(); setVisible(true); hud.show(true); hud.count(collected, wisps.length); },
    stop() { driftShots.reset(); G.uRevealOn.value = 0; sfx.encounter?.(false); state.calm = 99; state.active = false; support.reset(); for(const b of bodies)b.traversal.reset(); setVisible(false); hud.show(false); state.aim = null; },
    setDive(on) { state.diving = on; },
    aimMove(x,y,w,h,power,pixels) { aim.move(x,y,w,h,power,pixels,lockable()); },
    /** What a fling from this screen point would lock on to, without starting an aim. Used by the reticle. */
    targetAt(x,y,w,h) {
      const held=state.aim;
      aim.move(x,y,w,h,1,AIM.deadPixels+1,lockable());
      const target=state.aim?.target??null;
      state.aim=held;aim.refresh();
      return target;
    },
    aimCancel() { aim.cancel(); support.cancel(); },
    aimEnd() {
      let v = aim.velocity(); const selected = state.aim;
      aim.cancel();
      if (!state.active || !v) return;
      // speed you already have in the fling's direction carries into it
      v = carryLaunch(lead.grounded ? lead.walkVel : lead.vel, v) ?? v;
      const distance = lead.pos.distanceTo(new THREE.Vector3().copy(selected.target));
      state.cool = P.flingCooldown;
      state.lastRelease = { origin: {...lead.pos}, target: {...selected.target}, velocity: {...v} };
      lead.vel.copy(v);
      lead.propulsion = Math.min(AIM.propulsion, distance / lead.vel.length());
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

    update(dt, time) {
      if (!state.active) return;
      // Only an available airborne aim slows simulation; release and hit use real dt.
      const real = dt;
      // a landed hit freezes the world for a beat; aiming in the air with a fling left slows it
      state.slow = 0; state.freeze = Math.max((state.freeze || 0) - real, 0);
      // air flings refill on the ground and on any real contact (a bounce, a tree, a rock, a monster)
      const impact = lead.traversal.lastImpact?.id ?? 0;
      if (lead.grounded || impact !== state.seenImpact) state.air = P.airFlings;
      state.seenImpact = impact;
      dt *= state.freeze > 0 ? P.hitStopRate : state.aim && !lead.grounded ? P.aimSlow : 1;
      state.simTime=(state.simTime||0)+dt;state.realTime=(state.realTime||0)+real;
      state.cool = Math.max(state.cool - dt, 0);
      state.popCool = Math.max(state.popCool - real, 0);
      hud.special(1 - state.popCool / P.popCooldown);
      walk(dt);
      const fastest=Math.max(...bodies.map(b=>b.vel.length()));
      const sub=Math.min(TRAVERSAL.maxSubsteps,Math.max(1,Math.ceil(dt/TRAVERSAL.maxStep),Math.ceil(fastest*dt/TRAVERSAL.maxTravel)));
      for (let s = 0; s < sub; s++) {
        monster.update(dt/sub,time,bodies);
        for (const b of bodies) {
          b.traversal.begin();b.previous={...b.pos};
          if(!b.hover)step(b,dt/sub,b===lead&&state.diving&&!b.grounded);
          toys.touch(b,P.radius,b===lead);b.traversal.end();
        }
        support.afterPhysics();
      }

      driftShots.update(dt);
      updateBuddy(dt);updateReturn(dt);updateWave(real);
      // An encounter is on while a living monster that has noticed you is within reach. The battle music
      // holds a few seconds past the end, so a monster dropping or a brief retreat does not flick it off and on.
      let fighting=false;
      for(const m of monster.states)if(m.alive&&m.engaged&&m.pos.distanceTo(lead.pos)<P.encounterRange)fighting=true;
      state.calm=fighting?0:(state.calm??99)+real;
      state.encounter=fighting||state.calm<P.encounterLinger;
      sfx.encounter?.(state.encounter);
      // open water nearby is heard: the lake, and faintly the creek
      const shore=Math.hypot(lead.pos.x-lake.x,lead.pos.z-lake.z)-lake.r;
      sfx.water?.(THREE.MathUtils.clamp(1-shore/38,0,1)*(lead.wet&&lead.grounded?1:.7));
      bodies.forEach((b, i) => { if (b.grounded) monster.touch(b, P.radius, false, false); world.terrain.bodies[i].copy(b.pos); });
      toys.update(dt, time);
      pods.update(dt, time);
      life.update(dt, time, lead.pos);
      monster.draw(state.aim,lead);neighbours.update(dt,reducedMotion.matches);
      drawResidents(bodies,camera,support.state,real,reducedMotion.matches,{aiming:!!state.aim,charging:state.charging,floorAt});

      for (let i = 0; i < wisps.length; i++) {
        const w = wisps[i];
        if (!w.got) for (const b of bodies) if (b.pos.distanceToSquared(w.p) < P.wispRadius * P.wispRadius) { w.got = 1; collected++; sfx.wisp(); hud.count(collected, wisps.length); puff(w.p, 7, '#ffe6a0'); break; }
        if (w.got && w.got < 2) w.got = Math.min(w.got + dt * 4, 2);
        const s = w.got ? Math.max(2 - w.got, 0) : 1 + Math.sin(time * 2 + w.phase) * 0.12;
        m4.compose(tmp.copy(w.p).setY(w.p.y + Math.sin(time * 1.3 + w.phase) * 0.5), q.setFromEuler(e.set(time * 0.8 + w.phase, time * 1.1, 0)), tmp2.setScalar(s));
        wispMesh.setMatrixAt(i, m4);
      }
      wispMesh.instanceMatrix.needsUpdate = true;

      const tr = trailGeo.attributes.position;
      if (!lead.grounded) { tr.setXYZ(trailAt++ % TRAIL, lead.pos.x, lead.pos.y, lead.pos.z); tr.needsUpdate = true; }
      for (const r of rings) {
        if (r.life <= 0) continue;
        r.life -= dt * 1.8;
        r.s.scale.setScalar(r.size * (1.3 - r.life)); r.s.material.opacity = Math.max(r.life, 0) * 0.8; r.s.visible = r.life > 0;
      }

      dt = real; // the camera runs on real time, so slow motion still feels smooth
      // ---- Chase camera: lags behind, widens with speed, shakes on impact, stays above the ground ----
      const speed = lead.vel.length(), flat = Math.hypot(lead.vel.x, lead.vel.z);
      state.speed += (speed - state.speed) * Math.min(dt * 4, 1);
      // You own the camera. Only after you leave it alone for a while does it drift back behind fast movement.
      state.camIdle += dt;
      if (input.turn) { state.yaw -= input.turn * P.turn * dt; state.camIdle = 0; }
      if (state.aim && (input.x || input.z)) {
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
      const fast = THREE.MathUtils.smoothstep(state.speed, 14, 55), fall = THREE.MathUtils.clamp(-lead.vel.y / 50, 0, 1);
      const dist = enemyFrameDistance((P.camDistance + fast * 7) * state.zoom,monster.states,lead.pos), pitch = Math.min(state.pitch + fall * 0.25, 1.35);
      goal.set(lead.pos.x - Math.sin(state.yaw) * Math.cos(pitch) * dist, lead.pos.y + 1.2 + Math.sin(pitch) * dist, lead.pos.z - Math.cos(state.yaw) * Math.cos(pitch) * dist);
      goal.y = Math.max(goal.y, floorAt(goal.x, goal.z) + 1.6);
      // follow tightly sideways and softly in height, so hops do not bob the view
      const kxz = 1 - Math.exp(-dt * 9), ky = 1 - Math.exp(-dt * (lead.grounded ? 4 : 6));
      camPos.x += (goal.x - camPos.x) * kxz; camPos.z += (goal.z - camPos.z) * kxz; camPos.y += (goal.y - camPos.y) * ky;
      camPos.y = Math.max(camPos.y, floorAt(camPos.x, camPos.z) + 1.5);
      state.shake = Math.max(state.shake - dt * 1.6, 0); state.pop = Math.max(state.pop - dt * 1.5, 0);
      const sh = Math.pow(state.shake, 1.5);
      camera.position.copy(camPos).add(tmp.set(Math.sin(time * 91) * sh * 0.5, Math.sin(time * 77 + 1) * sh * 0.5, 0));
      // Slow-motion aim: the view tightens and leans toward what you are aiming at, and everything else softens.
      const focusing = state.aim && !lead.grounded ? 1 : 0;
      state.focus = (state.focus || 0) + (focusing - (state.focus || 0)) * Math.min(dt * (focusing ? 9 : 5), 1);
      tmp.copy(lead.pos).addScaledVector(lead.vel, 0.08).setY(lead.pos.y + 1.4 + (state.reticle ? P.reticleLift : 0));
      if (state.aim?.target) { state.focusPoint = tmp2.copy(state.aim.target); tmp.lerp(tmp2, P.focusLean * state.focus); }
      else {
        // in a fight the view leans toward the nearest monster, so both of you stay in frame
        let foe = null, gap = P.fightFrame;
        for (const m of monster.states) { const g = m.alive && m.engaged ? m.pos.distanceTo(lead.pos) : Infinity; if (g < gap) { foe = m; gap = g; } }
        if (foe) tmp.lerp(tmp2.copy(foe.pos), P.fightLean * (1 - gap / P.fightFrame));
      }
      look.lerp(tmp, 1 - Math.exp(-dt * 10));
      focusAt.copy(lead.pos).setY(lead.pos.y + CAMERA.focusHeight);
      let safe = clearCamera(focusAt, camera.position, obstacles, floorAt);
      // Something is in the way. Do not push in to a close-up of the leader's face: rise over the obstacle instead.
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
      // glide to the chosen spot so a block or an unblock is a move, not a cut
      if (!state.camShown) state.camShown = new THREE.Vector3().copy(safe);
      state.camShown.lerp(tmp2.copy(safe), 1 - Math.exp(-dt * 11));
      camera.position.copy(state.camShown);
      state.camera = { position: {...safe}, desired: {...camPos}, blocked: Math.hypot(safe.x-camPos.x,safe.y-camPos.y,safe.z-camPos.z) > 1 };
      camera.lookAt(look);
      const fovGoal = (camera.aspect < 0.8 ? 66 : 52) + fast * 12 * (1 - state.focus) + state.pop * 7 - state.focus * P.focusZoom;
      camera.fov += (fovGoal - camera.fov) * Math.min(dt * (fovGoal > camera.fov ? 5 : 1.25), 1);
      camera.updateProjectionMatrix();
      G.uRevealOn.value = 1;
      G.uRevealEye.value.copy(camera.position);
      for (let index = 0; index < bodies.length; index++) {
        const position = bodies[index].pos;
        G.uRevealTargets.value[index].set(position.x, position.y, position.z, P.revealRadius);
      }
      const target = state.aim?.target;
      G.uRevealTargets.value[2].set(target?.x ?? 0, target?.y ?? 0, target?.z ?? 0, target ? P.revealRadius : 0);
      aim.refresh();
    },
    snapCamera() { state.camShown = null; camPos.set(lead.pos.x - Math.sin(state.yaw) * 15, lead.pos.y + 5.5, lead.pos.z - Math.cos(state.yaw) * 15); look.copy(lead.pos); },
    /** The special move, "Pop": a shockwave. It staggers and shoves monsters, flattens the grass in a ring,
     *  rattles everything loose nearby, and throws you upward with your air flings refilled. */
    special() {
      if (!state.active || state.popCool > 0) return;
      state.popCool = P.popCooldown;
      // the wave itself: a ring racing out along the ground, a dome of light, and a ripple through the grass
      wave.at.copy(lead.pos); wave.age = 0; wave.floor = floorAt(lead.pos.x, lead.pos.z, lead.pos.y);
      puff(lead.pos, P.popRange * 2.2, '#8ff5e0'); puff(lead.pos, P.popRange * 1.1, '#ffffff');
      toys.burst(lead.pos, '#8ff5e0', 46, 26, 9); toys.burst(lead.pos, '#fff1b8', 30, 17, 14);
      toys.pop(lead.pos, P.popRange);
      const hits = monster.pop(lead.pos, P.popRange);
      for (const c of world.canopies) if (Math.hypot(c[0] - lead.pos.x, c[2] - lead.pos.z) < P.popRange + c[3]) world.shake(c[4], 1.4, Math.atan2(c[2] - lead.pos.z, c[0] - lead.pos.x));
      // you ride it: straight up from the ground, or a strong second wind in the air
      lead.propulsion = 0; lead.dive = 0;
      if (lead.grounded) { lead.grounded = false; lead.isle = null; lead.vel.copy(lead.walkVel).setY(P.popLaunch); lead.walkVel.set(0, 0, 0); }
      else lead.vel.y = Math.max(lead.vel.y, P.popLift);
      lead.squash = -0.8; state.air = P.airFlings; state.cool = 0;
      state.pop = 1; state.shake = Math.max(state.shake, hits ? 1 : 0.7);
      if (hits) hud.flash(hits > 1 ? 'Pop! ×' + hits : 'Pop!');
      sfx.pop(hits);
    },
    /** Drag to look around: pixels moved. */
    orbit(dx, dy) {
      state.yaw -= dx * 0.0055;
      state.pitch = THREE.MathUtils.clamp(state.pitch + dy * 0.004, -0.12, 1.25);
      state.camIdle = 0;
    },
    zoom(factor) { state.zoom = THREE.MathUtils.clamp(state.zoom * factor, 0.45, 2.4); },
    /** True when a press at these screen pixels is on or near the leader, so it should start a fling. */
    nearLead(x, y, w, h) {
      tmp.copy(lead.pos).project(camera);
      if (tmp.z > 1) return false;
      return Math.hypot((tmp.x * 0.5 + 0.5) * w - x, (-tmp.y * 0.5 + 0.5) * h - y) < Math.min(w, h) * P.flingGrab;
    },
  };
  return api;
}
