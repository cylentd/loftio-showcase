// Per-tree size, crown shape and lean from a hash of the tree's position: same valley on every load.
import {TREE_SIZES,TREE_SIZE_SHARE,TREE_SHAPES,TREE_SHAPE_SHARE,TREE_WIDTH_FROM_HEIGHT,TREE_LEAN_MAX,TREE_HASH_SALT as SALT,TREE_HASH as HASH} from './tree-variety-data.mjs';

const hash01=(x,z,salt)=>{const s=Math.sin((x+salt)*HASH.x+(z-salt)*HASH.z)*HASH.amp;return s-Math.floor(s);};
const pick=(u,share)=>{let acc=0;const names=Object.keys(share);for(const n of names){acc+=share[n];if(u<acc)return n;}return names[names.length-1];};
const lerp=([a,b],t)=>a+(b-a)*t;

/** @returns {{size:string,shape:string,height:number,width:number,leanX:number,leanZ:number}} multipliers on the kind's own size */
export function treeVariety(x,z){
  const size=pick(hash01(x,z,SALT.size),TREE_SIZE_SHARE),shape=pick(hash01(x,z,SALT.shape),TREE_SHAPE_SHARE);
  const height=lerp(TREE_SIZES[size],hash01(x,z,SALT.within));
  const lean=(salt)=>(hash01(x,z,salt)*2-1)*TREE_LEAN_MAX;
  return {size,shape,height,width:TREE_SHAPES[shape]*Math.pow(height,TREE_WIDTH_FROM_HEIGHT),leanX:lean(SALT.leanX),leanZ:lean(SALT.leanZ)};
}
/** The scale and lean a tree's instance matrix and its fade ghost are both built from. */
export const treeMatrixParts=(v)=>({scale:{x:v.width,y:v.height,z:v.width},leanX:v.leanX,leanZ:v.leanZ});
/** Radius that stands for a stretched crown sphere (collision, fade): the geometric mean of its two scales. */
export const treeBulk=(v)=>Math.sqrt(v.width*v.height);
