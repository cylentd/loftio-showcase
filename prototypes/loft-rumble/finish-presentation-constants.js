(function(root){
  'use strict';
  // 419/420 design: 100ms impact, then a continuous deceleration to rest within 3000ms.
  // The integrated speed envelope peaks below .3 of captured speed; no physics runs.
  const IMPACT_MS=100;
  const FOLLOW_MS=2600;
  const HOLD_MS=3000;
  const MILLISECONDS=1000;
  // Presentation tuning retained from the reviewed cinematic captures.
  const SPEED=.28;
  const RAMP_MS=160;
  const SETTLE_POWER=3;
  const ROTATION_PER_PIXEL=.008;
  const SHADOW_ALPHA=.2;
  const SHADOW_HEIGHT=.25;
  const PARTICLE_SIZE=3;
  const RING_SIZE=25;
  const BEAM_WIDTH=6;
  const RECOIL=12;
  const HALF=.5;
  root.LoftRumbleFinishConstants=Object.freeze({
    impactMs:IMPACT_MS,followMs:FOLLOW_MS,holdMs:HOLD_MS,milliseconds:MILLISECONDS,
    speed:SPEED,rampMs:RAMP_MS,settlePower:SETTLE_POWER,rotationPerPixel:ROTATION_PER_PIXEL,
    shadowAlpha:SHADOW_ALPHA,shadowHeight:SHADOW_HEIGHT,particleSize:PARTICLE_SIZE,ringSize:RING_SIZE,
    beamWidth:BEAM_WIDTH,recoil:RECOIL,half:HALF,
  });
})(globalThis);
