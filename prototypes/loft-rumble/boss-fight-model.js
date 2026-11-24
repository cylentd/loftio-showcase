// Bramble in the live fight (LM3): pure geometry and state for the rig, the shield that guards the weak spot and the
// two-way beam. No drawing, no DOM. Numbers: boss-fight-data.js; rig parts and poses: boss-rig-data.js and boss-rig-model.js.
// The look functions read the fight's attack effect and shield and never change them; the guard rules (guardZone,
// guardHit, guardStep) return the shield's next state for the page to store.
// Spec: docs/design/LOFT-RUMBLE-LIVING-MAGIC.md ("Boss animation construction", "Boss attacks and defense").
(function(root){
  'use strict';
  const TURN=Math.PI*2,HALF=.5;
  const QUARTER_TURN=Math.PI/2,EIGHTH_TURN=Math.PI/4;  // four views, each owns a quarter of the orbit
  const clamp01=v=>Math.max(0,Math.min(1,v));
  const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const Rig=()=>root.LoftRumbleBossRig;

  // ---- Rig ----
  // Rig space -> the boss's local frame (origin at the collider centre). The rig is scaled so crown top to feet spans the
  // storybook boss, feet on its foot line, then stretched by `upright` about the centre so the floor squash leaves it standing.
  function rigBase(radius,upright,F,R){
    const foot=R.pivots.foot,story=F.storybook,s=(story.bossTop+story.bossFoot)*radius/(foot.y-R.parts.crown.y);
    return [s,0,0,s*upright,-s*foot.x,upright*(story.bossFoot*radius-s*foot.y)];
  }
  // The rig model state for the fight's attack clock. Slam: the name flash is the crouch, the windup the hop up, the
  // travel the fall, the landing ring's life the impact squash, then the rig's own recovery. Other attacks: idle breath.
  function rigState({fx,feel,timing,clock},F,R){
    const D=R.durations,idle={attack:'idle',phase:'idle',t:0,clock};
    if(!fx||fx.warn.def.id!=='slam')return idle;
    const t=fx.t,impact=feel.windup+feel.travel,at=(phase,share)=>({attack:'slam',phase,t:share*D[phase],clock});
    if(t<0)return at('crouch',clamp01((t+timing.nameFlash)/timing.nameFlash));
    if(t<feel.windup)return at('rise',t/feel.windup);
    if(!fx.hit)return at('fall',clamp01((t-feel.windup)/feel.travel));
    const after=t-impact;
    if(after<feel.slamRingLife)return at('impact',after/feel.slamRingLife);
    if(after-feel.slamRingLife<D.recover)return {attack:'slam',phase:'recover',t:after-feel.slamRingLife,clock};
    return idle;
  }
  // Pose channels with no hop of the rig's own: the fight already lifts the whole boss for the Slam hop.
  function pose(o,reduced,F,R){return {...Rig().pose(rigState(o,F,R),R,reduced),lift:0};}

  // ---- Shield views ----
  // Screen angles, y down: +pi/2 faces the camera. Each view owns a quarter of the orbit; within `blend` of a boundary the
  // two neighbours share a weight linearly, summing to one. Only shieldLook's strongest view is drawn (no cross-fade).
  const VIEWS=Object.freeze([
    {view:'front',centre:QUARTER_TURN,mirror:false},{view:'rear',centre:-QUARTER_TURN,mirror:false},
    {view:'side',centre:0,mirror:true},{view:'side',centre:Math.PI,mirror:false}
  ]);
  function shieldViews(angle,F){
    const b=F.shield.blend,out=[];
    for(const v of VIEWS){
      const weight=clamp01((EIGHTH_TURN+b-Math.abs(wrap(angle-v.centre)))/(2*b));
      if(weight<=0)continue;
      const depth=v.view==='front'?'front':v.view==='rear'?'rear':Math.sin(angle)>=0?'front':'rear';
      out.push({view:v.view,mirror:v.mirror,depth,weight});
    }
    return out;
  }
  // What is drawn: only the strongest view, opaque. Its weight (1 in its own band, 0.5 at a boundary) sets how much of its
  // width shows, from 1 down to turnSquash at the boundary, where the neighbour takes over at the same width.
  function shieldLook(angle,F){
    const top=shieldViews(angle,F).reduce((a,v)=>v.weight>a.weight?v:a),T=F.shield.turnSquash;
    return {view:top.view,mirror:top.mirror,depth:top.depth,squash:T+(1-T)*(2*top.weight-1)};
  }
  const squashBox=(box,k)=>({...box,left:box.left+box.width*(1-k)*HALF,width:box.width*k});
  function shieldTexture(view,phase,F){
    if(view==='front')return phase==='cracked'?F.textures.cracked:F.textures.front;
    return F.textures[view];
  }
  // Where a view's sprite goes. gx, gy: the plate's middle on the floor, relative to the collider centre (logical units).
  // left, top, width, height: the sprite box in the upright frame at that point (screen-sized units).
  function shieldBox(view,angle,plate,arc,upright,texture,F){
    const S=F.shield,chord=2*plate*Math.sin(arc/2),gx=Math.cos(angle)*plate,gy=Math.sin(angle)*plate;
    if(view==='side'){
      const wall=chord/S.front.span*S.front.aspect*S.front.wall,height=(chord/upright+wall)/S.side.spanY,width=height*texture.width/texture.height;
      const outward=Math.cos(angle)>=0?1:-1,inset=plate*(1-Math.cos(arc/2))*HALF;  // the arc's middle x sits this far inside its outer point
      return {gx,gy,width,height,left:-width*HALF-outward*inset,top:-wall*HALF-height*S.side.centreY,mirror:outward>0};
    }
    const look=view==='front'?S.front:S.rear,width=chord/look.span,height=width*texture.height/texture.width;
    return {gx,gy,width,height,left:-width*HALF,top:-height*look.foot,mirror:false};
  }

  // ---- Shield lifecycle: one state type, one transition function ----
  // State: {phase: intact | cracked | broken | reforming, cracks, t (s in this phase and crack count)}. The phase follows the
  // game's shield ({cracks, down, up}); t restarts on every change, so a fresh crack can shake.
  const SHIELD_PHASES=Object.freeze(['intact','cracked','broken','reforming']);
  const shieldInitial=()=>({phase:'intact',cracks:0,t:0});
  function shieldNext(state,{shield,dt}){
    const phase=shield.down>0?'broken':shield.up<1?'reforming':shield.cracks>0?'cracked':'intact';
    if(phase===state.phase&&shield.cracks===state.cracks)return {...state,t:state.t+Math.max(0,dt)};
    return {phase,cracks:shield.cracks,t:0};
  }
  function crackShake(state,reduced,F){
    const S=F.shield;
    if(reduced||state.phase!=='cracked'||state.t>=S.crackLife)return 0;
    return S.crackShake*(1-state.t/S.crackLife)*Math.cos(TURN*S.crackShakeHz*state.t);
  }
  // The break sprite: on the plate, which sits on the weak spot (owner 2026-11-18), or null.
  function breakPoint(shield,feel,plate,life){
    const since=feel.shieldReform-shield.down;
    if(!(shield.down>0)||since<0||since>=life)return null;
    return {gx:Math.cos(shield.angle)*plate,gy:Math.sin(shield.angle)*plate,k:since/life};
  }

  // ---- Guard rules (owner decision 2026-11-18, #426): the plate sits on the weak spot and moves with it ----
  // shield: {angle (the weak spot's), hp, cracks (look stage from hp), down (exposed s left; >0 = broken), up (regrow 0..1)}.
  // Pure: each returns a new shield. Reduced motion never changes a rule, so the optional 4th/2nd-arg flag is unused.
  // delta: a contact hit's angle from the weak spot. plateHalf: half the plate's arc; weakHalf: the weak arc's half-width.
  const GUARD_ZONES=Object.freeze({plate:'plate',weak:'weak',body:'body'});
  function guardZone(shield,delta,plateHalf,weakHalf){
    const d=Math.abs(wrap(delta));
    if(!(shield.down>0)&&d<=plateHalf)return GUARD_ZONES.plate;
    return d<weakHalf?GUARD_ZONES.weak:GUARD_ZONES.body;
  }
  // Owner rules (2026-11-18), round 4 shield health: who: {trait, chomper}. On the plate, Chomper or a heavy trait takes
  // heavyShare of the shield's HP and anyone else otherShare; at 0 HP it breaks. Boss damage: 0, except a heavy TRAIT (#523 a), whose plate hit is plain (mult 1, plain: true, never the weak x3). A piercing trait
  // passes through to the weak spot under it (inside the weak arc only; elsewhere on the plate it is a plain x1) and takes no HP. The broken weak spot takes the usual weak multiplier only.
  // mult: 0 (no damage) or 1 (the usual hit); plain: a mult-1 plate hit that never takes the weak x3; weak: counts as a weak-spot hit (the page applies its usual x3); chip: the
  // shield HP the hit took. The optional reduced flag in who never changes a rule.
  const CRACKER_TRAIT='heavy',PASS_TRAIT='piercing',CRACK_STAGES=2;
  const GUARD_EVENTS=Object.freeze({crack:'crack',chip:'chip',break:'break',pierce:'pierce',slide:'slide',exposed:'exposed',opening:'opening'});
  // The look stage for a shield HP: 0 intact, 1 cracked, 2 cracked and darkened (owner thresholds 2026-11-18).
  const crackStage=(hp,G)=>hp<=G.hp*G.darkShare?CRACK_STAGES:hp<=G.hp*G.crackedShare?1:0;
  const hitPoints=(G,share)=>Math.round(G.hp*share);
  // Lift opening (owner 2026-11-18, #445): act is the page's attack envelope (actLevel, the value that raises the body).
  // share: the plate's rise, 0 down to 1 at the apex (eases up as act rises, settles as it falls). lifted: a weak-arc hit
  // is an opening. Reduced motion: no lift, so no opening.
  function guardLift(act,G,reduced){
    if(reduced)return {lifted:false,share:0};
    const a=clamp01(act);
    return {lifted:a>=G.liftOpenAt,share:Math.sin(a*Math.PI/2)};
  }
  function guardHit(shield,zone,G,who={}){
    // The plate is up off the weak spot (who.lifted): a weak-arc hit reaches it for anyone and takes no shield HP.
    if(zone==='plate'&&who.lifted&&who.inWeak)return {event:'opening',mult:1,weak:true,chip:0,shield};
    if(zone==='plate'){
      const heavy=who.chomper||who.trait===CRACKER_TRAIT;
      // Piercing reaches the weak spot only inside the weak arc (who.inWeak); on the rest of the plate it does the usual x1
      // and takes no HP, same as with no shield (owner 2026-11-18: x3 through the shield, never stronger than broken).
      if(!heavy&&who.trait===PASS_TRAIT)return who.inWeak?{event:'pierce',mult:1,weak:true,chip:0,shield}:{event:'slide',mult:1,weak:false,chip:0,shield};
      const chip=hitPoints(G,heavy?G.heavyShare:G.otherShare),hp=Math.max(0,shield.hp-chip);
      // Look #523 option a (David, 2026-11-21): a heavy-TRAIT hit on the plate is a plain hit (mult 1, plain: never the weak x3;
      // trait-sim.md "Heavy options rerun", option E). It still takes its shield HP and bounces. Chomper's other traits stay 0.
      const plainHit=who.trait===CRACKER_TRAIT,mult=plainHit?1:0,plain=plainHit?{plain:true}:null;
      if(!hp)return {event:'break',mult,weak:false,...plain,chip,shield:{...shield,hp:0,cracks:0,down:G.exposedSeconds}};
      return {event:heavy?'crack':'chip',mult,weak:false,...plain,chip,shield:{...shield,hp,cracks:crackStage(hp,G)}};
    }
    if(zone==='weak'&&shield.down>0)return {event:'exposed',mult:1,weak:true,chip:0,shield};
    return {event:zone,mult:1,weak:zone==='weak',chip:0,shield};
  }
  // angle: the weak spot's angle this step (the plate follows it). paused: nothing moves. The regrown plate is back with
  // full HP the moment the window ends; its bar refills with the regrow (shieldBar).
  function guardStep(shield,{dt,angle,paused},G){
    if(paused)return shield;
    const next={...shield,angle:angle??shield.angle};
    if(shield.down>0){next.down=Math.max(0,shield.down-dt);if(!next.down)Object.assign(next,{up:0,hp:G.hp,cracks:0});}
    else next.up=Math.min(1,shield.up+dt/G.regrowSeconds);
    return next;
  }
  // The shield health bar: {fill 0..1} (HP share, refilling with the regrow), or null while broken.
  const shieldBar=(shield,G)=>shield.down>0?null:{fill:clamp01(shield.hp/G.hp)*clamp01(shield.up)};
  // The regrowing plate's width share: regrowStart widening to 1 with an ease-out.
  const regrowScale=(up,G)=>G.regrowStart+(1-G.regrowStart)*(1-(1-clamp01(up))**2);
  function shards(shield,feel,plate,reduced,F){
    const S=F.shield.shards,p=breakPoint(shield,feel,plate,reduced?S.reducedLife:S.life);if(!p)return null;
    const k=p.k,fade=k<S.hold?0:(k-S.hold)/(1-S.hold);
    return {gx:p.gx,gy:p.gy,alpha:1-fade*fade,scale:S.scale,grow:reduced?0:S.grow*(1-(1-k)*(1-k)),drop:reduced?0:S.dropShare*k*k};
  }
  // The break flash at the same point: radius in logical units, ring alpha, core disc alpha, ring line width (px).
  function breakFlash(shield,feel,plate,reduced,F){
    const S=F.shield.flash,p=breakPoint(shield,feel,plate,S.life);if(!p)return null;
    const k=p.k,ease=1-(1-k)*(1-k);
    return {gx:p.gx,gy:p.gy,radius:plate*(S.start+(reduced?0:S.grow*ease)),alpha:1-k,
      core:S.coreAlpha*Math.max(0,1-k/S.coreShare),width:S.width*(1-k)+1};
  }

  // ---- Beam both ways ----
  // In the beam's own frame (x along the lane, origin at the collider centre): two beams leave the collider edge and grow
  // outward over the travel, then hold full reach and narrow and fade over beamFade. null when nothing shows.
  function beamSegments(fx,feel,radius,length,F,reduced){
    if(!fx||fx.warn.def.id!=='beam'||fx.t<feel.windup)return null;
    const after=fx.t-feel.windup-feel.travel;if(after>=feel.beamFade)return null;
    const k=reduced?1:clamp01((fx.t-feel.windup)/feel.travel),reach=radius+(length-radius)*k,fade=after<0?1:1-after/feel.beamFade,B=F.beam;
    const width=2*feel.beamHalf*B.laneFill/B.glowShare*(B.fadeWidth+(1-B.fadeWidth)*fade);
    // The texture's fade-in taper (its first opaqueFrom) is pushed back under the boss: the image ends at the reach.
    const seg=(from,to)=>({from,to,image:{from:to-(to-from)/(1-B.opaqueFrom),to}});
    return {segments:[seg(radius,reach),seg(-radius,-reach)],width,alpha:fade,
      lane:{reach,half:feel.beamHalf,alpha:B.laneAlpha*fade}};
  }
  // The two source glows: from the telegraph cue while it charges, then at full size fading with the fired beam.
  function beamSources({cue,fx,feel,radius},F){
    let charge,alpha,angle;
    if(cue&&cue.attack==='beam'){charge=cue.charge;alpha=1;angle=cue.angle}
    else if(fx&&fx.hit&&fx.warn.def.id==='beam'){
      const after=fx.t-feel.windup-feel.travel;if(after>=feel.beamFade)return null;
      charge=1;alpha=1-Math.max(0,after)/feel.beamFade;angle=fx.warn.angle;
    }else return null;
    const G=F.sources,size=G.size*radius*(G.minShare+(1-G.minShare)*clamp01(charge)),x=Math.cos(angle)*radius,y=Math.sin(angle)*radius;
    return {points:[{x,y},{x:-x,y:-y}],size,alpha,angle};
  }

  // ---- Beam look (concept: mockups/rumble-living-magic/beam-bidirectional-and-shield.webp, CHARGE / FIRE / FADE) ----
  // All in the beam's own frame like beamSegments. Look only: the hit test reads FEEL.beamHalf and the warning, never this.
  // Distances from the boss along +x (fore) and -x (back) to the play rect's edge, less the end glow's inset.
  function wallReach(enemy,angle,rect,F){
    const dx=Math.cos(angle),dy=Math.sin(angle),inset=F.beam.end.inset;
    const along=s=>Math.min(...[[s*dx,rect.right-enemy.x],[-s*dx,enemy.x-rect.left],[s*dy,rect.bottom-enemy.y],[-s*dy,enemy.y-rect.top]]
      .filter(([d])=>d>0).map(([d,room])=>room/d));
    return {fore:along(1)-inset,back:along(-1)-inset};
  }
  // CHARGE: chevrons from the collider edge to each wall, pointing outward, crawling outward with the clock.
  function laneChevrons({fore,back,half,radius,clock,charge,reduced},F){
    const C=F.beam.chevrons,size=C.size*half,offset=reduced?0:((clock*C.speed)%C.spacing+C.spacing)%C.spacing;
    const alpha=C.alpha+C.charge*clamp01(charge),out=[];
    for(const [dir,end] of [[1,fore],[-1,back]])
      for(let x=radius+size*HALF+offset;x+size*HALF<=end;x+=C.spacing)out.push({x:dir*x,dir,size,alpha});
    return out;
  }
  // FIRE then FADE: strength k, glow and core half-widths, and the bright bands running outward. null when nothing shows.
  function beamLook(fx,feel,radius,length,F,reduced){
    const seg=beamSegments(fx,feel,radius,length,F,reduced);if(!seg)return null;
    const B=F.beam,after=fx.t-feel.windup-feel.travel,hold=B.hold*feel.beamFade,fading=after>=hold;
    const p=fading?(after-hold)/(feel.beamFade-hold):0,k=(1-p)*(1-p),since=fx.t-feel.windup;
    const breathe=reduced?1:1-B.pulse.depth*HALF*(1-Math.cos(TURN*B.pulse.hz*since));
    const reach=seg.lane.reach,runs=[];
    if(!reduced)for(let x=radius+(since*B.runs.speed)%B.runs.spacing-B.runs.length;x<reach;x+=B.runs.spacing){
      const from=Math.max(radius,x),to=Math.min(reach,x+B.runs.length);if(to<=from)continue;
      runs.push({from,to,alpha:B.runs.alpha*k},{from:-from,to:-to,alpha:B.runs.alpha*k});
    }
    return {phase:fading?'fade':'fire',k,reach,glowHalf:B.glow.half*feel.beamHalf,glowAlpha:B.glow.alpha*k,
      coreHalf:B.core.half*feel.beamHalf*breathe,coreAlpha:B.core.alpha*k,runs};
  }
  // A fixed pseudo-random share in [0, 1) per particle and channel, so the particles are a pure function of time.
  const shares=H=>(i,channel)=>{const v=Math.sin((i+1)*H.index+channel*H.channel)*H.scale;return v-Math.floor(v);};
  const SEED_SIDE=97,SEED_X=1,SEED_Y=2,SEED_AGE=3,SEED_SPIN=4;  // channels of share()
  // FIRE: leaves and sparks streaming outward along each beam. FADE: a few leaves drifting off as the beam dissolves.
  // Each particle's centre plus half its size stays inside spread of beamHalf. Reduced motion: none.
  function beamParticles(fx,feel,radius,length,F,reduced){
    const look=reduced?null:beamLook(fx,feel,radius,length,F,false);if(!look)return [];
    const P=F.beam.particles,share=shares(P.hash),span=look.reach-radius,room=size=>P.spread*feel.beamHalf-size*HALF,out=[];
    const since=fx.t-feel.windup,after=since-feel.travel,fadeAt=F.beam.hold*feel.beamFade;
    for(const dir of [1,-1]){
      if(look.phase==='fire')for(let i=0;i<P.count;i++){const n=i+(dir<0?SEED_SIDE:0),kind=i%P.leafEvery===0?'leaf':'spark';
        const age=(since/P.life+share(n,SEED_AGE))%1,size=P.size[kind];
        out.push({kind,crop:i%P.crops[kind].length,size,alpha:Math.sin(age*Math.PI)*look.k,
          x:dir*(radius+span*Math.min(1,share(n,SEED_X)*(1-P.run)+age*P.run)),y:(2*share(n,SEED_Y)-1)*room(size),
          spin:TURN*(share(n,SEED_SPIN)+P.spin*age*P.life)});}
      else for(let i=0;i<P.fadeCount;i++){const n=i+(dir<0?SEED_SIDE:0),size=P.size.leaf,p=(after-fadeAt)/(feel.beamFade-fadeAt);
        const y=(2*share(n,SEED_Y)-1)*room(size)+P.sink*p,limit=room(size);
        out.push({kind:'leaf',crop:i%P.crops.leaf.length,size,alpha:1-p,
          x:dir*Math.min(look.reach,radius+span*(i+share(n,SEED_X))/P.fadeCount+P.drift*p),y:Math.max(-limit,Math.min(limit,y)),
          spin:TURN*(share(n,SEED_SPIN)+P.spin*p*feel.beamFade)});}
    }
    return out;
  }
  // The spiral glows where each beam meets the wall, once its reach gets there. ends: wallReach's {fore, back}.
  function beamEnds(reach,ends,k,radius,F){
    const size=F.beam.end.size*radius;
    return [[1,ends.fore],[-1,ends.back]].filter(([,d])=>d>radius&&reach>=d).map(([dir,d])=>({x:dir*d,size,alpha:k}));
  }

  // ---- Slam landing (LM3b) ----
  const quadOut=k=>1-(1-k)*(1-k),quadIn=k=>k*k;
  // Seconds since the Slam landed (the tick that set fx.hit), or null.
  function slamSince(fx,feel){
    if(!fx||!fx.hit||fx.warn.def.id!=='slam')return null;
    return fx.t-feel.windup-feel.travel;
  }
  // The game's zone radius: max(slamMin, slamRadius x the shorter arena side) (loft-rumble-realtime.html, slamRadius).
  const slamZone=(feel,arena)=>Math.max(feel.slamMin,feel.slamRadius*Math.min(arena.w,arena.h));
  // The crack on the floor. gx, gy: its core, the boss foot (logical units from the collider centre; the foot sits
  // bossFoot radii below the centre on screen, upright x that on the squashed floor). left, top, width, height: the
  // upright sprite box at that point. Sized so the farther fissure tip lands on tipShare of the ring radius.
  function slamCrack({fx,feel,radius,upright,reduced,arena,texture},F){
    const since=slamSince(fx,feel),C=F.slam.crack;if(since===null||since<0)return null;
    const fade=since-feel.slamRingLife;if(fade>=C.fade)return null;
    const gy=F.storybook.bossFoot*radius*upright,tip=C.tipShare*slamZone(feel,arena);
    const full=Math.sqrt(Math.max(0,tip*tip-gy*gy))/Math.max(C.coreX-C.left,C.right-C.coreX);
    const width=full*(reduced?1:C.growFrom+(1-C.growFrom)*quadOut(Math.min(1,since/C.grow))),height=width*texture.height/texture.width;
    return {gx:0,gy,width,height,left:-C.coreX*width,top:-C.coreY*height,alpha:fade<0?1:1-quadIn(fade/C.fade)};
  }
  // Debris pieces relative to the foot, upright frame (boss-rig-model.js debris: x, y on the floor, h above it).
  // Reduced motion: every reducedEvery-th piece, already resting where it lands, fading over its life.
  function slamDebris({fx,feel,reduced},F,R){
    const since=slamSince(fx,feel),S=F.slam;if(since===null||since<0)return [];
    const D=reduced?{...R,debris:R.debris.filter((_,i)=>i%S.reducedEvery===0)}:R;
    return Rig().debris(since,D,false,reduced).map(p=>({...p,size:p.size*S.debrisScale}));
  }
  // The rig's ground shadow in the boss's floor frame: rig space -> local matrix, and its opacity. The hop share is the
  // rig's own lift channel for the fight's Slam clock (its rise and fall keys mirror the game's hop curve).
  function groundShadow(o,F,R){
    const lift=Rig().pose(rigState(o,F,R),R,o.reduced).lift,p={...R.rest,lift},rig=Rig().rig(p,R);
    const S=F.slam.shadow,foot=R.pivots.foot;
    // Drop onto the foot line, then widen about the foot: [w,0,0,w,..] scales about (foot.x, foot.y).
    const place=[S.widen,0,0,S.widen,foot.x*(1-S.widen),foot.y*(1-S.widen)+S.widen*S.drop];
    return {matrix:Rig().mul(rigBase(o.radius,o.upright,F,R),Rig().mul(place,rig.matrices.shadow)),alpha:rig.shadowAlpha};
  }

  root.LoftRumbleBossFightModel=Object.freeze({rigBase,rigState,pose,shieldViews,shieldLook,squashBox,shieldTexture,shieldBox,
    SHIELD_PHASES,shieldInitial,shieldNext,crackShake,shards,breakFlash,GUARD_ZONES,GUARD_EVENTS,CRACK_STAGES,guardZone,guardHit,guardLift,guardStep,crackStage,shieldBar,regrowScale,beamSegments,beamSources,
    wallReach,laneChevrons,beamLook,beamParticles,beamEnds,slamSince,slamZone,slamCrack,slamDebris,groundShadow});
})(typeof window!=='undefined'?window:globalThis);
