import * as THREE from 'three';
import {sweepProp,createImpactFeedback} from './terrain-props.mjs';
import { PLAY as P } from './play-constants.js';
import { sweepSphere } from './contact-model.mjs';
import { TRAVERSAL as T } from './traversal-constants.mjs';
import { groundBounce } from './ground-bounce.mjs';
export function createCollisions({world,lake,lead,state,input,support,sfx,puff,hud,chainBounce,splash,slam}) {
  const H=world.terrain.heightAt,tmp=new THREE.Vector3(),nrm=new THREE.Vector3();
  let consumers=new WeakMap();
  function hitTerrain(b){
    let best=null,prop=null;
    for(const p of world.terrainProps??[]){const h=sweepProp(b.previous??b.pos,b.pos,P.radius,p);if(h&&(!best||h.t<best.t)){best=h;prop=p;}}
    if(!best)return;
    const velocity=b.grounded?b.walkVel:b.vel;
    const response=b.traversal.contact(prop.id,prop.material,best.normal,velocity);
    b.pos.copy(best.point);b.propulsion=0;
    if(response.incomingNormalSpeed>0){b.vel.copy(response.outgoing);b.walkVel.copy(response.outgoing).setY(0);if(response.qualifying)b.grounded=false;}
    if(response.qualifying){
      b.squash=.2;b.dive=0;
      let consumer=consumers.get(b);if(!consumer){consumer=createImpactFeedback();consumers.set(b,consumer);}
      const event=consumer.consume(b.traversal.lastImpact,!!sfx.on);
      if(event){world.woodland?.impact(event);sfx.material?.(event);}
    }
  }
  // ---- Collisions ----
  function land(b, hard, sound) {
    b.propulsion = 0;
    b.squash = Math.min(hard / 30, 1);
    if (b === lead) { state.shake = Math.max(state.shake, Math.min(hard / 60, 0.5)); if (sound) sfx.thump(Math.min(hard / 45, 1)); }
  }

  function skyfall(b) {
    b.vel.y = Math.max(b.vel.y, P.skyfallLaunch);
    b.squash = 1;
    puff(b.pos, 22, '#ffd58a');
    if (b === lead) { state.shake = 1; state.pop = 1; state.skyfalls++; hud.flash('Skyfall!'); sfx.slam?.(1); sfx.cloud(true); }
    if (b === lead) slam?.(b, (b.peak ?? b.pos.y) - b.pos.y); // how far Sprout fell: the shockwave and its flash read it
  }

  function hitGround(b, dt) {
    const inLake = Math.hypot(b.pos.x - lake.x, b.pos.z - lake.z) < lake.r * 1.4;
    if (inLake && b.vel.y < 0 && b.pos.y - P.radius < lake.y && H(b.pos.x, b.pos.z) < lake.y - 0.6) {
      b.propulsion = 0;
      if (b === lead) support.landed(); // a landing in the lake settles the fall too: it clears a standing counter
      b.traversal.contact('lake','water',{x:0,y:1,z:0});
      const hard = -b.vel.y, dived = b.dive > P.skyfallAfter;
      b.pos.y = lake.y + P.radius * 0.3;
      b.dive = 0;
      puff(b.pos, 8 + Math.min(hard, 30) * 0.5, '#c9e6ff');
      splash?.(b.pos, hard);
      if (b === lead) { sfx.splash(Math.min(hard / 35, 1)); state.pop = Math.max(state.pop, 0.4); }
      if (dived) { skyfall(b); return; }
      // water takes the fall: you plunge, lose most of your speed, and come up floating
      b.walkVel.copy(b.vel).setY(0).multiplyScalar(0.35); b.vel.set(0, 0, 0);
      b.grounded = true; b.isle = null; b.wet = true; b.squash = 0.8;
      return;
    }
    const gy = H(b.pos.x, b.pos.z);
    if (b.pos.y - P.radius >= gy) return;
    b.supportFloor = true;
    b.propulsion = 0;
    world.terrain.normalAt(b.pos.x, b.pos.z, nrm);
    b.pos.y = gy + P.radius;
    const response=b.traversal.contact('ground','soil',nrm);
    const vn = b.vel.dot(nrm);
    if (vn >= 0) return;
    if (b === lead) support.landed();
    const hard = -vn, dived = b.dive > P.skyfallAfter;
    b.vel.copy(response.outgoing);
    const up = dived ? 0 : chainBounce(b, hard);
    if (up) b.vel.addScaledVector(nrm,-b.vel.dot(nrm)).multiplyScalar(0.96).addScaledVector(nrm, up);
    else if (!dived && hard >= T.contactSpeed) {
      // plain ground: a soft landing plants, a hard one keeps a single rebound (see ground-bounce.mjs)
      const rebound = groundBounce(hard, P.groundPlantBelow, P.groundRebound);
      b.vel.addScaledVector(nrm, -b.vel.dot(nrm)).addScaledVector(nrm, rebound);
      if (rebound > 0 || nrm.y <= P.restSlope) { b.grounded = false; b.isle = null; }
      else { b.walkVel.copy(b === lead ? b.vel : tmp.set(0, 0, 0)).setY(0); b.vel.set(0, 0, 0); b.grounded = true; b.isle = null; }
      land(b,hard,true);
      if(hard>8)puff(b.pos,Math.min(hard*.45,14),'#fff1b8');
    }
    else if (!dived && hard < P.rollUnder) {
      b.vel.addScaledVector(nrm,-b.vel.dot(nrm));
      // rolling: stay on the ground, lose a little speed, let slopes speed you up
      b.vel.multiplyScalar(1 - P.rollFriction * dt);
      // at walking pace on gentle ground you are simply back on your feet, keeping your momentum
      if (b.vel.length() < P.walk * 1.4 && nrm.y > P.restSlope) { b.walkVel.copy(b === lead ? b.vel : tmp.set(0, 0, 0)).setY(0); b.vel.set(0, 0, 0); b.grounded = true; b.isle = null; }
      else if (hard > 3) land(b, hard, true);
    } else {
      if (!dived && nrm.y>P.restSlope) { b.walkVel.copy(b.vel).setY(0); b.vel.set(0,0,0); b.grounded=true; }
      if (dived) skyfall(b); else land(b, hard, true);
    }
    b.dive = 0;
  }

  function hitIsle(b, isle) {
    const lx = b.pos.x - isle.pos[0], lz = b.pos.z - isle.pos[2], d = Math.hypot(lx, lz);
    const edge = isle.outline(Math.atan2(lz, lx));
    if (d > edge + P.radius) return;
    const top = isle.heightAt(lx, lz) + isle.pos[1];
    if (d < edge && b.vel.y <= 0 && b.pos.y - P.radius < top && b.pos.y > top - 2.2) {
      b.supportFloor = true;
      if (b === lead) support.landed();
      b.propulsion = 0;
      b.pos.y = top + P.radius;
      const response=b.traversal.contact(`isle:${world.isles.indexOf(isle)}`,'soil',{x:0,y:1,z:0});
      const hard = -b.vel.y, dived = b.dive > P.skyfallAfter, up = dived ? 0 : chainBounce(b, hard);
      if (up) b.vel.y = up;
      else if (!dived && hard >= T.contactSpeed) {
        const rebound = groundBounce(hard, P.groundPlantBelow, P.groundRebound);
        b.vel.copy(response.outgoing);
        if (rebound > 0) { b.vel.y = rebound; b.grounded = false; b.isle = null; }
        else { b.walkVel.copy(b === lead ? b.vel : tmp.set(0, 0, 0)).setY(0); b.vel.set(0, 0, 0); b.grounded = true; b.isle = isle; }
        land(b,hard,true);
      }
      else if (!dived && hard < P.restSpeed && Math.hypot(b.vel.x, b.vel.z) < P.restSpeed * 2.4) { b.vel.set(0, 0, 0); b.grounded = true; b.isle = isle; if (b === lead && hard > 1.5) sfx.thump(0); }
      else { b.vel.copy(response.outgoing); if (dived) skyfall(b); else { b.walkVel.copy(b.vel).setY(0);b.vel.set(0,0,0);b.grounded=true;b.isle=isle;land(b,hard,true); } }
      b.dive = 0;
      return;
    }
    if (b.pos.y < top - 0.6 && b.pos.y > top - isle.depth) {
      const t = (top - b.pos.y) / isle.depth, rad = edge * Math.pow(1 - t, 0.6);
      if (d < rad + P.radius && d > 0.001) {
        b.propulsion = 0;
        const nx = lx / d, nz = lz / d, vn = b.vel.x * nx + b.vel.z * nz;
        b.pos.x += nx * (rad + P.radius - d); b.pos.z += nz * (rad + P.radius - d);
        const response=b.traversal.contact(`isle:${world.isles.indexOf(isle)}`,'rock',{x:nx,y:0,z:nz});
        if(vn<0)b.vel.copy(response.outgoing);
      }
    }
  }

  function hitRound(b,c,radius,material,id) {
    const h=sweepSphere(b.previous??b.pos,b.pos,c,radius+P.radius);
    if(!h)return false;
    const response=b.traversal.contact(id,material,h.normal);
    b.pos.copy(h.point);b.propulsion=0;
    if(response.incomingNormalSpeed>0)b.vel.copy(response.outgoing);
    if(response.qualifying){b.squash=T.contactSquash;b.dive=0;}
    return response.qualifying;
  }

  function pushOut(b,bounce) {
    for(const solid of world.solids) {
      const [x,z,rad,top]=solid;
      const from=b.previous??b.pos;
      const h=sweepSphere({x:from.x,y:0,z:from.z},{x:b.pos.x,y:0,z:b.pos.z},{x,y:0,z},rad+P.radius);
      if(!h||b.pos.y>top)continue;
      const response=b.traversal.contact(`solid:${world.solids.indexOf(solid)}`,'wood',h.normal);
      b.pos.x=h.point.x;b.pos.z=h.point.z;b.propulsion=0;
      if(bounce&&response.incomingNormalSpeed>0)b.vel.copy(response.outgoing);
    }
    hitTerrain(b);
  }
  return {hitGround,hitIsle,hitRound,pushOut,hitTerrain,resetFeedback(){consumers=new WeakMap();}};
}
