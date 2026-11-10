(function(root){
  'use strict';
  const settings=Object.freeze({
    base:'assets/camera-storybook/',names:['arena','boss','bumper-idle','bumper-impact','bumper-rebound'],
    // Tall boss (2026-11-09), in hit radii: 3.6 wide keeps the crown inside the arena, 4.7 tall is the art's 982:1283 shape,
    // 3.7 above the centre puts the feet one radius below it, on the unchanged collider's base.
    bossWidth:3.6,bossHeight:4.7,bossTop:3.7,bossFoot:0.9,
    // Measured on the art: the crown narrows to the trunk 56% down, and the trunk is 40% of the full width. Both padded a little.
    bossCrown:0.6,bossTrunk:0.42,impactThreshold:0.65,bumperWidths:{idle:2.6,impact:3.2,rebound:3},
    bumperAspect:{idle:840/900,impact:760/1090,rebound:1},bumperFoot:0.95,
    boundaryColor:'#ffcf75',boundaryAlpha:0.6,boundaryWidth:1,
  });
  const images={};
  let ready=null;
  const enabled=session=>session.shallow&&session.artPack==='STORYBOOK';
  function load(){
    if(ready)return ready;
    ready=Promise.all(settings.names.map(name=>new Promise(resolve=>{
      const image=new Image();image.onload=()=>{images[name]=image;resolve(true);};image.onerror=()=>resolve(false);
      image.src=settings.base+name+'.webp';
    })));
    return ready;
  }
  function bossBounds(x,y,radius){
    const width=radius*settings.bossWidth,height=radius*settings.bossHeight;
    return {x:x-width/2,y:y-radius*settings.bossTop,width,height,groundY:y+radius*settings.bossFoot};
  }
  // What the picture actually covers: the wide crown, then only the trunk under it. A resident beside the trunk is in plain view.
  function bossParts(x,y,radius){
    const whole=bossBounds(x,y,radius),crown=whole.height*settings.bossCrown,trunk=whole.width*settings.bossTrunk;
    return [{...whole,height:crown},{...whole,x:x-trunk/2,width:trunk,y:whole.y+crown,height:whole.height-crown}];
  }
  const bumperState=flash=>flash<=0?'idle':flash>settings.impactThreshold?'rebound':'impact';
  function background(session){
    if(!enabled(session)||!images.arena)return false;
    const {ctx,s,C}=session.game;
    ctx.drawImage(images.arena,0,C.hudTop,s.w,s.h-C.hudTop-C.hudBottom);
    return true;
  }
  function boss(session,x,y){
    if(!enabled(session)||!images.boss)return false;
    const {ctx,C}=session.game,rect=bossBounds(x,y,C.enemyRadius);
    ctx.save();ctx.globalAlpha*=session.bossFade??1;ctx.translate(x,y);ctx.scale(1,session.uprightScale);
    ctx.drawImage(images.boss,rect.x-x,rect.y-y,rect.width,rect.height);
    ctx.restore();return true;
  }
  function bumpers(session){
    if(!enabled(session)||!images['bumper-idle'])return false;
    const {ctx,s,FEEL,bumperSpots}=session.game;
    bumperSpots().forEach((point,index)=>{
      const radius=FEEL.bumperRadius,flash=s.bumperHits[index]/FEEL.bumperFlash;
      const state=bumperState(flash),image=images['bumper-'+state]??images['bumper-idle'];
      const width=radius*settings.bumperWidths[state],height=width*settings.bumperAspect[state];
      ctx.drawImage(image,point.x-width/2,point.y+radius*settings.bumperFoot-height,width,height);
      ctx.save();ctx.strokeStyle=settings.boundaryColor;ctx.globalAlpha=settings.boundaryAlpha;ctx.lineWidth=settings.boundaryWidth;
      ctx.beginPath();ctx.arc(point.x,point.y,radius,0,Math.PI*2);ctx.stroke();ctx.restore();
    });
    return true;
  }
  root.LoftRumbleStorybook={enabled,load,bossBounds,bossParts,bumperState,background,boss,bumpers};
})(globalThis);
