(function(root){
  'use strict';
  // Hero ability effects (LM2): seed volley, white Shockwave crescents, blue beam, ally-contact tick.
  // Pure look: it reads the effects and bolts the fight already keeps and never changes them, so damage timing,
  // attribution, charge and combo are untouched. Numbers live in hero-ability-fx-data.js.
  const D=()=>root.LoftRumbleHeroFxData;
  const QUARTER=Math.PI/2,TURN=Math.PI*2,GOLDEN=Math.PI*(3-Math.sqrt(5));
  const EASE_POWER=3;  // cubic ease-out: fast start, soft stop
  const CENTRE=.5;     // a texture's middle, the default core share
  const clamp01=v=>Math.max(0,Math.min(1,v));
  const easeOut=k=>1-Math.pow(1-clamp01(k),EASE_POWER);
  const trails=new WeakMap();

  // Visual life of one activation (s), and the effect record the fight stores. `contact` is where the mover met the ally.
  function life(kind){return D().life[kind];}
  function effect(kind,seq,ally,contact,extra){
    const max=life(kind);
    return {fx:kind,seq,x:ally.x,y:ally.y,cx:contact.x,cy:contact.y,life:max,max,label:'',...extra};
  }
  const age=f=>clamp01(1-f.life/f.max);
  const elapsed=f=>f.max-f.life;

  // Newest activation first: 1, then each older one fainter by `fade`, never below `floor`.
  function emphasis(effects){
    const {fade,floor}=D().overlap,out=new Map();
    [...effects].sort((a,b)=>b.seq-a.seq).forEach((f,rank)=>out.set(f,Math.max(floor,Math.pow(fade,rank))));
    return out;
  }
  // Shockwave radius in logical units: eases from startShare of the range to the full range. Reduced motion shows the reach at once.
  function shockRadius(f,reduced){
    const {startShare}=D().shock;
    return reduced?f.r:f.r*(startShare+(1-startShare)*easeOut(age(f)));
  }
  const fadeOut=(k,start)=>k<start?1:clamp01(1-(k-start)/(1-start));
  // Where the crescent image goes, in a frame whose origin is the wave centre and whose +y points at the arc's middle,
  // so the texture's outer edge lies on the circle of the given radius.
  function crescentRect(texture,radius){
    const {pivotX,pivotY,radiusShare}=D().shock,scale=radius/(radiusShare*texture.width);
    return {x:-pivotX*texture.width*scale,y:-pivotY*texture.height*scale,width:texture.width*scale,height:texture.height*scale};
  }
  // Arc directions for one front: spread evenly, turned per activation so repeated waves do not stack exactly.
  function arcAngles(front,seq){
    const turn=front.spin+seq*GOLDEN;
    return Array.from({length:front.arcs},(_,i)=>turn+i*TURN/front.arcs);
  }
  // A beam from (x,y) to (tx,ty) in screen space: the ground squash (upright = 1 / projection factor) is undone first,
  // so its width is the same at every angle and every distance.
  function beamLine(f,upright){
    const dx=f.tx-f.x,dy=(f.ty-f.y)/upright;
    return {length:Math.hypot(dx,dy),angle:Math.atan2(dy,dx)};
  }
  function beamWidth(f,reduced){
    const {width,snapLife,snapWidth}=D().beam;
    if(reduced)return width;
    const k=clamp01(elapsed(f)/snapLife);
    return width*(snapWidth+(1-snapWidth)*k);
  }

  function sprite(ctx,image,x,y,width,height,upright,angle,coreX=CENTRE,coreY=CENTRE){
    ctx.save();ctx.translate(x,y);ctx.scale(1,upright);if(angle)ctx.rotate(angle);
    ctx.drawImage(image,-coreX*width,-coreY*height,width,height);ctx.restore();
  }
  function drawContact(ctx,f,o){
    const c=D().contact,k=elapsed(f)/c.life,image=o.image(D().textures.contact);
    if(k>=1||!image)return;
    const size=c.size*(1+(o.reduced?0:c.grow*k));
    ctx.globalAlpha=o.alpha*(1-k);sprite(ctx,image,f.cx,f.cy,size,size,o.upright,0,c.coreX,c.coreY);
  }
  function drawShock(ctx,f,o,weight){
    const sh=D().shock,image=o.image(D().textures.crescent);if(!image)return false;
    const k=age(f),radius=shockRadius(f,o.reduced),fade=fadeOut(k,sh.fadeStart),thick=weight===1?sh.thickness:sh.olderThickness;
    for(const front of sh.fronts){
      const r=radius*front.share,rect=crescentRect(image,r);
      ctx.globalAlpha=o.alpha*weight*fade*front.alpha;
      for(const angle of arcAngles(front,f.seq)){
        ctx.save();ctx.translate(f.x,f.y);ctx.rotate(angle-QUARTER);
        ctx.translate(0,r);ctx.scale(1,thick);ctx.translate(0,-r); // thin an older band toward its outer edge
        ctx.drawImage(image,rect.x,rect.y,rect.width,rect.height);ctx.restore();
      }
    }
    return true;
  }
  function drawBeam(ctx,f,o,weight){
    const b=D().beam,strip=o.image(D().textures.beam);if(!strip)return false;
    const {length,angle}=beamLine(f,o.upright),width=beamWidth(f,o.reduced),k=age(f);
    const inset=Math.min(length,o.enemyRadius*b.impactInset);
    ctx.globalAlpha=o.alpha*weight*fadeOut(k,b.fadeStart);
    ctx.save();ctx.translate(f.x,f.y);ctx.scale(1,o.upright);ctx.rotate(angle);
    ctx.drawImage(strip,0,-width/2,length-inset,width);ctx.restore();
    const impact=o.image(D().textures.impact),t=elapsed(f)/b.impactLife;
    if(impact&&t<1){
      const share=(length-inset)/(length||1),x=f.x+(f.tx-f.x)*share,y=f.y+(f.ty-f.y)*share;
      const size=b.impactSize*(o.reduced?1:1+b.impactGrow*(1-t));
      ctx.globalAlpha=o.alpha*weight*(1-t);sprite(ctx,impact,x,y,size,size*impact.height/impact.width,o.upright,0,b.coreX,b.coreY);
    }
    return true;
  }
  function trail(bolt,reduced,count){
    if(reduced)return [];
    const points=trails.get(bolt)??[],last=points[points.length-1];
    if(!last||last.x!==bolt.x||last.y!==bolt.y)points.push({x:bolt.x,y:bolt.y});
    if(points.length>count)points.splice(0,points.length-count);
    trails.set(bolt,points);
    return points;
  }
  // A seed flies straight at the enemy each step (homing, no lob), so its heading is the line to the enemy.
  function seedAngle(bolt,enemy,upright){return Math.atan2((enemy.y-bolt.y)/upright,enemy.x-bolt.x);}
  function drawSeeds(ctx,o){
    const sd=D().seed,image=o.image(D().textures.seed);if(!image)return false;
    for(const bolt of o.bolts){
      if(bolt.delay>0)continue;
      const points=trail(bolt,o.reduced,sd.trail);
      ctx.save();ctx.lineCap='round';ctx.strokeStyle=o.colour(sd.trailColour);
      for(let i=1;i<points.length;i++){const share=i/(points.length-1);ctx.globalAlpha=o.alpha*sd.trailAlpha*share;ctx.lineWidth=sd.trailWidth*share;
        ctx.beginPath();ctx.moveTo(points[i-1].x,points[i-1].y);ctx.lineTo(points[i].x,points[i].y);ctx.stroke();}
      ctx.restore();
      ctx.globalAlpha=o.alpha*sd.glowAlpha;ctx.fillStyle=o.colour(sd.glow);ctx.beginPath();ctx.arc(bolt.x,bolt.y,sd.glowRadius,0,TURN);ctx.fill();
      ctx.globalAlpha=o.alpha;sprite(ctx,image,bolt.x,bolt.y,sd.length,sd.height,o.upright,seedAngle(bolt,o.enemy,o.upright));
    }
    return true;
  }
  // Draws every tagged effect and the live seed bolts. Returns false when the textures are not loaded yet, so the caller
  // can keep its plain shapes for that frame. o: {effects,bolts,enemy,enemyRadius,image(name),reduced,upright,danger}.
  function draw(ctx,o){
    if(!o.image(D().textures.seed)&&!o.image(D().textures.crescent))return false;
    const view={...o,upright:o.upright||1,alpha:o.danger?D().dangerDim:1};
    const tagged=o.effects.filter(f=>f.fx),weights=emphasis(tagged.filter(f=>f.fx!=='springy'));
    ctx.save();
    for(const f of tagged){
      if(f.fx==='heavy')drawShock(ctx,f,view,weights.get(f));
      if(f.fx==='piercing')drawBeam(ctx,f,view,weights.get(f));
    }
    drawSeeds(ctx,view);
    for(const f of tagged)drawContact(ctx,f,view);
    ctx.restore();ctx.globalAlpha=1;
    return true;
  }
  root.LoftRumbleHeroFx=Object.freeze({life,effect,emphasis,shockRadius,crescentRect,arcAngles,beamLine,beamWidth,seedAngle,draw});
})(globalThis);
