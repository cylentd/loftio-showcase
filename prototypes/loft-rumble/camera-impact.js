(function(root){
  'use strict';
  const profiles=root.LoftRumbleCameraConfig.attackImpact;
  function trigger(state,id){
    if(!profiles[id])return false;
    state.attackShake={id,age:0};
    return true;
  }
  function tick(state,dt){
    const shake=state.attackShake;
    if(shake&&(shake.age+=dt)>=profiles[shake.id].duration)state.attackShake=null;
  }
  function offset(state,reduced){
    const shake=state.attackShake;
    if(!shake||reduced)return null;
    const profile=profiles[shake.id],progress=shake.age/profile.duration;
    const envelope=(1-progress)**2,phase=progress*Math.PI*2*profile.cycles;
    return shake.id==='slam'
      ?{x:Math.sin(phase)*profile.x*envelope,y:Math.cos(phase)*profile.y*envelope}
      :{x:Math.cos(phase)*profile.x*envelope,y:Math.sin(phase)*profile.y*envelope};
  }
  root.LoftRumbleAttackImpact=Object.freeze({trigger,tick,offset});
})(globalThis);
