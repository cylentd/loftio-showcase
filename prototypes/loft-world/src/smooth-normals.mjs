// Smooth shading for a triangle soup (three floats per vertex, three vertices per face): vertices at the same
// position share one normal, the area-weighted average of every face that touches them.
import {ROCK_SMOOTH} from './rock-look-data.mjs';

const key=(p,i)=>`${Math.round(p[i]*ROCK_SMOOTH.weld)},${Math.round(p[i+1]*ROCK_SMOOTH.weld)},${Math.round(p[i+2]*ROCK_SMOOTH.weld)}`;
export function smoothNormals(p){
  const sums=new Map(),faceN=[];
  for(let f=0;f<p.length;f+=9){
    const ux=p[f+3]-p[f],uy=p[f+4]-p[f+1],uz=p[f+5]-p[f+2],vx=p[f+6]-p[f],vy=p[f+7]-p[f+1],vz=p[f+8]-p[f+2];
    const n=[uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];faceN.push(n);
    for(let k=0;k<9;k+=3){const id=key(p,f+k),s=sums.get(id)??[0,0,0];sums.set(id,[s[0]+n[0],s[1]+n[1],s[2]+n[2]]);}
  }
  const out=new Float32Array(p.length);
  for(let i=0;i<p.length;i+=3){const s=sums.get(key(p,i)),len=Math.hypot(...s)||1;out[i]=s[0]/len;out[i+1]=s[1]/len;out[i+2]=s[2]/len;}
  return out;
}
