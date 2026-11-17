export function wireJumpButton(button,win,play) {
  let pointer=null;
  const release=()=>{pointer=null;play.input.jumpHeld=false;};
  button.addEventListener('pointerdown',e=>{
    e.preventDefault();
    if(!play.active||pointer!==null)return;
    pointer=e.pointerId;button.setPointerCapture(pointer);
    play.input.jump=true;play.input.jumpHeld=true;
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,e=>{
    if(e.pointerId===pointer)release();
  });
  win.addEventListener('blur',release);
}
