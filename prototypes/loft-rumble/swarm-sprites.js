// Swarm sprites: the browser half of the sprite cache. A monster kind in one pose, and a health bar at one fill, is painted once to
// an offscreen canvas at the screen's pixel density (swarm-monster-art.js does the painting) and from then on drawn with a single
// drawImage: no gradient, shadow blur or path is built per frame. Which sprite, and which one leaves when the cache is full, is
// pure and tested (swarm-sprite-cache.js); this file only makes canvases, so it has no unit test. The look is checked by the pixel
// diff in studies/swarm-sprite-diff.py. A monster that is dying is not cached (its pop and sparks are one-off) and is drawn live.
(function(root){
  'use strict';
  const D=root.LoftRumbleSwarmData,Cache=root.LoftRumbleSwarmSpriteCache,Art=root.LoftRumbleSwarmMonsterArt;
  if(!D||!Cache||!Art)return;
  const store=Cache.lru(D.SPRITE.CAP);
  const counts={hits:0,misses:0};
  const BAR_PAD=1; // canvas units round the bar's frame, for its rounded ends
  let enabled=true;

  // Device pixels per canvas unit under the context's transform (the page's pixel ratio times any camera zoom).
  const density=ctx=>{const m=ctx.getTransform();return Math.hypot(m.a,m.b)};
  function canvas(w,h){const c=document.createElement('canvas');c.width=Math.ceil(w);c.height=Math.ceil(h);return c}
  function remember(k,make){
    let sprite=store.get(k);
    if(sprite){counts.hits++;return sprite}
    counts.misses++;sprite=make();
    if(sprite)store.set(k,sprite);
    else enabled=false; // no 2d context (Safari out of canvas memory): draw live from now on
    return sprite;
  }

  // The sprite for a variant painted a quarter-pixel phase (qx, qy) in, so that blitting it on a whole device pixel reproduces the
  // live drawing at that sub-pixel position: a plain copy with no blur at the edges.
  function monsterSprite(v,ext,size,qx,qy){
    const L=Cache.levels(v),P=D.SPRITE.PHASES;
    const ox=Math.ceil(-ext.x0*L.px),oy=Math.ceil(-ext.y0*L.px); // the art's origin sits on a whole sprite pixel
    const c=canvas(ox+(ext.x0+ext.w)*L.px+1,oy+(ext.y0+ext.h)*L.px+1),g=c.getContext('2d'); // +1: room for the phase shift
    if(!g)return null;
    g.translate(ox+qx/P,oy+qy/P);
    Art.paint(g,v.kind,{size:L.px,r:size,k:L.flash*D.ART.flashMix,pose:{scaleX:L.sx,scaleY:L.sy,wing:L.wing,flash:L.flash,silhouette:0}});
    return {c,px:L.px,ox,oy};
  }

  // One live monster at its anchor (x, y) with its pose (Art.pose) and facing, drawn from the cache. Returns false, drawing
  // nothing, when it must be drawn live instead (the cache is off, or the monster is dying).
  function drawMonster(ctx,{kind,x,y,r,facing=1,pose}){
    if(!enabled||pose.silhouette||pose.alpha<1)return false;
    const base=Art.drawRadius(kind,r),size=base*pose.scale;
    if(!(size>0)||!Number.isFinite(size))return false;
    const dpx=size*density(ctx),v=Cache.variant(kind,pose,dpx),ext=Cache.extent(kind);
    queueBars(density(ctx));   // a monster is drawn before its first hit, so its bar fills are painted before that hit
    queueWarm(kind,dpx,size,v.size);
    ctx.save();ctx.translate(x,y);
    Art.groundShadow(ctx,kind,{size,alpha:pose.alpha});
    ctx.translate(0,pose.bobY*base);
    if(v.flash)return drawHit(ctx,Cache.hitVariant(kind,pose,dpx),ext,size,pose,facing);
    const o=ctx.getTransform(),P=D.SPRITE.PHASES,px=Cache.phase(o.e),py=Cache.phase(o.f),flip=facing<0;
    // A mirrored sprite shifts the other way: it is painted at the complementary phase and lands one pixel further on.
    const qx=flip?(P-px.q)%P:px.q,wholeX=flip&&px.q>0?px.whole+1:px.whole;
    const sprite=remember(Cache.key(v,{x:qx,y:py.q}),()=>monsterSprite(v,ext,size,qx,py.q));
    if(!sprite){ctx.restore();return false}
    ctx.translate((wholeX-o.e)/o.a,(py.whole-o.f)/o.d); // the origin on a whole device pixel
    if(flip)ctx.scale(-1,1);
    ctx.drawImage(sprite.c,-sprite.ox/sprite.px*size,-sprite.oy/sprite.px*size,sprite.c.width/sprite.px*size,sprite.c.height/sprite.px*size);
    ctx.restore();
    return true;
  }

  // A flashed monster (lag fix 2026-11-20): the hit sprite, painted at rest scale and no phase, scaled by the pose's squash at
  // blit time. The squash is a scale about the anchor in the live drawing too, so only the resampling differs, for HIT_FLASH_S.
  // The context is already at the anchor (bob applied); this restores it.
  function drawHit(ctx,v,ext,size,pose,facing){
    const sprite=remember(Cache.hitKey(v),()=>monsterSprite(v,ext,size,0,0));
    if(!sprite){ctx.restore();return false}
    ctx.scale((facing<0?-1:1)*pose.scaleX,pose.scaleY);
    ctx.drawImage(sprite.c,-sprite.ox/sprite.px*size,-sprite.oy/sprite.px*size,sprite.c.width/sprite.px*size,sprite.c.height/sprite.px*size);
    ctx.restore();
    return true;
  }

  // Warm-up: when a kind is first drawn at a size, every sprite it can need there is queued, the hit sprites (Cache.warmList)
  // first, then each resting pose in each quarter phase (Cache.restList), and warmStep paints SPRITE.WARM_PER_FRAME of them per
  // frame. A fling mid-fight then finds its sprites painted instead of painting them in the frame it hits. A kind drawn at a new
  // size drops its queue for the old one, so a zoom never piles up work.
  const warmedAt=new Map();let warmQueue=[];
  function queueWarm(kind,px,size,bucket){
    if(warmedAt.get(kind)===bucket)return;
    warmedAt.set(kind,bucket);
    warmQueue=warmQueue.filter(w=>w.kind!==kind);
    const ext=Cache.extent(kind);
    for(const v of Cache.warmList(kind,px))warmQueue.push({kind,k:Cache.hitKey(v),make:()=>monsterSprite(v,ext,size,0,0)});
    for(const [v,ph] of Cache.restList(kind,px,t=>Art.pose(kind,{t})))warmQueue.push({kind,k:Cache.key(v,ph),make:()=>monsterSprite(v,ext,size,ph.x,ph.y)});
  }
  // A hit moves a bar to a new fill, so every fill at the bar's size is queued the first time a bar is drawn there.
  function queueBars(density){
    const bucket=Cache.barVariant(1,density).size;
    if(warmedAt.get('bar')===bucket)return;
    warmedAt.set('bar',bucket);
    warmQueue=warmQueue.filter(w=>w.kind!=='bar');
    for(let fill=0;fill<=D.SPRITE.BAR_STEPS;fill++){const v={fill,size:bucket};warmQueue.unshift({kind:'bar',k:Cache.barKey(v),make:()=>barSprite(v)})}
  }
  function warmStep(){
    let painted=0;
    while(painted<D.SPRITE.WARM_PER_FRAME&&warmQueue.length&&enabled){
      const {k,make}=warmQueue.shift();
      if(store.get(k))continue;
      const sprite=make();
      if(sprite)store.set(k,sprite);else enabled=false;
      painted++;
    }
  }

  function barSprite(v){
    const B=D.ART.bar,px=Cache.sizeOf(v.size),w=B.w+2*BAR_PAD,h=B.h+2*BAR_PAD;
    const c=canvas(w*px,h*px),g=c.getContext('2d');
    if(!g)return null;
    g.scale(px,px);
    Art.bar(g,{x:w/2,y:h-BAR_PAD,share:v.fill/D.SPRITE.BAR_STEPS});
    return {c,px};
  }

  // A health bar standing on (x, y) at its bottom centre, as Art.bar draws it, from the cache. False when the cache is off.
  function drawBar(ctx,{x,y,share}){
    if(!enabled)return false;
    const B=D.ART.bar,v=Cache.barVariant(share,density(ctx));
    queueBars(density(ctx));
    const sprite=remember(Cache.barKey(v),()=>barSprite(v));
    if(!sprite)return false;
    ctx.drawImage(sprite.c,x-(B.w/2+BAR_PAD),y-B.h-BAR_PAD,sprite.c.width/sprite.px,sprite.c.height/sprite.px);
    return true;
  }

  const stats=()=>({...counts,size:store.size(),warming:warmQueue.length});
  const enable=on=>{enabled=!!on};
  root.LoftRumbleSwarmSprites=Object.freeze({drawMonster,drawBar,warmStep,stats,enable});
})(typeof globalThis!=='undefined'?globalThis:this);
