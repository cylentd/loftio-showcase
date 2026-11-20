(function(root){
  'use strict';
  const data=root.LoftRumbleWhiplashData;
  function clip(poly,side){
    const out=[];
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length],da=side(a),db=side(b);
      if(da>=0)out.push(a);
      if((da>=0)!==(db>=0)){const k=da/(da-db);out.push({x:a.x+(b.x-a.x)*k,y:a.y+(b.y-a.y)*k});}
    }
    return out;
  }
  function footprint(p,rig){
    // Bark hurts only inside the floor warning. Bark drawn outside it (the root on Bramble's back,
    // trailing leaves at the start of the swing) never hits, so the rear refuge stays exactly safe.
    const raw=root.LoftRumbleWhiplashPose.polygons(p,rig),bounds=rig?.bounds;
    const wedges=data.sectorSlices,result=[];
    for(let n=0;n<wedges;n++){
      const a=p.startAngle+(p.endAngle-p.startAngle)*n/wedges,b=p.startAngle+(p.endAngle-p.startAngle)*(n+1)/wedges;
      const planes=[v=>Math.cos(a)*(v.y-p.origin.y)-Math.sin(a)*(v.x-p.origin.x),
        v=>Math.sin(b)*(v.x-p.origin.x)-Math.cos(b)*(v.y-p.origin.y)];
      if(bounds)planes.push(v=>v.x,v=>v.y,v=>bounds.width-v.x,v=>bounds.height-v.y);
      for(const outline of raw){let polygon=outline;for(const side of planes)polygon=clip(polygon,side);
        polygon.group=outline.group+':'+n;polygon.raw=raw;polygon.planes=planes;if(polygon.length)result.push(polygon);}
    }
    return result;
  }
  function distance(polygons,point){
    let nearest=Infinity;const groups={};
    for(const poly of polygons){let contained=false;
      for(let i=0,j=poly.length-1;i<poly.length;j=i++){
        const a=poly[j],b=poly[i],dx=b.x-a.x,dy=b.y-a.y;
        const k=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy||1)));
        const candidate={x:a.x+k*dx,y:a.y+k*dy};
        // Concave clipping can connect disjoint islands along a clip plane. That zero-area
        // connector is not painted; its real endpoints are still tested by the adjacent edges.
        const bridge=poly.planes?.some(side=>Math.abs(side(a))<data.geometryEpsilon&&Math.abs(side(b))<data.geometryEpsilon)
          &&distance(poly.raw,candidate)>data.contactTolerance;
        if(!bridge)nearest=Math.min(nearest,Math.hypot(point.x-candidate.x,point.y-candidate.y));
        if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)contained=!contained;
      }
      if(contained)groups[poly.group]=!groups[poly.group];
    }
    return Object.values(groups).some(Boolean)?0:nearest;
  }
  function first(state,from,to,start,end,radius){
    const model=root.LoftRumbleWhiplashModel,c=state.config,begin=c.prepare+c.telegraph;
    const lo=Math.max(from,begin),hi=Math.min(to,begin+c.strike);
    if(hi<lo||from>=begin+c.strike||to<=from)return null;
    const bounds=state.rig?.bounds;
    if(bounds&&(Math.max(start.x,end.x)<-radius||Math.min(start.x,end.x)>bounds.width+radius||
      Math.max(start.y,end.y)<-radius||Math.min(start.y,end.y)>bounds.height+radius))return null;
    const moving=Math.hypot(end.x-start.x,end.y-start.y)/(to-from);
    // Ease-in (k^2) angular velocity <= 2 * swept angle / duration < 2*pi / duration; shoulder rotation is bounded too.
    const bound=moving+data.speedSafety*(state.reach+data.rigMargin)*(2*Math.PI/c.strike);
    function sample(t,clipped=true){
      const k=(t-from)/(to-from),body={x:start.x+(end.x-start.x)*k,y:start.y+(end.y-start.y)*k};
      const p=model.project({...state,elapsed:Math.min(t,begin+c.strike-data.clockEpsilon*2)});
      const shape=clipped?footprint(p,state.rig):root.LoftRumbleWhiplashPose.polygons(p,state.rig);
      return {gap:distance(shape,body)-radius,body,p};
    }
    function search(a,b){
      const mid=(a+b)/2,probe=sample(mid);
      if(probe.gap>bound*(b-a)/2+data.contactTolerance)return null;
      const left=sample(a);if(left.gap<=data.contactTolerance)return {at:a,point:left.body};
      if(b-a<=data.contactTimeTolerance){
        for(const t of [mid,b]){const hit=sample(t);if(hit.gap<=data.contactTolerance)return {at:t,point:hit.body};}
        return null;
      }
      return search(a,mid)||search(mid,b);
    }
    return search(lo,hi);
  }
  function contacts(state,from,to,previous,bodies,radius,already=[]){
    return Object.keys(bodies).filter(id=>!already.includes(id)).flatMap(id=>{
      const hit=first(state,from,to,previous[id]??bodies[id],bodies[id],radius);
      return hit?[{id,...hit}]:[];
    }).sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
  }
  root.LoftRumbleWhiplashContact=Object.freeze({footprint,distance,first,contacts});
})(globalThis);
