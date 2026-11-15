(function(root){
  'use strict';
  root.LoftRumbleDemoData=Object.freeze({
    enrageAt:0.35,enragedInterval:5.5,enrageLead:0.75,bannerLife:2.2,secondsPerMinute:60,
    rotation:Object.freeze(['beam','slam','pulse']),
    tutorialKey:'loftRumbleDemoTutorialSeen',
    resident:Object.freeze({name:'Puff',trait:'piercing'}),
playerControls:Object.freeze(['pause','help-toggle','sound','music','haptics','throw-style','reset','replay-tutorial']),
    // Living-magic results screen (LM6c, owner's results kit 2026-11-15). Every list here is data: the screen draws as many
    // summary items, heroes and actions as it is given, and no texture holds a fixed number of any of them.
    results:Object.freeze({
      originalRoster:Object.freeze({sprout:'sprout',chomper:'chomper',custom:'puff'}), // static demo markup identities
      summary:Object.freeze(['time','combo']),          // facts in the summary band, in reading order; extra items wrap
      actions:Object.freeze(['replay']),                // footer actions; the first is the primary one
      // Resident art and bar colour. The original three keep their colours (violet, teal, blue); a player-made resident
      // takes its roster art and the next colour from `palette`, in team order.
      art:Object.freeze({sprout:'art/portrait-sprout.webp',chomper:'art/portrait-chomper.webp',puff:'art/portrait-puff.webp',
        hoodie:'art/portrait-hoodie.webp',slime:'art/portrait-slime.webp',burger:'art/portrait-burger.webp'}),
      colour:Object.freeze({sprout:'teal',chomper:'violet',puff:'blue'}),
      palette:Object.freeze(['amber','rose','lime','coral']),
      // Where each resident stands on the stage floor, by team size: x across the stage (0 to 1), size against the
      // stage height, a tilt in degrees and a small step back. The concept's three on one level is a composition, not a
      // podium, so nobody stands higher for doing more damage.
      stage:Object.freeze({
        1:Object.freeze([{x:.5,size:.62,tilt:0,back:0}]),
        2:Object.freeze([{x:.34,size:.58,tilt:-3,back:0},{x:.66,size:.58,tilt:3,back:0}]),
        3:Object.freeze([{x:.25,size:.5,tilt:-4,back:.02},{x:.5,size:.54,tilt:0,back:0},{x:.75,size:.5,tilt:4,back:.02}]),
        4:Object.freeze([{x:.16,size:.5,tilt:-4,back:.03},{x:.39,size:.54,tilt:-1,back:0},{x:.61,size:.54,tilt:1,back:0},{x:.84,size:.5,tilt:4,back:.03}]),
      }),
      crowdSize:.5, // a team bigger than the table above stands evenly spaced at this size, the smallest standards section 2 allows
      slotMidpoint:.5, // center each equally spaced crowd slot
      ground:.81,   // the stage art's floor line, as a share of its height (results kit manifest, ground_line_candidate_normalized)
      footPad:.03,  // transparent rows under a portrait's feet: 7 of 256 px in every ui-v1 portrait
    }),
    copy:Object.freeze({
      menuLabel:'Pause and settings',resume:'Resume battle',helpMenu:'How to play',pausedTitle:'Battle paused',
      arrivalLead:'Ready to',arrivalTitle:'Rumble',musicOn:'Music on',musicOff:'Music off',
      boss:'Bramble Beetle',enragedBoss:'Bramble Beetle · Enraged',back:'Back to Loft',
      enrage:'Bramble is enraged!',enrageSub:'Attacks come faster. Watch the windup.',
      victory:'Bramble defeated!',defeat:'Team knocked out',
      winHint:'Try another run. Build a longer chain.',lossHint:'Chain teammates. Watch the windups.',
      time:'Fight time',combo:'Best combo',replay:'Play Again', // owner's pick, 2026-11-15
      // End-screen damage list and breakdown: labels and numbers only.
      // "Bumps" and "Teammates bumped" replace "Set off" and "Teammates set off" (owner, 2026-11-15); the stat key stays setOff.
      damage:'Damage',hitMark:'×',setOff:'Teammates bumped',
      // A collapsed row's counts, in order (owner, 2026-11-15). "Throws", not "Flung": it counts sling releases too.
      rowCounts:Object.freeze({throws:'Throws',specials:'Specials',setOff:'Bumps'}),countSeparator:' · ',
      parts:Object.freeze({direct:'Direct hits',weak:'Weak spot',walls:'Wall bounce',ability:'Ability',special:'Special'}),
      // A note under a breakdown's part (owner, 2026-11-15): Ability damage stays credited to its owner, but it fires only
      // when a teammate bumps that resident, so the row says so.
      partNotes:Object.freeze({ability:'from teammate bumps'}),
      // Results screen labels for keys with no label above: time, combo, replay and back keep their own keys. The screen
      // shows only what `results.summary` and `results.actions` name; these are ready for those lists.
      summary:Object.freeze({teamDamage:'Team damage',throws:'Throws'}),
      actions:Object.freeze({tutorial:'Replay tutorial'}),
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
