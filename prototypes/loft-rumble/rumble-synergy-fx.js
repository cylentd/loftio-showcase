(function(root){
  'use strict';
  // Code-drawn arcs for the projectile synergies (ledger #462, A2), in the living-magic look (docs/design/LOFT-RUMBLE-LIVING-MAGIC.md):
  // a warm glow under a bright core, the newest brightest, fading with age. No text. A bolt is a jagged line between two points;
  // a ricochet arc bends through its bounce point. Pure drawing: it reads arcs and never touches fight state.
  const LIFE=.35;        // seconds an arc stays on screen
  const GLOW_WIDTH=9;    // px, the soft outer stroke
  const CORE_WIDTH=3;    // px, the bright inner stroke
  const JAG_COUNT=5;     // segments per jagged bolt
  const JAG_SIZE=7;      // px, sideways wobble per segment
  const GLOW_ALPHA=.45;  // outer stroke opacity at birth

  const HASH_SEED=12.9898, HASH_STEP=78.233; // the classic sin-hash pair: any two unrelated large numbers give an unrelated wobble per bolt
  // Deterministic wobble, so a frame redraws the same bolt (no flicker, no random in the render).
  const wobble=(seed,i)=>Math.sin(seed*HASH_SEED+i*HASH_STEP)*JAG_SIZE;
  function points(arc){
    const path=arc.via?[arc.from,arc.via,arc.to]:[arc.from,arc.to],out=[];
    for(let p=1;p<path.length;p++){
      const a=path[p-1],b=path[p],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
      for(let i=p===1?0:1;i<=JAG_COUNT;i++){
        const t=i/JAG_COUNT,w=i===0||i===JAG_COUNT?0:wobble(arc.seed,i+p*JAG_COUNT);
        out.push({x:a.x+dx*t+nx*w,y:a.y+dy*t+ny*w});
      }
    }
    return out;
  }
  function stroke(ctx,pts,width,colour,alpha){
    ctx.globalAlpha=alpha;ctx.strokeStyle=colour;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';
    ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
  }
  // arcs: [{from,via?,to,seed,life}] with life counting down from LIFE. colours: {glow,core}.
  function draw(ctx,{arcs,colours}){
    if(!ctx||!Array.isArray(arcs))return;
    ctx.save();
    for(const arc of arcs){
      const fade=Math.max(0,Math.min(1,arc.life/LIFE)),pts=points(arc);
      stroke(ctx,pts,GLOW_WIDTH*fade+CORE_WIDTH,colours.glow,GLOW_ALPHA*fade);
      stroke(ctx,pts,CORE_WIDTH,colours.core,fade);
    }
    ctx.restore();
  }
  // Field cues (A3): a ring for a Power field, a soft cloud for a Poison cloud. Colours come from the caller; no text, no images.
  const CLOUD_RADIUS=70;   // px, the cloud over the boss
  const RING_WIDTH=4;      // px
  const RING_ALPHA=.7;     // ring opacity at birth
  const CLOUD_ALPHA=.28;   // cloud fill opacity at birth
  const BREATH=.06;        // share of the radius the cue swells and shrinks
  const BREATH_RATE=3;     // radians a second
  // fields: [{id,x,y,radius?,life,max}]. still is the page's reduced-motion flag: it freezes the breathing. time: seconds.
  function drawFields(ctx,{fields,colours,still,time}){
    if(!ctx||!Array.isArray(fields))return;
    ctx.save();
    for(const f of fields){
      const fade=Math.max(0,Math.min(1,f.life/f.max)),swell=still?0:Math.sin((time||0)*BREATH_RATE)*BREATH,power=f.id==='power-field';
      const radius=(power?f.radius:CLOUD_RADIUS)*(1+swell);
      ctx.beginPath();ctx.arc(f.x,f.y,radius,0,Math.PI*2);
      if(power){ctx.globalAlpha=RING_ALPHA*fade;ctx.strokeStyle=colours.core;ctx.lineWidth=RING_WIDTH;ctx.stroke()}
      else{ctx.globalAlpha=CLOUD_ALPHA*fade;ctx.fillStyle=colours.glow;ctx.fill()}
    }
    ctx.restore();
  }
  // Support cues (A4): a ring around a hero holding a bubble, and a short expanding ring for a Mend heal or a popped bubble.
  const RING_LIFE=.5;        // seconds a heal or pop ring stays on screen
  const BUBBLE_RADIUS=34;    // px, a bit more than a resident's body
  const BUBBLE_ALPHA=.8;     // bubble ring opacity
  const BUBBLE_FILL_ALPHA=.12; // soft fill inside the bubble
  const PULSE_GROWTH=1.6;    // a ring grows from 1x to this many times its start radius over its life
  // bubbles: [{x,y}] heroes holding one. rings: [{x,y,life}] counting down from RING_LIFE. still freezes the bubble's breathing.
  function drawSupport(ctx,{bubbles,rings,colours,still,time}){
    if(!ctx)return;
    ctx.save();
    for(const b of Array.isArray(bubbles)?bubbles:[]){
      const swell=still?0:Math.sin((time||0)*BREATH_RATE)*BREATH;
      ctx.beginPath();ctx.arc(b.x,b.y,BUBBLE_RADIUS*(1+swell),0,Math.PI*2);
      ctx.globalAlpha=BUBBLE_FILL_ALPHA;ctx.fillStyle=colours.glow;ctx.fill();
      ctx.globalAlpha=BUBBLE_ALPHA;ctx.strokeStyle=colours.core;ctx.lineWidth=RING_WIDTH/2;ctx.stroke();
    }
    for(const r of Array.isArray(rings)?rings:[]){
      const fade=Math.max(0,Math.min(1,r.life/RING_LIFE)),grow=still?1:1+(PULSE_GROWTH-1)*(1-fade);
      ctx.beginPath();ctx.arc(r.x,r.y,BUBBLE_RADIUS*grow,0,Math.PI*2);
      ctx.globalAlpha=RING_ALPHA*fade;ctx.strokeStyle=colours.core;ctx.lineWidth=RING_WIDTH;ctx.stroke();
    }
    ctx.restore();
  }
  const api=Object.freeze({life:LIFE,ringLife:RING_LIFE,points,draw,drawFields,drawSupport});
  root.LoftRumbleSynergyFx=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
