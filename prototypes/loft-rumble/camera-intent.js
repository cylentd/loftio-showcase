(function(root){
  'use strict';
  const config=root.LoftRumbleCameraConfig;
  const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));

  function draw(ctx,options){
    const {anchor,width,top,bottom,enemyRadius,attack,warning,colors,icon}=options;
    const radius=config.intentRadius,inset=radius+config.intentInset;
    const offset=enemyRadius+radius+config.intentGap;
    const side=anchor.x+offset<=width-inset?1:-1;
    const x=clamp(anchor.x+side*offset,inset,width-inset);
    const y=clamp(anchor.y-enemyRadius+config.intentDrop,top+inset,bottom-inset);
    if(attack.id!=='pulse'||!warning)return;
    const colour=colors[attack.colour];
    ctx.save();
    icon(attack.id,x,y,colour);
    ctx.restore();
  }

  root.LoftRumbleIntent={draw};
})(globalThis);
