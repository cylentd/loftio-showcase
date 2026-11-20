// Living-magic HUD (LM6b): draws the owner's ui-v1 boss header, team bar and combo count on the fight canvas.
// Layout: rumble-hud-model.js; numbers: rumble-hud-data.js; colours: the --hud-* tokens in rumble-hud.css.
// All text is live canvas text, never baked into art. Each frame draw returns false while its art is missing, so the page
// keeps its old bar. It only reads health, pending damage and hit counts; `shown` records what was last drawn, for tests.
(function(root){
  'use strict';
  const D=root.LoftRumbleHudData,M=root.LoftRumbleHudModel;
  if(!D||!M)return;
  const HALF=.5;
  const {sheen:SHEEN,sheenAlpha:SHEEN_ALPHA,strandBand:STRAND_BAND}=D.fill;
  const shown={boss:null,shield:null,counter:null,team:null,combo:null};
  let palette=null;
  const tinted=new Map();
  const screenScale=()=>typeof document==='undefined'?1:parseFloat(document.getElementById?.('arena')?.style.getPropertyValue('--k'))||1;
  const typeSize=(size,floor=D.type.helper)=>M.textSize(size,screenScale(),floor);

  function colours(){
    if(palette)return palette;
    const style=getComputedStyle(document.documentElement);
    palette=Object.fromEntries(Object.entries(D.tokens).map(([key,name])=>[key,style.getPropertyValue(name).trim()]));
    return palette;
  }

  // The neutral fill strand recoloured once per tint: hue from the tint, light from the strand, alpha from the strand.
  function strand(image,tint){
    const key=tint+'|'+image.src;
    if(tinted.has(key))return tinted.get(key);
    const canvas=document.createElement('canvas');
    canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
    const c=canvas.getContext('2d');
    c.drawImage(image,0,0);
    c.globalCompositeOperation='color';c.fillStyle=tint;c.fillRect(0,0,canvas.width,canvas.height);
    c.globalCompositeOperation='destination-in';c.drawImage(image,0,0);
    tinted.set(key,canvas);
    return canvas;
  }

  function label(ctx,text,x,y,size,font,align,fill){
    const P=colours();
    ctx.font=D.type.weight+' '+typeSize(size)+'px '+font;ctx.textAlign=align;ctx.textBaseline='alphabetic';ctx.lineJoin='round';
    ctx.lineWidth=D.textStroke;ctx.strokeStyle=P.ink;ctx.strokeText(text,x,y);
    ctx.fillStyle=fill??P.cream;ctx.fillText(text,x,y);
  }

  // Tapered, curved filaments advect through the painted sap. The offscreen wrap never resets visible pixels.
  function energyStrands(ctx,rect,filled,tint){
    const E=D.energy,{x,y,w,h}=rect,time=(root.performance?.now()??0)/E.period;
    const P=colours(),lightTint=tint===P.boss?P.bossEnergy:P.teamEnergy;
    const length=w*E.length,route=w+length*2;
    ctx.save();ctx.beginPath();ctx.rect(x,y,filled,h);ctx.clip();
    ctx.globalCompositeOperation='screen';ctx.lineCap='round';ctx.lineJoin='round';
    for(let index=0;index<E.count;index++){
      const phase=(time+E.phase+index/E.count)%1,start=x+phase*route-length*2;
      const light=ctx.createLinearGradient(start,y,start+length,y);
      light.addColorStop(0,'transparent');light.addColorStop(E.feather,lightTint);
      light.addColorStop(1-E.feather,lightTint);light.addColorStop(1,'transparent');
      ctx.beginPath();
      for(let step=0;step<=E.segments;step++){
        const u=step/E.segments,angle=u*Math.PI*2*E.waves+index*E.phaseGap;
        const py=y+h*(HALF+E.amplitude*Math.sin(angle+time*E.drift)
          +E.ripple*Math.sin(angle*2-time*E.drift));
        if(step===0)ctx.moveTo(start+u*length,py);else ctx.lineTo(start+u*length,py);
      }
      ctx.strokeStyle=light;ctx.lineWidth=h*E.haloWidth;ctx.globalAlpha=E.haloAlpha;ctx.stroke();
      ctx.lineWidth=h*E.coreWidth;ctx.globalAlpha=E.coreAlpha;ctx.stroke();
    }
    ctx.restore();
  }

  // The channel: pending damage in pale cream, then the tinted body cropped to the health share with the luminous strand
  // over it, then any hit or low-health wash. Everything stays clipped inside the rounded channel.
  function channel(ctx,rect,bar,tint,fillImage){
    const P=colours(),{x,y,w,h}=rect,r=h*HALF;
    ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.clip();
    ctx.fillStyle=P.pending;ctx.fillRect(x,y,M.fillWidth(bar.chip,bar.max,w),h);
    const filled=M.fillWidth(bar.value,bar.max,w);
    if(filled>0){
      ctx.save();ctx.beginPath();ctx.rect(x,y,filled,h);ctx.clip();
      ctx.fillStyle=tint;ctx.fillRect(x,y,filled,h);
      ctx.globalAlpha=SHEEN_ALPHA;ctx.fillStyle=P.flash;ctx.fillRect(x,y,filled,h*SHEEN);ctx.globalAlpha=1;
      if(fillImage){const band=h/STRAND_BAND;ctx.globalAlpha=D.fill.strandAlpha;ctx.globalCompositeOperation='lighter';ctx.drawImage(strand(fillImage,tint),x,y+h*HALF-band*HALF,w,band)}
      ctx.restore();
    }
    if(bar.flash>0){ctx.globalAlpha=Math.min(D.fill.flashMax,bar.flash);ctx.fillStyle=bar.wash;ctx.fillRect(x,y,w,h)}
    if(filled>0&&!root.matchMedia?.('(prefers-reduced-motion: reduce)').matches){
      energyStrands(ctx,rect,filled,tint);
    }
    ctx.restore();
    return filled;
  }

  // A soft shade at the top of the arena so the cream name reads over bright wall art; it fades out by the strip's bottom.
  function scrim(ctx,width,top){
    const P=colours(),shade=ctx.createLinearGradient(0,0,0,top);
    shade.addColorStop(0,P.scrim);shade.addColorStop(1,'transparent');
    ctx.save();ctx.globalAlpha=D.scrimAlpha;ctx.fillStyle=shade;ctx.fillRect(0,0,width,top);ctx.restore();
  }

  // Shield health under the boss bar (owner 2026-11-18, round 5): ink outline, dark track, amber fill to `fill` (0..1),
  // and the live "Shield" word left of it. An empty track while the shield is broken; it refills with the regrow.
  function shieldBar(ctx,L,shield,font){
    const P=colours(),S=M.shieldLayout(L,D),{x,y,w,h}=S.bar,e=D.shield.edge,share=Math.max(0,Math.min(1,shield.fill));
    ctx.save();
    ctx.fillStyle=P.ink;ctx.beginPath();ctx.roundRect(x-e,y-e,w+2*e,h+2*e,(h+2*e)*HALF);ctx.fill();
    ctx.fillStyle=P.shieldTrack;ctx.beginPath();ctx.roundRect(x,y,w,h,h*HALF);ctx.fill();
    ctx.beginPath();ctx.roundRect(x,y,w,h,h*HALF);ctx.clip();
    ctx.fillStyle=P.shield;ctx.fillRect(x,y,w*share,h);
    ctx.restore();
    ctx.textBaseline='middle';
    label(ctx,shield.label,S.label.x,S.label.y,typeSize(D.shield.labelFont),font,'right');
    ctx.textBaseline='alphabetic';
    return share;
  }

  // bar: {value, chip, max, flash, wash}; shield: {fill, label} or null; image(name) returns a loaded texture or null.
  function boss(ctx,{width,top,name,bar,font,image,shield=null}){
    const frame=image(D.art.bossFrame);
    if(!frame)return false;
    const L=M.bossLayout(width,D,screenScale(),top);
    if(!L.channel.w)return false; // initial layout has not yet reserved a readable strip
    scrim(ctx,width,top);
    ctx.drawImage(frame,L.frame.x,L.frame.y,L.frame.w,L.frame.h);
    const filled=channel(ctx,L.channel,bar,colours().boss,image(D.art.fill));
    label(ctx,name,L.name.x,L.name.y,typeSize(D.boss.nameFont,D.type.body),font,'center');
    if(screenScale()>=D.compactScale)label(ctx,String(bar.value),L.hp.x,L.hp.y,typeSize(D.boss.hpFont),font,'right');
    shown.boss={value:bar.value,max:bar.max,share:filled/L.channel.w,text:String(bar.value)};
    shown.shield=shield?{share:shieldBar(ctx,L,shield,font)}:null;
    return true;
  }

  // Swarm counter (ledger #487 U3): Hunt reads kills/goal, Hold reads the time left as m:ss, rounded up so it shows 0:00
  // only at the win. progress: swarm-model.js progress(state) {mode, kills, goal, remaining, frac}.
  function counterText(progress){
    if(progress.mode==='hunt')return Math.min(progress.kills,progress.goal)+'/'+progress.goal;
    const left=Math.max(0,Math.ceil(progress.remaining)),perMinute=D.swarm.secondsPerMinute;
    return Math.floor(left/perMinute)+':'+String(left%perMinute).padStart(2,'0');
  }

  // The counter takes the boss plate's place in a swarm fight: the same frame, the channel filled to frac in the team's
  // colour, and the counter text where the boss name sits. No words.
  function counter(ctx,{width,top,progress,font,image}){
    const frame=image(D.art.bossFrame);
    if(!frame)return false;
    const L=M.bossLayout(width,D,screenScale(),top);
    if(!L.channel.w)return false;
    const share=Math.max(0,Math.min(1,progress.frac)),max=D.swarm.counterMax,value=share*max;
    scrim(ctx,width,top);
    ctx.drawImage(frame,L.frame.x,L.frame.y,L.frame.w,L.frame.h);
    const filled=channel(ctx,L.channel,{value,chip:value,max,flash:0},colours().team,image(D.art.fill));
    const text=counterText(progress);
    label(ctx,text,L.name.x,L.name.y,typeSize(D.boss.nameFont,D.type.body),font,'center');
    shown.counter={text,share:filled/L.channel.w};
    return true;
  }

  function team(ctx,{width,height,strip,bar,shake=0,font,image}){
    const frame=image(D.art.teamFrame);
    if(!frame)return false;
    const L=M.teamLayout(width,height,strip,readoutWidth(ctx,bar.max,font),D);
    if(!L.channel.w)return false;
    ctx.save();ctx.translate(shake,0);
    ctx.drawImage(frame,L.frame.x,L.frame.y,L.frame.w,L.frame.h);
    const filled=channel(ctx,L.channel,bar,colours().team,image(D.art.fill));
    const seed=image(D.art.seed);
    if(seed)ctx.drawImage(seed,L.seed.x,L.seed.y,L.seed.w,L.seed.h);
    const text=bar.value+'/'+bar.max;
    ctx.textBaseline='middle';
    label(ctx,text,L.number.x,L.number.y,typeSize(D.team.numberFont),font,'right');
    ctx.textBaseline='alphabetic';
    ctx.restore();
    shown.team={value:bar.value,max:bar.max,share:filled/L.channel.w,text};
    return true;
  }

  function readoutWidth(ctx,max,font){
    ctx.save();ctx.font=D.type.weight+' '+typeSize(D.team.numberFont)+'px '+font;const w=ctx.measureText(max+'/'+max).width;ctx.restore();return w;
  }

  // The two health channels, for damage and heal words that fly into a bar. Null while the frame art is missing.
  function channels(ctx,{width,height,strip,teamMax,font,image}){
    if(!image(D.art.bossFrame)||!image(D.art.teamFrame))return null;
    return {boss:M.bossLayout(width,D,screenScale()).channel,team:M.teamLayout(width,height,strip,readoutWidth(ctx,teamMax,font),D).channel};
  }

  // Where milestone words and "Combo saved!" pin: under the count, starting at the ornament's left edge.
  function comboAnchor(){const L=M.comboLayout(D);return {x:L.ornament.x,y:L.label.y,align:'left'}}

  // combo: {hits, word, scale, lost:{n, age, shatter, word}|null, reduced}. The count sits in the open spiral; a lost combo
  // fades, its digits scatter after an attack (a plain fade under reduced motion) with the "Combo lost" word under it.
  function combo(ctx,{hits,word,scale,lost,reduced,font,image}){
    const L=M.comboLayout(D),P=colours();
    ctx.save();
    if(hits>0){
      const ornament=image(D.art.combo);
      ctx.translate(L.count.x,L.count.y);ctx.scale(scale,scale);ctx.translate(-L.count.x,-L.count.y);
      if(ornament)ctx.drawImage(ornament,L.ornament.x,L.ornament.y,L.ornament.w,L.ornament.h);
      ctx.textBaseline='middle';
      label(ctx,String(hits),L.count.x,L.count.y,typeSize(D.combo.countFont),font,'center');
      label(ctx,word,L.label.x,L.count.y+typeSize(D.combo.labelGap),typeSize(D.combo.labelFont),font,'center');
      shown.combo={hits,word};
    }else if(lost){
      const n=String(lost.n);ctx.globalAlpha=Math.max(0,1-lost.age);ctx.textBaseline='middle';
      if(lost.shatter&&!reduced){
        ctx.font=D.type.weight+' '+typeSize(D.combo.countFont)+'px '+font;
        const chars=[...n],total=ctx.measureText(n).width;let cx=L.count.x-total*HALF;
        chars.forEach((c,i)=>{const w=ctx.measureText(c).width,dir=i-(chars.length-1)*HALF||HALF;ctx.save();
          ctx.translate(cx+w*HALF+dir*lost.spread*lost.age,L.count.y+lost.spread*lost.age*lost.age);ctx.rotate(dir*lost.age);
          label(ctx,c,0,0,D.combo.countFont,font,'center',P.low);ctx.restore();cx+=w});
      }else label(ctx,n,L.count.x,L.count.y,D.combo.countFont,font,'center');
      if(lost.shatter)label(ctx,lost.word,L.ornament.x,L.label.y,D.combo.labelFont,font,'left',P.low);
      shown.combo=null;
    }else shown.combo=null;
    ctx.restore();
    return true;
  }

  // ---- Dock cards (DOM). The frames and the pause stone are CSS (rumble-hud.css); this swaps in the canonical portraits
  // once the art has loaded and shrinks a long name to fit its frame before the CSS ellipsis takes over.
  const fitted=new WeakMap();
  const cropped=new WeakMap();
  // Custom images can have very wide/tall transparent canvases. Remove only outer
  // transparent pixels; never stretch or redraw the owner's character.
  function fitCustom(img){
    if(!img?.matches?.('.portrait img')||!img.closest('[data-own-art]')||!img.complete||!img.naturalWidth||cropped.get(img)===img.src)return;
    cropped.set(img,img.src);
    try{
      const canvas=document.createElement('canvas'),w=img.naturalWidth,h=img.naturalHeight;
      canvas.width=w;canvas.height=h;
      const c=canvas.getContext('2d');c.drawImage(img,0,0);
      const pixels=c.getImageData(0,0,w,h).data;
      let left=w,top=h,right=-1,bottom=-1;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(pixels[(y*w+x)*D.pixels.channels+D.pixels.alpha]){
        left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
      }
      if(right<left||(left===0&&top===0&&right===w-1&&bottom===h-1))return;
      const output=document.createElement('canvas');output.width=right-left+1;output.height=bottom-top+1;
      output.getContext('2d').drawImage(canvas,left,top,output.width,output.height,0,0,output.width,output.height);
      const source=output.toDataURL('image/png');cropped.set(img,source);img.src=source;
    }catch{ /* A cross-origin image without pixel access still uses object-fit: contain. */ }
  }
  function fitName(el){
    const key=el.textContent+'|'+el.clientWidth;
    if(fitted.get(el)===key)return;
    el.style.fontSize='';
    let size=parseFloat(getComputedStyle(el).fontSize);
    while(el.scrollWidth>el.clientWidth&&size>D.nameFit.min){size=Math.max(D.nameFit.min,size-D.nameFit.step);el.style.fontSize=size+'px'}
    fitted.set(el,el.textContent+'|'+el.clientWidth);
  }
  const energyPaints=new WeakMap();
  // Rasterise the same nine-slice once per size, so light changes RGB beneath one fixed alpha mask.
  // Compositing a second painted border would brighten translucent edge pixels and move its apparent frontier.
  function energyPaint(card){
    const image=root.LoftRumbleArt?.available('lm-hero-frame-ready-v2'),meter=card.querySelector('.dock-meter');
    if(!image||!meter)return;
    const rect=meter.getBoundingClientRect(),style=getComputedStyle(meter),ratio=root.devicePixelRatio||1;
    if(!rect.width||!rect.height)return;
    const key=[rect.width,rect.height,ratio].join('|');
    if(energyPaints.get(meter)===key)return;
    const canvas=document.createElement('canvas');canvas.width=Math.round(rect.width*ratio);canvas.height=Math.round(rect.height*ratio);
    const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);
    const x=[0,parseFloat(style.borderLeftWidth),rect.width-parseFloat(style.borderRightWidth),rect.width];
    const y=[0,parseFloat(style.borderTopWidth),rect.height-parseFloat(style.borderBottomWidth),rect.height];
    const source=D.energySlices;
    for(let row=0;row<y.length-1;row++)for(let col=0;col<x.length-1;col++){
      ctx.drawImage(image,source.x[col],source.y[row],source.x[col+1]-source.x[col],source.y[row+1]-source.y[row],
        x[col],y[row],x[col+1]-x[col],y[row+1]-y[row]);
    }
    meter.style.setProperty('--hud-energy-paint','url("'+canvas.toDataURL('image/png')+'")');
    meter.dataset.energyPaint='';energyPaints.set(meter,key);
  }
  function fitNames(){
    for(const el of document.querySelectorAll('.roster .card b'))fitName(el);
    for(const card of document.querySelectorAll('.roster .card'))energyPaint(card);
  }
  function portraits(art){
    for(const [id,name] of Object.entries(D.portraits)){
      const card=document.querySelector('.roster [data-resident="'+id+'"]'),image=art.available(name);
      if(!card||card.hasAttribute('data-own-art')||!image)continue;
      const img=card.querySelector('.portrait img');
      if(img){img.src=image.src;img.dataset.hudPortraitSource=img.src;}
    }
  }
  function dock(){
    const roster=document.querySelector('.roster');
    if(!roster)return;
    fitNames();
    roster.addEventListener('load',event=>fitCustom(event.target),true);
    for(const img of roster.querySelectorAll('[data-own-art] img'))fitCustom(img);
    new MutationObserver(fitNames).observe(roster,{subtree:true,childList:true,characterData:true});
    if(root.ResizeObserver)new ResizeObserver(fitNames).observe(roster);
    const art=root.LoftRumbleArt;
    art?.ready?.then(()=>{
      if(!art.available(D.art.bossFrame))return;
      portraits(art);
      document.documentElement.classList.add('lm-hud-art');
      fitNames();
    });
  }
  if(typeof document!=='undefined'){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',dock,{once:true});else dock();
  }

  root.LoftRumbleHud=Object.freeze({boss,counter,counterText,team,combo,comboAnchor,channels,fitNames,shown});
})(globalThis);
