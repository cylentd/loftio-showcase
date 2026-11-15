(function(root){
  'use strict';
  const config=root.LoftRumbleDragData;
  function launch(ctx,event,colors,reduced){
    if(!event||reduced)return;
    const progress=event.age/config.launchLife;
    ctx.globalAlpha=1-progress;ctx.strokeStyle=colors.warning;ctx.lineWidth=config.launchWidth*(1-progress);
    ctx.beginPath();ctx.ellipse(event.x,event.y,config.launchRadius+config.launchSpread*progress,
      (config.launchRadius+config.launchSpread*progress)/2,0,0,Math.PI*2);ctx.stroke();
  }
  function dragLine(ctx,pointer,origin,colors){
    if(pointer.x===origin.x&&pointer.y===origin.y)return;
    const gradient=ctx.createLinearGradient(origin.x,origin.y,pointer.x,pointer.y);
    gradient.addColorStop(0,'transparent');
    gradient.addColorStop(config.dragFadeStop,colors['muted-foreground']);
    gradient.addColorStop(1,colors.foreground);
    ctx.globalAlpha=config.dragAlpha;ctx.lineCap='round';
    ctx.strokeStyle=gradient;ctx.lineWidth=config.dragWidth;ctx.beginPath();
    ctx.moveTo(origin.x,origin.y);ctx.lineTo(pointer.x,pointer.y);ctx.stroke();
    ctx.fillStyle=colors.foreground;ctx.beginPath();ctx.arc(pointer.x,pointer.y,config.thumbRadius,0,Math.PI*2);ctx.fill();
  }
  // style is the throw style in use. Sling keeps its rubber-band pull line ("keep rubber band", owner 2026-11-15); a fling
  // aims along the drag, where the line would lie over its aim dots, so fling draws none.
  function draw(ctx,{feedback,body,pointer,origin,colors,reduced,style}){
    ctx.save();launch(ctx,feedback.launch,colors,reduced);ctx.globalAlpha=1;
    if(body&&feedback.held?.armed&&style!=='fling')dragLine(ctx,pointer,origin,colors);
    ctx.restore();
  }
  function aimDot(ctx,{x,y,color,alpha}){
    ctx.save();ctx.globalAlpha=1;ctx.beginPath();
    ctx.arc(x,y,config.aimRadius,0,Math.PI*2);
    ctx.strokeStyle=config.aimOutline;ctx.lineWidth=config.aimOutlineWidth;ctx.stroke();
    ctx.globalAlpha=Math.max(config.aimAlphaMin,alpha);ctx.fillStyle=color;ctx.fill();ctx.restore();
  }
  root.LoftRumbleDragRenderer=Object.freeze({draw,aimDot});
})(globalThis);
