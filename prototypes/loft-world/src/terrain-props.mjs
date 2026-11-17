import {LOOK,ROUTE,FEEDBACK} from './terrain-look-data.mjs';
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
export function makeTerrainProps(heightAt,seed=LOOK.seed){
  return ROUTE.map((d,index)=>{
    const y=heightAt(d.x,d.z),vertices=[],faces=[],N=LOOK.sides;
    const rings=d.material==='rock'?[[d.base,.82],[d.height*.28,1],[d.height,d.topScale]]:[[d.base,1],[d.height,d.topScale]];
    for(const [height,scale] of rings)for(let i=0;i<N;i++){
      const a=i/N*Math.PI*2, r=d.r*(1+Math.sin(i*2+seed+index)*.065)*scale;
      vertices.push({x:d.x+Math.cos(a)*r,y:y+height,z:d.z+Math.sin(a)*r});
    }
    faces.push(Array.from({length:N},(_,i)=>N-1-i),Array.from({length:N},(_,i)=>(rings.length-1)*N+i));
    for(let ring=0;ring<rings.length-1;ring++)for(let i=0;i<N;i++)faces.push([ring*N+i,ring*N+(i+1)%N,(ring+1)*N+(i+1)%N,(ring+1)*N+i]);
    const center={x:d.x,y:y+(d.base+d.height)/2,z:d.z};
    const planes=faces.map(face=>{
      const a=vertices[face[0]],u=sub(vertices[face[1]],a),v=sub(vertices[face[2]],a);
      let n={x:u.y*v.z-u.z*v.y,y:u.z*v.x-u.x*v.z,z:u.x*v.y-u.y*v.x};
      const length=Math.hypot(n.x,n.y,n.z),sign=dot(n,sub(a,center))<0?-1:1;
      n={x:n.x/length*sign||0,y:n.y/length*sign||0,z:n.z/length*sign||0};
      return {normal:n,offset:dot(n,a)};
    });
    return {...d,y,center,vertices,faces,planes,decorativeSolid:false,cameraRadius:Math.max(...vertices.map(v=>Math.hypot(v.x-center.x,v.y-center.y,v.z-center.z)))};
  });
}
/** Sweep against the same convex planes used by visible faces, expanded for the body. */
export function sweepProp(from,to,radius,prop){
  const delta=sub(to,from);let enter=0,exit=1,normal=null,nearest=-Infinity,insideNormal=null;
  for(const plane of prop.planes){
    const distance=dot(plane.normal,from)-plane.offset-radius,speed=dot(plane.normal,delta);
    if(distance>nearest){nearest=distance;insideNormal=plane.normal;}
    if(Math.abs(speed)<LOOK.epsilon){if(distance>0)return null;continue;}
    const t=-distance/speed;
    if(speed<0){if(t>=enter){enter=t;normal=plane.normal;}}else exit=Math.min(exit,t);
    if(enter>exit)return null;
  }
  if(exit<0||enter>1)return null;
  if(!normal){if(dot(insideNormal,delta)>=0)return null;normal=insideNormal;}
  const point={x:from.x+delta.x*enter,y:from.y+delta.y*enter,z:from.z+delta.z*enter};
  if(nearest<0&&enter===0)for(const k of ['x','y','z'])point[k]-=normal[k]*nearest;
  // Remove interpolation roundoff at horizontal landing faces.
  if(normal.y===1)point.y=prop.y+prop.height+radius;
  return {t:enter,normal,point};
}
export function rayProps(origin,direction,props,range=LOOK.rayRange){
  const end={x:origin.x+direction.x*range,y:origin.y+direction.y*range,z:origin.z+direction.z*range};
  let best=null;
  for(const prop of props){const hit=sweepProp(origin,end,0,prop);if(hit&&(!best||hit.t<best.t))best={...hit,id:prop.id,distance:hit.t*range};}
  return best;
}
export const ambientStep=(time,dt,reduced)=>({time:reduced?time:time+dt,dt});
export function createImpactFeedback(){
  let last=0;
  return {reset(){last=0;},consume(event,audible){
    if(!event||event.id<=last)return null;last=event.id;
    const recipe=FEEDBACK[event.material];if(!recipe)return null;
    const strength=Math.min(1,Math.max(0,event.incomingNormalSpeed/LOOK.feedbackSpeed));
    return {...recipe,id:event.id,contactId:event.contactId,material:event.material,strength,gain:audible?LOOK.feedbackGain*strength:0};
  }};
}
export function feedbackPose(event,age,reduced){
  if(!event||age>=event.duration)return {scaleY:1,tint:0};
  const phase=Math.max(0,age/event.duration);
  return {scaleY:reduced?1:1-event.compression*event.strength*Math.sin(Math.PI*phase),tint:reduced?.06:0};
}
