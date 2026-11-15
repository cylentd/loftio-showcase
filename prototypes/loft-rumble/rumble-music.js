(function(root){
  'use strict';
  // The next track index: random, never the previous one (-1 for none); a one-track list returns its only track.
  function pick(count,previous,random=Math.random){
    const others=Array.from({length:count},(_,i)=>i).filter(i=>i!==previous);
    if(!others.length)return 0;
    return others[Math.floor(random()*others.length)];
  }
  function create(makeAudio=()=>new Audio(),random=Math.random){
    const config=root.LoftRumbleMusicData;
    // trackIndex lives for the page session only; heard is true once the current track has been offered to the player.
    let media=null,context=null,source=null,unlocked=false,enabled=true,paused=false,hidden=false,trackIndex=pick(config.tracks.length,-1,random),heard=false;
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
      const next=pick(config.tracks.length,trackIndex,random);
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
  root.LoftRumbleMusic=Object.freeze({create,pick});
})(globalThis);
