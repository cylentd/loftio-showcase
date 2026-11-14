// Loft Rumble battle cue rail: the numbers and words of the cues that name each actor, cause and result.
// Behaviour lives in rumble-cues.js; DOM in rumble-cues-view.js. Spec: docs/product/LOFT-RUMBLE-LEARNABILITY.md.
(function(root){
  'use strict';
  root.LoftRumbleCuesData=Object.freeze({
    cueLife:3,                             // real seconds an event cue (hit, teammate, special effect, attack outcome) stays up
    eventCueMax:2,                         // event cues in the hidden live region at once, newest first; readiness always joins them
    alertMax:1,                            // sentences in the hidden alert list: the soonest danger, else a stun (option a, 2026-11-13; off screen since 2026-11-14)
    countdownDigits:1,                     // decimals in the danger countdown
    // Field cues (owner, 2026-11-14): where they sit over a resident, in logical arena px above its centre.
    field:Object.freeze({
      markerLift:58,                       // the target marker's tip: over camera-stun's stars (lift 34) and clear of the 46 px sprite's head
      spiralLift:34,                       // the stun spiral circles where LoftRumbleCameraConfig.stun.lift puts the code stars
      wordLift:44,                         // a word pop's foot: above the damage number, which pops one popupSize (20) over the hit and is about as tall
      markerFlash:1,                     // seconds before impact the marker switches to its flash cell (the prompt's second state)
      plate:Object.freeze({weak:'stickerPerfect',dodge:'stickerGreat',combo:'stickerGreat'}),  // gold for the weak spot (the gold rule), steel for a dodge or a combo
      cells:Object.freeze({targetMarker:2,stunSpiral:3})                // states or frames side by side in each sheet, per its prompt
    }),
    // Moments: a cut-in, a READY stamp or a word pop. One on screen at a time (owner's brief, 2026-11-14).
    moment:Object.freeze({
      wait:.5,                             // a moment that cannot show within this many real seconds is dropped, not queued (the brief's ~0.5 s)
      cutin:.8,                            // ally cut-in, slide in and out included: the brief caps it under 1 s
      ready:.7,                            // READY stamp on a dock portrait
      word:.7                              // one-word pop at the event, the length of the old Great/Perfect pop
    }),
    // Owner-generated art (LOFT-RUMBLE-ASSET-PROMPTS.md, feedback batch). Missing files show nothing in their place.
    art:Object.freeze({
      targetMarker:'art/rumble_target_marker.webp',   // two cells: idle, flash
      stunSpiral:'art/rumble_stun_spiral.webp',       // three frames, a third of a turn apart
      stickerGreat:'art/rumble_sticker_great.webp',
      stickerPerfect:'art/rumble_sticker_perfect.webp'
    }),
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
      launchEffect:Object.freeze({springy:'faster and farther this sling'}),
      // Words on the field: names and single words only, never a sentence (owner, 2026-11-14).
      field:Object.freeze({
        rootSnap:'Root snap',              // the close-range danger's name at the boss bar
        ready:'READY',
        // weak: {multiplier} is the battle's weak-spot multiplier. combo: one word per FEEL.comboMilestones entry, in order.
        word:Object.freeze({weak:'WEAK ×{multiplier}',dodge:'DODGED',combo:Object.freeze(['NICE','GREAT','RUMBLE'])})
      })
    })
  });
})(globalThis);
