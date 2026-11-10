// Springy seek: off each wall, a Springy resident turns part of the way toward the boss. Camera experiment only. The owner's
// fights (2026-11-10) had a Springy landing about 1.3 hits a launch, barely more than a Heavy hitter's 0.9 and each worth half as
// much: "he flies everywhere but doesn't hit much". The turn is capped so the launch angle still decides the route.
(function(root){
  'use strict';
  const settings=Object.freeze({
    // The most a wall bounce may turn the path toward the boss. Owner's pick after playing 15 and 25 (2026-11-10). Hits a launch
    // over 48 unaimed launches: 0.73 with seek off, 1.21 at 15, 1.96 at 25, 2.35 at 45.
    degrees:25,
    min:0,max:45,    // the slider's range. 0 switches seek off
    halfTurn:180,
  });
  let limit=settings.degrees;
  function cap(value){
    if(value===undefined)return limit;
    const next=Number(value);
    if(!(next>=settings.min&&next<=settings.max))throw new RangeError(`Springy seek must be from ${settings.min} to ${settings.max} degrees`);
    return limit=next;
  }
  // (vx,vy) is the velocity just after the bounce; (dx,dy) points from the resident to the boss. Returns the turned velocity.
  function turn(vx,vy,dx,dy){
    const speed=Math.hypot(vx,vy);
    if(!speed||!Math.hypot(dx,dy)||!limit)return {vx,vy};
    const heading=Math.atan2(vy,vx),wanted=Math.atan2(dy,dx),most=limit*Math.PI/settings.halfTurn;
    const off=Math.atan2(Math.sin(wanted-heading),Math.cos(wanted-heading)),angle=heading+Math.max(-most,Math.min(most,off));
    return {vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed};
  }
  root.LoftRumbleSeek={settings,cap,turn};
})(globalThis);
