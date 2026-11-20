// Swarm view (ledger #487 U3): draws the swarm stage's monsters, their small health bar, the spawn rune, the spit
// telegraph ring and the flying seed on the fight canvas. Reads a SwarmState (swarm-model.js contract) and never changes it.
// Numbers: LoftRumbleHudData.swarm (rumble-hud-data.js); colours: the tokens it names. Creatures are painted art only
// (VISION): a monster, bar or seed whose image is missing draws nothing. The rune and ring are code geometry like the
// danger rings. image(name) returns a loaded texture or null, as in rumble-hud.js.
(function(root){
  'use strict';
  const D=root.LoftRumbleHudData?.swarm;
  if(!D)return;
  const HALF=.5,TURN=Math.PI*2;
  const dyingSince=new Map(); // monster id -> state.t when first drawn dying, so the puff runs on the fight clock
  let palette=null;

  function colours(){
    if(palette)return palette;
    const style=getComputedStyle(document.documentElement);
    palette=Object.fromEntries(Object.entries(D.tokens).map(([key,name])=>[key,style.getPropertyValue(name).trim()]));
    return palette;
  }
  const clamp01=v=>Math.max(0,Math.min(1,v));

  // The sprite's rectangle: feet anchors sit on the bottom of the hit circle, the flyer is centred on its position.
  function spriteRect(m){
    const s=D.sprites[m.kind];
    if(!s)return null;
    const y=s.anchor==='feet'?m.y+m.r-s.h:m.y-s.h*HALF;
    return {x:m.x-s.w*HALF,y,w:s.w,h:s.h};
  }

  function sprite(ctx,m,rect,img,alpha){
    ctx.save();ctx.globalAlpha=alpha;
    if(m.facing<0){ctx.translate(m.x,0);ctx.scale(-1,1);ctx.translate(-m.x,0)}
    ctx.drawImage(img,rect.x,rect.y,rect.w,rect.h);
    ctx.restore();
  }

  // The small bar above a hurt monster: the frame, then the fill cropped to the health share. Both or neither.
  function bar(ctx,m,rect,image){
    const frame=image(D.art.bar),fill=image(D.art.barFill),B=D.bar;
    if(!frame||!fill||!(m.hp<m.maxHP))return;
    const x=m.x-B.w*HALF,y=rect.y-B.gap-B.h,share=clamp01(m.hp/m.maxHP);
    ctx.drawImage(frame,x,y,B.w,B.h);
    const fw=B.w*B.fillShare,fh=B.h*B.fillHeight,sw=(fill.naturalWidth??fill.width)*share,sh=fill.naturalHeight??fill.height;
    if(share>0)ctx.drawImage(fill,0,0,sw,sh,m.x-fw*HALF,y+(B.h-fh)*HALF,fw*share,fh);
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

  // Death: the sprite fades while fx-leaf-puff grows over it; reduced motion keeps the puff's size and only fades.
  function dying(ctx,m,rect,img,t,image,reduced){
    if(!dyingSince.has(m.id)||dyingSince.get(m.id)>t)dyingSince.set(m.id,t);
    const P=D.puff,frac=clamp01((t-dyingSince.get(m.id))/P.seconds);
    if(frac>=1)return;
    sprite(ctx,m,rect,img,1-frac);
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
    const rect=spriteRect(m),img=image(D.art.monsters[m.kind]);
    if(!rect||!img)return;
    if(m.life==='dying'){dying(ctx,m,rect,img,t,image,reduced);return}
    if(m.life!=='alive')return;
    sprite(ctx,m,rect,img,1);
    bar(ctx,m,rect,image);
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
  //   ground  spawn runes, under the heroes
  //   body    the one live monster `id`, drawn at its place in the renderer's back-to-front order
  //   top     dying monsters and spits, over everything so a telegraph is never hidden behind a hero
  //   all     everything, back to front by ground line (the default)
  const inLayer={ground:m=>m.life==='spawning',top:m=>m.life==='dying',all:()=>true};
  function draw(ctx,{state,image,reduced=false,layer='all',id}){
    const pick=layer==='body'?m=>m.id===id&&m.life==='alive':inLayer[layer];
    const monsters=state.monsters.filter(pick).sort((a,b)=>a.y-b.y);
    for(const m of monsters)monster(ctx,m,state.t,image,reduced);
    if(layer!=='top'&&layer!=='all')return;
    const live=new Set(state.monsters.filter(m=>m.life==='dying').map(m=>m.id));
    for(const key of dyingSince.keys())if(!live.has(key))dyingSince.delete(key);
    for(const s of state.shots)shot(ctx,s,image,reduced);
  }

  const layers=Object.freeze({ground:'ground',body:'body',top:'top',all:'all'}); // the page names layers through this, not literals
  const api=Object.freeze({draw,spriteRect,layers});
  root.LoftRumbleSwarmView=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
