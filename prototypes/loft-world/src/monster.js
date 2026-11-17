// Grumble: a big fuzzy valley monster with a smooth vinyl face. You fight it by flinging residents into it.
// It is slow and telegraphs its one attack, a ground stomp that tosses nearby residents away.
import * as THREE from 'three';
import { softMaterial } from './glsl.js';
import { blob, merge, place, tint } from './util.js';
import { sweepSphere } from './contact-model.mjs';
import {CREATURE as C} from './creature-constants.mjs';
import {initialPatrol,nextPatrol,patrolPosition,safeHome,movingContact} from './creature-model.mjs';
import {CREATURE_COPY} from './creature-copy.mjs';
import {buildDrift} from './drift-view.js';

export const MONSTER = {
  radius: 5.2, // body collider
  health: 100,
  hitSpeed: 9, // slower touches just push you away
  damagePerSpeed: 0.5, // a fling at speed 30 does about 15 (was 0.85, set when flings were speed 22)
  weakBonus: 3, // a hit on the glowing weak spot does this many times the damage
  turnRate: 1.0, // radians per second it can turn to face its target: a half turn takes about 3 s
  commitAfterAttack: 1.6, // seconds it stands committed after a stomp, headbutt or gust: the opening to get behind it
  commitAfterHit: 0.9, // seconds it reels, unable to turn, after you hit it
  distract: 2.2, // seconds it keeps facing an ally that just hit it
  weakCone: 0.5, // how close to dead-on the spot a hit must be: within 60 degrees
  floatHeight: 11, // the floating kind hovers this far above the ground
  floatSpeed: 4.2, // and drifts toward you at this speed
  gustEvery: 4.5, // seconds between its gusts
  gustRange: 15, // it gusts when you are this close
  gustPush: [17, 6], // sideways and upward speed a gust gives you
  popDamage: 12, // a Pop does a little less than one fling
  popStun: 1.3, // seconds a Pop leaves it staggered: no chasing, no stomp
  popShove: 26, // speed it is shoved back at, dying away fast: about 5 units of slide
  allyShare: 0.33, // Chomper's hits do a third of what yours would: he is the helper, you are the hitter
  diveBonus: 1.6, // damage multiplier after a dive
  rebound: 0.9, // share of your speed you keep bouncing off
  reboundLift: 15, // you always leave upward, so the next fling is in the air
  comboWindow: 2.6, // seconds between hits that keep a combo going
  comboBonus: 0.15, // extra damage per combo step
  walk: 2.6,
  notice: 70, // it turns to you inside this distance
  stompRange: 20,
  stompEvery: 6.5, // seconds between stomps while you are close
  stompWindup: 0.9, // seconds of crouch before the stomp lands
  stompToss: [17, 15], // sideways and upward speed given to residents caught on the ground
  respawn: 45,
  spots: [[2, 72], [-58, 40], [44, -34]], // where it appears, in turn
};

const v = new THREE.Vector3(), n = new THREE.Vector3();

