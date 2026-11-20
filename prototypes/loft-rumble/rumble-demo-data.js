(function(root){
  'use strict';
  // The boss's one name: copy.boss below, and every string that names it. Owner, 2026-11-15: "Bramble" everywhere a player sees it.
  const boss='Bramble';
  root.LoftRumbleDemoData=Object.freeze({
    enrageAt:0.35,enragedInterval:5.5,enrageLead:0.75,secondsPerMinute:60,
    rotation:Object.freeze(['beam','slam','whiplash']),
    tutorialKey:'loftRumbleDemoTutorialSeen',
    soundKey:'loftRumbleSound',          // localStorage 'on' | 'off', read and written like loftRumbleMusic (docs/architecture/ICD.md)
    resident:Object.freeze({name:'Puff',trait:'piercing'}),
playerControls:Object.freeze(['pause','help-toggle','sound','music','music-track-row','haptics','throw-style','reset','replay-tutorial']),
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
      arrivalLead:'Ready to',arrivalTitle:'Rumble',
      // Settings rows: the label never changes; the switch shows the state (audit 2026-11-15, top 10 #6).
      sound:'Sound',music:'Music',musicHint:'Turn on Sound', // the hint shows under Music while Sound is off
      // Every player string that names the boss reads this one key (owner, 2026-11-15: Bramble).
      boss,enragedBoss:boss+' · Enraged',back:'Back to Loft',
      // Enrage shows on the field only (owner, 2026-11-15): no banner and no subline. This sentence is for screen readers.
      enrage:boss+' is enraged!',
      victory:boss+' defeated',defeat:'Team knocked out',
      // Swarm end screen (ledger #487): labels only, no sentences. Same results-v1 kit as Bramble's screen.
      swarm:Object.freeze({won:'Victory',lost:'Team knocked out',kills:'Kills',time:'Time'}),
      winHint:'Try another run. Build a longer combo.',lossHint:'Bump teammates. Watch the warnings.',
      time:'Battle time',combo:'Best combo',replay:'Play Again', // "Play Again" is the owner's pick, 2026-11-15; it wins over the audit glossary's sentence case
      // End-screen damage list and breakdown: labels and numbers only. Counts are plain numbers, never "×2" (audit glossary).
      // "Bumps" and "Teammates bumped" replace "Set off" and "Teammates set off" (owner, 2026-11-15); the stat key stays setOff.
      damage:'Damage',hitMark:'',setOff:'Teammates bumped',
      // A collapsed row's counts, in order (owner, 2026-11-15). "Throws", not "Flung": it counts sling releases too.
      rowCounts:Object.freeze({throws:'Throws',specials:'Specials',setOff:'Bumps'}),countSeparator:' · ',
      parts:Object.freeze({direct:'Direct hits',weak:'Weak spot',walls:'Wall bounce',ability:'Ability',special:'Special'}),
      // A note under a breakdown's part (owner, 2026-11-15): Ability damage stays credited to its owner, but it fires only
      // when a teammate bumps that resident, so the row says so.
      partNotes:Object.freeze({ability:'from teammate bumps'}),
      // Results screen labels for keys with no label above: time, combo, replay and back keep their own keys. The screen
      // shows only what `results.summary` and `results.actions` name; these are ready for those lists.
      restart:Object.freeze({title:'New battle?',body:'Leave this battle and start again?',confirm:'New battle',cancel:'Cancel'}),
      summary:Object.freeze({bossHP:'Boss HP',teamDamage:'Team damage',throws:'Throws'}),
      actions:Object.freeze({tutorial:'Replay training'}),
      // How to play and the danger hint, keyed by throw style (one style at a time, owner 2026-11-15). The page writes the set
      // for the style in use and rewrites it when the setting changes.
      throwHelp:Object.freeze({
        zone:Object.freeze({fling:'Fling out of the danger zone',sling:'Sling out of the danger zone'}),
        // About three short lines (owner, 2026-11-15): the throw, the bump, the special (it fires on the next throw until the
        // specials redesign), and a pointer to Training for the rest. Replay training is the menu's own button.
        teamHelp:Object.freeze({
          fling:'Swipe a ready resident to fling it at '+boss+'; bump a teammate to fire its ability.',
          sling:'Pull back a ready resident and let go to sling it at '+boss+'; bump a teammate to fire its ability.'
        }),
        aimHelp:Object.freeze({
          fling:'A full gold portrait makes your next fling a special.',
          sling:'A full gold portrait makes your next sling a special.'
        }),
        // The page adds this only when Training is installed (it is with ?training), because only then does the menu hold the button.
        training:'Replay training in the menu for the rest.'
      }),
      // Words the realtime page shows, keyed (audit 2026-11-15, top 10 #2). The page reads them as COPY.<key> and PAGE.<key>;
      // `{name}`-style holes are filled by the page. Field cues only (owner, 2026-11-15): no enrage banner, no cut-in subline,
      // no READY stamp.
      page:Object.freeze({
        gameName:'Loft Rumble',settings:'Settings',pause:'Pause',resume:'Resume',paused:'Paused · tap to resume',
        newBattle:'New battle',reroll:'Reroll trait',replayTutorial:'Replay training',turnBased:'Try turn-based',
        timingOn:'Timing on',timingOff:'Timing off',rechargeOn:'Recharge on',rechargeOff:'Recharge off', // lab-only rows keep a flipping label
        portraitHint:'Best in portrait',dismiss:'Dismiss',bossBar:boss+' health',traitUnset:'Random trait',
        name:Object.freeze({sprout:'Sprout',chomper:'Chomper',custom:'Custom'}), // Custom shows in the lab only; the demo names the third resident Puff
        trait:Object.freeze({
          springy:Object.freeze({name:'Springy',description:'Long, fast ricochets. Light hits; keep bouncing to build damage.'}),
          heavy:Object.freeze({name:'Heavy hitter',description:'Weightier throws. Strong hits; aim for the weak spot.'}),
          piercing:Object.freeze({name:'Piercing',description:'Pass through '+boss+'. Bank off a wall to strike again.'}),
        }),
        abilityName:Object.freeze({springy:'Seed burst',heavy:'Shockwave',piercing:'Piercing beam'}),
        specialName:Object.freeze({springy:'Overdrive',heavy:'Meteor smash',piercing:'Comet shot'}),
        attack:Object.freeze({
          whiplash:Object.freeze({name:'Whiplash',tip:'Move to the rear'}),
          pulse:Object.freeze({name:'Pulse',tip:'Hits the whole team'}),
          beam:Object.freeze({name:'Beam',tip:'Leave the purple lane'}),
          slam:Object.freeze({name:'Slam',tip:'Leave the purple ring'}),
        }),
        ability:Object.freeze({springy:'Seeds chase '+boss,heavy:'Blasts '+boss+' up close',piercing:'Zaps from anywhere'}), // ally intro taglines, 4 words max
        special:'Special',tutor:Object.freeze({bump:'Bump a teammate',zone:'Leave the zone'}), // first-battle steps, 4 words max
        combo:'combo',comboMiles:Object.freeze(['Nice','Great','Rumble']),comboSaved:'Combo saved!',comboLost:'Combo lost',
        shieldChip:'Shield -{points}',shieldLabel:'Shield',pierce:'Pierce!',crack:'Crack!',shattered:'Shield broken!', // shieldChip replaces 'Blocked' (owner 2026-11-18, round 4 shield health)
        shieldToast:Object.freeze({title:'Shield on the weak spot',sub:'Heavy hits break it fast, Piercing passes'}), // owner rules 2026-11-18, round 4
        multiplier:'×{multiplier}', // the weak-spot mark and the bounce counter: the sign comes first, the number after (audit glossary)
        perfect:'PERFECT',perfectStreak:'PERFECT ×{streak}',grade:Object.freeze({perfect:'Perfect',great:'Great'}),
        weak:'Weak spot',missed:'Missed',dodged:'Dodged',heal:'Heal',newTrait:'New trait: {name}.',
        miss:'Press on a resident to pick it up.',recharging:'{name} is recharging.',
        ready:'Ready',recharge:'Recharging',moving:'Moving',focus:'Focus',attackNow:'Now',secondsSuffix:'s',
        won:'Won in {time}',lost:'Knocked out at {time}',again:'Tap to play again',ready_sr:' special ready',ko:'Knocked out',
        battle:'Battle time {time}',battleOver:'Battle finished',attackIn:'{attack} in {seconds} s',skip:'Tap to skip',
        bossHealth:'{boss} · {hp} HP',bossDown:'{boss} defeated',teamHealth:'Team {now}/{max} HP',hp:'{hp} HP',teamName:'Your team',
      }),
    }),
  });
})(globalThis);
