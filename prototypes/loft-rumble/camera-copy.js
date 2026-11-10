(function (root) {
  'use strict';
  root.LoftRumbleCameraCopy = Object.freeze({
    title: 'Camera lab', mode: 'View', tilt: 'Tilt', scene: 'Encounter',
    art: 'Art pack', artPacks: {ORIGINAL:'Original art',STORYBOOK:'New storybook art (shallow only)'},
    modes: {TOP_DOWN:'Top-down baseline',SHALLOW_2_5D:'Shallow 2.5D'},
    scenes: {BASELINE:'Current battle',MINIONS:'A · Three minions',TWO_BOSSES:'B · Two bosses',MOVING_BOSS:'C · Moving boss',BUMPER_CHAIN:'D · Bumper chain'},
    stats: {time: 'Time', peak: 'Highest combo', hits: 'Hits', damage: 'Damage', perSecond: '/s',
      star: '★', noStar: '☆', nextStar: 'stars under', topStars: 'top grade',
      victory: 'Victory', defeat: 'Defeated', bestCombo: 'Best combo', perSecondLabel: 'Damage a second',
      dealt: 'Damage dealt', total: 'total', other: 'Everything else', ownHits: 'Own hits', hitMark: '×',
      biggest: 'Biggest hit', perfects: 'Perfect releases', breaks: 'Combo breaks',
      launches: 'Launches', perfect: 'Perfect', weak: 'Weak spot', perLaunch: 'Per launch', again: 'Tap to play again',
      topCaption: 'Fastest grade. Nothing left to beat but your time.', nextStarAt: 'Next star: win in under',
      lossHint: 'Win the fight to earn stars'},
    seek: 'Springy seek', degrees: '° toward the boss per wall',
    bossHp: 'Boss HP',
    stunned: 'Stunned', stunWait: ' is stunned. Try another resident.',
    timeout: 'Combo timeout', seconds: 's without a hit', payoff: 'Damage at 200 hits', times: 'x', payoffOff: 'off',
    fire: 'Combo fire (80+ hits)', fires: {COMET:'Comet: streams behind, bursts on hit',RISE:'Rising: flames lift off the resident'},
    combo: 'Test combo', comboOff: 'off, normal play', comboHeld: 'hits, held',
    debug: 'Collision / trajectory overlay', freeze: 'Freeze frame', resume: 'Unfreeze',
    replay: 'Repeat launch', restore: 'Restore launch state',
    note: 'Camera changes rendering only. Encounter changes reset the battle. Colosseum is the evaluated arena.',
    legend: 'Cyan: collision · amber: ground · violet: art bounds · green: predicted · coral: traveled',
  });
})(globalThis);