const COATS = {
  walk: ['#6a4fae', '#3a2a66', '#9a7bd8'], // Grumble: violet
  hop: ['#b0577e', '#5e2748', '#e39ab8'], // Pebble: rose
  float: ['#3f9c9a', '#1c5560', '#8fe0d0'], // Drift: teal
};
function build(style = 'walk') {
  if (style === 'float') return buildDrift();
  const fur = [], face = [], coat = COATS[style] ?? COATS.walk;
  const body = (c, x, y, z) => { c.lerp(new THREE.Color(coat[1]), Math.max(-y, 0) * 0.5).lerp(new THREE.Color(coat[2]), Math.max(y, 0) * 0.35); };
  fur.push(place(tint(blob(11, 0.1, 1.4, 3), coat[0], 0, body), 0, 0, 0, 0, 0, 0, 5, 4.6, 4.7));
  fur.push(place(tint(blob(12, 0.12, 1.6, 2), '#e9dcc0'), 0, -1.2, 3.1, 0, 0, 0, 3, 2.6, 2)); // pale belly
  for (const side of [-1, 1]) {
    fur.push(place(tint(blob(13 + side, 0.15, 1.5, 2), '#5a4296'), side * 4.6, -0.6, 1, 0, 0, side * 0.5, 1.5, 2.1, 1.4)); // arms
    fur.push(place(tint(blob(15 + side, 0.12, 1.5, 2), '#4a3684'), side * 2.3, -4.1, 1.2, 0, 0, 0, 1.7, 1, 2)); // feet
    fur.push(place(tint(blob(17 + side, 0.1, 1.5, 2), '#4a3684'), side * 2.7, 4.5, 0.4, 0.15, 0, -side * 0.4, 0.95, 1.5, 0.7)); // round ears
    face.push(place(tint(new THREE.SphereGeometry(0.42, 12, 10), '#ffd0e6'), side * 2.75, 4.6, 0.95, 0, 0, 0, 1, 1.5, 0.5)); // pink inner ear
    face.push(place(tint(new THREE.SphereGeometry(0.78, 16, 12), '#fff8ee', 0.05), side * 1.25, 1.45, 4.25)); // eyes
    face.push(place(tint(new THREE.SphereGeometry(0.4, 12, 10), '#1c1230'), side * 1.2, 1.4, 4.85));
    face.push(place(tint(new THREE.SphereGeometry(0.13, 8, 6), '#ffffff', 1), side * 1.05, 1.62, 5.18));
  }
  // smooth vinyl face plate with a wide toothy grin
  face.push(place(tint(new THREE.SphereGeometry(1, 28, 20), '#d9b39c'), 0, 0.9, 2.55, 0, 0, 0, 3.1, 2.5, 2.2));
  face.push(place(tint(new THREE.TorusGeometry(1.25, 0.2, 8, 20, Math.PI), '#3a1f33'), 0, 0.15, 4.72, 0.25, 0, Math.PI));
  for (let i = 0; i < 7; i++) {
    const a = Math.PI + (i + 0.5) / 7 * Math.PI;
    face.push(place(tint(new THREE.ConeGeometry(0.15, 0.42, 5), '#ffffff'), Math.cos(a) * 1.22, 0.15 + Math.sin(a) * 1.22 + 0.25, 4.86, Math.PI));
  }
  fur.push(place(tint(blob(21, 0.2, 1.8, 2), '#e9dcc0'), 0, -1.8, -4.4, 0, 0, 0, 1.3)); // tail tuft
  const group = new THREE.Group();
  group.add(new THREE.Mesh(merge(fur), softMaterial({ fuzz: 1, leaf: 2.4 })));
  group.add(new THREE.Mesh(merge(face), softMaterial({ fuzz: 0, gloss: 0.8 })));
  // The weak spot: a soft glowing patch. On the back for the two that walk; on top for the one that floats,
  // so you get behind the first two and above the third.
  const spot = new THREE.Mesh(tint(new THREE.SphereGeometry(1, 20, 14), '#ffd27a', 0.75, (c, x, y) => c.lerp(new THREE.Color('#ff8fb8'), Math.min(Math.hypot(x, y), 1) * 0.8)), softMaterial({ fuzz: 0 }));
  if (style === 'float') { spot.position.set(0, 4.35, 0); spot.scale.set(1.9, 0.5, 1.9); } else { spot.position.set(0, 0.8, -4.4); spot.scale.set(1.8, 1.8, 0.5); }
  group.add(spot);
  group.userData.spot = spot;
  return group;
}

