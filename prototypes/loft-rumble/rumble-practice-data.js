// Loft Rumble practice: the numbers and words for the five-beat safe practice and the battle cue rail.
// Behaviour lives in rumble-practice.js; DOM in rumble-practice-view.js. Spec: docs/product/LOFT-RUMBLE-LEARNABILITY.md.
(function(root){
  'use strict';
  root.LoftRumblePracticeData=Object.freeze({
    storageKey:'loftRumbleLearnability',  // versioned record {version,status,step}; never touches other keys
    version:1,                             // bump when the record shape changes; an unknown version reads as no record
    statuses:Object.freeze(['incomplete','completed','skipped']),
    steps:Object.freeze(['gesture','ordinary','weak','special','beam']), // spec, "Recommended sequence"
    specialResident:'custom',              // the special beat lends this resident (Puff, the selected resident) a full portrait
    regrantDelay:1.5,                      // sim seconds a missed practice special waits at rest before the portrait refills
    beamReadTime:1.5,                      // sim seconds between entering the Beam beat (or a caught retry) and the lane showing, on top of RT.telegraph
    cueLife:3,                             // real seconds an event cue (hit, teammate, special effect, attack outcome) stays up
    eventCueMax:2,                         // event cues shown at once, newest first; danger, stun and readiness always show
    countdownDigits:1,                     // decimals in the danger countdown
    copy:Object.freeze({
      panelLabel:'Practice',
      badge:'Practice: no damage',
      progress:'Step {n} of {total}',
      title:Object.freeze({gesture:'Sling',ordinary:'Keep slinging',weak:'Weak spot',special:'Special',beam:'Dodge',done:'Practice done',resume:'Practice'}),
      instruction:Object.freeze({
        gesture:'Pull away from Bramble, then release toward him. Short pulls work too.',
        ordinary:'Keep slinging while they move. A quick shot into Bramble or a teammate counts.',
        weak:'Gold spot: extra damage. Try it, or skip ahead.',
        special:'Hits charge {name}. Practice filled {name}’s portrait: sling {name} into Bramble to fire {special}.',
        specialMissed:'Missed, so no special damage. {name}’s portrait refills in a moment.',
        beam:'Bramble keeps attacking while you aim. When the Beam lane shows, sling the resident in it clear.',
        beamRetry:'Caught, but practice does no damage. Another Beam is coming.',
        done:'Clean dodge. Finish practice to start the real fight.',
        resume:'You left practice partway. Pick up where you stopped?'
      }),
      skipPractice:'Skip practice',
      skipWeak:'Skip weak spot',
      skipSpecial:'Skip special',
      finish:'Finish practice',
      resume:'Continue practice',
      replay:'Replay practice',
      live:'Practice over. Attacks now hurt.',
      protectedFly:'No damage',
      and:' and ',
      listSep:', ',
      confirm:Object.freeze({
        title:'Restart practice?',
        body:'This restarts the current battle and begins practice at step 1.',
        accept:'Restart practice',
        cancel:'Cancel'
      }),
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
        rootSafe:'Root snap caught {names}: practice, no damage',
        rootLive:'Root snap caught {names}: {amount} team damage',
        caughtSafe:'{attack} caught {names}: practice, no damage',
        caughtLive:'{attack} hit {names}: {amount} team damage, stunned',
        teamSafe:'{attack} hit the team: practice, no damage',
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
