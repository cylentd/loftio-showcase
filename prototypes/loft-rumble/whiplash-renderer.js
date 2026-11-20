// LM4b: paint only. Projection and eligible elapsed belong to the scheduler.
(function(root){
  'use strict';
  // Shipped copies in art/, like every other Bramble texture (sources stay in assets/living-magic/).
  const art={},rig='art/',poses='art/';
  for(const name of ['base','middle','tip','branch','windup']){
    const image=new Image();
    image.src=name==='windup'?poses+'bramble-body-whip-windup.webp':(name==='branch'?poses:rig)+'bramble-whip-'+name+'.webp';
    art[name]=image;
  }
  const look=root.LoftRumbleWhiplashLook;
  const sapCanvases={};
  function leaves(ctx,p){
    const r=p.reach*look.leafRadius,span=p.endAngle-p.startAngle;
    ctx.globalAlpha=look.leafAlpha;ctx.fillStyle=look.leafColour;
    for(let i=0;i<look.leafCount;i++){
      const a=p.startAngle+span*(i+1)/(look.leafCount+1),b=a+look.leafArc,m=a+look.leafArc*look.leafShoulder;
      ctx.beginPath();ctx.moveTo((r+look.leafHalfWidth)*Math.cos(a),(r+look.leafHalfWidth)*Math.sin(a));
      ctx.quadraticCurveTo((r+look.leafHalfWidth)*Math.cos(m),(r+look.leafHalfWidth)*Math.sin(m),r*Math.cos(b),r*Math.sin(b));
      ctx.quadraticCurveTo((r-look.leafHalfWidth)*Math.cos(m),(r-look.leafHalfWidth)*Math.sin(m),(r-look.leafHalfWidth)*Math.cos(a),(r-look.leafHalfWidth)*Math.sin(a));
      ctx.quadraticCurveTo(r*Math.cos(a-look.leafTail),r*Math.sin(a-look.leafTail),(r+look.leafHalfWidth)*Math.cos(a),(r+look.leafHalfWidth)*Math.sin(a));
      ctx.fill();
    }
  }
  function warning(ctx,p,colour){
    if(!p||!['telegraph','strike'].includes(p.phase))return;
    ctx.save();ctx.translate(p.origin.x,p.origin.y);ctx.setLineDash([]);
    ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,p.reach,p.startAngle,p.endAngle);ctx.closePath();
    ctx.fillStyle=colour;ctx.globalAlpha=look.fill;ctx.fill();
    ctx.strokeStyle=colour;ctx.globalAlpha=look.edge;ctx.lineWidth=look.line;ctx.stroke();leaves(ctx,p);ctx.restore();
  }
  function sap(name,elapsed,reduced){
    const im=art[name],c=sapCanvases[name]??(sapCanvases[name]=document.createElement('canvas'));
    const w=look.sapWidth,h=Math.round(w*im.height/im.width);
    if(c.width!==w||c.height!==h){c.width=w;c.height=h;}
    const x=c.getContext('2d');x.clearRect(0,0,w,h);x.globalCompositeOperation='source-over';
    const head=reduced?1:(elapsed/look.sapPeriod)%1;
    const g=x.createLinearGradient(0,0,w,0);
    if(reduced){g.addColorStop(0,look.sapColour);g.addColorStop(1,look.sapColour);}
    else for(const [at,colour] of [[0,'transparent'],[Math.max(0,head-look.sapBand),'transparent'],[head,look.sapColour],[Math.min(1,head+look.sapBand),'transparent'],[1,'transparent']])g.addColorStop(at,colour);
    x.strokeStyle=g;x.lineWidth=look.sapLine;x.lineCap='round';
    for(const v of look.sapVeins){
      x.beginPath();x.moveTo(0,h*v);x.bezierCurveTo(w*look.sapControl[0],h*(v-look.sapBend),w*look.sapControl[1],h*(v+look.sapBend),w,h*v);x.stroke();
      x.beginPath();x.moveTo(w*look.sapForkStart,h*v);x.quadraticCurveTo(w*look.sapForkControl,h*(v-look.sapFork),w,h*(v-look.sapFork));x.stroke();
    }
    x.globalCompositeOperation='destination-in';x.drawImage(im,0,0,w,h);return c;
  }
  function loaded(image){return image.complete&&image.naturalWidth>0;}
  function body(ctx,o){
    const {projection:p,elapsed,reduced,radius:R,upright}=o;
    if(!p||p.phase==='done'||!Object.values(art).every(loaded))return false;
    return paintedBody(ctx,o);
  }
  function paintedBody(ctx,o){
    const fx=root.LoftRumbleWhiplashFx;
    const p=o.projection;
    const R=o.radius,upright=o.upright,charge=fx?fx.charge(p):0;
    const rig={radius:R,upright,foot:root.LoftRumbleBossFightData.storybook.bossFoot,bounds:o.bounds};
    const pose=root.LoftRumbleWhiplashPose.pose(p,rig);
    const textures=Object.fromEntries(['branch','base','middle','tip'].map(name=>[name,sap(name,o.elapsed??0,o.reduced)]));
    function torso(){
      ctx.save();ctx.translate(p.origin.x,p.origin.y+pose.foot);ctx.rotate(pose.twist);ctx.translate(0,-pose.foot);
      root.LoftRumbleBossFight.body(ctx,{...o,fx:null,clock:0,enabled:true,fade:1});ctx.restore();
    }
    if(!pose.behind)torso();
    ctx.save();
    // Bark is drawn whole, never sliced by the floor wedge. Contact is this bark inside the warning (whiplash-contact.js).
    if(o.bounds){ctx.beginPath();ctx.rect(0,0,o.bounds.width,o.bounds.height);ctx.clip();}
    for(const piece of pose.pieces){
      const im=art[piece.name];ctx.save();ctx.translate(piece.x,piece.y);ctx.rotate(piece.angle);
      ctx.drawImage(im,piece.sourceX,0,piece.sourceWidth,im.height,0,piece.top,piece.width,piece.height);
      const texture=textures[piece.name],scale=texture.width/im.width;
      ctx.globalCompositeOperation='source-atop';ctx.globalAlpha*=Math.min(1,look.sapAlpha+look.sapCharge*charge);
      ctx.drawImage(texture,piece.sourceX*scale,0,piece.sourceWidth*scale,texture.height,0,piece.top,piece.width,piece.height);ctx.restore();
    }
    if(p.phase!=='recover'){
      const r=look.socketRadius+(look.chargeRadius-look.socketRadius)*charge;
      const g=ctx.createRadialGradient(pose.shoulder.x,pose.shoulder.y,0,pose.shoulder.x,pose.shoulder.y,r);
      g.addColorStop(0,look.socketColour);g.addColorStop(1,'transparent');
      ctx.save();ctx.globalAlpha*=look.socketAlpha+(look.chargeAlpha-look.socketAlpha)*charge*charge;
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(pose.shoulder.x,pose.shoulder.y,r,0,2*Math.PI);ctx.fill();ctx.restore();
      if(p.phase==='telegraph'&&!o.reduced)motes(ctx,pose.shoulder,o.elapsed??0,charge);
    }
    ctx.restore();if(pose.behind)torso();return true;
  }
  // Slash trail and speed lines: a separate layer drawn before the body, so they sit behind Bramble
  // and the bark. They are effects, never bark: body() paints bark only, and contact ignores them.
  function trail(ctx,o){
    const fx=root.LoftRumbleWhiplashFx,p=o.projection;
    if(!fx||!p||!['strike','recover'].includes(p.phase)||!Object.values(art).every(loaded))return false;
    const rig={radius:o.radius,upright:o.upright,foot:root.LoftRumbleBossFightData.storybook.bossFoot,bounds:o.bounds};
    const pose=root.LoftRumbleWhiplashPose.pose(p,rig),reach=visibleReach(pose,o.bounds);
    ctx.save();
    if(o.bounds){ctx.beginPath();ctx.rect(0,0,o.bounds.width,o.bounds.height);ctx.clip();}
    smear(ctx,fx.smear(p,o.reduced),pose,reach);speedLines(ctx,p,pose,fx.speedLines(p,o.reduced),reach);
    ctx.restore();return true;
  }
  // Gold motes drift inward to the socket while the swing charges.
  function motes(ctx,at,elapsed,charge){
    ctx.save();ctx.fillStyle=look.sapColour;
    for(let i=0;i<look.moteCount;i++){
      const u=(elapsed*look.moteRate+i/look.moteCount)%1,a=i*2*Math.PI/look.moteCount,d=look.moteDistance*(1-u);
      ctx.globalAlpha=look.moteAlpha*charge*Math.sin(Math.PI*u);
      ctx.beginPath();ctx.arc(at.x+Math.cos(a)*d,at.y+Math.sin(a)*d,look.moteSize,0,2*Math.PI);ctx.fill();
    }
    ctx.restore();
  }
  // On-screen bark length along the current angle; effects follow the bark the player can see, not the arena reach.
  function visibleReach(pose,bounds){
    const {x,y}=pose.shoulder,dx=Math.cos(pose.angle),dy=Math.sin(pose.angle);
    const wall=bounds?Math.min(dx>0?(bounds.width-x)/dx:dx<0?-x/dx:Infinity,dy>0?(bounds.height-y)/dy:dy<0?-y/dy:Infinity):Infinity;
    return Math.min(pose.length,wall)*look.trailReach;
  }
  // Crescent slash trail around the shoulder pivot: thin at the tail, deepest at the head.
  function crescent(ctx,c,from,to,outer,depth){
    const n=look.smearSegments;ctx.beginPath();
    for(let i=0;i<=n;i++){const a=from+(to-from)*i/n;ctx.lineTo(c.x+Math.cos(a)*outer,c.y+Math.sin(a)*outer);}
    for(let i=n;i>=0;i--){const u=i/n,a=from+(to-from)*u,r=outer*(1-depth*u*u);ctx.lineTo(c.x+Math.cos(a)*r,c.y+Math.sin(a)*r);}
    ctx.closePath();ctx.fill();
  }
  function smear(ctx,m,pose,L){
    if(!m||!(m.to>m.from)||!(L>0))return;ctx.save();ctx.globalAlpha=m.alpha*look.smearEdgeAlpha;ctx.fillStyle=look.sapColour;
    crescent(ctx,pose.shoulder,m.from,m.to,L,look.smearDepth);
    ctx.globalAlpha=m.alpha;ctx.fillStyle=look.smearCoreColour;
    crescent(ctx,pose.shoulder,m.from,m.to,L*(1-look.smearDepth*(1-look.smearCore)/2),look.smearDepth*look.smearCore);
    ctx.restore();
  }
  function speedLines(ctx,p,pose,count,L){
    if(!count||!(L>0))return;
    const c=pose.shoulder,from=p.startAngle,to=pose.angle;
    ctx.save();ctx.strokeStyle=look.smearCoreColour;ctx.lineWidth=look.speedLineWidth;ctx.globalAlpha=look.speedLineAlpha;ctx.beginPath();
    for(let i=0;i<count;i++){
      const j=Math.abs((Math.sin((i+1)*look.hashSeed)*look.hashScale)%1),a=from+(to-from)*(i+look.speedLineCentre)/count;
      const r0=L*(look.speedLineInner+look.speedLineJitter*j),r1=L*look.speedLineOuter;
      ctx.moveTo(c.x+Math.cos(a)*r0,c.y+Math.sin(a)*r0);ctx.lineTo(c.x+Math.cos(a)*r1,c.y+Math.sin(a)*r1);
    }
    ctx.stroke();ctx.restore();
  }
  function impact(ctx,p,hits,bodies,fx,reduced){
    if(!p)return;
    ctx.save();
    for(const id of hits||[]){const b=bodies[id],strength=hitAccent(fx,id);if(!b||!strength)continue;
      ctx.globalAlpha=reduced?1:strength;
      ctx.beginPath();
      if(reduced)ctx.arc(b.x,b.y,look.impactRing,0,2*Math.PI);
      else for(let i=0;i<look.impactRays;i++){const a=i*2*Math.PI/look.impactRays,x=Math.cos(a),y=Math.sin(a);
        ctx.moveTo(b.x+x*look.impactRing,b.y+y*look.impactRing);
        ctx.lineTo(b.x+x*(look.impactRing+look.impactRayLength),b.y+y*(look.impactRing+look.impactRayLength));
        ctx.lineTo(b.x+x*look.impactRing-y*look.chipWidth,b.y+y*look.impactRing+x*look.chipWidth);ctx.closePath();}
      if(!reduced){ctx.fillStyle=look.smearCoreColour;ctx.fill();}
      ctx.strokeStyle=look.impactInk;ctx.lineWidth=look.impactLine;ctx.stroke();
      ctx.strokeStyle=look.impactColour;ctx.lineWidth=look.line;ctx.stroke();
      if(!reduced)burst(ctx,b,fx.whiplash.elapsed-fx.contacts[id].shownAt,id);}
    ctx.restore();
  }
  // Small leaf and spark burst flung outward from the resident on contact.
  function burst(ctx,b,age,id){
    const k=age/look.burstLife;if(!(k>=0&&k<1))return;
    const travel=look.impactRing+look.burstTravel*(1-(1-k)*(1-k)),seed=id.length;
    ctx.save();ctx.globalAlpha=1-k;
    for(let i=0;i<look.burstCount;i++){
      const a=(i+seed*look.burstSpin)*2*Math.PI/look.burstCount,x=b.x+Math.cos(a)*travel,y=b.y+Math.sin(a)*travel,size=look.burstSize*(1-k*look.burstShrink);
      ctx.fillStyle=i%2?look.leafColour:look.impactColour;ctx.beginPath();
      ctx.ellipse(x,y,size,size*look.burstSquash,a+k*Math.PI,0,2*Math.PI);ctx.fill();
    }
    ctx.restore();
  }
  function residentPose(fx,id,b,reduced){
    if(!fx?.whiplash||!fx.contacts?.[id])return null;
    const p=fx.warn.projection,force=hitAccent(fx,id);
    const dx=b.x-p.origin.x,dy=b.y-p.origin.y,d=Math.hypot(dx,dy)||1;
    return {x:reduced?0:dx/d*look.hitRecoil*force,y:reduced?0:dy/d*look.hitRecoil*force,
      sx:1,sy:1,rotation:0};
  }
  function hitAccent(fx,id){
    const contact=fx?.contacts?.[id];if(!fx?.whiplash||!contact)return 0;
    const age=Math.max(0,fx.whiplash.elapsed-contact.shownAt);
    return Math.max(0,1-Math.max(0,age-look.hitHold)/(look.hitAccentLife-look.hitHold));
  }
  function hitFlash(fx,id,reduced){
    const contact=fx?.contacts?.[id];if(!fx?.whiplash||!contact)return 0;
    return root.LoftRumbleWhiplashFx.flash(fx.whiplash.elapsed-contact.shownAt,reduced);
  }
  root.LoftRumbleWhiplashRenderer=Object.freeze({warning,trail,body,impact,residentPose,hitAccent,hitFlash});
})(globalThis);
