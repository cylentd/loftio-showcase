// Pure motion curves for the code-built neighbours. No Three, no DOM, no clock: time comes in as an argument.
const TAU=2*Math.PI;
/** An angle folded into [-PI, PI]. */
const wrap=a=>a-TAU*Math.round(a/TAU);
const clamp=(x,lo,hi)=>Math.min(hi,Math.max(lo,x));

/** 0 open, 1 shut. A triangle that peaks halfway through each blink, once per period. */
export function blink(t,period,duration){
 const p=t%period;if(p>=duration)return 0;
 return 1-Math.abs(2*p/duration-1);
}
/** A slow breath or jiggle: height grows by `amount`, width shrinks by half of it, so the body keeps its bulk. */
export function squashStretch(t,period,amount){
 const s=Math.sin(TAU*t/period);
 return {y:1+amount*s,xz:1-amount*s/2};
}
/** One hop: a ballistic arc of `height`, stretched by `squash` at the top and squashed by it on the ground. */
export function hopShape(phase,height,squash){
 const p=phase-Math.floor(phase),lift=4*height*p*(1-p);
 return {lift,y:1+squash*(2*lift/height-1)};
}
/** Head where it travels, but never more than `maxOff` away from the camera, so its face stays in view. */
export function faceYaw(travel,toCamera,maxOff){
 return toCamera+clamp(wrap(travel-toCamera),-maxOff,maxOff);
}
/** One frame of turning: the short way round, at most `maxStep` radians. */
export function turnToward(from,to,maxStep){
 return from+clamp(wrap(to-from),-maxStep,maxStep);
}
