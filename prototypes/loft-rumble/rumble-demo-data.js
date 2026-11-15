(function(root){
  'use strict';
  root.LoftRumbleDemoData=Object.freeze({
    enrageAt:0.35,enragedInterval:5.5,enrageLead:0.75,bannerLife:2.2,secondsPerMinute:60,
    rotation:Object.freeze(['beam','slam','pulse']),
    tutorialKey:'loftRumbleDemoTutorialSeen',
    resident:Object.freeze({name:'Puff',trait:'piercing'}),
playerControls:Object.freeze(['pause','help-toggle','sound','music','haptics','throw-style','reset','replay-tutorial']),
    copy:Object.freeze({
      menuLabel:'Pause and settings',resume:'Resume battle',helpMenu:'How to play',pausedTitle:'Battle paused',
      arrivalLead:'Ready to',arrivalTitle:'Rumble',musicOn:'Music on',musicOff:'Music off',
      boss:'Bramble Beetle',enragedBoss:'Bramble Beetle · Enraged',back:'Back to Loft',
      enrage:'Bramble is enraged!',enrageSub:'Attacks come faster. Watch the windup.',
      victory:'Bramble defeated!',defeat:'Team knocked out',
      winHint:'Try another run. Build a longer chain.',lossHint:'Chain teammates. Watch the windups.',
      time:'Fight time',combo:'Best combo',replay:'Play Again', // owner's pick, 2026-11-15
      // End-screen damage list and breakdown: labels and numbers only.
      damage:'Damage',hitMark:'×',setOff:'Teammates set off',
      // A collapsed row's counts, in order (owner, 2026-11-15). "Throws", not "Flung": it counts sling releases too.
      rowCounts:Object.freeze({throws:'Throws',specials:'Specials',setOff:'Set off'}),countSeparator:' · ',
      parts:Object.freeze({direct:'Direct hits',weak:'Weak spot',walls:'Wall bounce',ability:'Ability',special:'Special'}),
      // How to play and the danger hint, keyed by throw style (one style at a time, owner 2026-11-15). The page writes the set
      // for the style in use and rewrites it when the setting changes.
      throwHelp:Object.freeze({
        zone:Object.freeze({fling:'Fling out of the danger zone',sling:'Sling out of the danger zone'}),
        teamHelp:Object.freeze({
          fling:'Swipe any ready resident to fling it, even while others are moving. Bump a teammate to fire its ability. Each enemy hit builds your combo. Your combo expires after 2.5 seconds without a hit. Beam and Slam stun residents caught in their zones, including moving ones. A stun stops that resident, not your whole combo. A full gold portrait makes its next fling a special.',
          sling:'Pull back any ready resident and let go to sling it, even while others are moving. Bump a teammate to fire its ability. Each enemy hit builds your combo. Your combo expires after 2.5 seconds without a hit. Beam and Slam stun residents caught in their zones, including moving ones. A stun stops that resident, not your whole combo. A full gold portrait makes its next sling a special.'
        }),
        aimHelp:Object.freeze({
          fling:'Hit the gold weak spot for 3× damage. Wall bounces add damage, up to ×2. To aim, drag and hold still: the dots point along your drag. Let go on the gold timing mark for bonus damage. Watch Bramble charge a Beam or crouch for a Slam, then fling residents clear of the marked ground. Collect hearts to heal. At low health, Bramble attacks faster.',
          sling:'Hit the gold weak spot for 3× damage. Wall bounces add damage, up to ×2. Hold the pull still to aim: the dots point opposite your pull. Let go on the gold timing mark for bonus damage. Watch Bramble charge a Beam or crouch for a Slam, then sling residents clear of the marked ground. Collect hearts to heal. At low health, Bramble attacks faster.'
        })
      }),
    }),
  });
})(globalThis);
