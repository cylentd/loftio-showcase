// Swarm monster art: the capling, mossback and sporemoth and their small health bar, drawn in canvas code (owner
// 2026-11-20: monsters may be code-drawn; residents stay painted). Every shape, colour and timing is data in
// LoftRumbleSwarmData.ART (swarm-data.js); this file only turns that data into soft-shaded paths: a radial gradient lit
// from the upper left, a darker rim, a light highlight and a contact shadow, to sit with the painted arenas.
// pose() is pure (motion, hit flash, defeat pop); draw() and bar() paint one monster or one bar on a 2D context.
(function(root){
  'use strict';
  const Data=root.LoftRumbleSwarmData;
  if(!Data)return;
  const A=Data.ART,P=A.palette,TURN=Math.PI*2,HALF=.5;
  const HEX_RADIX=16,HEX_PAIR=2,CHANNELS=[0,1,2]; // '#rrggbb'
  const SPIRAL_STEPS=24;                          // segments in a wing's spiral vein
  const SIDES=[-1,1];
  const kinds=Object.freeze([...Data.IDS]);
  const clamp01=v=>Math.max(0,Math.min(1,v));

  function known(kind){
    if(!A.bounds[kind]||!A[kind])throw new Error(`swarm monster art: unknown kind "${kind}"`);
    return kind;
  }
  const drawRadius=(kind,r)=>r*A.drawScale[known(kind)];  // the size the shapes are drawn at; the hit radius is r itself
  function bounds(kind,r){const b=A.bounds[known(kind)],s=drawRadius(kind,r);return {w:b.w*s,h:b.h*s,anchor:b.anchor}}
  const top=(kind,r)=>A.barTop[known(kind)]*drawRadius(kind,r); // the bar's bottom, canvas units above the anchor: clear of every pose

  // Motion for one frame. Walkers breathe about the feet; the flyer bobs and flaps. A hit flashes (and squashes with full
  // motion); a defeat grows and fades (only fades under reduced motion). Reduced motion holds every other value at rest.
  function pose(kind,{t=0,id=0,hitAge=Infinity,defeat=0,reduced=false}={}){
    known(kind);
    const flash=clamp01(1-hitAge/A.hitFlashS),d=clamp01(defeat);
    const out={bobY:0,scaleX:1,scaleY:1,wing:0,flash,alpha:1-d,scale:1,silhouette:d>0&&d<A.popWhite?1:0};
    if(reduced)return out;
    const phase=id*A.phaseSpread;
    out.scale=1+A.popGrow*d;
    if(A.bounds[kind].anchor==='centre'){
      out.bobY=-A.bobAmp*(HALF+HALF*Math.sin(TURN*(t*A.bobHz+phase)));
      out.wing=A.flapAmp*Math.sin(TURN*(t*A.flapHz+phase));
    }else{
      const s=Math.sin(TURN*(t*A.breatheHz+phase));
      out.scaleY=1+A.breatheAmp*s;out.scaleX=1-A.breatheAmp*s*HALF;
    }
    out.scaleX*=1+A.hitSquash*flash;out.scaleY*=1-A.hitSquash*flash*HALF;
    return out;
  }

  // ---- Colour and primitives. k is the flash mix toward white; k 0 returns the palette colour untouched.
  const rgb=hex=>CHANNELS.map(i=>parseInt(hex.slice(1+i*HEX_PAIR,1+(i+1)*HEX_PAIR),HEX_RADIX));
  function mix(hex,k,to=P.flash){
    if(!(k>0))return hex;
    const a=rgb(hex),b=rgb(to);
    return '#'+CHANNELS.map(i=>Math.round(a[i]+(b[i]-a[i])*k).toString(HEX_RADIX).padStart(HEX_PAIR,'0')).join('');
  }
  function oval(ctx,e){ctx.beginPath();ctx.ellipse(e.x,e.y,e.rx??e.r,e.ry??e.r,e.a??0,0,TURN)}
  function gradient(ctx,cx,cy,rx,ry,[light,base,dark],k){
    const g=ctx.createRadialGradient(cx+rx*A.lightAt.x,cy+ry*A.lightAt.y,0,cx,cy,Math.max(rx,ry));
    g.addColorStop(0,mix(light,k));g.addColorStop(HALF,mix(base,k));g.addColorStop(1,mix(dark,k));
    return g;
  }
  // One soft-shaded body: gradient fill, dark rim. The current path is filled when `path` is false.
  function shade(ctx,e,tones,f,path=true){
    const rx=e.rx??e.r,ry=e.ry??e.r;
    if(path)oval(ctx,e);
    ctx.fillStyle=gradient(ctx,e.x,e.y,rx,ry,tones,f.k);ctx.fill();
    ctx.strokeStyle=mix(mix(tones[2],A.rimInk,P.outline),f.k);ctx.lineWidth=A.rimPx/f.r;ctx.stroke();
  }
  function flat(ctx,e,colour,f){oval(ctx,e);ctx.fillStyle=mix(colour,f.k);ctx.fill()}
  function shine(ctx,e,f){
    ctx.save();ctx.globalAlpha*=A.highlightAlpha;flat(ctx,e,P.flash,f);ctx.restore();
  }
  function line(ctx,l,width,colour,f){
    ctx.beginPath();ctx.moveTo(l.x1,l.y1);ctx.lineTo(l.x2,l.y2);
    ctx.lineCap='round';ctx.lineWidth=width;ctx.strokeStyle=mix(colour,f.k);ctx.stroke();
  }
  // Round eyes with pupils looking forward (+x; the caller mirrors for facing) and heavy angry brows.
  function face(ctx,S,f){
    for(const e of S.eyes){
      oval(ctx,e);ctx.fillStyle=mix(P.face.white,f.k);ctx.fill();
      ctx.strokeStyle=mix(P.face.ink,f.k);ctx.lineWidth=A.rimPx/f.r;ctx.stroke();
      flat(ctx,{x:e.x+S.look,y:e.y,r:S.pupil},P.face.ink,f);
    }
    for(const b of S.brows)line(ctx,b,S.browWidth,P.face.ink,f);
    flat(ctx,{x:S.mouth.x,y:S.mouth.y,rx:S.mouth.w*HALF,ry:S.mouth.h},P.face.ink,f);
  }

  // ---- The capling: a glossy spotted red dome over a stout tan stem, a mossy collar, a scowl with two small fangs.
  function capling(ctx,f){
    const S=A.capling,C=P.capling,stem=[C.stemLight,C.stem,C.stemDark],moss=[C.mossLight,C.moss,C.mossDark];
    for(const l of S.legs)shade(ctx,l,stem,f);
    shade(ctx,S.stem,stem,f);
    const c=S.collar;
    shade(ctx,c,moss,f);
    for(let i=0;i<c.lumps;i++){const a=i/(c.lumps-1)*Math.PI;shade(ctx,{x:c.x+Math.cos(a)*c.rx,y:c.y+Math.sin(a)*c.ry,r:c.lumpR},moss,f)}
    face(ctx,S,f);
    for(const g of S.fangs){
      ctx.beginPath();ctx.moveTo(g.x-S.fangW*HALF,g.y);ctx.lineTo(g.x+S.fangW*HALF,g.y);ctx.lineTo(g.x,g.y+S.fangH);ctx.closePath();
      ctx.fillStyle=mix(P.face.fang,f.k);ctx.fill();
    }
    const cap=S.cap;
    ctx.beginPath();ctx.ellipse(cap.x,cap.y,cap.rx,cap.ry,0,Math.PI,TURN);ctx.ellipse(cap.x,cap.y,cap.rx,cap.lip,0,0,Math.PI);ctx.closePath();
    shade(ctx,{x:cap.x,y:cap.y-cap.ry*HALF,rx:cap.rx,ry:cap.ry},[C.light,C.body,C.dark],f,false);
    for(const s of S.spots)flat(ctx,s,C.spot,f);
    shine(ctx,S.shine,f);
  }

  // ---- The mossback: a low wide bark-plated body under a thick moss mantle, forked branch antlers, glowing amber eyes.
  function mossback(ctx,f){
    const S=A.mossback,C=P.mossback,bark=[C.light,C.body,C.dark],moss=[C.mossLight,C.moss,C.mossDark];
    // Legs sit behind the body, so only the stubby feet show under its rim.
    for(const l of S.legs)shade(ctx,l,l.back?[C.body,C.dark,C.dark]:bark,f);
    shade(ctx,S.body,bark,f);
    for(const r of S.ridges){
      ctx.beginPath();ctx.ellipse(r.x,r.y,r.rx,r.ry,0,0,Math.PI);
      ctx.lineWidth=S.ridgeWidth;ctx.strokeStyle=mix(C.dark,f.k);ctx.stroke();
    }
    for(const m of S.mantle)shade(ctx,m,moss,f);
    for(const l of S.leaves)flat(ctx,{x:l.x,y:l.y,rx:S.leafL,ry:S.leafW,a:l.a},C.leaf,f);
    // Antlers: a dark casing stroked under the pale branch, so the fork reads against the moss and the sand alike.
    for(const [width,colour] of [[S.antlerWidth+S.antlerCase,C.antlerDark],[S.antlerWidth,C.antler]])for(const a of S.antlers){
      const mid={x:a.root.x+(a.tip.x-a.root.x)*S.forkAt,y:a.root.y+(a.tip.y-a.root.y)*S.forkAt};
      line(ctx,{x1:a.root.x,y1:a.root.y,x2:a.tip.x,y2:a.tip.y},width,colour,f);
      line(ctx,{x1:mid.x,y1:mid.y,x2:a.fork.x,y2:a.fork.y},width,colour,f);
    }
    shade(ctx,S.head,bark,f);
    for(const e of S.eyes){
      oval(ctx,e);ctx.fillStyle=gradient(ctx,e.x,e.y,e.r,e.r,[C.eyeCore,C.eye,C.eye],f.k);ctx.fill();
      ctx.strokeStyle=mix(P.face.ink,f.k);ctx.lineWidth=A.rimPx/f.r;ctx.stroke();
      flat(ctx,{x:e.x,y:e.y,r:S.eyeCore},C.eyeCore,f);
    }
    for(const b of S.brows)line(ctx,b,S.browWidth,P.face.ink,f);
    const m=S.mouth;
    ctx.beginPath();ctx.ellipse(m.x,m.y+m.h,m.w*HALF,m.h,0,Math.PI,TURN);
    ctx.lineWidth=S.browWidth*HALF;ctx.strokeStyle=mix(P.face.ink,f.k);ctx.stroke();
    shine(ctx,S.shine,f);
  }

  // ---- The sporemoth: a fuzzy lavender puff on two pairs of translucent leaf wings with a pale spiral vein.
  function wing(ctx,w,side,flap,f){
    const S=A.sporemoth,C=P.sporemoth;
    const dx=(w.tip.x-w.root.x)*side,dy=w.tip.y-w.root.y,len=Math.hypot(dx,dy),nx=-dy/len*w.width,ny=dx/len*w.width;
    ctx.save();ctx.translate(w.root.x*side,w.root.y);ctx.rotate(-side*flap);ctx.globalAlpha*=S.wingAlpha;
    ctx.beginPath();ctx.moveTo(0,0);
    ctx.quadraticCurveTo(dx*HALF+nx,dy*HALF+ny,dx,dy);ctx.quadraticCurveTo(dx*HALF-nx,dy*HALF-ny,0,0);
    shade(ctx,{x:dx*HALF,y:dy*HALF,rx:len*HALF,ry:len*HALF},[C.wingLight,C.wing,C.wingDark],f,false);
    ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(dx,dy);
    const cx=dx*S.veinAt,cy=dy*S.veinAt,r0=w.width*S.veinR;
    ctx.moveTo(cx+r0,cy);
    for(let i=1;i<=SPIRAL_STEPS;i++){const u=i/SPIRAL_STEPS,a=u*S.veinTurns*TURN,r=r0*(1-u);ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r)}
    ctx.lineCap='round';ctx.lineWidth=S.veinWidth;ctx.strokeStyle=mix(C.vein,f.k);ctx.stroke();
    ctx.restore();
  }
  function sporemoth(ctx,f){
    const S=A.sporemoth,C=P.sporemoth,fur=[C.light,C.body,C.dark];
    for(const w of [...S.wings].reverse())for(const side of SIDES)wing(ctx,w,side,f.pose.wing,f);
    // Fur: one rimmed backing disc for the outline, soft rimless lumps round its edge, then the soft body over their roots.
    const z=S.fuzz,soft=e=>{oval(ctx,e);ctx.fillStyle=gradient(ctx,e.x,e.y,e.r,e.r,fur,f.k);ctx.fill()};
    shade(ctx,{x:S.body.x,y:S.body.y,r:z.r+z.back},fur,f);
    for(let i=0;i<z.lumps;i++){const a=i/z.lumps*TURN;soft({x:Math.cos(a)*z.r,y:Math.sin(a)*z.r,r:z.lumpR})}
    soft(S.body);
    for(const a of S.antennae){
      ctx.beginPath();ctx.moveTo(a.root.x,a.root.y);ctx.quadraticCurveTo(a.bend.x,a.bend.y,a.tip.x,a.tip.y);
      ctx.lineCap='round';ctx.lineWidth=S.antennaWidth;ctx.strokeStyle=mix(C.antenna,f.k);ctx.stroke();
      shade(ctx,{x:a.tip.x,y:a.tip.y,r:S.bulb},[C.bulb,C.bulb,C.antenna],f);
    }
    face(ctx,S,f);
    shine(ctx,{x:-S.body.r*HALF,y:-S.body.r*HALF,rx:S.body.r*HALF*HALF*2,ry:S.body.r*HALF*HALF},f);
  }
  const PAINT=Object.freeze({capling,mossback,sporemoth});

  // The contact shadow: under the feet for walkers, on the ground below the flyer (it does not bob).
  function shadow(ctx,kind,alpha){
    const e=kind==='sporemoth'?{x:0,y:A.sporemoth.hover,...A.sporemoth.shadow}:A[kind].shadow;
    ctx.save();ctx.globalAlpha=alpha*A.shadowAlpha;oval(ctx,{...e,rx:e.rx*A.shadowGrow,ry:e.ry*A.shadowGrow});ctx.fillStyle=P.shadow;ctx.fill();ctx.restore();
  }

  // The body alone, painted about the origin at `size` canvas units per art unit: the pose's squash and (for the flyer) wing, the
  // hit flash `k` (a share toward white), mirrored for facing -1. The sprite cache (swarm-sprites.js) paints this to a canvas.
  // `r` is the size the rim width is measured against (canvas units per art unit on screen); a sprite painted at another scale
  // passes the on-screen size so its rim is the same number of screen pixels.
  function paint(ctx,kind,{size,pose:p,facing=1,k,r=size}){
    ctx.scale((facing<0?-1:1)*size*p.scaleX,size*p.scaleY);
    PAINT[kind](ctx,{k:k??Math.max(p.flash*A.flashMix,p.silhouette),r,pose:p});
  }
  // The contact shadow at `size`, drawn before the body (it does not bob, so the caller places it at the anchor).
  function groundShadow(ctx,kind,{size,alpha}){ctx.save();ctx.scale(size,size);shadow(ctx,kind,alpha);ctx.restore()}

  // One monster at (x, y), its anchor point (bounds().anchor), radius r in canvas units.
  function draw(ctx,{kind,x,y,r,facing=1,t=0,id=0,hitAge=Infinity,defeat=0,reduced=false}){
    const p=pose(kind,{t,id,hitAge,defeat,reduced}),base=drawRadius(kind,r),size=base*p.scale;
    ctx.save();ctx.translate(x,y);
    groundShadow(ctx,kind,{size,alpha:p.alpha});
    ctx.globalAlpha=p.alpha;
    if(p.bobY)ctx.translate(0,p.bobY*base);
    paint(ctx,kind,{size,pose:p,facing});
    ctx.restore();
    if(defeat>0)sparks(ctx,{kind,x,y,r,defeat,reduced});
  }

  // ---- The defeat burst: sparks thrown out of the pop. Pure geometry first, relative to the silhouette's centre.
  const easeOut=u=>1-(1-u)*(1-u);
  function burst(kind,r,frac,reduced=false){
    const B=A.burst,u=clamp01(frac),half=bounds(kind,r).w*HALF,reach=half*(reduced?B.hold:B.from+(B.to-B.from)*easeOut(u));
    const turn=reduced?0:B.spin*u,size=drawRadius(kind,r)*B.size*(1-u*HALF);
    return Array.from({length:B.sparks},(_,i)=>{const a=(i/B.sparks+turn)*TURN;return {x:Math.cos(a)*reach,y:Math.sin(a)*reach,size,alpha:1-u}});
  }
  function sparks(ctx,{kind,x,y,r,defeat,reduced}){
    const b=bounds(kind,r),cy=b.anchor==='feet'?y-b.h*HALF:y;
    ctx.save();ctx.translate(x,cy);
    for(const p of burst(kind,r,defeat,reduced)){
      ctx.globalAlpha=p.alpha;
      ctx.beginPath();ctx.moveTo(p.x,p.y-p.size);ctx.lineTo(p.x+p.size*HALF,p.y);ctx.lineTo(p.x,p.y+p.size);ctx.lineTo(p.x-p.size*HALF,p.y);ctx.closePath();
      ctx.fillStyle=A.burst.colour;ctx.fill();
      oval(ctx,{x:p.x,y:p.y,r:p.size*HALF*HALF});ctx.fillStyle=A.burst.core;ctx.fill();
    }
    ctx.restore();
  }

  // ---- The enemy bar: origin at its bottom centre. Pure geometry first, so the fill share is testable.
  function barGeometry(share){
    const B=A.bar,s=clamp01(share);
    return {frame:{x:-B.w*HALF,y:-B.h,w:B.w,h:B.h},fill:{x:-B.w*HALF+B.rim,y:-B.h+B.rim,w:(B.w-2*B.rim)*s,h:B.h-2*B.rim}};
  }
  function bar(ctx,{x,y,share}){
    const B=A.bar,C=P.bar,{frame:o,fill}=barGeometry(share),ch={x:fill.x,y:fill.y,w:B.w-2*B.rim,h:fill.h};
    ctx.save();ctx.translate(x,y);
    ctx.beginPath();ctx.roundRect(o.x,o.y,o.w,o.h,o.h*HALF);ctx.fillStyle=C.rim;ctx.fill();
    ctx.beginPath();ctx.moveTo(o.x+o.h*HALF,o.y+B.litWidth);ctx.lineTo(o.x+o.w*HALF,o.y+B.litWidth);
    ctx.lineCap='round';ctx.lineWidth=B.litWidth;ctx.strokeStyle=C.lit;ctx.stroke();
    ctx.beginPath();ctx.roundRect(ch.x,ch.y,ch.w,ch.h,ch.h*HALF);ctx.fillStyle=C.channel;ctx.fill();
    if(fill.w>0){
      ctx.clip();
      const g=ctx.createLinearGradient(0,ch.y,0,ch.y+ch.h);
      g.addColorStop(0,C.roseDeep);g.addColorStop(HALF,C.rose);g.addColorStop(1,C.roseDeep);
      ctx.fillStyle=g;ctx.fillRect(fill.x,fill.y,fill.w,fill.h);
      ctx.fillStyle=C.core;ctx.fillRect(fill.x,ch.y+(ch.h-B.coreWidth)*HALF,fill.w,B.coreWidth);
    }
    ctx.restore();
  }

  const api=Object.freeze({kinds,bounds,top,pose,draw,burst,barGeometry,bar,paint,groundShadow,drawRadius});
  root.LoftRumbleSwarmMonsterArt=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
