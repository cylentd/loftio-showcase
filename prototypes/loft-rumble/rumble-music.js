(function(root){
  'use strict';
  // The next track index: random, never the previous one (-1 for none); a one-track list returns its only track.
  function pick(count,previous,random=Math.random){
    const others=Array.from({length:count},(_,i)=>i).filter(i=>i!==previous);
    if(!others.length)return 0;
    return others[Math.floor(random()*others.length)];
  }
  function create(makeAudio=()=>new Audio(),random=Math.random,options={}){
    const config=root.LoftRumbleMusicData;
    const valid=value=>config.selections.some(choice=>choice.id===value)?value:'shuffle';
    let storage=null,selection='shuffle';
    try{storage=options.storage??root.localStorage;selection=valid(storage?.getItem(config.selectionKey))}catch{}
    // trackIndex lives for the page session only; heard is true once the current track has been offered to the player.
    let media=null,context=null,source=null,unlocked=false,enabled=true,paused=false,hidden=false,trackIndex=pick(config.tracks.length,-1,random),heard=false;
    if(selection!=='shuffle')trackIndex=config.selections.findIndex(choice=>choice.id===selection)-1;
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
      if(!heard||selection!=='shuffle')return;
      heard=false;
      const next=pick(config.tracks.length,trackIndex,random);
      if(next!==trackIndex){media.src=config.tracks[next];media.pause()}
      trackIndex=next;
      sync();
    }
    function setSelection(value){
      const next=valid(value);
      if(next===selection)return;
      selection=next;
      try{storage?.setItem(config.selectionKey,selection)}catch{}
      if(selection==='shuffle')return;
      const index=config.selections.findIndex(choice=>choice.id===selection)-1;
      if(index===trackIndex)return;
      trackIndex=index;
      if(media){media.pause();media.src=config.tracks[trackIndex]}
      sync();
    }
    return Object.freeze({
      getSelection:()=>selection,
      setSelection,
      unlock(audioContext){context=audioContext??context;unlocked=true;sync()},
      setEnabled(value){enabled=value;sync()},
      setPaused(value){paused=value;sync()},
      setHidden(value){hidden=value;sync()},
      startFight,
    });
  }
  function picker(music,button){
    const config=root.LoftRumbleMusicData,row=document.createElement('label'),select=document.createElement('select');
    row.id='music-track-row';row.htmlFor='music-track';row.textContent=config.selectionLabel;
    select.id='music-track';select.setAttribute('aria-label',config.selectionLabel);
    for(const choice of config.selections){const option=document.createElement('option');option.value=choice.id;option.textContent=choice.label;select.append(option)}
    select.value=music.getSelection();select.onchange=()=>music.setSelection(select.value);
    row.append(select);button.after(row);
    return select;
  }
  root.LoftRumbleMusic=Object.freeze({create,pick,picker});
})(globalThis);
