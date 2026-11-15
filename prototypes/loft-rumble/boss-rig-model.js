// Bramble rig model for the dev-only preview: one state type, one pure transition function, pose sampling and the rig's
// part transforms. No drawing, no DOM. Data: boss-rig-data.js. Lifecycle map: idle -> crouch -> rise -> fall -> impact ->
// recover -> (Slam loops: gap -> crouch) | (Idle: idle). Spec: docs/design/LOFT-RUMBLE-LIVING-MAGIC.md.
(function(root){
  'use strict';
  const HALF=.5;
  const DEGREES_PER_PI=180;  // degree to radian conversion
  const ARC_PEAK=4;          // 4k(1-k) is a unit-height arc over k in 0..1, peaking at k = 0.5
  const EASE={
    linear:k=>k,
    sineInOut:k=>HALF-HALF*Math.cos(Math.PI*k),
    sineOut:k=>Math.sin(k*Math.PI*HALF),
    quadIn:k=>k*k,
    quadOut:k=>1-(1-k)*(1-k)
  };
  const ATTACKS=Object.freeze(['idle','slam']);
  const CHANNELS=Object.freeze(['sx','sy','lean','crownDy','crownRot','arm','lift']);

  // State: {attack, phase, t (seconds into phase), clock (seconds of breath)}. Every function returns a new object.
  const initial=()=>({attack:'idle',phase:'idle',t:0,clock:0});
  const after=(attack,phase,D)=>{
    const order=D.slamPhases,i=order.indexOf(phase);
    if(i>=0&&i<order.length-1)return order[i+1];
    if(phase==='gap')return 'crouch';
    return attack==='slam'?'gap':'idle';
  };
  const length=(phase,D)=>phase==='gap'?D.slamGap:D.durations[phase];

  // The one transition function. Events: {type:'select',attack}, {type:'tick',dt}, {type:'reset'}.
  function next(state,event,D){
    if(event.type==='reset')return initial();
    if(event.type==='select'){
      if(!ATTACKS.includes(event.attack))return state;
      return {attack:event.attack,phase:event.attack==='slam'?'crouch':'idle',t:0,clock:state.clock};
    }
    if(event.type!=='tick'||!(event.dt>0))return state;
    let {phase,t}=state;t+=event.dt;
    // Idle has no end; every other phase hands its overflow to the next.
    while(phase!=='idle'&&t>=length(phase,D)){t-=length(phase,D);phase=after(state.attack,phase,D)}
    return {attack:state.attack,phase,t,clock:state.clock+event.dt};
  }
  // The state `seconds` after choosing `attack` from rest: what the page's ?t= parameter and the tests use.
  const at=(attack,seconds,D)=>next(next(initial(),{type:'select',attack},D),{type:'tick',dt:seconds},D);

  function sampleKeys(keys,k,D){
    let a=keys[0],b=keys[keys.length-1];
    for(let i=0;i<keys.length-1;i++)if(k>=keys[i][0]&&k<=keys[i+1][0]){a=keys[i];b=keys[i+1];break}
    const span=b[0]-a[0],u=span>0?(k-a[0])/span:0,out={};
    for(const c of CHANNELS){const va=a[1][c]??D.rest[c],vb=b[1][c]??D.rest[c];out[c]=va+(vb-va)*u}
    return out;
  }
  // Pose channels for a state. reduced: deviation from rest is scaled by D.reduced.poseShare (0 = a still boss).
  function pose(state,D,reduced){
    let p={...D.rest};
    if(state.phase==='idle'||state.phase==='gap'){
      const w=2*Math.PI*state.clock/D.idlePeriod,lag=2*Math.PI*D.idle.crownLag;
      p.sy=1+D.idle.sy*Math.sin(w);p.sx=1+D.idle.sx*Math.sin(w);
      p.crownRot=D.idle.crownRot*Math.sin(w-lag);p.arm=D.idle.arm*Math.sin(w-lag);
    }else{
      const k=Math.min(1,Math.max(0,state.t/D.durations[state.phase]));
      p=sampleKeys(D.keys[state.phase],EASE[D.ease[state.phase]](k),D);
    }
    if(!reduced)return p;
    const share=D.reduced.poseShare,out={};
    for(const c of CHANNELS)out[c]=D.rest[c]+(p[c]-D.rest[c])*share;
    return out;
  }

  // 2D affine [a,b,c,d,e,f] as canvas setTransform takes it.
  const mul=([a,b,c,d,e,f],[g,h,i,j,k,l])=>[a*g+c*h,b*g+d*h,a*i+c*j,b*i+d*j,a*k+c*l+e,b*k+d*l+f];
  const T=(x,y)=>[1,0,0,1,x,y],S=(x,y)=>[x,0,0,y,0,0],R=a=>[Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0];
  const apply=([a,b,c,d,e,f],p)=>({x:a*p.x+c*p.y+e,y:b*p.x+d*p.y+f});
  const chain=(...ms)=>ms.reduce(mul);

  // Rig units per logical arena unit: the rig's height (crown top to feet) is rigHeightRadii boss radii.
  const unitsPerLogical=D=>(D.pivots.foot.y-D.parts.crown.y)/(D.rigHeightRadii*D.game.enemyRadius);
  const hopUnits=D=>D.game.slamHop*unitsPerLogical(D);

  // Part transforms in rig space for a pose. Torso scales and leans about the foot pivot, so grounded feet never move;
  // the crown and sockets ride their attach points on the torso and only rotate about their own pivots.
  function rig(p,D){
    const pv=D.pivots,foot=pv.foot,lift=p.lift*hopUnits(D);
    const torso=chain(T(foot.x,foot.y-lift),R(p.lean),S(p.sx,p.sy),T(-foot.x,-foot.y));
    const brow=apply(torso,pv.brow),crownAt={x:brow.x,y:brow.y+p.crownDy};
    const crown=chain(T(crownAt.x,crownAt.y),R(p.crownRot),T(-pv.crown.x,-pv.crown.y));
    const shoulderL=apply(torso,pv.shoulderLeft),shoulderR=apply(torso,pv.shoulderRight);
    const socketLeft=chain(T(shoulderL.x,shoulderL.y),R(p.arm),T(-pv.socketLeft.x,-pv.socketLeft.y));
    const socketRight=chain(T(shoulderR.x,shoulderR.y),R(-p.arm),T(-pv.socketRight.x,-pv.socketRight.y));
    const liftShare=Math.min(1,Math.max(0,p.lift)),sh=D.shadow;
    const shadowScale=1+(sh.apexScale-1)*liftShare;
    const shadow=chain(T(foot.x,foot.y-D.shadowLift),S(shadowScale*p.sx,shadowScale),T(-foot.x,-(foot.y-D.shadowLift)));
    return {
      matrices:{torso,crown,socketLeft,socketRight,shadow},
      points:{foot:apply(torso,foot),brow,crownAt,crownPivot:apply(crown,pv.crown),
        shoulderLeft:shoulderL,shoulderRight:shoulderR,socketLeft:apply(socketLeft,pv.socketLeft),socketRight:apply(socketRight,pv.socketRight)},
      shadowAlpha:sh.alpha*(1+(sh.apexAlpha-1)*liftShare),shadowScale,liftUnits:lift
    };
  }

  const slamRadius=G=>Math.max(G.slamMin,G.slamRadius*Math.min(G.arenaW,G.arenaH));
  // Seconds since the landing, or null outside impact/recover.
  function sinceImpact(state,D){
    if(state.phase==='impact')return state.t;
    if(state.phase==='recover')return D.durations.impact+state.t;
    return null;
  }
  // The game's landing shockwave: from the boss edge to the zone edge over slamRingLife (realtime.html, Slam ring draw).
  function ring(since,D){
    const G=D.game;if(since===null||since>=G.slamRingLife)return null;
    const k=since/G.slamRingLife;
    return {r:G.enemyRadius+(slamRadius(G)-G.enemyRadius)*Math.sqrt(k),alpha:1-k};
  }
  // Impact sprite size (logical width) and opacity. Reduced motion keeps the flash but not its growth.
  function impact(since,D,reduced){
    const I=D.impact;if(since===null||since>=I.life)return null;
    const k=since/I.life,width=2*slamRadius(D.game)*I.ringShare;
    return {width:width*(reduced?1:I.growFrom+(1-I.growFrom)*EASE.quadOut(Math.min(1,k*2))),alpha:1-EASE.quadIn(k)};
  }
  // Debris pieces relative to the ground point, logical units: x, y on the floor; h = height above it.
  function debris(since,D,reduced){
    if(reduced||since===null)return [];
    const zone=slamRadius(D.game),R=D.game.enemyRadius,out=[];
    for(const d of D.debris){
      if(since>=d.life)continue;
      const k=since/d.life,a=d.angle*Math.PI/DEGREES_PER_PI,r=d.dist*zone*EASE.quadOut(k);
      out.push({kind:d.kind,x:Math.cos(a)*r,y:Math.sin(a)*r*HALF,h:ARC_PEAK*d.h*R*k*(1-k),rot:2*Math.PI*d.spin*k,size:d.size*R,alpha:1-EASE.quadIn(k)});
    }
    return out;
  }
  // As in the game: the zone ring shows until the hit lands (currentWarn in loft-rumble-realtime.html); then only the shockwave.
  const WARNING_PHASES=new Set(['crouch','rise','fall']);
  const warning=state=>state.attack==='slam'&&WARNING_PHASES.has(state.phase);

  root.LoftRumbleBossRig=Object.freeze({ATTACKS,CHANNELS,initial,next,at,pose,rig,apply,slamRadius,sinceImpact,ring,impact,debris,warning,unitsPerLogical,hopUnits});
})(typeof window!=='undefined'?window:globalThis);
