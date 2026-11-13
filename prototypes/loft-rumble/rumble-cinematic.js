(function(root){
  'use strict';
  function updateSound(sound,muted,data){
    sound.setAttribute('aria-label',muted?data.copy.soundOff:data.copy.soundOn);
    sound.setAttribute('aria-pressed',String(!muted));
    sound.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="'+
      (muted?data.icons.muted:data.icons.sound)+'" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  function surface(data){
    const overlay=document.createElement('section'),video=document.createElement('video');
    overlay.className='rumble-cinematic';overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label',data.copy.label);
    video.muted=true;video.defaultMuted=true;video.playsInline=true;video.autoplay=true;
    video.setAttribute('playsinline','');video.setAttribute('muted','');
    video.setAttribute('aria-hidden','true');video.src=data.source;
    const skip=document.createElement('button'),sound=document.createElement('button');
    skip.textContent=matchMedia('(pointer: coarse)').matches?data.copy.skipTouch:data.copy.skipPointer;
    skip.className='cinematic-skip';
    sound.className='cinematic-sound';updateSound(sound,true,data);
    overlay.append(video,skip,sound);document.body.append(overlay);
    return {overlay,video,skip,sound};
  }
  function play({main,setBlocked}){
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return {done:Promise.resolve(true),dispose(){}};
    const data=root.LoftRumbleCinematicData,{overlay,video,skip,sound}=surface(data);
    let finished=false,resolveDone;const done=new Promise(resolve=>resolveDone=resolve);
    const wasInert=main.inert;main.inert=true;setBlocked(true);
    const events=['pointerdown','pointerup','click','keydown','keyup'];
    function finish(continueToTitle=true){
      if(finished)return;finished=true;clearTimeout(timeout);clearTimeout(hintTimeout);
      for(const type of events)root.removeEventListener(type,input,{capture:true});
      root.removeEventListener('pagehide',dispose);
      video.removeEventListener('ended',release);video.removeEventListener('error',release);
      video.pause();video.removeAttribute('src');video.load();overlay.remove();
      main.inert=wasInert;setBlocked(false);resolveDone(continueToTitle);
    }
    const release=()=>finish(),dispose=()=>finish(false);
    function input(event){
      event.stopImmediatePropagation();
      const onSound=sound.contains(event.target);
      if(event.type==='keydown'&&event.key==='Tab'){
        event.preventDefault();(onSound?skip:sound).focus();return;
      }
      if(event.type==='click'){
        event.preventDefault();
        if(onSound){video.muted=!video.muted;updateSound(sound,video.muted,data);}
        else finish();
      }else if(event.type==='keydown'&&event.key==='Escape'){event.preventDefault();finish();}
    }
    const timeout=setTimeout(release,data.timeoutMs);
    const hintTimeout=setTimeout(()=>skip.setAttribute('data-faded','true'),data.hintDurationMs);
    for(const type of events)root.addEventListener(type,input,true);
    root.addEventListener('pagehide',dispose);
    video.addEventListener('ended',release);video.addEventListener('error',release);
    overlay.tabIndex=-1;overlay.focus();
    try{Promise.resolve(video.play()).catch(release);}catch{release();}
    return {done,dispose};
  }
  root.LoftRumbleCinematic=Object.freeze({play});
})(globalThis);
