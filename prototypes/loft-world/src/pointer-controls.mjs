import { AIM } from './control-constants.mjs';

export function wirePointerControls({canvas,win,play,orbit,size}) {
  const pointers=new Map();
  let primary=null;
  const release=id=>{if(canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);};
  function cancel() {
    primary=null; play.aimCancel();
    const ids=[...pointers.keys()]; pointers.clear(); ids.forEach(release);
  }
  function aim(e,p) {
    const {width,height}=size(),pixels=Math.hypot(e.clientX-p.x,e.clientY-p.y);
    play.aimMove(e.clientX,e.clientY,width,height,Math.min(pixels/(Math.min(width,height)*AIM.swipeShare),1),pixels);
  }
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('pointerdown',e=>{
    if(pointers.has(e.pointerId)) return;
    const {width,height}=size();
    const fling=play.active && primary===null && e.button===0 && play.nearLead(e.clientX,e.clientY,width,height);
    const p={x:e.clientX,y:e.clientY,px:e.clientX,py:e.clientY,fling,yaw:orbit.goalYaw,pitch:orbit.goalPitch};
    pointers.set(e.pointerId,p);canvas.setPointerCapture(e.pointerId);
    if(fling) { primary=e.pointerId;play.state.aim={target:null,power:0,pixels:0}; }
  });
  canvas.addEventListener('pointermove',e=>{
    const p=pointers.get(e.pointerId);if(!p)return;
    if(play.active) {
      // Mouse button chords share a pointer ID: right held means orbit, preserving aim.
      if(p.fling && !(e.buttons & 2)) { if(!p.chord && (e.clientX!==p.px || e.clientY!==p.py)) aim(e,p); }
      else play.orbit(e.clientX-p.px,e.clientY-p.py);
      p.chord=!!(e.buttons & 2);
    } else {
      const {width,height}=size();
      orbit.goalYaw=Math.max(-1.1,Math.min(1.1,p.yaw-(e.clientX-p.x)/width*2.2));
      orbit.goalPitch=Math.max(-.22,Math.min(.45,p.pitch+(e.clientY-p.y)/height*1.2));
    }
    p.px=e.clientX;p.py=e.clientY;
  });
  function finish(e,cancelled) {
    const p=pointers.get(e.pointerId);if(!p)return;
    // pointerup is emitted only after all mouse buttons release. mouseup below
    // handles releasing left first while right is still held.
    pointers.delete(e.pointerId);
    if(p.fling) { primary=null; if(cancelled)play.aimCancel();else play.aimEnd(); }
    release(e.pointerId);
  }
  canvas.addEventListener('mouseup',e=>{
    if(e.button!==0 || !(e.buttons&2))return;
    const p=pointers.get(primary);if(!p)return;
    p.fling=false;primary=null;play.aimEnd();
  });
  canvas.addEventListener('pointerup',e=>finish(e,false));
  canvas.addEventListener('pointercancel',e=>finish(e,true));
  canvas.addEventListener('lostpointercapture',e=>finish(e,true));
  win.addEventListener('blur',cancel);
  win.addEventListener('keydown',e=>{if(e.code==='Escape')cancel();});
  return {cancel};
}
