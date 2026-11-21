// Living-magic HUD (LM6b): pure layout for the boss header, the team bar and the combo count. No drawing, no DOM.
// Numbers: rumble-hud-data.js. It reads health and hit counts and never changes them, so damage and timing stay put.
(function(root){
  'use strict';
  const clamp01=v=>Math.max(0,Math.min(1,v));
  const HALF=.5;
  const box=(frame,rect)=>({x:frame.x+rect.x*frame.w,y:frame.y+rect.y*frame.h,w:rect.w*frame.w,h:rect.h*frame.h});

  // The filled share of a channel `width` wide: health over max, clamped, so overkill or a heal past max never spills.
  function fillWidth(value,max,width){return max>0?width*clamp01(value/max):0}

  // Boss header: the name centred at the top, the frame centred under it with its crest just below the name.
  function textSize(size,scale,floor){return Math.max(size,floor/scale)}
  function bossLayout(width,D,scale=1,top=D.topStrip){
    const B=D.boss,T=D.textures.bossFrame,baseline=Math.max(B.nameBaseline,textSize(B.nameFont,scale,D.type.body));
    const room=(top-baseline-B.nameGap)*T.w/(T.h*(B.visibleBottom-B.crestTop));
    const w=Math.max(0,Math.min(B.width,width-D.inset*2,room)),h=w*T.h/T.w;
    const frame={x:(width-w)/2,y:baseline+B.nameGap-B.crestTop*h,w,h};
    const channel=box(frame,B.channel);
    return {frame,channel,bottom:frame.y+B.visibleBottom*h,
      name:{x:width/2,y:baseline},hp:{x:frame.x+frame.w-channel.h,y:baseline}};
  }

  // Shield bar (owner 2026-11-18, round 5): centred under the boss channel, its top tucked onto the frame's lower lip;
  // the "Shield" word right-aligned left of it, on the bar's middle. L: a bossLayout.
  function shieldLayout(L,D){
    const S=D.shield,w=L.channel.w*S.share,x=L.channel.x+(L.channel.w-w)*HALF;
    const y=Math.max(L.channel.y+L.channel.h+S.edge,L.bottom-S.tuck);
    return {bar:{x,y,w,h:S.height},label:{x:x-S.labelGap,y:y+S.height*HALF}};
  }

  // Team bar: the frame from the left inset, centred in the bottom strip, with the live readout to its right.
  function teamLayout(width,height,strip,numberWidth,D){
    const P=D.team,T=D.textures.teamFrame,mid=height-strip*HALF;
    const w=Math.max(0,width-D.inset*2-numberWidth-P.numberGap),h=w*T.h/T.w;
    const frame={x:D.inset,y:mid-h*HALF,w,h};
    const size=P.socket.size*w*P.seedScale;
    return {frame,channel:box(frame,P.channel),number:{x:width-D.inset,y:mid},
      seed:{x:frame.x+P.socket.x*w-size*HALF,y:frame.y+P.socket.y*h-size*HALF,w:size,h:size}};
  }

  // Combo: the open-spiral ornament on the left edge, the count centred in its opening and the label under the count.
  function comboLayout(D){
    const K=D.combo,T=D.textures.combo,h=K.width*T.h/T.w;
    const centre={x:K.x+K.width*HALF,y:K.y+h*HALF};
    return {ornament:{x:K.x,y:K.y,w:K.width,h},count:centre,label:{x:centre.x,y:centre.y+K.labelGap}};
  }

  // A milestone pop: `left` is the share of the page's hit pop still to run (1 on the hit, 0 when done). Full extra scale on
  // the milestone hit, easing back to none; reduced motion never pops.
  function milestoneScale(left,D,reduced){
    if(reduced||!(left>0))return 1;
    const k=clamp01(left);
    return 1+D.combo.milestonePop*k*k;
  }

  // Special charge as the hero-card border lighting clockwise (owner direction, 2026-11-15). The lit front starts at the
  // rune socket (bottom centre) and walks the card's edge clockwise at a steady speed, so `charge` is the share of the
  // perimeter lit. Returns that front as a conic-gradient angle in degrees: 0 points straight down, angles run clockwise
  // (CSS `conic-gradient(from 180deg ...)`), measured from the centre of a card `aspect` wide by 1 tall. A steady angle
  // would rush along the short sides and crawl along the long ones; this keeps the front moving at one speed.
  const FULL_TURN=360;
  function chargeSweep(charge,aspect){
    const k=clamp01(charge);
    if(k>=1)return FULL_TURN;
    const w=aspect,h=1,walk=k*2*(w+h);
    const legs=[[w*HALF,s=>[-s,h*HALF]],[h,s=>[-w*HALF,h*HALF-s]],[w,s=>[s-w*HALF,-h*HALF]],
      [h,s=>[w*HALF,s-h*HALF]],[w*HALF,s=>[w*HALF-s,h*HALF]]];
    let left=walk,point=[0,h*HALF];
    for(const [length,at] of legs){if(left<=length){point=at(left);break}left-=length}
    const degrees=Math.atan2(-point[0],point[1])*FULL_TURN/(2*Math.PI);
    return degrees<0?degrees+FULL_TURN:degrees;
  }

  // Swarm Defense counter (D2): the kill count centred at the top, one dot per wave centred under it. `bottom` is the
  // lowest drawn point, the current dot's outline, which must stay above the monsters' TOP_INSET.
  function defenseLayout(width,waves,D,scale=1){
    const F=D.swarm.defense,centre=width*HALF,span=(waves-1)*F.dotGap;
    const dots=Array.from({length:waves},(_,index)=>({x:centre-span*HALF+index*F.dotGap,y:F.dotY}));
    return {count:{x:centre,y:F.countBaseline,size:textSize(F.countFont,scale,D.type.body)},dots,
      bottom:F.dotY+F.currentR+F.dotEdge};
  }

  // The first `held` waves are held (progress.held: every monster of the wave has died). The named wave and any earlier wave still
  // holding live monsters are current (running, or coming in a lull); the rest are to come. The count cannot say which earlier wave is
  // the live one, so the held waves are read as the first ones.
  function waveDots(progress){
    return Array.from({length:progress.waves},(_,index)=>index<progress.held&&index+1<progress.wave?'done':index+1<=progress.wave?'current':'next');
  }

  // The lull cue: the coming wave and the whole seconds left, rounded up so it never shows 0. The count pops on each new
  // second and eases back over popShare of it; reduced motion keeps it still. Null while a wave runs.
  function lullCue(progress,D,reduced){
    if(!(progress.lullLeft>0))return null;
    const F=D.swarm.defense,count=Math.ceil(progress.lullLeft),into=count-progress.lullLeft; // 0 on the tick, toward 1 after
    const k=reduced?0:clamp01(1-into/F.popShare);
    return {wave:progress.wave,count,scale:1+F.pop*k*k};
  }

  root.LoftRumbleHudModel=Object.freeze({fillWidth,bossLayout,shieldLayout,teamLayout,comboLayout,milestoneScale,textSize,chargeSweep,
    defenseLayout,waveDots,lullCue});
})(globalThis);
