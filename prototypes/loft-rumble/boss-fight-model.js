// Bramble in the live fight (LM3): pure geometry and state for the rig, the rotating shield and the two-way beam.
// No drawing, no DOM. Numbers: boss-fight-data.js; rig parts and poses: boss-rig-data.js and boss-rig-model.js.
// It reads the fight's attack effect and shield and never changes them, so damage, colliders and timings stay put.
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
  // The break sprite: where the plate was when it broke (the angle keeps turning while it is down), or null.
  function breakPoint(shield,feel,plate,life){
    const since=feel.shieldReform-shield.down;
    if(!(shield.down>0)||since<0||since>=life)return null;
    const at=shield.angle-since*TURN/feel.shieldTurn;
    return {gx:Math.cos(at)*plate,gy:Math.sin(at)*plate,k:since/life};
  }
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

  root.LoftRumbleBossFightModel=Object.freeze({rigBase,rigState,pose,shieldViews,shieldLook,squashBox,shieldTexture,shieldBox,
    SHIELD_PHASES,shieldInitial,shieldNext,crackShake,shards,breakFlash,beamSegments,beamSources});
})(typeof window!=='undefined'?window:globalThis);
