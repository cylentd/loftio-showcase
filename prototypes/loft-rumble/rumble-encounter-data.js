(function(root){
  'use strict';
  root.LoftRumbleEncounterData=Object.freeze({
    defaultId:'clearing',storageKey:'loft-rumble-encounter',label:'Encounter',
    layoutNote:'This encounter supplies its own bumper layout.',
    entries:[
      {id:'clearing',label:'Bramble clearing',description:'Open center. Approach the weak spot and keep your teammates connected.'},
      {id:'flank',label:'Bramble flank',description:'Bank around the staggered posts to reach the left-facing weak spot. Beam fires first.',
        boss:{x:0.69,y:0.37,angle:Math.PI},
        bumpers:[[0.25,0.34],[0.42,0.54],[0.75,0.65]],
        starts:{sprout:[0.18,0.81],chomper:[0.42,0.73],custom:[0.8,0.86]},
        rotation:['beam','whiplash','slam']},
    ],
    // Swarm stages (ledger #487). Not menu entries: they are reached only by ?stage=<id>, and while LoftRumbleSwarmData.SWARM_LIVE is
    // false only together with ?lab (rumble-encounters.js stageMode). Seed and held-clock numbers live in swarm-data.js.
    swarm:{
      param:'stage',
      stages:{'swarm-hunt':'hunt','swarm-hold':'hold','swarm-bench':'bench','swarm-defense':'defense'}, // ?stage value -> swarm mode (swarm-data.js MODES)
      labels:{hunt:'Hunt',hold:'Hold',bench:'Bench',defense:'Defense'},                // the stage's name in the lab header and the encounter control (U6)
      defense:{
        heroRow:.7,     // residents start at this share of the arena height: above the crystal (swarm-data.js CRYSTAL, y .85) (crystal design, owner 2026-11-20)
        shakeShare:.4,  // a bite's shake, as a share of the page's attack shake: lighter than being hit (first guess, tune by eye)
        // Owner 2026-11-20 ("build crystal"): the hero bounces off the crystal. One bumper at the crystal; position and size come from
        // swarm-data.js CRYSTAL (x, y as shares of the arena; r as a share of its width), never restated here. Read on use, not at
        // load, because tests load this file without swarm-data.js.
        get bumpers(){const c=root.LoftRumbleSwarmData.CRYSTAL;return [[c.x,c.y]]},
        get bumperRadius(){return root.LoftRumbleSwarmData.CRYSTAL.r},
      },
      weakAngle:Math.PI/2,     // a monster's weak-spot angle, facing down the field toward the team; one value, no per-kind weak spot yet
    },
  });
})(globalThis);
