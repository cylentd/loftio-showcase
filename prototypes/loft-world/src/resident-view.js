// Residents are painted sprites. This file picks which painting to show and animates it so a flat image
// reads as a soft toy: it hops, leans, squashes, spins, cross-fades between paintings and casts a ground shadow.
import * as THREE from 'three';
import {RESIDENTS,POSES,ASSET_ROOT,RESIDENT_LOOK as LOOK,IDLE_FIT} from './resident-data.mjs';
import {TEAM} from './teamwork-constants.mjs';
import {PLAY} from './play-constants.js';
import {ANCHORS} from '../assets/residents/anchors.mjs';
import {G} from './glsl.js';
import {lightSprite,shadowMaterial} from './resident-light.js';
import {shadowShape,shadowOffset} from './resident-light-model.mjs';

const IDLE_ROOT=ASSET_ROOT;

export function createResidents(scene, leadArt) {
  const loader=new THREE.TextureLoader();
  return RESIDENTS.map((name,index)=>{
    const art=index===0?leadArt:undefined;
    const load=url=>{const tex=loader.load(url);tex.colorSpace=THREE.SRGBColorSpace;return tex;};
    const textures=art?{idle:new THREE.CanvasTexture(art.image)}:Object.fromEntries(POSES.map(pose=>[pose,load(`${ASSET_ROOT}${name}-${pose}.webp`)]));
    if(art)textures.idle.colorSpace=THREE.SRGBColorSpace;
    else textures.idle=load(`${IDLE_ROOT}${name}-idle.webp`);
    // the fading-out copy needs its own picture settings, so it can face the old way while the new one faces the new way
    const ghostTextures=Object.fromEntries(Object.entries(textures).map(([pose,tex])=>[pose,tex.clone()]));
    // both paintings take the scene's light; each one's feet height is a uniform the draw sets per frame
    const mat=new THREE.SpriteMaterial({map:textures.idle});
    const feet=lightSprite(mat);
    const sprite=new THREE.Sprite(mat);
    sprite.center.set(.5,1-TEAM.baseline/TEAM.frameSize);sprite.visible=false;scene.add(sprite);
    // the outgoing painting, drawn over the new one and faded away
    const ghostMat=new THREE.SpriteMaterial({map:textures.idle,opacity:0,depthWrite:false});
    const ghostFeet=lightSprite(ghostMat);ghostMat.alphaTest=.02;
    const ghost=new THREE.Sprite(ghostMat);
    ghost.visible=false;ghost.renderOrder=3;scene.add(ghost);
    // drawn before every sprite so the painting blends over its own shadow; Euler order lets the pool turn about the ground's up
    const shadow=new THREE.Mesh(new THREE.PlaneGeometry(2,2),shadowMaterial());
    shadow.rotation.order='YXZ';shadow.rotation.x=-Math.PI/2;shadow.visible=false;shadow.renderOrder=-1;scene.add(shadow);
    return {name,savedFit:art?.fit,sprite,ghost,shadow,mat,feet,ghostFeet,textures,ghostTextures,shownFace:1,ghostFace:1,pose:'idle',pos:new THREE.Vector3(),vel:new THREE.Vector3(),walkVel:new THREE.Vector3(),
      walkSpeed:0,grounded:true,spin:0,squash:0,dive:0,isle:null,stride:0,face:1,offGround:9,hopped:false,dizzy:0,away:false,excited:0,turn:1,fade:0,swap:0};
  });
}

/** Which painting: resting by default; other faces only while something is actually happening. */
function choosePose(b,flags) {
  if(b.savedFit)return 'idle';
  if(b.dizzy>0)return 'dizzy';
  if(flags.winding)return 'determined';
  if(b.excited>0)return 'happy';
  if(b.grounded&&b.away&&b.walkSpeedShown>1.5)return 'back';
  return 'idle';
}
/** The fading copy of a painting. A copy made before its image finished loading must be flagged once it has. */
function ghostOf(b,pose) {
  const tex=b.ghostTextures[pose];
  if(!tex.userData.sent&&tex.image?.width){tex.needsUpdate=true;tex.userData.sent=true;}
  return tex;
}
const fit=(b,pose)=>b.savedFit??(pose==='idle'?IDLE_FIT[b.name]:{scale:1,anchor:ANCHORS[`${b.name}-${pose}`]});

