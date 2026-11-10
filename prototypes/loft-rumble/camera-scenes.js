(function (root) {
  'use strict';
  root.LoftRumbleCameraScenes = Object.freeze({
    MINIONS: [
      {id:'enemy-0',type:'minion',x:100,y:210,radius:25,angle:2.55},
      {id:'enemy-1',type:'minion',x:260,y:250,radius:25,angle:2.55},
      {id:'enemy-2',type:'minion',x:180,y:405,radius:25,angle:2.55},
    ],
    TWO_BOSSES: [
      {id:'enemy-0',type:'boss',x:100,y:240,radius:48,angle:2.55},
      {id:'enemy-1',type:'boss',x:260,y:240,radius:48,angle:2.55},
    ],
    MOVING_BOSS: [{id:'enemy-0',type:'boss',x:180,y:215,radius:38,angle:2.55,moving:true}],
    BUMPER_CHAIN: [{id:'enemy-0',type:'boss',x:180,y:165,radius:38,angle:2.55}],
  });
})(globalThis);
