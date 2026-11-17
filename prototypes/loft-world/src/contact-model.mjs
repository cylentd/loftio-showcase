import {TRAVERSAL as T,MATERIALS} from './traversal-constants.mjs';
const ZERO={x:0,y:0,z:0};
export function impulse(velocity,normal,material,targetVelocity=ZERO) {
  const p=MATERIALS[material];
  if(!p)throw new Error(`Unknown contact material: ${material}`);
  const r={x:velocity.x-targetVelocity.x,y:velocity.y-targetVelocity.y,z:velocity.z-targetVelocity.z};
  const vn=r.x*normal.x+r.y*normal.y+r.z*normal.z;
  const incomingNormalSpeed=Math.max(0,-vn),outgoing={...velocity};
  if(vn<0) {
    for(const k of ['x','y','z'])outgoing[k]=targetVelocity[k]+(r[k]-vn*normal[k])*p.tangent-vn*p.restitution*normal[k];
    if(p.lift&&incomingNormalSpeed>=T.contactSpeed)outgoing.y=Math.max(outgoing.y,p.lift);
  }
  const speed=Math.hypot(outgoing.x,outgoing.y,outgoing.z),cap=p.cap??T.responseMax;
  if(speed>cap)for(const k of ['x','y','z'])outgoing[k]*=cap/speed;
  return {incomingNormalSpeed,outgoing};
}
/** Swept point versus expanded sphere. Starting overlaps report their current normal. */
export function sweepSphere(from,to,center,radius) {
  const o={x:from.x-center.x,y:from.y-center.y,z:from.z-center.z};
  const d={x:to.x-from.x,y:to.y-from.y,z:to.z-from.z};
  const a=d.x*d.x+d.y*d.y+d.z*d.z,b=o.x*d.x+o.y*d.y+o.z*d.z;
  const c=o.x*o.x+o.y*o.y+o.z*o.z-radius*radius;
  if(c<=0&&b>=0&&Math.hypot(to.x-center.x,to.y-center.y,to.z-center.z)>radius)return null;
  let t=0;
  if(c>0) {const disc=b*b-a*c;if(!a||disc<0)return null;t=(-b-Math.sqrt(disc))/a;if(t<0||t>1)return null;}
  const normal={x:o.x+d.x*t,y:o.y+d.y*t,z:o.z+d.z*t};
  const length=Math.hypot(normal.x,normal.y,normal.z);
  if(!length)return null;
  for(const k of ['x','y','z'])normal[k]/=length;
  return {t,normal,point:{x:center.x+normal.x*radius,y:center.y+normal.y*radius,z:center.z+normal.z*radius}};
}