/** flags: {aiming, charging} for the leader, and floorAt(x,z,y) for the ground shadow. */
export function drawResidents(bodies,camera,support,dt,reduced=false,flags={}) {
  for(const [i,b] of bodies.entries()) {
    b.dizzy=Math.max(0,b.dizzy-dt);
    // excitement is earned: a fling or a fast flight, and it fades soon after landing
    const flying=!b.grounded&&(b.propulsion>0||b.vel.length()>LOOK.excitedSpeed);
    b.excited=flying?LOOK.excitedHold:Math.max(0,b.excited-dt);
    const motion=b.grounded?b.walkVel:b.vel;
    const speed=Math.hypot(motion.x,motion.z);
    b.walkSpeedShown=speed;
    const toCamX=camera.position.x-b.pos.x,toCamZ=camera.position.z-b.pos.z,camDist=Math.max(1,Math.hypot(toCamX,toCamZ));
    if(speed>TEAM.poseSpeed)b.away=motion.x*-toCamX+motion.z*-toCamZ>speed*camDist*.55;
    const pose=choosePose(b,{winding:i===0&&(flags.aiming||flags.charging)});
    if(pose!==b.pose) {
      // keep the old painting on top and fade it out; a small squash covers the cut
      b.ghost.material.map=ghostOf(b,b.pose);b.ghostPose=b.pose;b.ghostFace=b.shownFace;b.fade=1;b.swap=1;b.pose=pose;
    }
    b.mat.map=b.textures[b.pose];
    b.fade=Math.max(0,b.fade-dt/LOOK.blend);b.swap=Math.max(0,b.swap-dt/LOOK.blend);
    const weight=1-Math.exp(-LOOK.easing*dt);
    // which way it is heading across the screen: face that way
    const side=(motion.x*toCamZ-motion.z*toCamX)/camDist;
    if(Math.abs(side)>1.2)b.face=side>0?-1:1;
    b.turn+=(b.face-b.turn)*(1-Math.exp(-14*dt));
    // Turning round: the picture facing the old way fades out over the one facing the new way, with a small
    // squash and hop. It never goes thin like a card seen edge-on, which is what gave the flatness away.
    const facing=b.turn<0?-1:1;
    if(facing!==b.shownFace) {
      b.ghost.material.map=ghostOf(b,b.pose);b.ghostPose=b.pose;b.ghostFace=b.shownFace;b.fade=1;b.swap=1;b.turnHop=1;b.shownFace=facing;
    }
    b.turnHop=Math.max(0,(b.turnHop||0)-dt/LOOK.blend);

    // On the ground a plush does not glide: it hops. Each stride is one little arc with a squash on landing.
    let lift=0,stretch=1;
    if(b.grounded&&speed>.6&&!reduced) {
      const arc=Math.abs(Math.sin(b.stride)),pace=Math.min(speed/PLAY.walk,1.6);
      lift=arc*LOOK.hopHeight*(.5+.5*pace);
      stretch=1+(arc-.45)*LOOK.hopStretch;
    } else if(b.grounded&&!reduced) stretch=1+Math.sin(performance.now()*.0022+i*2)*LOOK.breathe;
    // squash from impacts and wind-ups (set by the physics), eased here
    b.squashShown=(b.squashShown||0)+((b.squash||0)-(b.squashShown||0))*Math.min(dt*16,1);
    b.squash=(b.squash||0)*Math.exp(-dt*7);
    const pop=reduced?0:Math.sin(b.swap*Math.PI)*LOOK.swapPop;
    const sq=reduced?1:THREE.MathUtils.clamp(1-b.squashShown*.36,.55,1.5)*stretch*(1-pop);

    // In the air it curls and spins like a ball; on the ground it leans into its heading.
    if(reduced) b.spinShown=0;
    else if(b.grounded||b.hover) {
      const lean=reduced?0:-THREE.MathUtils.clamp(side/PLAY.walk,-1,1)*LOOK.walkTilt-(Math.sin(b.stride*2)*.05*Math.min(speed/PLAY.walk,1));
      b.spinShown=Math.atan2(Math.sin(b.spinShown||0),Math.cos(b.spinShown||0));
      b.spinShown+=(lean-b.spinShown)*weight;
    } else {
      b.spinShown=(b.spinShown||0)+Math.min(b.vel.length()*PLAY.spin,15)*dt*(side>0?-1:1);
    }
    const width=reduced?1:LOOK.turnWidth+(1-LOOK.turnWidth)*Math.abs(b.turn),standing=b.grounded;
    lift+=standing&&!reduced?Math.sin(b.turnHop*Math.PI)*LOOK.turnHop:0;
    const place=(sprite,poseName,face,feet)=>{
      const f=fit(b,poseName),size=PLAY.spriteSize*f.scale,map=sprite.material.map,mirrored=face<0;
      feet.value=standing?f.anchor[1]:-1; // the grass closes round the feet only while it stands on them
      // Mirror by flipping the picture, not the sprite: a sprite ignores a negative width.
      map.repeat.x=mirrored?-1:1;map.offset.x=mirrored?1:0;
      sprite.material.rotation=b.spinShown;
      // spin about the middle of the body in the air, stand on the feet on the ground
      const airCenter=f.visibleHeight==null?LOOK.starterAirPivotY:f.anchor[1]+f.visibleHeight/2;
      sprite.center.set(f.anchor[0],standing?f.anchor[1]:airCenter);
      if(b.savedFit&&mirrored)sprite.center.x=1-f.anchor[0];
      sprite.scale.set(size*(f.aspect??1)/Math.sqrt(sq)*width,size*sq,1);
      // on the ground the feet settle a little into the grass
      const sink=LOOK.footSink*size*(f.visibleHeight??1);
      sprite.position.copy(b.pos).setY(b.pos.y+(standing?-PLAY.radius+lift-sink:LOOK.airLift));
    };
    place(b.sprite,b.pose,b.shownFace,b.feet);
    b.ghost.visible=b.sprite.visible&&b.fade>0;
    if(b.ghost.visible){b.ghost.material.opacity=b.fade*b.fade;place(b.ghost,b.ghostPose,b.ghostFace,b.ghostFeet);}
    drawShadow(b,flags);
  }
}

