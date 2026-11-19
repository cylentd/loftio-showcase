// Look defaults: deliberately bounded support, awaiting owner feel approval.
export const TEAM = {
  // boost raised from 20 (2026-11-17): his bump should carry you clearly higher, about 16 units
  delay:.22, boost:27, approachSpeed:36, approachTime:.75, recoverTime:.35,
  below:1.8, contact:.9, followSpeed:8.5, followRange:45, stopGap:1.6, // slower and less fussy: he no longer shuffles to an exact spot
  followGain:1.5, slotBack:2.5, slotSide:1.7, // the follow leash is the island's shore now (companion-model.mjs, shore.mjs)
  poseSpeed:.5, dizzyTime:.35, frameSize:640, baseline:608,
  approachClearance:.3, // Keep the approach above terrain when the second press is early.
  minStep:.001, historyLimit:32, recoverCarry:.5, // Numerical floor, bounded debug history, soft departure.
};
// Angle chain payoff (owner, 2026-11-18): a hit from a new side lands heavier and re-arms F. No hold, no time scaling.
// payoffShake/payoffPop: above an ordinary hit's .7 shake/pop, capped at the camera's 1.0 maximum.
export const CHOMP_COMBO={spitPop:.6,spitPuff:14,payoffShake:1,payoffPop:1,payoffBurst:28,frameLean:.55,frameTurn:6,color:'#ffd0f0',
  counterColor:'#ffe27a', // a counter hit adds a gold burst, the weak spot's colour, so a timed F reads apart from a plain link
  // the payoff's bursts: each one's speed and up (toys.burst's last two arguments)
  payoffSpeed:14,payoffUp:6, coreColor:'#ffe6a0',coreSpeed:10,coreUp:4, counterSpeed:18,counterUp:9,
  blinkOut:5,blinkIn:8}; // blink puffs: 5 matches his catch-up poof, the arrival a little bigger so you see where he went
// Counter cue (owner, 2026-11-18: attacks were hard to read): gold sparks over a monster's head while F would counter it.
// Gold matches the counter-hit burst and the weak spot. above 1.5 radii clears the ears; size .9 radii reads at bank range (30).
// pulse ±20% at 14 rad/s (about 2 beats a second) says "now" without strobing; reduced motion holds it steady.
export const COUNTER_CUE={color:'#ffe27a',above:1.5,size:.9,pulse:.2,pulseRate:14,opacity:.95,canvas:128,strokes:3,stroke:10,
  fan:Math.PI/5, // 36 degrees between strokes, so three fan over a 72-degree arc
  base:.85, // strokes start from 85% down the canvas and rise
  zig:[[.2,0],[.42,.05],[.5,-.05],[.72,0]]}; // one stroke's lightning kink: [distance out, sideways offset], canvas fractions
// Chomper flank zip (owner, 2026-11-18): Space goes up, F goes around. F slings Sprout around the enemy to its
// back (a floater's top), where the weak spot is, and leaves the hit to you.
// gap 4: the circle sits this far outside the body. step 30 degrees: a chord dips only 3.4% inside the circle,
// under a unit even for the giant (radius 15.6). speed 48: a Grumble half-lap (~28 units) in about .6 s, the
// giant's (~61) in 1.3 s. maxTime 2.2 caps a giant lap plus the run-in. exitLift 8: a small hop at the end, so
// Sprout hangs long enough to aim instead of dropping.
export const ZIP={gap:4,step:Math.PI/6,speed:48,reach:1.5,maxTime:2.2,exitLift:8};
// Comet: pink afterimages behind Sprout during a zip. One every 25 ms over a .85 s climb is ~34 drops;
// a .3 s life keeps about 12 on screen, so 12 slots never overwrite a visible one.
export const COMET={count:12,every:.025,life:.3,size:1.8,color:'#ffb3e6'};
export const CHOMPER_BANK={range:30,approachTime:.85,approachSpeed:60,sideGap:1.7,below:.85,contact:1.05,strikeTime:.85,minHeadingSpeed:2,
  // a Chomper farther than range blinks to this far from Sprout on F (owner, 2026-11-18: big monsters left him
  // behind); 8 at approachSpeed 60 is about .13 s of approach, so the bank still feels instant
  blinkGap:8};
