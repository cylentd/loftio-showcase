(function(root){
  'use strict';
  const config=root.LoftRumbleDragData;
  function create({state,emit}){
    state.dragFeedback={held:null,launch:null};
    function grab(id){
      state.dragFeedback.held={id,age:0,distance:0,armed:false,clicked:false};
      emit('grab');
    }
    function move(distance,armed){
      const held=state.dragFeedback.held;if(!held)return;
      held.distance=Math.max(0,distance);held.armed=armed;
      if(armed&&!held.clicked){held.clicked=true;emit('armed')}
    }
    function cancel(){state.dragFeedback.held=null;state.dragFeedback.launch=null}
    function launch(body){
      state.dragFeedback.launch={x:body.x,y:body.y,age:0};
      emit('launch');
    }
    function tick(elapsed){
      const {held,launch}=state.dragFeedback;
      if(held)held.age+=elapsed;
      if(launch&&(launch.age+=elapsed)>=config.launchLife)state.dragFeedback.launch=null;
    }
    function pose(id,reduced){
      const held=state.dragFeedback.held;
      if(reduced||held?.id!==id)return {scale:1,lift:0,stretch:0};
      const pickup=Math.max(0,1-held.age/config.pickupLife);
      return {scale:1+config.heldScale+config.pickupScale*pickup,
        lift:config.heldLift,stretch:Math.min(1,held.distance/config.pullReach)*config.pullSquash};
    }
    return Object.freeze({grab,move,cancel,launch,tick,pose});
  }
  root.LoftRumbleDragFeedback=Object.freeze({create});
})(globalThis);
