'use strict';
function bootRealtime(direct){
  startRealtime(direct);
  if(direct){window.LoftRumbleDemo.ensureArrivalReturn(document);draw()}
  artwork?.ready.then(()=>{resize();draw()});requestAnimationFrame(frame);
  for(const gesture of ['pointerdown','keydown'])addEventListener(gesture,startAudio,{once:true,capture:true});
  addEventListener('pagehide',()=>music.setHidden(true));
  addEventListener('pageshow',()=>music.setHidden(document.hidden));
}

async function bootArrivalFighter(){
  const arrival=window.rumbleArrival;
  if(arrival?.targeted!==true)return;
  try{
    const sprite=images[ids[0]],limit=window.LoftRumbleArrival.MAX_THUMB_SIDE;
    if(!TEAM.active||sprite?.src!==arrival.team[0].art.src)return;
    await sprite.decode();
    if(!sprite.naturalWidth||!sprite.naturalHeight||sprite.naturalWidth>limit||sprite.naturalHeight>limit)return;
    bootRealtime(true);
  }catch{return;}
  document.body.firstElementChild.inert=false;
  delete document.documentElement.dataset.rumbleArrivalGate;
  delete document.documentElement.dataset.rumblePending;
}

if(Object.hasOwn(document.documentElement.dataset,'rumbleArrivalGate'))void bootArrivalFighter();
else bootRealtime(false);
