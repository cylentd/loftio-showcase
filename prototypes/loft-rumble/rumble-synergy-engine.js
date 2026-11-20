(function(root){
  'use strict';
  // Projectile synergies in real time (ledger #462, unit A2): Spread shot, Ricochet, Chain lightning. Pure plans, no page state.
  // Every number comes from the registry (rumble-synergy.js); the boss is the only target. A plan is data the page plays:
  // `seeds` fly straight and are tested with seedHits; `hits` land after `delay` seconds along a path of points.
  // The carrying hit is one Seed burst bolt (registry 'seed-burst' damage); each synergy's share is a fraction of it.
  const SYN=root.LoftRumbleSynergy,MODE='boss';
  const HANDLES=Object.freeze(['spread-shot','ricochet','chain-lightning']);
  const HALF_TURN_DEG=180; // degrees in half a turn (unit conversion)
  const num=id=>SYN.numbers(id,MODE);
  const share=(base,fraction)=>Math.max(1,Math.round(base*fraction)); // a hit is never zero
  const dist=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);
  const pt=p=>({x:p.x,y:p.y});

  function spread(src,target){
    const n=num('spread-shot'),seed=num('seed-burst'),count=n.count;
    const aim=Math.atan2(target.y-src.y,target.x-src.x),fan=n.angleDeg*Math.PI/HALF_TURN_DEG;
    const seeds=[];
    for(let i=0;i<count;i++){
      const a=count>1?aim-fan/2+fan*i/(count-1):aim;
      seeds.push({x:src.x,y:src.y,vx:Math.cos(a)*seed.speed,vy:Math.sin(a)*seed.speed,
        damage:share(seed.damage,n.damageShare),delay:i*seed.stagger,life:seed.boltLife});
    }
    return {seeds,hits:[]};
  }

  // The point where a ray from `from` through `to` leaves the arena rectangle.
  function wallPoint(from,to,arena){
    let dx=to.x-from.x,dy=to.y-from.y;const len=Math.hypot(dx,dy);
    if(len===0){dx=0;dy=-1}else{dx/=len;dy/=len}
    const tx=dx>0?(arena.w-to.x)/dx:dx<0?-to.x/dx:Infinity,ty=dy>0?(arena.h-to.y)/dy:dy<0?-to.y/dy:Infinity;
    const t=Math.max(0,Math.min(tx,ty));
    return {x:to.x+dx*t,y:to.y+dy*t};
  }

  // A hit path is timed by how far the seed has flown at the registry bolt speed.
  const timed=(hits,speed)=>{let flown=0;return hits.map(h=>{flown+=h.length;return {from:h.from,via:h.via,to:h.to,damage:h.damage,delay:flown/speed}})};

  function ricochet(src,target,arena){
    const n=num('ricochet'),seed=num('seed-burst'),centre=pt(target),wall=wallPoint(src,centre,arena);
    const hits=[{from:pt(src),to:centre,damage:seed.damage,length:dist(src,centre)}];
    for(let i=0;i<n.maxBounces;i++)hits.push({from:centre,via:wall,to:centre,damage:share(seed.damage,n.damageShare),length:dist(centre,wall)*2});
    return {seeds:[],hits:timed(hits,seed.speed)};
  }

  // Lone boss: every jump arcs to another point on the boss's own ring, so each jump still lands on the target.
  function chain(src,target){
    const n=num('chain-lightning'),seed=num('seed-burst'),centre=pt(target);
    const aim=Math.atan2(target.y-src.y,target.x-src.x),step=Math.PI*2/(n.jumps+1);
    const hits=[{from:pt(src),to:centre,damage:seed.damage,length:dist(src,centre)}];
    let at=centre;
    for(let i=1;i<=n.jumps;i++){
      const a=aim+Math.PI+step*i,to={x:target.x+Math.cos(a)*target.radius,y:target.y+Math.sin(a)*target.radius};
      hits.push({from:at,to,damage:share(seed.damage,n.damageShare),length:dist(at,to)});at=to;
    }
    return {seeds:[],hits:timed(hits,seed.speed)};
  }

  const PLANNERS={'spread-shot':spread,'ricochet':ricochet,'chain-lightning':chain};
  function launch(id,src,target,arena){
    const plan=typeof id==='string'&&HANDLES.includes(id)?PLANNERS[id]:null;
    return plan?plan(src,target,arena):{seeds:[],hits:[]};
  }

  // True when the seed's path over dt passes within the target's radius (segment against circle).
  function seedHits(seed,target,dt){
    const ex=seed.vx*dt,ey=seed.vy*dt,fx=seed.x-target.x,fy=seed.y-target.y,len2=ex*ex+ey*ey;
    const t=len2===0?0:Math.max(0,Math.min(1,-(fx*ex+fy*ey)/len2));
    return Math.hypot(fx+ex*t,fy+ey*t)<=target.radius;
  }
  function moveSeed(seed,dt){seed.x+=seed.vx*dt;seed.y+=seed.vy*dt}

  const api=Object.freeze({handles:HANDLES,launch,seedHits,moveSeed});
  root.LoftRumbleSynergyEngine=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
