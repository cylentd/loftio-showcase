(function(root){
  'use strict';
  function create(makeAudio=()=>new Audio()){
    const config=root.LoftRumbleMusicData;
    let media=null,context=null,source=null,unlocked=false,enabled=true,paused=false,hidden=false;
    function sync(){
      if(!unlocked||!enabled||paused||hidden){media?.pause();return}
      try{
        if(!media){media=makeAudio();media.src=config.src;media.loop=true;media.volume=config.volume}
        if(context&&!source){
          const gain=context.createGain();gain.gain.value=config.volume;
          source=context.createMediaElementSource(media);source.connect(gain);gain.connect(context.destination);media.volume=1;
        }
        if(media.paused)Promise.resolve(media.play()).catch(()=>{});
      }catch{}
    }
    return Object.freeze({
      unlock(audioContext){context=audioContext??context;unlocked=true;sync()},
      setEnabled(value){enabled=value;sync()},
      setPaused(value){paused=value;sync()},
      setHidden(value){hidden=value;sync()},
    });
  }
  root.LoftRumbleMusic=Object.freeze({create});
})(globalThis);
