// Root snap: the boss punishes a resident parked beside it. Camera experiment only. The owner's playtests (2026-11-10) saw the hit
// combo break 0 or 1 times in five fights, because a resident could sit next to the boss and be relaunched into it at no risk.
// A resident resting within the ring for parkTime draws a warning ring; at the end of the warning every resident still resting in
// it hurts the team, breaks the combo and is knocked clear. Pure timer and geometry here; the game applies the damage.
(function(root){
  'use strict';
  const settings={
    // All untuned first guesses (owner brief, 2026-11-10); none has been played yet.
    range:40,        // units past the boss radius that count as parked beside it
    parkTime:2,      // seconds a resident must rest inside the ring before the boss warns
    warnTime:.8,     // seconds the ring shows before it snaps
    cooldown:3,      // seconds after a snap before the park timer can start again
    knockSpeed:360,  // units a second the knocked resident leaves at
    slide:120,       // units it slides before it rests again (the glide budget)
  };
  const initial=()=>({park:0,warn:null,cool:0});
  const ring=bossRadius=>bossRadius+settings.range;
  // Residents resting (not in flight) with their centre inside the ring.
  function resting(bodies,boss,bossRadius){
    return bodies.filter(body=>!body.moving&&Math.hypot(body.x-boss.x,body.y-boss.y)<=ring(bossRadius)).map(body=>body.id);
  }
  // One step of the clock. Returns 'warn' when the ring appears, 'snap' when it lands, else null. `parked` is whether any
  // resident is resting inside the ring now. The warning runs to its end even if everyone leaves; the snap hits whoever is in.
  function tick(state,dt,parked){
    if(state.warn!==null){
      state.warn-=dt;
      if(state.warn>0)return null;
      state.warn=null;state.park=0;state.cool=settings.cooldown;
      return 'snap';
    }
    if(state.cool>0){state.cool=Math.max(0,state.cool-dt);return null}
    if(!parked){state.park=0;return null}
    state.park+=dt;
    if(state.park<settings.parkTime)return null;
    state.park=0;state.warn=settings.warnTime;
    return 'warn';
  }
  // Velocity straight away from the boss centre. A resident dead on the centre goes along +x.
  function knock(body,boss){
    const dx=body.x-boss.x,dy=body.y-boss.y,distance=Math.hypot(dx,dy);
    if(!distance)return {vx:settings.knockSpeed,vy:0};
    return {vx:dx/distance*settings.knockSpeed,vy:dy/distance*settings.knockSpeed};
  }
  root.LoftRumblePunish={settings,initial,ring,resting,tick,knock};
})(globalThis);
