(function(root){
  'use strict';
  const FIELDS=root.LoftRumbleReplayData.FIELDS;
  // Copies plain data (objects, arrays, numbers, strings) and keeps shared references for anything else (functions, images, DOM nodes,
  // class instances). `seen` keeps two fields that were one object one object, as `s.positions` and `s.bodies` are.
  // A long list of bare {x,y} points (a fling's predicted path) is only ever appended to or replaced, never edited in place, and it is
  // most of a snapshot's bytes. Snapshots of the same list at the same length share one copy.
  const TRAIL_KEEP=root.LoftRumbleReplayData.TRAIL_KEEP_POINTS;
  const SHARE_MIN=root.LoftRumbleReplayData.SHARE_MIN_POINTS;
  const shared=new WeakMap();
  const isPoint=p=>p!==null&&typeof p==='object'&&typeof p.x==='number'&&typeof p.y==='number'&&Object.keys(p).length===2;
  function sharedPath(value,seen){
    if(value.length<SHARE_MIN||canonical.has(value[0])||!isPoint(value[0])||!isPoint(value[value.length-1]))return null;
    const kept=shared.get(value);
    if(kept&&kept.length===value.length&&kept.last.x===value[value.length-1].x&&kept.last.y===value[value.length-1].y)return kept.copy;
    const out=copy(value,seen);
    shared.set(value,{length:value.length,last:{x:value[value.length-1].x,y:value[value.length-1].y},copy:out});
    return out;
  }
  function copy(value,seen,share){
    if(value===null||typeof value!=='object')return value;
    if(seen.has(value))return seen.get(value);
    if(Array.isArray(value)){
      if(share){const hit=sharedPath(value,seen);if(hit)return hit}
      const out=new Array(value.length);seen.set(value,out);for(let i=0;i<value.length;i++)out[i]=copy(value[i],seen,share);return out}
    const proto=Object.getPrototypeOf(value);
    if(proto!==Object.prototype&&proto!==null)return value;
    const out={};seen.set(value,out);
    for(const key in value)out[key]=copy(value[key],seen,share);
    return out;
  }
  // Structural sharing: like copy(), but where a value equals the previous snapshot's copy of it, returns that very object, so an
  // unchanged HUD field or an unchanged body costs no retained memory. Snapshots are never written to (apply() copies), so sharing is safe.
  function plain(value){const p=Object.getPrototypeOf(value);return p===Object.prototype||p===null}
  function copyShared(value,prev,seen){
    if(value===null||typeof value!=='object')return value;
    if(canonical.has(value))return value;
    if(seen.has(value))return seen.get(value);
    const isArr=Array.isArray(value);
    if(!isArr&&!plain(value))return value;
    if(isArr){const hit=sharedPath(value,seen);if(hit)return hit}
    const old=prev!==null&&typeof prev==='object'&&Array.isArray(prev)===isArr?prev:null;
    let same=old!==null,out;
    if(isArr){
      out=new Array(value.length);seen.set(value,out);
      if(old&&old.length!==value.length)same=false;
      for(let i=0;i<value.length;i++){const c=copyShared(value[i],old&&old[i],seen);out[i]=c;if(same&&c!==old[i])same=false}
    }else{
      out={};seen.set(value,out);let n=0;
      for(const key in value){const c=copyShared(value[key],old&&old[key],seen);out[key]=c;n++;if(same&&(!(key in old)||c!==old[key]))same=false}
      if(same&&Object.keys(old).length!==n)same=false;
    }
    if(same){seen.set(value,old);return old}
    return out;
  }
  // One painted frame: the fields of `s` that draw() reads, copied, with the fight time t.
  // `whole` keeps a field's full history (the live end state kept for exit); a recorded frame keeps only what draw() reads of it.
  // A path point is appended once and never edited, and the last TRAIL_KEEP of them are in every recorded frame: one copy per live point,
  // shared by every snapshot that holds it, instead of 28 fresh copies a frame.
  const pointCopies=new WeakMap(),canonical=new WeakSet();
  function canonicalPoint(p){
    if(!isPoint(p))return p;
    let c=pointCopies.get(p);
    if(!c){c={x:p.x,y:p.y};pointCopies.set(p,c);canonical.add(c)}
    return c;
  }
  // Particles are the biggest field: dozens of objects that change x, y and life every frame and nothing else. A recorded frame keeps
  // those three numbers per particle in one Float64Array and points at one shared copy of the rest (vx, vy, max, color, size, wall),
  // which a particle never changes. apply() builds ordinary particle objects again.
  const PARTICLE_MOVING=3,metaCopies=new WeakMap();
  const isPacked=v=>v!==null&&typeof v==='object'&&v.packedParticles===true;
  function packParticles(list){
    const xyl=new Float64Array(list.length*PARTICLE_MOVING),meta=new Array(list.length);
    for(let i=0;i<list.length;i++){
      const p=list[i];xyl[i*PARTICLE_MOVING]=p.x;xyl[i*PARTICLE_MOVING+1]=p.y;xyl[i*PARTICLE_MOVING+2]=p.life;
      let m=metaCopies.get(p);
      if(!m){m={};for(const key in p)if(key!=='x'&&key!=='y'&&key!=='life')m[key]=p[key];metaCopies.set(p,m)}
      meta[i]=m;
    }
    return {packedParticles:true,xyl,meta};
  }
  function unpackParticles(pack){
    const out=new Array(pack.meta.length);
    for(let i=0;i<out.length;i++)out[i]={x:pack.xyl[i*PARTICLE_MOVING],y:pack.xyl[i*PARTICLE_MOVING+1],life:pack.xyl[i*PARTICLE_MOVING+2],...pack.meta[i]};
    return out;
  }
  const packable=list=>Array.isArray(list)&&list.length>0&&list.every(p=>p!==null&&typeof p==='object'&&plain(p)&&typeof p.x==='number'&&typeof p.y==='number'&&typeof p.life==='number');
  function trimmed(scene){
    if(!scene||!scene.paths)return scene;
    const paths={};for(const id in scene.paths)paths[id]=scene.paths[id].slice(-TRAIL_KEEP).map(canonicalPoint);
    return {...scene,paths};
  }
  // A snapshot of ~85 fields costs about 2 KB of object even when almost all of them are unchanged, so a snapshot stores only the fields
  // that changed since the previous one (`own`) and a link to it; every KEYFRAME_EVERY-th snapshot stores all of them, which bounds the
  // chain a read walks. `snap.state` resolves the full state; the newest snapshot's is kept so recording never walks a chain.
  const KEY_EVERY=root.LoftRumbleReplayData.KEYFRAME_EVERY;
  const ABSENT=Object.freeze({});
  let latest={snap:null,full:null};
  function fullOf(snap){
    if(latest.snap===snap)return latest.full;
    const chain=[];for(let n=snap;n;n=n.prev)chain.push(n);
    const full={};
    for(let i=chain.length-1;i>=0;i--)for(const k in chain[i].own){if(chain[i].own[k]===ABSENT)delete full[k];else full[k]=chain[i].own[k]}
    return full;
  }
  // `previous` is the last recorded snapshot: unchanged parts of this one are shared with it.
  function take(s,t,whole,previous){
    const seen=new Map(),full={},own={},key=!previous||previous.depth>=KEY_EVERY-1,before=previous?fullOf(previous):{};
    for(const name of FIELDS){
      if(name in s){
        const v=name==='particles'&&!whole&&packable(s[name])?packParticles(s[name]):copyShared(name==='cameraScene'&&!whole?trimmed(s[name]):s[name],before[name],seen);
        full[name]=v;if(key||!(name in before)||before[name]!==v)own[name]=v;
      }else if(!key&&name in before)own[name]=ABSENT;
    }
    const snap={t,own:key?full:own,prev:key?null:previous,depth:key?0:previous.depth+1,get state(){return fullOf(this)}};
    latest={snap,full};
    return snap;
  }
  // Writes a snapshot back into `s` for one draw. Copies again, so drawing never changes the recording; a field the snapshot lacks is removed.
  function apply(s,snap){
    const seen=new Map(),state=snap.state;
    for(const name of FIELDS){if(name in state)s[name]=isPacked(state[name])?unpackParticles(state[name]):copy(state[name],seen);else delete s[name]}
  }
  root.LoftRumbleReplaySnapshot=Object.freeze({take,apply});
})(globalThis);
