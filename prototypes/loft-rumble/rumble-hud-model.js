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

  root.LoftRumbleHudModel=Object.freeze({fillWidth,bossLayout,teamLayout,comboLayout,milestoneScale,textSize});
})(globalThis);
