(function(root){
  'use strict';
  root.LoftRumbleWhiplashData=Object.freeze({
    id:'whiplash',events:Object.freeze({tick:'tick'}),phases:Object.freeze({done:'done'}),
    // Owner round 3: visible sweep on the authoritative clock; damage onset and dodge lead unchanged.
    // Owner 2026-11-18 anime round: slow build, fast hit (strike 0.5 -> 0.22 s, eased in).
    prepare:0.45,telegraph:1.8,strike:0.22,recover:0.6,
    rearAngle:5*Math.PI/6, // owner 2026-11-18: bigger safe area (90 -> 150 degrees)
    totalDamage:12,rosterSize:3,
    geometryEpsilon:1e-9,clockEpsilon:1e-12,
    // Contact precision in arena pixels/eligible seconds; conservative angular bound, three convex warning wedges.
    contactTolerance:.05,contactTimeTolerance:1e-6,speedSafety:2,rigMargin:200,sectorSlices:3,
    nearestSlack:1e-9 // relative margin on the squared-distance prefilter in distance(): far above a double's rounding step, far below contactTolerance
  });
})(globalThis);
