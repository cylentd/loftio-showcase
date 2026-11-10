(function(root){
  'use strict';
  const config=root.LoftRumbleCameraConfig.stun;
  const active=body=>(body?.stun??0)>0;
  function apply(body,attack,stop){
    const duration=config[attack];
    if(!duration)return false;
    stop(body);
    body.stun=Math.max(body.stun??0,duration);
    body.charge=0;
    body.ping=0;
    return true;
  }
  function tick(body,dt){
    if(!active(body))return false;
    body.stun=Math.max(0,body.stun-dt);
    body.charge=body.stun?0:1;
    return !body.stun;
  }
  function draw(ctx,body,{clock,reduced,upright,colour}){
    if(!active(body))return;
    ctx.save();ctx.translate(body.x,body.y);ctx.scale(1,upright);
    ctx.globalAlpha=1;ctx.fillStyle=colour;
    ctx.strokeStyle=root.LoftRumbleCameraConfig.shadowColor;ctx.lineWidth=config.outline;ctx.lineJoin='round';
    for(let index=0;index<config.stars;index++){
      const angle=index/config.stars*Math.PI*2+(reduced?0:clock*config.spin);
      const x=Math.cos(angle)*config.orbit,y=-config.lift+Math.sin(angle)*config.orbitHeight;
      ctx.beginPath();
      for(let point=0;point<config.points*2;point++){
        const direction=point/(config.points*2)*Math.PI*2-Math.PI/2;
        const radius=config.size*(point%2?config.inner:1);
        const px=x+Math.cos(direction)*radius,py=y+Math.sin(direction)*radius;
        if(point)ctx.lineTo(px,py);else ctx.moveTo(px,py);
      }
      ctx.closePath();ctx.stroke();ctx.fill();
    }
    ctx.restore();
  }
  root.LoftRumbleStun=Object.freeze({active,apply,tick,draw});
})(globalThis);
