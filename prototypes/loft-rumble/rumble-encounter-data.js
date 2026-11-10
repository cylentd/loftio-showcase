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
        rotation:['beam','pulse','slam']},
    ],
  });
})(globalThis);
