// Loft Rumble hit feel: the named numbers behind the hit-stop gate and the shake model (rumble-feel.js). Owner decision 2026-11-21,
// studies/boss-lag.md option (a): at most one hit-stop per window, and a shake that eases out along the hit instead of jumping.
(function(root){
  // Hit-stop gate. A stop that would start less than this many seconds of fight time after the last stop started arms nothing.
  // 0.25 s is the owner's number (study fix 1). Fight time is s.time, which freezes during a stop.
  const STOP_WINDOW=.25;
  // Shake: one damped sine along the hit's direction. offset = amp * exp(-age/DECAY) * sin(2*pi*FREQ*age), so it starts at 0 and never jumps.
  // DECAY: seconds, the e-folding time. 0.10 s sits just above the old per-frame decay (FEEL.shakeDecay 0.09 in the page), so a hit shakes
  // for about as long as before (under 0.4 s to the 0.2 px cut-off) but with a visible direction.
  const SHAKE_DECAY=.10;
  // FREQ: hertz. Chosen so one event moves at most SHAKE_STEP_SHARE of its amplitude between two 60 fps frames: 2*pi*6/60 = 0.63.
  // A faster sine would again look like a jump every frame, which is what the old random offset did.
  const SHAKE_FREQ=6;
  // The frame-to-frame bound the test holds one event to, as a share of its amplitude at 60 fps (2*pi*SHAKE_FREQ/60 rounded up).
  const SHAKE_STEP_SHARE=.65;
  // Events quieter than this many px are dropped; same cut-off as the page's old `if(s.shake<.2)s.shake=0`.
  const SHAKE_FLOOR=.2;
  // Where the soft cap starts, as a share of the cap. Below it the offset is the plain sum; above it tanh eases up to the cap,
  // with a matching slope at the knee so there is no kink.
  const SHAKE_KNEE=.75;
  // Direction for an event that has none: the golden angle in radians (pi*(3-sqrt 5)), so successive events never repeat a direction.
  // Counted, not random, so a replay reproduces it.
  const GOLDEN_ANGLE=2.399963229728653;
  root.LoftRumbleFeelData=Object.freeze({STOP_WINDOW,SHAKE_DECAY,SHAKE_FREQ,SHAKE_STEP_SHARE,SHAKE_FLOOR,SHAKE_KNEE,GOLDEN_ANGLE});
})(globalThis);
