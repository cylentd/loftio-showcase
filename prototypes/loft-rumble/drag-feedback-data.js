(function(root){
  'use strict';
  root.LoftRumbleDragData=Object.freeze({
    pickupLife:.16,pickupScale:.055,heldScale:.025,heldLift:2,
    pullReach:90,pullSquash:.04,
    dragWidth:1.25,dragAlpha:.45,dragFadeStop:.35,thumbRadius:1.75,
    aimRadius:3.6,aimOutline:'#18291f',aimOutlineWidth:2.2,aimAlphaMin:.85,
    launchLife:.2,launchRadius:22,launchSpread:22,launchWidth:3,
    copy:Object.freeze({on:'Rumble on',off:'Rumble off'}),
    cues:Object.freeze({
      grab:Object.freeze({buzz:10,freq:320,to:460,life:.045,gain:.035}),
      armed:Object.freeze({buzz:6,freq:480,to:620,life:.035,gain:.025}),
      launch:Object.freeze({buzz:18,freq:160,to:70,life:.09,gain:.08})
    })
  });
})(globalThis);
