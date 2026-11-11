(function(root){
  'use strict';
  root.LoftRumbleDemoData=Object.freeze({
    enrageAt:0.35,enragedInterval:5.5,enrageLead:0.75,bannerLife:2.2,secondsPerMinute:60,
    rotation:Object.freeze(['beam','slam','pulse']),
    tutorialKey:'loftRumbleDemoTutorialSeen',
    resident:Object.freeze({name:'Puff',trait:'piercing'}),
playerControls:Object.freeze(['pause','help-toggle','sound','music','haptics','reset','replay-tutorial']),
    copy:Object.freeze({
      menuLabel:'Pause and settings',resume:'Resume battle',helpMenu:'How to play',pausedTitle:'Battle paused',
      arrivalLead:'Ready to',arrivalTitle:'Rumble',musicOn:'Music on',musicOff:'Music off',
      boss:'Bramble Beetle',enragedBoss:'Bramble Beetle · Enraged',back:'Back to Loft',
      enrage:'Bramble is enraged!',enrageSub:'Attacks come faster. Watch the windup.',
      victory:'Bramble defeated!',defeat:'Team knocked out',
      winHint:'Try another run. Build a longer chain.',lossHint:'Chain teammates. Watch the windups.',
      time:'Fight time',combo:'Best combo',replay:'Play again',zone:'Fling out of the danger zone',
      teamHelp:'Fling any ready resident, even while others are moving. Bump a teammate to fire its ability. Each enemy hit builds your combo. Your combo expires after 2.5 seconds without a hit. Beam and Slam stun residents caught in their zones, including moving ones. A stun stops that resident, not your whole combo. A full gold portrait makes its next fling a special.',
      aimHelp:'Hit the gold weak spot for 3× damage. Wall bounces add damage, up to ×2. Release on the gold timing mark for bonus damage. Watch Bramble charge a Beam or crouch for a Slam, then fling residents clear of the marked ground. Collect hearts to heal. At low health, Bramble attacks faster.',
    }),
  });
})(globalThis);