export function createMonster({ scene, world, sfx, toys, hud, puff, definition={id:"grumble",name:"Grumble",x:2,z:72,scale:1,style:"walk"} }) {
  const M = {...MONSTER,radius:MONSTER.radius*definition.scale}, H = world.terrain.heightAt;
  const home=safeHome(definition,M.radius,world), tuning={speed:definition.style==='hop'?C.hopSpeed:C.walk,hopHeight:C.hopHeight};
  let visible=true;
  const floats = definition.style === 'float', group = build(definition.style);
  scene.add(group);
  const s = { hp: M.health, at: 0, pos: new THREE.Vector3(), yaw: 0, hit: 9, stompIn: M.stompEvery, wind: -1, down: -1, combo: 0, sinceHit: 9, alive: true, grow: 0 };
  Object.assign(s,{id:definition.id,name:definition.name??CREATURE_COPY[definition.id],radius:M.radius,heading:definition.heading??0,engaged:false,patrol:initialPatrol(),home});
  s.previous=new THREE.Vector3();
  s.sweep=(from,to,radius)=>movingContact(from,to,s.previous,s.pos,M.radius+radius);
  function spawn() {
    const {x,z}=home??{x:definition.x,z:definition.z};
    s.pos.set(x, H(x, z) + M.radius * C.foot, z); s.hp = M.health; s.alive = true; s.grow = 0; s.stompIn = M.stompEvery; s.wind = -1;
    s.alive=!!home;s.engaged=false;s.combo=0;s.sinceHit=9;s.down=-1;s.patrol=initialPatrol(definition.style==='hop'?C.hopWait:C.wait);s.previous.copy(s.pos);s.velocity?.set(0,0,0);group.rotation.z=0;
    s.stun=0;s.commit=0;s.distracted=0;s.distractAt=null;s.shove?.set(0,0,0);s.bonk=C.bonkEvery;s.gust=M.gustEvery;
  }
  spawn();
  s.velocity=new THREE.Vector3();

  return {
    state: s, group, tuning,
    reset(){s.at++;spawn();},
    setVisible(on){visible=on;group.visible=on&&s.alive;},
    /** Pushes a resident out of the monster. If it came in fast, that is a hit: returns the damage dealt. */
    touch(b, radius, isLead, dived) {
      if (!s.alive || s.grow < 0.9) return 0;
      const contact=s.sweep?s.sweep(b.previous??b.pos,b.pos,radius):sweepSphere(b.previous??b.pos,b.pos,s.pos,M.radius+radius);
      if(!contact)return 0;
      n.copy(contact.normal);b.pos.copy(contact.point);
      if (b.grounded) return 0;
      const response=b.traversal.contact(`enemy:${s.id??'grumble'}:${s.at}`,'enemy',n,b.vel,s.velocity);
      const into=response.incomingNormalSpeed;
      if(into>0){b.vel.copy(response.outgoing);b.propulsion=0;}
      if (!response.qualifying || into < M.hitSpeed) return 0;
      // only your own hits build the combo; an ally's hit keeps it alive but does not raise it
      if (isLead) s.combo = s.sinceHit < M.comboWindow ? s.combo + 1 : 1;
      s.sinceHit = 0; s.hit = 0; s.engaged=true;
      if (!isLead) { s.distracted = M.distract; s.distractAt = b.pos; } else s.commit = Math.max(s.commit ?? 0, M.commitAfterHit);
      // weak spot: the back of the walkers, the top of the floater. The contact normal says where you struck.
      const weak = (floats ? n.y : -(n.x * Math.sin(s.yaw) + n.z * Math.cos(s.yaw))) > M.weakCone;
      const damage = Math.max(1, Math.round(into * M.damagePerSpeed * (dived ? M.diveBonus : 1) * (weak ? M.weakBonus : 1) * (isLead ? 1 + (s.combo - 1) * M.comboBonus : M.allyShare)));
      s.lastWeak = weak;
      s.hp = Math.max(s.hp - damage, 0);
      // Contact recoil belongs to the incoming resident; patrol remains within its safe hull.
      toys.burst(v.copy(b.pos), '#c9b2ff', 16, 12, 6);
      puff(b.pos, 12 + damage * 0.3, weak ? '#ffd27a' : dived ? '#ffd58a' : '#ffffff');
      if (weak) { toys.burst(v.copy(b.pos), '#ffd27a', 26, 16, 9); s.spotHit = 0; }
      sfx.hit(Math.min(damage / 40, 1), s.combo);
      if (weak) sfx.weak?.();
      if (s.hp <= 0) {
        s.alive = false; s.down = 0;
        for (let k = 0; k < 6; k++) toys.burst(v.copy(s.pos).add(n.set(Math.sin(k) * 3, k - 2, Math.cos(k) * 3)), ['#c9b2ff', '#ffe6a0', '#8ff5e0'][k % 3], 20, 16, 12);
        sfx.cloud(true);
        hud.flash(s.name ? `${s.name} is out cold!` : 'Grumble is out cold!');
      } else if (weak) hud.flash(`Weak spot! ${damage}`);
      else if (isLead || s.combo > 1) hud.flash(s.combo > 1 ? `${damage}  ×${s.combo}` : `${damage}`);
      return damage;
    },
    /** A special move that lands near the monster chips it. */
    /** Returns true if the wave caught it: it takes damage, is shoved back and staggers for a moment. */
    pop(p, range) {
      if (!s.alive || p.distanceTo(s.pos) > range + M.radius) return false;
      s.hp = Math.max(s.hp - M.popDamage, 1); s.hit = 0; s.engaged = true;
      s.stun = M.popStun; s.wind = -1; s.stompIn = Math.max(s.stompIn, M.popStun + 1); // an interrupted stomp starts over
      n.set(s.pos.x - p.x, 0, s.pos.z - p.z);
      if (n.lengthSq() < 0.01) n.set(1, 0, 0);
      s.shove = (s.shove ?? new THREE.Vector3()).copy(n.normalize()).multiplyScalar(M.popShove);
      toys.burst(v.copy(s.pos), '#8ff5e0', 18, 14, 8);
      return true;
    },
    update(dt, time, bodies) {
      if(!visible)return;
      const lead = bodies[0];
      const previous={...s.pos};s.previous.copy(s.pos);s.velocity.set(0,0,0);
      s.hit += dt; s.sinceHit += dt;
      if (!s.alive) {
        s.patrol=nextPatrol(s.patrol,{type:"defeat"});s.down += dt;
        const k = Math.max(1 - s.down * 1.4, 0);
        group.scale.set(k, k * k, k); group.rotation.z = s.down * 3;
        if (s.down > M.respawn) { s.at++; spawn(); group.rotation.z = 0; }
        group.visible=visible&&s.alive;
        return;
      }
      s.grow = Math.min(s.grow + dt * 1.2, 1);
      const dx = lead.pos.x - s.pos.x, dz = lead.pos.z - s.pos.z, dist = Math.hypot(dx, dz);
      s.patrol=nextPatrol(s.patrol,{type:'tick',dt});
      // Chase: once you are close enough to notice, it leaves its patrol and comes for you.
      // staggered by a Pop: slide back along the shove, and do nothing else until it wears off
      s.stun=Math.max((s.stun??0)-dt,0);s.commit=Math.max((s.commit??0)-dt,0);
      if(s.shove&&s.shove.lengthSq()>.01){
        const nx=s.pos.x+s.shove.x*dt,nz=s.pos.z+s.shove.z*dt,lake=world.lake;
        if(!(lake&&Math.hypot(nx-lake.x,nz-lake.z)<lake.r+M.radius*.5)){s.pos.x=nx;s.pos.z=nz;}
        s.shove.multiplyScalar(Math.exp(-dt*5));
      }
      const recovering=s.stun>0||s.commit>0;
      const chasing=dist<C.notice&&s.wind<0&&!recovering;
      s.bonk=(s.bonk??0)-dt;
      if(chasing){
        s.engaged=true;
        // it faces you, or for a moment the ally that last hit it; and it can only turn so fast
        s.distracted=Math.max((s.distracted??0)-dt,0);
        const eye=s.distracted>0&&s.distractAt?s.distractAt:lead.pos,want=Math.atan2(eye.x-s.pos.x,eye.z-s.pos.z);
        const turn=Math.atan2(Math.sin(want-s.yaw),Math.cos(want-s.yaw)),most=M.turnRate*dt;
        if(s.commit<=0)s.yaw+=Math.max(-most,Math.min(most,turn));
        const reach=M.radius+C.chaseStop;
        if(dist>reach){
          const stepLen=Math.min((floats?M.floatSpeed:tuning.speed*C.chaseBoost)*dt,dist-reach),nx=s.pos.x+dx/dist*stepLen,nz=s.pos.z+dz/dist*stepLen;
          const lake=world.lake,wet=lake&&Math.hypot(nx-lake.x,nz-lake.z)<lake.r+M.radius*.5;
          if(!wet){s.pos.x=nx;s.pos.z=nz;}
        }else if(!floats&&s.bonk<0&&lead.grounded&&Math.abs(lead.pos.y-s.pos.y)<M.radius+2){
          // close enough to shove: a headbutt that sends you tumbling
          s.bonk=C.bonkEvery;s.hit=0;s.commit=M.commitAfterAttack;
          n.set(dx,0,dz).normalize();
          lead.vel.copy(n).multiplyScalar(C.bonkToss[0]).setY(C.bonkToss[1]);lead.grounded=false;lead.squash=1;lead.dizzy=.6;
          puff(lead.pos,12,'#c9b2ff');sfx.hit(.5,1);hud.shake(.6);
        }
      } else if(s.patrol.phase==='move'&&s.wind<0&&!recovering){
        const next=patrolPosition(s,home,dt,tuning.speed,world,M.radius);
        if(next){s.pos.copy(next);const want=Math.atan2(s.pos.x-previous.x,s.pos.z-previous.z);s.yaw+=Math.atan2(Math.sin(want-s.yaw),Math.cos(want-s.yaw))*Math.min(dt*C.turn,1);}
        else s.patrol={phase:'wait',remaining:C.wait,leg:s.patrol.leg+1};
      }
      const hop=definition.style==='hop'&&(chasing||s.patrol.phase==='move')?Math.abs(Math.sin((chasing?time:C.travel-s.patrol.remaining)/C.hopPeriod*Math.PI))*tuning.hopHeight*(chasing?2:1):0;
      s.pos.y=H(s.pos.x,s.pos.z)+M.radius*C.foot+hop+(floats?M.floatHeight+Math.sin(time*1.1+s.heading)*1.2:0);
      // the weak spot pulses, and flares when struck
      s.spotHit=(s.spotHit??9)+dt;
      const pulse=1+Math.sin(time*3.2+s.heading)*.09+Math.exp(-s.spotHit*5)*.7,spot=group.userData.spot;
      if(floats)spot.scale.set(1.9*pulse,.5,1.9*pulse);else spot.scale.set(1.8*pulse,1.8*pulse,.5);
      if(floats){
        // a gust: a puff of air that shoves you sideways when you get close
        s.gust=(s.gust??M.gustEvery)-dt;
        if(s.gust<0&&!recovering&&lead.pos.distanceTo(s.pos)<M.gustRange){
          s.gust=M.gustEvery;s.hit=0;s.commit=M.commitAfterAttack;
          n.set(lead.pos.x-s.pos.x,0,lead.pos.z-s.pos.z);if(n.lengthSq()<.01)n.set(1,0,0);n.normalize();
          lead.vel.copy(n).multiplyScalar(M.gustPush[0]).setY(Math.max(lead.vel.y,M.gustPush[1]));lead.grounded=false;lead.propulsion=0;lead.squash=.6;
          puff(s.pos,20,'#8fe0d0');toys.burst(v.copy(lead.pos),'#c9fff2',18,14,4);sfx.rustle?.();hud.shake(.4);
        }
      }
      if(dt>0)s.velocity.set((s.pos.x-previous.x)/dt,(s.pos.y-previous.y)/dt,(s.pos.z-previous.z)/dt);

      // stomp: crouch (the warning), then slam; residents on the ground nearby get tossed
      if (s.wind >= 0) {
        s.wind += dt;
        if (s.wind > M.stompWindup) {
          s.wind = -1; s.stompIn = M.stompEvery; s.commit = M.commitAfterAttack;
          v.copy(s.pos).setY(s.pos.y - M.radius * 0.8);
          puff(v, 44, '#c9b2ff'); toys.burst(v, '#e9dcc0', 30, 22, 5);
          sfx.stomp();
          for (const b of bodies) {
            const bd = Math.hypot(b.pos.x - s.pos.x, b.pos.z - s.pos.z);
            if (bd > M.stompRange || b.pos.y - H(b.pos.x, b.pos.z) > 3.5) continue;
            n.set(b.pos.x - s.pos.x, 0, b.pos.z - s.pos.z).normalize();
            b.vel.copy(n).multiplyScalar(M.stompToss[0]).setY(M.stompToss[1]); b.grounded = false; b.squash = 1;
          }
          hud.shake(0.9);
        }
      } else if (!floats && !recovering && dist < M.stompRange * definition.scale) { s.stompIn -= dt; if (s.stompIn < 0) { s.wind = 0; sfx.growl(); } }

      const breathe = Math.sin(time * 1.6) * 0.025, flinch = Math.exp(-s.hit * 7) * Math.cos(s.hit * 26) * 0.22;
      const crouch = s.wind >= 0 ? Math.sin(Math.min(s.wind / M.stompWindup, 1) * Math.PI * 0.5) * 0.3 : 0;
      const g = definition.scale * s.grow * s.grow * (3 - 2 * s.grow);
      group.visible=visible&&s.alive;
      group.position.copy(s.pos).setY(s.pos.y - crouch * M.radius * 0.5);
      group.rotation.y = s.yaw;
      group.scale.set(g * (1 + crouch * 0.25 - flinch), g * (1 + breathe - crouch + flinch), g * (1 + crouch * 0.25 - flinch));
      // The collection chooses one contextual HUD, never one bar per instance.
    },
  };
}
