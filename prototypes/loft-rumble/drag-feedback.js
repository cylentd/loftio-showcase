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
  // Fling vs sling. Pure: no DOM, no clock. The page feeds it pointer samples (arena units, event time in ms) and asks at release
  // which mode the gesture was. The swipe measurement is copied from flick() in game/src/fidget-model.ts (recent samples, stale
  // rejection, minimum speed, speed cap). Copied, not imported: the prototype's pages are plain script tags and fidget-model.ts
  // is a TypeScript module. It lives in this file because a new script would need a game/build/rumble-files.json entry.
  const F=config.fling,MODES=Object.freeze({full:'full',speed:'speed',speedFloor:'speed-floor'});
  // A gesture is {samples, movedAt}: recent pointer samples, and the time the finger last moved at swipe speed.
  function track(x,y,time){return{samples:[{x,y,time}],movedAt:time}}
  function push(t,x,y,time,scale){
    t.samples.push({x,y,time});
    const keepFrom=time-F.sampleMs;
    t.samples=t.samples.filter(sample=>sample.time>=keepFrom);
    if(swipe(t.samples,time,scale))t.movedAt=time;
  }
  // The recent swipe velocity {x,y,speed} in arena units/s, or null when the finger is not moving at swipe speed.
  function swipe(samples,now,scale){
    const last=samples[samples.length-1];
    if(!last||now-last.time>F.staleMs)return null;
    const recent=samples.filter(sample=>sample.time>=last.time-F.sampleMs),first=recent[0];
    if(recent.length<F.minSamples||last.time<=first.time)return null;
    const elapsed=(last.time-first.time)/F.msPerSecond;
    const x=(last.x-first.x)/elapsed,y=(last.y-first.y)/elapsed,speed=Math.hypot(x,y);
    if(speed*scale<F.minScreenSpeed)return null;
    const cap=Math.min(1,F.maxSpeed/speed);
    return{x:x*cap,y:y*cap,speed:Math.min(speed,F.maxSpeed)};
  }
  // True once the finger has stayed below swipe speed for holdStill: the sling's aim dots and gauge may show.
  function holding(t,now){return now-t.movedAt>=F.holdStill*F.msPerSecond}
  // Share of the trait's travel range a fling gets, 0 to 1, for a swipe speed in arena units/s.
  function power(mode,speed){
    const bySpeed=Math.min(1,speed/F.fullSpeed);
    if(mode===MODES.full)return 1;
    if(mode===MODES.speed)return bySpeed;
    if(mode===MODES.speedFloor)return Math.max(F.powerFloor,bySpeed);
    throw new Error('Unknown fling power mode: '+mode);
  }
  // The gesture at release. A swipe still moving is a fling: its direction, never timing-graded. Anything else is a sling:
  // the caller aims opposite the pull and grades the gauge.
  function release(t,now,scale){
    const v=swipe(t.samples,now,scale);
    if(!v)return{mode:'sling',graded:true};
    return{mode:'fling',angle:Math.atan2(v.y,v.x),speed:v.speed,power:power(F.powerMode,v.speed),graded:false};
  }
  const fling=Object.freeze({MODES,track,push,swipe,holding,power,release});
  // Steady sling aim. Pure. The aim point stays put while the finger is within radius of it; past that it is pulled along to
  // exactly radius behind the finger. Finger noise smaller than the radius never moves it, a real move moves it at once.
  // Flings never read it: they use the swipe samples above.
  function follow(at,x,y,radius){
    const dx=x-at.x,dy=y-at.y,gap=Math.hypot(dx,dy);
    if(gap<=radius)return at;
    const keep=radius/gap;
    return Object.freeze({x:x-dx*keep,y:y-dy*keep});
  }
  const aim=Object.freeze({follow});
  root.LoftRumbleDragFeedback=Object.freeze({create,fling,aim});
})(globalThis);
