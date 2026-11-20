// Owner 2026-11-18 anime round: pure strike-effect timing. Render-only; never touches the eligible clock, damage or contact.
(function(root){
  'use strict';
  const look=root.LoftRumbleWhiplashLook,ease=root.LoftRumbleWhiplashPose.ease;
  const mix=(a,b,k)=>a+(b-a)*k;
  // Crescent behind the bark: from the swing start to the current angle, then a fading tail after the swing.
  function smear(p,reduced){
    if(!p)return null;
    const strike=p.phase==='strike',tail=p.phase==='recover'&&p.phaseElapsed<look.smearFade;
    if(!strike&&!tail)return null;
    if(reduced)return {from:p.startAngle,to:p.endAngle,alpha:look.smearReducedAlpha};
    if(tail)return {from:p.startAngle,to:p.endAngle,alpha:1-p.phaseElapsed/look.smearFade};
    return {from:p.startAngle,to:mix(p.startAngle,p.endAngle,ease(p.phaseElapsed/p.phaseDuration)),alpha:1};
  }
  function speedLines(p,reduced){return !reduced&&p?.phase==='strike'?look.speedLineCount:0;}
  // Latest contact still inside its hit-stop window freezes the drawn pose at that contact.
  function frozenElapsed(contacts,elapsed,reduced){
    if(reduced||!contacts)return elapsed;
    let frozen=-Infinity;
    for(const c of Object.values(contacts)){const age=elapsed-c.shownAt;if(age>=0&&age<look.hitStop)frozen=Math.max(frozen,c.shownAt);}
    return Number.isFinite(frozen)?frozen:elapsed;
  }
  function flash(age,reduced){
    const frames=reduced?look.reducedFlashFrames:look.flashFrames;
    // Half a frame of margin so frame N lands inside the window and frame N+1 outside it.
    return age>=0&&age<(frames-look.flashMargin)*look.frameTime?1:0;
  }
  function shake(contacts,elapsed,reduced){
    if(reduced||!contacts)return 0;
    const first=Math.min(...Object.values(contacts).map(c=>c.shownAt)),age=elapsed-first;
    return Number.isFinite(age)&&age>=0&&age<look.shakeLife?look.shakeAmplitude*(1-age/look.shakeLife):0;
  }
  // Windup charge 0..1 across the telegraph; full during the strike.
  function charge(p){
    if(!p)return 0;
    if(p.phase==='telegraph')return Math.min(1,p.phaseElapsed/p.phaseDuration);
    return p.phase==='strike'?1:0;
  }
  root.LoftRumbleWhiplashFx=Object.freeze({smear,speedLines,frozenElapsed,flash,shake,charge});
})(globalThis);
