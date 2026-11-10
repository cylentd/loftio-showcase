(function(root){
  'use strict';
  const config=root.LoftRumbleCameraConfig.telegraph;
  const clamp=value=>Math.max(0,Math.min(1,value));
  function read({warn,fx,remaining,timing,feel}){
    if(!warn||fx?.hit||!['beam','slam'].includes(warn.def.id))return null;
    const charge=fx
      ?config.prepareShare+(1-config.prepareShare)*clamp((fx.t+timing.nameFlash)/(timing.nameFlash+feel.windup+feel.travel))
      :config.prepareShare*clamp(1-remaining/timing.telegraph);
    const compression=fx&&fx.t>=feel.windup?1-clamp((fx.t-feel.windup)/feel.travel):charge;
    return {attack:warn.def.id,angle:warn.angle??0,charge,compression,colour:warn.def.colour};
  }
  function pose(ctx,cue,radius,reduced){
    if(!cue||cue.attack!=='slam'||reduced)return;
    ctx.translate(0,radius);
    ctx.scale(1+config.squeezeX*cue.compression,1-config.squeezeY*cue.compression);
    ctx.translate(0,-radius);
  }
  function source(ctx,cue,radius,colours){
    if(!cue||cue.attack!=='beam')return;
    const size=config.portRadius+config.portGrowth*cue.charge;
    ctx.save();
    for(const side of [-1,1]){
      const x=Math.cos(cue.angle)*radius*side,y=Math.sin(cue.angle)*radius*side;
      ctx.fillStyle=colours[cue.colour];ctx.globalAlpha=config.haloAlpha;
      ctx.beginPath();ctx.arc(x,y,size*config.haloScale,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=config.sourceAlpha+(1-config.sourceAlpha)*cue.charge;
      ctx.beginPath();ctx.arc(x,y,size,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=colours.flash;ctx.beginPath();ctx.arc(x,y,size*config.coreScale,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  function ground(ctx,cue,enemy,radius,colours,reduced){
    if(!cue||cue.attack!=='slam')return;
    ctx.save();ctx.fillStyle=colours.warning;ctx.globalAlpha=config.dustAlpha*cue.charge;
    ctx.strokeStyle=root.LoftRumbleCameraConfig.shadowColor;ctx.lineWidth=config.dustOutline;
    for(let index=0;index<config.dustCount;index++){
      const angle=index/config.dustCount*Math.PI*2+(reduced?0:cue.charge*config.dustTurn);
      const distance=radius*(config.dustRadius-config.dustGather*cue.charge);
      const size=config.dustSize*(1+index%2);
      ctx.beginPath();ctx.ellipse(enemy.x+Math.cos(angle)*distance,enemy.y+Math.sin(angle)*distance,
        size,size*config.dustHeight,angle,0,Math.PI*2);ctx.stroke();ctx.fill();
    }
    ctx.restore();
  }
  root.LoftRumbleTelegraph=Object.freeze({read,pose,source,ground});
})(globalThis);
