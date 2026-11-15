(function(root){
  'use strict';
  function create(makeAudio=()=>new Audio()){
    const config=root.LoftRumbleMusicData;
    // trackIndex lives for the page session only; heard is true once the current track has been offered to the player.
    let media=null,context=null,source=null,unlocked=false,enabled=true,paused=false,hidden=false,trackIndex=0,heard=false;
    function sync(){
      if(!unlocked||!enabled||paused||hidden){media?.pause();return}
      try{
        if(!media){media=makeAudio();media.src=config.tracks[trackIndex];media.loop=true;media.volume=config.volume}
        if(context&&!source){
          const gain=context.createGain();gain.gain.value=config.volume;
          source=context.createMediaElementSource(media);source.connect(gain);gain.connect(context.destination);media.volume=1;
        }
        heard=true;
        if(media.paused)Promise.resolve(media.play()).catch(()=>{});
      }catch{}
    }
    function startFight(){
      if(!heard)return;
      heard=false;
      const next=(trackIndex+1)%config.tracks.length;
      if(next!==trackIndex){media.src=config.tracks[next];media.pause()}
      trackIndex=next;
      sync();
    }
    return Object.freeze({
      unlock(audioContext){context=audioContext??context;unlocked=true;sync()},
      setEnabled(value){enabled=value;sync()},
      setPaused(value){paused=value;sync()},
      setHidden(value){hidden=value;sync()},
      startFight,
    });
  }
  root.LoftRumbleMusic=Object.freeze({create});
})(globalThis);
