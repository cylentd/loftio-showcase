// The drawn shape of a route rock: a rounded boulder profile, not the collision hull. Positions are local to the
// rock (x,z around its foot, y from the ground). It stays inside the hull and its top is the landing height.
import {ROCK_DOME} from './rock-look-data.mjs';

const hash=(x,z,salt)=>{const s=Math.sin(x*ROCK_DOME.hashX+z*ROCK_DOME.hashZ+salt)*ROCK_DOME.hashAmp;return s-Math.floor(s);};
/** Triangle list of three floats per vertex, three vertices per face. d: a ROUTE rock {x,z,r,height,base}. */
export function rockDome(d){
  const N=ROCK_DOME.sides,P=ROCK_DOME.profile,ph=[hash(d.x,d.z,1)*6.28,hash(d.x,d.z,2)*6.28];
  const grid=[];
  for(const [fh,fr] of P){
    const ring=[];
    for(let i=0;i<N;i++){
      const a=i/N*Math.PI*2,wob=1-ROCK_DOME.wobble*(0.5+0.25*Math.sin(a*3+ph[0])+0.25*Math.sin(a*5+ph[1])),r=d.r*fr*wob;
      ring.push([Math.cos(a)*r,d.base+(d.height-d.base)*fh,Math.sin(a)*r]);
    }
    grid.push(ring);
  }
  const out=[],tri=(a,b,c)=>out.push(...a,...b,...c),top=[0,d.height,0],foot=[0,d.base,0];
  for(let k=0;k<grid.length-1;k++)for(let i=0;i<N;i++){
    const j=(i+1)%N,a=grid[k][i],b=grid[k][j],c=grid[k+1][j],e=grid[k+1][i];
    tri(a,c,b);tri(a,e,c);
  }
  for(let i=0;i<N;i++){const j=(i+1)%N;tri(top,grid.at(-1)[j],grid.at(-1)[i]);tri(foot,grid[0][i],grid[0][j]);}
  return new Float32Array(out);
}
