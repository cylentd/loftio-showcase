import { CAMERA } from './control-constants.mjs';
import { sphereEntry } from './aim-model.mjs';
import {sweepProp} from './terrain-props.mjs';

// Pure geometry: never touches meshes, material opacity or shared instance buffers.
export function clearCamera(from,to,obstacles,heightAt) {
  const dx=to.x-from.x,dy=to.y-from.y,dz=to.z-from.z, length=Math.hypot(dx,dy,dz);
  if(!length) return {...to};
  const direction={x:dx/length,y:dy/length,z:dz/length};
  let distance=length;
  for(const o of obstacles) {
    let hit;
    if(o.prop){const h=sweepProp(from,to,CAMERA.clearance,o.prop);hit=h?h.t*length:null;}
    else if(o.minY===undefined) hit=sphereEntry(from,direction,o.center,o.radius+CAMERA.clearance);
    else {
      // Cylinder side intersections restricted to the solid's vertical extent.
      const x=from.x-o.center.x,z=from.z-o.center.z,a=direction.x**2+direction.z**2;
      const b=x*direction.x+z*direction.z,c=x*x+z*z-(o.radius+CAMERA.clearance)**2,d=b*b-a*c;
      if(a===0 || d<0) continue;
      const enter=Math.max(0,(-b-Math.sqrt(d))/a),exit=(-b+Math.sqrt(d))/a;
      let low=enter,high=exit;
      if(direction.y) { const ys=[(o.minY-from.y)/direction.y,(o.maxY-from.y)/direction.y].sort((a,b)=>a-b); low=Math.max(low,ys[0]);high=Math.min(high,ys[1]); }
      else if(from.y<o.minY || from.y>o.maxY) continue;
      hit=high>=low ? low : null;
    }
    if(hit!==null && hit!==undefined) distance=Math.min(distance,Math.max(CAMERA.minimum,hit-CAMERA.clearance));
  }
  // Stop before intervening terrain, not just terrain at the desired endpoint.
  for(let i=1;i<=CAMERA.samples;i++) {
    const d=distance*i/CAMERA.samples,x=from.x+direction.x*d,z=from.z+direction.z*d;
    if(from.y+direction.y*d<heightAt(x,z)+CAMERA.sightClearance) { distance=Math.max(CAMERA.minimum,d-CAMERA.clearance);break; }
  }
  const result={x:from.x+direction.x*distance,y:from.y+direction.y*distance,z:from.z+direction.z*distance};
  result.y=Math.max(result.y,heightAt(result.x,result.z)+CAMERA.terrainClearance);
  return result;
}

export function worldObstacles(world) {
  return [...world.canopies.map(([x,y,z,r])=>({center:{x,y,z},radius:r})),
    ...world.solids.map(([x,z,r,top])=>({center:{x,y:0,z},radius:r,minY:world.terrain.heightAt(x,z),maxY:top})),
    ...world.rocks.map(r=>({center:{...r.g.position},radius:r.r})),
    ...(world.terrainProps??[]).map(p=>({center:p.center,radius:p.cameraRadius,prop:p}))];
}
