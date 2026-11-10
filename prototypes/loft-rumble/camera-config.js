(function (root) {
  'use strict';
  root.LoftRumbleCameraConfig = Object.freeze({
    // Floor squash is cos(tilt). 35 gives 0.82: a 45 degree shot draws at 39 degrees, the most squash that still aims by eye (owner review 2026-11-09).
    // 40 (0.77) is the lab slider's ceiling for trying more.
    tilt: 35, minTilt: 10, maxTilt: 40, degreesPerHalfTurn: 180,
    grid: 40, anchorSize: 3, lineWidth: 1, boundsAlpha: 0.65,
    comboTestMax: 140, // top of the Camera lab's test-combo slider: past the 120 hits where the combo fire stops growing, so the cap shows
    // Seconds without a hit before the combo drops, in this experiment. The game's 4 was long against other games' combos and 2.5
    // felt right (owner, 2026-11-09). The slider runs 1 to 6 in half seconds.
    // Boss HP in this experiment, set for a casual player's two-minute fight. Owner's three fights, 2026-11-09:
    //   2800 HP, skilled: dead in 30 s at a 76-hit combo.
    //   12000 HP, skilled: dead in 71 s at 240 hits. About 78 damage a second before the combo payoff.
    //   12000 HP, casual, no big combos: 2417 damage in 60 s. About 40 a second.
    // 40 a second for 120 s is 4800. A skilled player should clear that in about 38 s at about 130 hits. 12000 stays reachable on
    // the slider as the long fight.
    bossHp: 4800, bossHpMin: 2800, bossHpMax: 24000, bossHpStep: 400,
    seekStep: 5, // degrees a notch on the Springy seek slider
    comboTimeout: 2.5, comboTimeoutMin: 1, comboTimeoutMax: 6, sliderStep: 0.5,
    stun: Object.freeze({beam: 1.5, slam: 2.0, stars: 3, orbit: 17, orbitHeight: 5, lift: 34, size: 4, inner: 0.45, points: 5, spin: 4, alpha: 0.65, outline: 1.5}),
    attackImpact: Object.freeze({
      beam: Object.freeze({x: 5, y: 1, duration: 0.12, cycles: 2}),
      slam: Object.freeze({x: 2, y: 7, duration: 0.2, cycles: 1.5}),
    }),
    telegraph: Object.freeze({prepareShare: 0.65, squeezeX: 0.14, squeezeY: 0.2, portRadius: 6, portGrowth: 6, haloScale: 2, haloAlpha: 0.24, coreScale: 0.4, sourceAlpha: 0.45, dustCount: 12, dustRadius: 2.6, dustGather: 0.35, dustSize: 4, dustHeight: 0.45, dustAlpha: 0.65, dustTurn: 0.4, dustOutline: 1}),
    occludedBossAlpha: 0.4, // a boss with a resident behind it fades to this, so the resident shows through (owner review 2026-11-09)
    silhouetteAlpha: 0.65, silhouetteWidth: 2, silhouettePadding: 3,
    contactShadowAlpha: 0.22, contactShadowHeight: 0.3,
    trailAlpha: 0.35, trailWidth: 2, trailSamples: 6, pathLimit: 960, pathStride: 3,
    predictionSteps: 720, predictionRefresh: 0.15, cornerDot: 0.99,
    predictionAngleStep: Math.PI / 360, // half-degree aim buckets suppress subpixel pointer jitter without a new simulation
    projectionTop: 50, projectionBottom: 608, // default play-area bounds: arenaH 640 minus the 32-unit dock
    rootChargeAlpha: 0.15, rootOutlineAlpha: 0.7, rootDash: [8,7], rootDangerWidth: 3, // Root snap shares Slam's warning style
    intentRadius: 19, intentInset: 10, intentGap: 24, intentDrop: 44, // compact attack badge beside the boss crown, clear of the health HUD
    intentLineWidth: 3, intentWarningWidth: 1, intentPulseWidth: 1.5, intentPulseRate: 6, // warning emphasis matches the existing floor telegraph rhythm
    offstage: -100000, hitSlack: 2, // forecast only: where an ally in flight is parked, and the gap (units) still read as touching an enemy
    replaySteps: 720, replayAngle: 0, replayAngles: {MINIONS: Math.PI / 18}, fixtureAttackDelay: 1000,
    movingAmplitude: 55, movingRate: 1.5, bumperY: 300,
    fixtureBumpers: [[100 / 360, 300 / 640], [260 / 360, 300 / 640]],
    parkedResidents: { sprout: [55, 560], custom: [305, 560], chomper: [180, 300] },
    physicsColor: '#64d8e8', anchorColor: '#e3b66a', gridColor: '#748596',
    boundsColor: '#c0a4ff', silhouetteColor: '#f2ce83',
    forecastColor: '#89d8a5', actualColor: '#f08080', shadowColor: '#162c27',
    sideColor: '#536355', edgeColor: '#b4a17b', wallDepth: 6,
    randomSeed: 1249, randomMultiplier: 1664525, randomIncrement: 1013904223, randomDivisor: 4294967296,
  });
})(globalThis);
