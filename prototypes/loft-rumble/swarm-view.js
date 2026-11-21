// Swarm view (ledger #487 U3): draws the swarm stage's monsters, their small health bar, the spawn rune, the spit
// telegraph ring and the flying seed on the fight canvas; in defense, the crystal the swarm bites (code-drawn, C3 of #501), and
// the ring each hero stands on in swarm mode. Reads a SwarmState (swarm-model.js contract) and never changes it.
// Numbers: LoftRumbleHudData.swarm (rumble-hud-data.js); colours: the tokens it names. Monsters and their bar are drawn in
// code by swarm-monster-art.js (owner 2026-11-20), so they need no image. The death puff and the seed are painted effects:
// one whose image is missing draws nothing. The rune and ring are code geometry like the danger rings. image(name)
// returns a loaded texture or null, as in rumble-hud.js.
(function(root){
  'use strict';
  const D=root.LoftRumbleHudData?.swarm,Art=root.LoftRumbleSwarmMonsterArt;
  if(!D||!Art)return;
  const HALF=.5,TURN=Math.PI*2;
  const dyingSince=new Map(); // monster id -> state.t when first drawn dying, so the pop runs on the fight clock
  const hits=new Map();       // monster id -> {hp, at}: the last hp drawn and state.t of the last drop, for the hit flash
  let palette=null;

  function colours(){
    if(palette)return palette;
    const style=getComputedStyle(document.documentElement);
    palette=Object.fromEntries(Object.entries(D.tokens).map(([key,name])=>[key,style.getPropertyValue(name).trim()]));
    return palette;
  }
  const clamp01=v=>Math.max(0,Math.min(1,v));

  // The silhouette's rectangle: feet anchors sit on the bottom of the hit circle, the flyer is centred on its position.
  function spriteRect(m){
    const b=Art.bounds(m.kind,m.r);
    const y=b.anchor==='feet'?m.y+m.r-b.h:m.y-b.h*HALF;
    return {x:m.x-b.w*HALF,y,w:b.w,h:b.h};
  }
  const anchorY=m=>Art.bounds(m.kind,m.r).anchor==='feet'?m.y+m.r:m.y;

  // Seconds since this monster's hp last dropped; Infinity when it never has.
  function hitAge(m,t){
    const seen=hits.get(m.id);
    if(!seen||m.hp>seen.hp||seen.at>t){hits.set(m.id,{hp:m.hp,at:-Infinity});return Infinity}
    if(m.hp<seen.hp)hits.set(m.id,{hp:m.hp,at:t});
    return t-hits.get(m.id).at;
  }

  // A live monster is drawn from the sprite cache when the page has one (swarm-sprites.js): one drawImage in place of its
  // gradients. A dying monster (extra.defeat) and a page without the cache use the art's own live drawing.
  function body(ctx,m,t,reduced,extra){
    const args={kind:m.kind,x:m.x,y:anchorY(m),r:m.r,facing:m.facing,t,id:m.id,reduced,...extra};
    const Sprites=root.LoftRumbleSwarmSprites;
    if(Sprites&&!args.defeat&&Sprites.drawMonster(ctx,{...args,pose:Art.pose(args.kind,args)}))return;
    Art.draw(ctx,args);
  }

  // The small bar above a hurt monster, the gap above the highest point its art reaches in any pose (Art.top).
  function bar(ctx,m){
    if(!(m.hp<m.maxHP))return;
    const at={x:m.x,y:anchorY(m)-Art.top(m.kind,m.r)-D.bar.gap,share:clamp01(m.hp/m.maxHP)};
    if(!(root.LoftRumbleSwarmSprites?.drawBar(ctx,at)))Art.bar(ctx,at);
  }

  // Spawn rune: a ring with short outward ticks, growing to full over SPAWN_RUNE_S. It turns only with full motion.
  function rune(ctx,m,reduced){
    const R=D.rune,runeS=root.LoftRumbleSwarmData?.SPAWN_RUNE_S,frac=runeS?clamp01(m.age/runeS):1;
    const radius=m.r*R.radius*(R.from+(1-R.from)*frac);
    ctx.save();ctx.translate(m.x,m.y);
    if(!reduced)ctx.rotate(m.age*R.spin);
    ctx.globalAlpha=R.alpha;ctx.strokeStyle=colours().rune;ctx.lineWidth=R.width;
    ctx.beginPath();ctx.arc(0,0,radius,0,TURN);
    for(let i=0;i<R.ticks;i++){
      const a=i/R.ticks*TURN,c=Math.cos(a),s=Math.sin(a);
      ctx.moveTo(c*radius,s*radius);ctx.lineTo(c*radius*(1+R.tick),s*radius*(1+R.tick));
    }
    ctx.stroke();ctx.restore();
  }

  // Death: the killing hit flashes, the monster pops (grows and fades) while fx-leaf-puff grows over it; reduced motion
  // keeps both sizes and only fades.
  function dying(ctx,m,rect,t,image,reduced){
    if(!dyingSince.has(m.id)||dyingSince.get(m.id)>t)dyingSince.set(m.id,t);
    const P=D.puff,since=t-dyingSince.get(m.id),frac=clamp01(since/P.seconds);
    if(frac>=1)return;
    body(ctx,m,t,reduced,{hitAge:since,defeat:frac});
    const puff=image(D.art.puff);
    if(!puff)return;
    const size=P.size*(reduced?1:P.from+(P.to-P.from)*frac),cy=rect.y+rect.h*HALF;
    ctx.save();ctx.globalAlpha=1-frac;
    ctx.drawImage(puff,m.x-size*HALF,cy-size*HALF,size,size);
    ctx.restore();
  }

  function monster(ctx,m,t,image,reduced){
    if(m.life==='removed')return;
    if(m.life==='spawning'){rune(ctx,m,reduced);return}
    const rect=spriteRect(m);
    if(m.life==='dying'){dying(ctx,m,rect,t,image,reduced);return}
    if(m.life!=='alive')return;
    body(ctx,m,t,reduced,{hitAge:hitAge(m,t)});
    bar(ctx,m);
  }

  // A spit: a pulsing danger ring while it telegraphs (steady under reduced motion), then the seed pointed along its flight.
  // The ring and its aim line are one path, stroked twice: a steady dark casing that holds the contrast on sand, then the
  // pink core that pulses inside it.
  function shot(ctx,s,image,reduced){
    if(s.phase==='telegraph'){
      const T=D.telegraph,wave=reduced?1:HALF+HALF*Math.sin(s.t*T.pulse*TURN),edge=s.r*T.radius;
      ctx.save();ctx.lineCap='round';ctx.beginPath();ctx.arc(s.x,s.y,edge,0,TURN);
      // The aim line from the ring's edge along the flight, so the player reads where to step out of.
      const speed=Math.hypot(s.vx,s.vy);
      if(speed>0){
        const ux=s.vx/speed,uy=s.vy/speed,reach=speed*T.aim;
        ctx.moveTo(s.x+ux*edge,s.y+uy*edge);ctx.lineTo(s.x+ux*reach,s.y+uy*reach);
      }
      ctx.globalAlpha=1;ctx.strokeStyle=colours().telegraphCase;ctx.lineWidth=T.caseWidth;ctx.stroke();
      ctx.globalAlpha=T.alphaMin+(1-T.alphaMin)*wave;ctx.strokeStyle=colours().telegraph;ctx.lineWidth=T.width;ctx.stroke();
      ctx.restore();
      return;
    }
    const seed=image(D.art.seed);
    if(s.phase!=='flying'||!seed)return;
    const size=s.r*D.seed.size;
    ctx.save();ctx.translate(s.x,s.y);ctx.rotate(Math.atan2(s.vy,s.vx));
    ctx.drawImage(seed,-size*HALF,-size*HALF,size,size);
    ctx.restore();
  }

  // Layers, so the camera renderer can depth-sort live monsters with the heroes (camera-renderer.js draws each enemy in turn):
  //   ground  each marked hero's ring, then spawn runes, under the heroes
  //   body    the one live monster `id`, drawn at its place in the renderer's back-to-front order
  //   top     dying monsters and spits, over everything so a telegraph is never hidden behind a hero
  //   all     everything, back to front by ground line (the default)
  const inLayer={ground:m=>m.life==='spawning',top:m=>m.life==='dying',all:()=>true};
  //   crystal the crystal, if no monster in front of it has drawn it yet; the page draws this layer before the heroes
  // The crystal takes its place in the body order: before the first monster standing in front of it (ground line), once a frame.
  // upright: the camera's uprightScale, so the gem stands up under the shallow projection as the boss and bumpers do.
  let crystalDone=false; // the crystal was drawn this frame; the ground layer, drawn first each frame, clears it
  function draw(ctx,{state,image,reduced=false,layer='all',id,upright=1}){
    const c=state.crystal,paint=()=>{crystalDone=true;drawCrystal(ctx,c,state.t,reduced,upright)};
    if(layer==='crystal'){if(c&&!crystalDone)paint();return}
    if(layer==='ground')drawHeroMarks(ctx,state.t,reduced);
    if(c){
      if(layer==='ground'){crystalDone=false;if(!state.monsters.some(m=>m.life==='alive'))paint()}
      else if(layer==='all')paint();
      else if(layer==='body'&&!crystalDone){const m=state.monsters.find(m=>m.id===id);if(m&&anchorY(m)>=crystalGround(c))paint()}
    }
    const pick=layer==='body'?m=>m.id===id&&m.life==='alive':inLayer[layer];
    const monsters=state.monsters.filter(pick).sort((a,b)=>a.y-b.y);
    for(const m of monsters)monster(ctx,m,state.t,image,reduced);
    if(layer!=='top'&&layer!=='all')return;
    root.LoftRumbleSwarmSprites?.warmStep?.(); // once a frame: paint a few hit sprites ahead of the first hit
    const dead=new Set(state.monsters.filter(m=>m.life==='dying').map(m=>m.id));
    for(const key of dyingSince.keys())if(!dead.has(key))dyingSince.delete(key);
    const present=new Set(state.monsters.filter(m=>m.life!=='removed').map(m=>m.id));
    for(const key of hits.keys())if(!present.has(key))hits.delete(key);
    for(const s of state.shots)shot(ctx,s,image,reduced);
  }

  // ---- Crystal (defense, C3 of ledger #501, owner "build crystal" 2026-11-20). Code-drawn per the 2026-11-16 rule.
  // The look (every number, colour token and shape) is LoftRumbleHudData.swarm.crystal and .heroRing in rumble-hud-data.js.
  const look=deepFreeze({crystal:D.crystal,heroRing:D.heroRing});
  function deepFreeze(o){for(const v of Object.values(o))if(v&&typeof v==='object')deepFreeze(v);return Object.freeze(o)}
  const crystalColours=Object.fromEntries(Object.keys(look.crystal.tokens).map(key=>[key,null]));
  function crystalColour(key){
    if(crystalColours[key]===null)crystalColours[key]=getComputedStyle(document.documentElement).getPropertyValue(look.crystal.tokens[key]).trim();
    return crystalColours[key];
  }

  // 0 whole, 1 cracked, 2 badly cracked: one stage per HP third.
  function crackStage(c){
    const share=c.maxHP>0?c.hp/c.maxHP:0,L=look.crystal;
    return share>L.cracked?0:share>L.badly?1:2;
  }

  // The latest bite: pending until the next frame stamps it with the fight clock (crystalHit carries no time).
  let bite=null;
  function crystalHit(ev){bite=ev?.reduced?null:{at:null}}
  function flashShare(t){
    if(!bite)return 0;
    if(bite.at===null)bite.at=t;
    const age=t-bite.at,F=look.crystal.flashS;
    if(age<0||age>=F){bite=null;return 0}   // done, or a reset put the clock back
    return 1-age/F;
  }

  function path(ctx,points){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath()}
  // One gem's facets: left side light to face, right side deep, the top bevel lightest. scaleR is the canvas px per gem unit.
  // crown: the points between the left and right shoulders, the tip alone or the snapped crown.
  const mirror=([x,y])=>[-x,y];
  function outlinePoints(crown){const {shoulder,hip,base}=look.crystal.gem;return [mirror(shoulder),...crown,shoulder,hip,base,mirror(hip)]}
  function gem(ctx,scaleR,crown=[look.crystal.gem.tip]){
    const {tip,shoulder,hip,base,bevel}=look.crystal.gem;
    const left=[mirror(shoulder),mirror(hip),base,bevel],right=[shoulder,hip,base,bevel],top=[mirror(shoulder),...crown,shoulder,bevel];
    const sheen=ctx.createLinearGradient(-shoulder[0],tip[1],0,base[1]);
    sheen.addColorStop(0,crystalColour('light'));sheen.addColorStop(1,crystalColour('face'));
    path(ctx,left);ctx.fillStyle=sheen;ctx.fill();
    path(ctx,right);ctx.fillStyle=crystalColour('deep');ctx.fill();
    path(ctx,top);ctx.fillStyle=crystalColour('light');ctx.fill();
    outline(ctx,outlinePoints(crown),scaleR);
  }
  function outline(ctx,points,scaleR){path(ctx,points);ctx.strokeStyle=crystalColour('ink');ctx.lineWidth=look.crystal.inkPx/scaleR;ctx.lineJoin='round';ctx.stroke()}
  function placed(ctx,side,draw){ctx.save();ctx.translate(...side.at);ctx.rotate(side.turn);ctx.scale(side.scale,side.scale);draw(side.scale);ctx.restore()}

  // The arena y of the crystal's ground line: a monster whose feet are at or below it stands in front.
  const crystalGround=c=>c.y+look.crystal.gem.base[1]*c.r*look.crystal.drawScale;

  function drawCrystal(ctx,c,t,reduced,upright){
    const L=look.crystal,stage=crackStage(c),flash=reduced?0:flashShare(t),R=c.r*L.drawScale,base=L.gem.base[1];
    if(reduced)bite=null;
    ctx.save();ctx.translate(c.x,c.y);ctx.scale(R,R);
    ctx.globalAlpha=L.shadow.alpha;ctx.fillStyle=crystalColour('shadow');
    ctx.beginPath();ctx.ellipse(0,L.shadow.y,L.shadow.rx,L.shadow.ry,0,0,TURN);ctx.fill();ctx.globalAlpha=1;
    ctx.translate(0,base);ctx.scale(1,upright);ctx.translate(0,-base); // stand up from the ground line, the shadow stays flat
    const [leftSide,rightSide]=L.sides;
    placed(ctx,leftSide,k=>gem(ctx,R*k));
    if(stage<2)placed(ctx,rightSide,k=>gem(ctx,R*k));
    else placed(ctx,rightSide,k=>{path(ctx,L.stub);ctx.fillStyle=crystalColour('deep');ctx.fill();outline(ctx,L.stub,R*k)});
    const crown=stage<2?[L.gem.tip]:L.snapped;
    gem(ctx,R,crown);
    const shown=stage===0?[]:stage===1?L.cracks.slice(0,1):L.cracks;
    ctx.lineCap='round';ctx.lineJoin='round';
    for(const crack of shown){
      ctx.beginPath();crack.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
      ctx.strokeStyle=crystalColour('ink');ctx.lineWidth=L.crackCasePx/R;ctx.stroke();
      ctx.strokeStyle=crystalColour('crack');ctx.lineWidth=L.crackPx/R;ctx.stroke();
    }
    if(flash>0){
      ctx.globalAlpha=L.flashAlpha*flash;ctx.fillStyle=crystalColour('flash');
      path(ctx,outlinePoints(crown));ctx.fill();
      for(const side of stage<2?L.sides:[leftSide])placed(ctx,side,()=>{path(ctx,outlinePoints([L.gem.tip]));ctx.fill()});
    }
    ctx.restore();
  }

  // A pool of light at the hero's feet (look.heroRing). It stays flat on the ground: no upright scale, no fill over the body.
  // tint: the hero's dock colours, {ink, surface}; look.heroRing names which one the glow and the rim take.
  function heroRing(ctx,{x,y,r,t=0,reduced=true,...tint}){
    const H=look.heroRing,{steps,alpha}=H.glow,cy=y+r*H.footY,rx=r*H.rx,ry=rx*H.squash;
    const swell=reduced?1:1+H.breathe.amp*Math.sin(TURN*t/H.breathe.periodS);
    const oval=k=>{ctx.beginPath();ctx.ellipse(x,cy,rx*k,ry*k,0,0,TURN)};
    ctx.save();ctx.fillStyle=tint[H.glow.colour];ctx.globalAlpha=alpha*swell;
    for(let i=0;i<steps;i++){oval(1-i/steps);ctx.fill()} // nested, so the light builds toward the centre
    ctx.globalAlpha=Math.min(1,H.rim.alpha*swell);ctx.strokeStyle=tint[H.rim.colour];ctx.lineWidth=H.rim.width;oval(H.rim.at);ctx.stroke();
    ctx.restore();
  }
  // The page marks each hero as it draws it; the next ground layer, drawn before every monster, lays the light down from the
  // live body, so the marker sits under the monsters and the heroes at the body's place this frame. Cleared once drawn.
  const heroMarks=new Map();
  function heroMark(id,{body,r,ink,surface}){heroMarks.set(id,{body,r,ink,surface})}
  function drawHeroMarks(ctx,t,reduced){
    for(const {body,r,ink,surface} of heroMarks.values())heroRing(ctx,{x:body.x,y:body.y,r,ink,surface,t,reduced});
    heroMarks.clear();
  }
  // A hero's dock colours (its card's --hero-ink and --hero-surface, hero-cards.css), read once per hero; fallback
  // ({ink,surface}) stands in for a hero with no dock card or no tint.
  const heroTints=new Map();
  function heroTint(id,fallback){
    if(heroTints.has(id))return heroTints.get(id);
    const card=document.querySelector(`.roster [data-resident="${id}"]`),style=card&&getComputedStyle(card);
    const tint={ink:style?.getPropertyValue('--hero-ink').trim()||fallback.ink,surface:style?.getPropertyValue('--hero-surface').trim()||fallback.surface};
    heroTints.set(id,tint);return tint;
  }

  const layers=Object.freeze({ground:'ground',body:'body',crystal:'crystal',top:'top',all:'all'}); // the page names layers through this, not literals
  const api=Object.freeze({draw,spriteRect,layers,crystalHit,crackStage,heroRing,heroMark,heroTint,look});
  root.LoftRumbleSwarmView=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
