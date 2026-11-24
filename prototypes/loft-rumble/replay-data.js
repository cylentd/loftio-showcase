(function(root){
  'use strict';
  // Fight replay constants (owner request 2026-11-15; brief 2026-11-21). Behaviour lives in replay-model.js, replay-snapshot.js and replay-runtime.js.
  // Longest recording kept: 2:30 of fight, the owner's figure for a long Rumble fight (a full Bramble fight plus its finish).
  const CAP_SECONDS=150;
  // Snapshots per second of fight (not one per painted frame). 30: playback shows each snapshot for two frames on a 60 Hz screen. At 60 the recording was 163.5 MB
  // of heap for 2:30 (unit B, 2026-11-21), 42 MB after structural sharing, trimmed paths, packed particles and delta snapshots, and
  // about 26 MB at 30 (measured below). The fidelity test compares live and replayed draw calls on the recorded frames only.
  const RATE=30;
  // Retained heap per frame of a busy fight (7 s, three flung residents, JSON length of what a snapshot kept as new objects, unit C 2026-11-21):
  // particles ~8.6 KB (44 particles; x, y, life move each frame), cameraScene ~4.2 KB (28-point trails of 3 bodies), bodies ~1.2 KB,
  // attackFx 0.2 KB, popups 0.2 KB. Every other field is under 0.15 KB, but a snapshot holding all ~85 fields costs ~2 KB as an object.
  // Cuts, in order: unchanged parts reuse the previous snapshot's objects; each path point is copied once; particles keep x, y, life in
  // one Float64Array and share their other fields; a snapshot stores only changed fields (keyframe every KEYFRAME_EVERY).
  // Heap measured with Chromium --enable-precise-memory-info --js-flags=--expose-gc, gc() before each read, 9000 frames (2:30 at 60/s
  // played): 163.5 MB before; 136 MB with sharing alone; 42.3 MB at 60/s with all four cuts; 26.7 MB at 30/s (4500 snapshots, 21.6 MB over the
  // 5.1 MB page baseline). Under the 30 MB limit. take() cost was 0.01-0.02 ms before these cuts and is not re-measured here.
  const FALLBACK_RATE=30;
  // Limits from the unit brief: a full 2:30 recording under 30 MB, take() under 0.3 ms on a desktop.
  const MAX_BYTES=30*1024*1024;
  const MAX_TAKE_MS=0.3;
  // A frame is kept when it is at least this share of the recording interval after the last kept one, so a 60 Hz screen's 16.6 ms jitter never skips one.
  const KEEP_SHARE=.9;
  // A list of at least this many bare {x,y} points (a fling's predicted path) is shared between snapshots while it is unchanged; shorter lists are copied.
  const SHARE_MIN_POINTS=8;
  // A body's path history grows all fight (camera-config pathLimit 960), but the trail painter reads its last trailSamples points,
  // at most 28 (camera-heat.js, hottest level). A recorded frame keeps that many.
  const TRAIL_KEEP_POINTS=28;
  // A snapshot stores only the fields that changed since the previous one; every this-many snapshots stores all of them, so reading
  // one frame walks at most this many links. 30 = half a second at 60/s.
  const KEYFRAME_EVERY=30;
  // The two playback speeds the controls offer.
  const SPEEDS=[1,2];
  // Every field of the game state `s` that draw() reads to paint a frame. Two tests guard the list: replay-fields.test.cjs scans the page's
  // draw functions for `s.<name>` reads and fails on a name that is neither here nor in its short static list (so a field added to draw()
  // breaks the build); tests/test_replay_fidelity.py compares live and replayed canvas calls, but only catches a missing field that
  // changes in its scripted fight. A read that is not a literal `s.<name>` (s[key], a helper in another file) is covered by neither.
  // Static fields (s.w, s.h, s.scale) are not here: they cannot change inside a fight.
  const FIELDS=[
    'bodies','positions','phase','won','time','clock','hp','teamHP','enemyT','attackIndex','warn','attackFx','tally','comboT','combos','payoff','heart',
    'hitStop','reactions','particles','rings','popups','bolts','synHits','synArcs','synFields','bubbles','supportRings','teamEffects','shake','shakes','attackShake',
    'vignette','enemyFlash','enemyHit','enemyChip','enemyDrain','enemyWait','enemyBarFlash','teamShown','teamChip','teamHold','teamBarHit','teamFly',
    'teamFlyFlash','heals','teamFlash','lastHit','banners','cutin','flashes','splash','toasts','statusT','focus','slow','gaugeT','streak','flash','kick',
    'bumperHits','finale','finaleCount','shield','hits','hitsIdle','hitsPeak','hitsPop','hitsLost','specialCharge','specialFx','cameraScene','whipTail','battleEnd',
    'held','pulled','ax','ay','aimX','aimY','px','py','gesture','pointer','timing','perfectPulse','gaugeZone','dragFeedback','fightStats','bossAngle','swarm'
  ];
  root.LoftRumbleReplayData=Object.freeze({CAP_SECONDS,RATE,FALLBACK_RATE,MAX_BYTES,MAX_TAKE_MS,KEEP_SHARE,SHARE_MIN_POINTS,TRAIL_KEEP_POINTS,KEYFRAME_EVERY,SPEEDS,FIELDS});
})(globalThis);
