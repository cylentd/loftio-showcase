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
  // Fling and sling input. Pure: no DOM, no clock. The page feeds it pointer samples (arena units, event time in ms) and asks at
  // release what the gesture throws in the chosen throw style (one mode at a time, owner 2026-11-15). The swipe measurement is copied from flick() in game/src/fidget-model.ts (recent samples, stale
  // rejection, minimum speed, speed cap). Copied, not imported: the prototype's pages are plain script tags and fidget-model.ts
  // is a TypeScript module. It lives in this file because a new script would need a game/build/rumble-files.json entry.
  const F=config.fling,MODES=Object.freeze({full:'full',speed:'speed',speedFloor:'speed-floor'});
  // A gesture is {samples, movedAt, swiping, swipeAt}: recent pointer samples, the time the finger last moved at swipe speed,
  // whether the last sample was at swipe speed, and the time the latest swipe began (null before any). That moment grades a
  // fling: the page reads the gauge then, before the swipe restarts it.
  function track(x,y,time){return{samples:[{x,y,time}],movedAt:time,swiping:false,swipeAt:null}}
  function push(t,x,y,time,scale){
    t.samples.push({x,y,time});
    const keepFrom=time-F.sampleMs,rested=holding(t,time);
    t.samples=t.samples.filter(sample=>sample.time>=keepFrom);
    const moving=!!swipe(t.samples,time,scale);
    // A swipe begins on the first swipe-speed sample, or the first after a rest of holdStill; a brief dip mid-swipe keeps it.
    const began=moving&&!t.swiping&&(t.swipeAt===null||rested);
    if(began)t.swipeAt=time;
    if(moving)t.movedAt=time;
    t.swiping=moving;
    return began; // true on the sample that starts a swipe: the page reads the gauge for a fling then
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
  // True once the finger has stayed below swipe speed for holdStill: the gauge runs, and in sling mode the aim dots show.
  function holding(t,now){return now-t.movedAt>=F.holdStill*F.msPerSecond}
  // Share of the trait's travel range a fling gets, 0 to 1, for a swipe speed in arena units/s.
  function power(mode,speed){
    const bySpeed=Math.min(1,speed/F.fullSpeed);
    if(mode===MODES.full)return 1;
    if(mode===MODES.speed)return bySpeed;
    if(mode===MODES.speedFloor)return Math.max(F.powerFloor,bySpeed);
    throw new Error('Unknown fling power mode: '+mode);
  }
  // The held-aim direction of a pull {from: press point, to: steady aim point}: the style picks the sign. Sling launches
  // opposite the pull, fling along it (owner, 2026-11-15). Aim dots and the release both read this.
  const SIGN=Object.freeze({fling:1,sling:-1});
  function heldAngle(style,pull){
    const sign=SIGN[style];
    if(!sign)throw new Error('Unknown throw style: '+style);
    return Math.atan2(sign*(pull.to.y-pull.from.y),sign*(pull.to.x-pull.from.x));
  }
  // The throw at release: {mode, aim, angle, gradeAt, graded, power}, full power in both styles. graded true means the page
  // grades from the gauge as it stood at gradeAt, and only a gauge that was drawn then gives a grade (the page's gaugeDelay
  // check). In fling style only, a finger still moving at release aims by the swipe velocity (aim 'swipe'). Anything else aims
  // by the pull (aim 'held', heldAngle). gradeAt is 'swipe' (the gauge at swipeAt) for a fling swipe, and for a fling swipe that
  // slowed just before release without holding still again; otherwise 'release'.
  function release(t,now,scale,style,pull){
    const v=style==='fling'?swipe(t.samples,now,scale):null;
    if(v)return{mode:style,aim:'swipe',angle:Math.atan2(v.y,v.x),speed:v.speed,power:power(F.powerMode,v.speed),gradeAt:'swipe',graded:true};
    const slowed=style==='fling'&&t.swipeAt!==null&&!holding(t,now);
    return{mode:style,aim:'held',angle:heldAngle(style,pull),gradeAt:slowed?'swipe':'release',graded:true,power:1};
  }
  const fling=Object.freeze({MODES,track,push,swipe,holding,power,heldAngle,release});
  // The throw style setting. Storage is injected (the page passes localStorage); a storage that throws is ignored, as for music.
  const T=config.throwStyle;
  function valid(value){return T.styles.includes(value)?value:T.fallback}
  function createThrowStyle({storage=null,onChange=()=>{}}={}){
    let value=T.fallback;
    try{value=valid(storage?.getItem(T.storageKey))}catch{}
    function set(next){
      const chosen=valid(next);
      try{storage?.setItem(T.storageKey,chosen)}catch{}
      if(chosen!==value){value=chosen;onChange(chosen)}
      return chosen;
    }
    return Object.freeze({get:()=>value,set});
  }
  const throwStyle=Object.freeze({create:createThrowStyle,valid});
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
  root.LoftRumbleDragFeedback=Object.freeze({create,fling,aim,throwStyle});
})(globalThis);
