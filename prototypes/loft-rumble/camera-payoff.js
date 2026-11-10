// Combo payoff: a hit does more damage the longer the hit combo, for a resident's own hit and for ability damage alike, so a
// one-big-hit ability cashes in a combo that many-small-hit ones built. Camera experiment only (owner brief 2026-11-09); the main
// game keeps its rule that the combo changes charge rate, never damage. The numbers are to tune with boss HP and fight length.
(function(root){
  'use strict';
  const settings=Object.freeze({
    full:200,                // hits where the payoff peaks: about a perfect two-minute fight (owner, 2026-11-09)
    peak:3,                  // damage multiple at that point. The owner's range is 3x to 4x; bounce (2x) and weak spot (3x) multiply on top
    peakMin:1,peakMax:4,     // the Camera lab slider's range. 1 switches the payoff off
  });
  let top=settings.peak;
  function peak(value){
    if(value===undefined)return top;
    const next=Number(value);
    if(!(next>=settings.peakMin&&next<=settings.peakMax))throw new RangeError(`Payoff peak must be from ${settings.peakMin} to ${settings.peakMax}`);
    return top=next;
  }
  const multiplier=hits=>1+(top-1)*Math.min(1,Math.max(0,hits)/settings.full);
  root.LoftRumblePayoff={settings,peak,multiplier};
})(globalThis);