/** A soft pool on whatever is underneath: thrown away from the moon like the terrain's shadows, shrinking and fading as the resident climbs. */
function drawShadow(b,flags) {
  const under=flags.floorAt?flags.floorAt(b.pos.x,b.pos.z,b.pos.y):b.pos.y-PLAY.radius;
  const shape=shadowShape(b.pos.y-PLAY.radius-under,LOOK),off=shadowOffset(G.uShadowDir.value,LOOK.shadowReachHeight,LOOK.shadowOffsetCap);
  const radius=PLAY.radius*shape.scale,throwing=Math.hypot(off.x,off.z)>0;
  const x=b.pos.x+off.x*shape.near,z=b.pos.z+off.z*shape.near;
  // the pool lies on the ground where it falls, which on a slope is not the height under the feet
  const floor=flags.floorAt?flags.floorAt(x,z,under+PLAY.radius):under;
  b.shadow.visible=b.sprite.visible&&shape.near>0;
  b.shadow.position.set(x,floor+LOOK.shadowLift,z);
  b.shadow.rotation.y=throwing?Math.atan2(-off.z,off.x):0;
  b.shadow.scale.set(radius*(throwing?LOOK.shadowStretch:1),radius,1);
  b.shadow.material.uniforms.uOpacity.value=shape.opacity;
}
