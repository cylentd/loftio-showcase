// Loft Rumble battle cue rail: the numbers and words of the cues that name each actor, cause and result.
// Behaviour lives in rumble-cues.js; DOM in rumble-cues-view.js. Spec: docs/product/LOFT-RUMBLE-LEARNABILITY.md.
(function(root){
  'use strict';
  root.LoftRumbleCuesData=Object.freeze({
    cueLife:3,                             // real seconds an event cue (hit, teammate, special effect, attack outcome) stays up
    eventCueMax:2,                         // event cues in the hidden live region at once, newest first; readiness always joins them
    alertMax:1,                            // lines on screen: the soonest danger, else a stun (owner's option a, 2026-11-13)
    countdownDigits:1,                     // decimals in the danger countdown
    copy:Object.freeze({
      protectedFly:'No damage',            // the team-bar fly-up while an attack costs nothing (Training)
      and:' and ',
      listSep:', ',
      cue:Object.freeze({
        rail:'Battle cues',
        live:'Battle news',
        hit:'{actor} {kind} hit: {amount} damage to Bramble',
        bodyKind:'body',
        weakKind:'weak spot ×3',
        ally:'{actor} bumped {ally}: {ability} hit Bramble for {amount}',
        allyLaunch:'{actor} bumped {ally}: {ability} fired',
        ready:'{name} {special} ready: next sling {effect}',
        effect:'{name} {special}: {effect}',
        stun:'{names} stunned for {seconds} s',
        danger:'{attack} on {names} in {seconds} s: move out',
        dangerNow:'{attack} on {names} now: move out',
        dangerTeam:'{attack} in {seconds} s: hits the whole team',
        dangerTeamNow:'{attack} now: hits the whole team',
        dangerClear:'{attack} in {seconds} s: everyone is clear',
        root:'Root snap on {names}: move away from Bramble',
        rootLive:'Root snap caught {names}: {amount} team damage',
        caughtLive:'{attack} hit {names}: {amount} team damage, stunned',
        teamLive:'{attack} hit the team: {amount} team damage',
        clear:'{attack} dodged: {names} got clear',
        missed:'{attack} missed everyone'
      }),
      effect:Object.freeze({
        springy:'goes faster and farther',
        heavy:'adds +{amount} on impact',
        piercing:'adds +{amount} piercing damage'
      }),
      launchEffect:Object.freeze({springy:'faster and farther this sling'})
    })
  });
})(globalThis);
