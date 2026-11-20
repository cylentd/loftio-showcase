// Bramble's bark shield, front-facing, drawn in code (canvas) straight over the weak spot (#439 Look round 2, owner 2026-11-18:
// round 1's side-on sprite read as a dark branch). Pure look: reads the shield's cracks, regrow and hit jolt; never changes state.
// Three stages: whole, cracked once, cracked twice. Breaking at 0 HP is the rules' job (boss-fight-model.js guardHit); the break flash and shards stay in boss-fight.js.
// Colours are the page's CSS tokens (o.colors); shape numbers are shares of the shield's width w or height h.
(function(root){
  'use strict';
  const S=Object.freeze({
    aspect:1.18,                 // h / w: a heater shield, a little taller than wide magic-ok: pure canvas shape geometry of the code-drawn bark shield (owner 2026-11-18 look round), each value named in S or a path table
    top:-.42,topArch:-.54,       // the top edge's corners and its arch, in h magic-ok: pure canvas shape geometry of the code-drawn bark shield (owner 2026-11-18 look round), each value named in S or a path table
    shoulder:.12,point:.56,      // where the sides start to curve in, and the bottom point, in h magic-ok: pure canvas shape geometry of the code-drawn bark shield (owner 2026-11-18 look round), each value named in S or a path table
    rim:3.2,rimInset:2.2,        // px: dark outer rim, and the light inner rim's inset magic-ok: pure canvas shape geometry of the code-drawn bark shield (owner 2026-11-18 look round), each value named in S or a path table
    innerAlpha:.42,              // the light inner rim's opacity magic-ok: pure canvas shape geometry of the code-drawn bark shield (owner 2026-11-18 look round), each value named in S or a path table
    shadeAlpha:.5,               // the dark wash at the foot, for depth magic-ok: pure canvas shape geometry of the code-drawn bark shield (owner 2026-11-18 look round), each value named in S or a path table
    tone:.34,                    // a flat ink wash over the amber so it reads as bark, not brass (still pass 1, 2026-11-18) magic-ok: pure canvas shape geometry of the code-drawn bark shield (owner 2026-11-18 look round), each value named in S or a path table
    grain:Object.freeze([-.3,-.1,.1,.3]),grainWave:.06,grainWidth:1.8,grainAlpha:.7, // vertical bark grain lines, in w magic-ok: pure canvas shape geometry of the code-drawn bark shield (owner 2026-11-18 look round), each value named in S or a path table
    knot:Object.freeze({x:.18,y:.18,rx:.09,ry:.06}),   // one bark knot, in w and h magic-ok: pure canvas shape geometry of the code-drawn bark shield (owner 2026-11-18 look round), each value named in S or a path table
    leaf:Object.freeze({y:-.5,size:.2,spread:.7}),     // the two-leaf sprout on the top edge, Bramble's mark magic-ok: pure canvas shape geometry of the code-drawn bark shield (owner 2026-11-18 look round), each value named in S or a path table
    shadow:Object.freeze({x:2,y:3,blur:4,alpha:.55}),  // px drop shadow so it lifts off the boss magic-ok: pure canvas shape geometry of the code-drawn bark shield (owner 2026-11-18 look round), each value named in S or a path table
    crackDark:4,crackLight:1.6,  // px: each crack is a dark stroke under a light core, readable at 390x844 magic-ok: pure canvas shape geometry of the code-drawn bark shield (owner 2026-11-18 look round), each value named in S or a path table
    hitScale:.1,hitFlash:.45,    // the jolt after a hit: grows by this share and flashes white this much at its peak magic-ok: pure canvas shape geometry of the code-drawn bark shield (owner 2026-11-18 look round), each value named in S or a path table
    chipAlpha:.7                 // the chipped corner at the second crack magic-ok: pure canvas shape geometry of the code-drawn bark shield (owner 2026-11-18 look round), each value named in S or a path table
  });
  // Crack paths, in (w, h) shares. Stage 1: one crack from the top edge down. Stage 2 adds a second from the right edge and a chip.
  const CRACKS=Object.freeze([
    Object.freeze([[-.12,-.48],[-.02,-.3],[-.14,-.12],[.02,.06],[-.04,.22]]), // magic-ok: pure canvas shape geometry of the code-drawn bark shield (owner 2026-11-18 look round), each value named in S or a path table
    Object.freeze([[.47,-.12],[.26,-.02],[.3,.14],[.1,.24],[.14,.4]]) // magic-ok: pure canvas shape geometry of the code-drawn bark shield (owner 2026-11-18 look round), each value named in S or a path table
  ]);
  const CHIP=Object.freeze([[.3,-.47],[.47,-.4],[.36,-.3]]);
  const xy=(p,w,h)=>[p[0]*w,p[1]*h];

  function outline(ctx,w,h){
    const hw=w/2;
    ctx.beginPath();ctx.moveTo(-hw,S.top*h);
    ctx.quadraticCurveTo(0,S.topArch*h,hw,S.top*h);
    ctx.lineTo(hw,S.shoulder*h);
    ctx.bezierCurveTo(hw,S.point*h*.6,w*.18,S.point*h*.85,0,S.point*h); // magic-ok: pure canvas shape geometry of the code-drawn bark shield (owner 2026-11-18 look round), each value named in S or a path table
    ctx.bezierCurveTo(-w*.18,S.point*h*.85,-hw,S.point*h*.6,-hw,S.shoulder*h); // magic-ok: pure canvas shape geometry of the code-drawn bark shield (owner 2026-11-18 look round), each value named in S or a path table
    ctx.closePath();
  }
  function line(ctx,pts,w,h){ctx.beginPath();pts.forEach((p,i)=>{const [x,y]=xy(p,w,h);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});}
  function body(ctx,w,h,c){
    ctx.save();ctx.shadowColor=c['rumble-ink'];ctx.shadowOffsetX=S.shadow.x;ctx.shadowOffsetY=S.shadow.y;ctx.shadowBlur=S.shadow.blur;
    ctx.globalAlpha*=S.shadow.alpha;outline(ctx,w,h);ctx.fillStyle=c['rumble-ink'];ctx.fill();ctx.restore();
    outline(ctx,w,h);ctx.fillStyle=c.warning;ctx.fill();
    ctx.save();outline(ctx,w,h);ctx.clip();
    ctx.save();ctx.globalAlpha*=S.tone;ctx.fillStyle=c['rumble-ink'];ctx.fillRect(-w,-h,2*w,2*h);ctx.restore();
    const g=ctx.createLinearGradient(0,S.top*h,0,S.point*h);g.addColorStop(0,'transparent');g.addColorStop(1,c['rumble-ink']);
    ctx.globalAlpha*=S.shadeAlpha;ctx.fillStyle=g;ctx.fillRect(-w,-h,2*w,2*h);ctx.restore();
  }
  function grain(ctx,w,h,c){
    ctx.save();outline(ctx,w,h);ctx.clip();ctx.globalAlpha*=S.grainAlpha;ctx.strokeStyle=c['rumble-ink'];ctx.lineWidth=S.grainWidth;ctx.lineCap='round';
    for(const gx of S.grain){ctx.beginPath();ctx.moveTo(gx*w,-h);ctx.bezierCurveTo((gx+S.grainWave)*w,-h/4,(gx-S.grainWave)*w,h/4,gx*w,h);ctx.stroke();} // magic-ok: pure canvas shape geometry of the code-drawn bark shield (owner 2026-11-18 look round), each value named in S or a path table
    const k=S.knot;ctx.beginPath();ctx.ellipse(-k.x*w,k.y*h,k.rx*w,k.ry*h,0,0,Math.PI*2);ctx.stroke();ctx.restore();
  }
  function rims(ctx,w,h,c){
    ctx.save();ctx.globalAlpha*=S.innerAlpha;ctx.strokeStyle=c['rumble-cream'];ctx.lineWidth=S.rimInset;
    ctx.translate(0,0);ctx.scale(1-2*S.rimInset/w,1-2*S.rimInset/h);outline(ctx,w,h);ctx.stroke();ctx.restore();
    outline(ctx,w,h);ctx.lineJoin='round';ctx.strokeStyle=c['rumble-ink'];ctx.lineWidth=S.rim;ctx.stroke();
  }
  function leaf(ctx,w,h,c){
    const L=S.leaf,size=L.size*w,y=L.y*h;ctx.save();ctx.fillStyle=c.seed;ctx.strokeStyle=c['rumble-ink'];ctx.lineWidth=S.grainWidth;
    for(const side of [-1,1]){ctx.save();ctx.translate(0,y);ctx.rotate(side*L.spread);ctx.beginPath();ctx.ellipse(0,-size,size/2,size,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();}
    ctx.restore();
  }
  function cracks(ctx,w,h,n,c){
    if(n>=2){ctx.save();ctx.globalAlpha*=S.chipAlpha;line(ctx,CHIP,w,h);ctx.closePath();ctx.fillStyle=c['rumble-ink'];ctx.fill();ctx.restore();}
    ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
    for(const path of CRACKS.slice(0,Math.min(n,CRACKS.length))){
      line(ctx,path,w,h);ctx.strokeStyle=c['rumble-ink'];ctx.lineWidth=S.crackDark;ctx.stroke();
      line(ctx,path,w,h);ctx.strokeStyle=c['rumble-cream'];ctx.lineWidth=S.crackLight;ctx.stroke();
    }
    ctx.restore();
  }
  // o: {x, y, size (width, logical px), cracks (0..2), grow (regrow width share), alpha, hit (jolt 1..0), reduced, colors}.
  function draw(ctx,o){
    const c=o.colors||{};if(!c.warning||!c['rumble-ink'])return false;
    const hit=Math.max(0,Math.min(1,o.hit||0)),w=o.size*(o.grow??1)*(o.reduced?1:1+S.hitScale*hit),h=w*S.aspect;
    ctx.save();ctx.globalAlpha*=o.alpha??1;ctx.translate(o.x,o.y);
    body(ctx,w,h,c);grain(ctx,w,h,c);cracks(ctx,w,h,o.cracks|0,c);rims(ctx,w,h,c);leaf(ctx,w,h,c);
    if(hit>0){ctx.save();outline(ctx,w,h);ctx.globalAlpha*=S.hitFlash*hit;ctx.fillStyle=c.flash||c['rumble-cream'];ctx.fill();ctx.restore();}
    ctx.restore();return true;
  }
  root.LoftRumbleBarkShield=Object.freeze({draw,SHAPE:S,CRACKS});
})(typeof window!=='undefined'?window:globalThis);
