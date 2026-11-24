// Tap-to-fire specials, the page side (#536, U2a). Keeps one lifecycle state per hero (special-model.js next) in s.specials,
// turns taps and Auto into events, and calls back into the page for the cut-in, the active hook and the ready cue.
// Behind ?specials=tap; without it `on` is false and the page never calls the rest. ?training keeps the old special beat.
(function(root){
  const M=root.LoftRumbleSpecials,D=root.LoftRumbleSpecialData;
  const MS=1000; // pointer timestamps are milliseconds, the tap limit is seconds
  const AUTO='auto';

  // host: {search, s, ids, traitOf(id), swarm(), moving(id), stunned(id), showCutin(id,done), onActive(kind,id), onReady(id), storage}
  function create(host){
    const {s}=host,params=new URLSearchParams(host.search);
    const on=params.get('specials')==='tap'&&!params.has('training');
    let refresh=()=>{};const setting=M.setting.create({storage:host.storage,onChange:()=>refresh()});
    let down=null;

    function send(id,event){
      const before=s.specials[id],resting=!host.moving(id);
      const full=event.type==='tap'||event.type===AUTO?{...event,moving:!resting,stunned:host.stunned(id)}:event;
      const after=M.next(before,full);
      s.specials[id]=after;s.specialCharge[id]=after.charge;
      if(after.phase==='cutin'&&before.phase!=='cutin')host.showCutin(id,()=>send(id,{type:'cutinDone'}));
      if(after.phase==='active'&&before.phase!=='active')host.onActive(after.special,id);
      if(before.phase!=='ready'&&after.phase==='ready')host.onReady(id); // the one source of the READY cue: a bar that fills, or one that filled during a special
    }
    function reset(){s.specialFx=[];s.specials=Object.fromEntries(host.ids.map(id=>[id,M.start(id,host.swarm()?'swarm':'boss',host.traitOf(id))]))}
    function tick(dt){
      if(s.phase!=='play')return;
      for(const id of host.ids){
        send(id,{type:'tick',dt});
        if(setting.get()===AUTO&&s.specials[id].phase==='ready')send(id,{type:AUTO});
      }
    }
    const press=event=>{if(on)down={x:event.clientX,y:event.clientY,t:event.timeStamp,far:0}}; // without the flag there is no tap path to arm
    const move=event=>{if(down)down.far=Math.max(down.far,Math.hypot(event.clientX-down.x,event.clientY-down.y))}; // the farthest the finger went, so a pull out and back is no tap
    // A tap on a ready resident fires its special; the caller then skips the throw. Anything else is the caller's.
    function release(id,event){
      const start=down;down=null;
      if(!start||s.specials[id].phase!=='ready')return false;
      const moved=Math.max(start.far,Math.hypot(event.clientX-start.x,event.clientY-start.y));
      if(!M.isTap(moved,(event.timeStamp-start.t)/MS))return false;
      send(id,{type:'tap'});return true;
    }
    // The dock card: a click is a tap by definition. Not ready or refused: nothing happens.
    const dockTap=id=>{if(on)send(id,{type:'tap'})};
    const charge=(id,amount)=>send(id,{type:'charge',amount});

    // The Settings row: the switch is on for Auto. Same one-button-and-hint shape as the Lab: Swarm row.
    function installSetting(doc,copy){
      const button=doc.createElement('button');button.id='specials-mode';
      const show=()=>{
        const hint=doc.createElement('data');hint.className='settings-hint';hint.textContent=copy.hint;
        button.replaceChildren(copy.label,hint);button.setAttribute('aria-pressed',String(setting.get()===AUTO));
      };
      button.onclick=()=>setting.set(setting.get()===AUTO?D.setting.fallback:AUTO);
      const row=doc.getElementById('reset');row.parentNode.insertBefore(button,row);
      refresh=show;show();
    }
    return Object.freeze({on,setting,reset,send,tick,press,release,dockTap,charge,move,installSetting});
  }
  // Painted Meteor smash, look round (ledger #462), behind ?specials-fx=paint. Lives here, not in a new script, so the
  // release file list (game/build/rumble-files.json) needs no entry. Without the flag nothing is installed and the page's
  // LoftRumbleSpecialFx?.launch hook stays empty, which is today's effect.
  const HALF=2;
  const P=D.paint,METEOR=P.meteor;
  const mode=search=>new URLSearchParams(search).get(P.flag)===P.on?P.on:'default';
  const frame=(offset,scale,opacity,turn)=>({offset,transform:'scale('+scale+') rotate('+turn+'deg)',opacity});
  const turnAt=offset=>METEOR.turnDeg*(offset-1/HALF);
  // Reduced motion: two identical frames, so the still shows at full size and does not move.
  function steps(reduced){
    if(reduced)return [frame(0,1,1,0),frame(1,1,1,0)];
    return [frame(0,METEOR.popFrom,0,turnAt(0)),frame(METEOR.peakAt,METEOR.overshoot,1,turnAt(METEOR.peakAt)),
      frame(METEOR.holdAt,1,1,turnAt(METEOR.holdAt)),frame(1,METEOR.fadeTo,0,turnAt(1))];
  }
  // A square as wide as the burst (radius in arena units, scale = screen px per unit), centred on the landing spot.
  function box(center,radius,scale){const size=HALF*radius*scale;return {left:center.x-size/HALF,top:center.y-size/HALF,size}}
  // host: {search, reduced (read at launch), doc, place(id) -> {x, y, scale} in client px or null, root}
  function install(host){
    if(mode(host.search)!==P.on)return null;
    function launch(what,id){
      const at=what==='meteor'&&host.place(id);
      if(!at)return;
      const b=box(at,D.specials.meteor.boss.radius,at.scale),still=host.reduced;
      const img=host.doc.createElement('img');
      img.src=METEOR.src;img.alt='';img.setAttribute('aria-hidden','true');img.className='special-paint';
      Object.assign(img.style,{position:'fixed',left:b.left+'px',top:b.top+'px',width:b.size+'px',height:b.size+'px',pointerEvents:'none'});
      host.doc.body.append(img);
      const run=img.animate(steps(still),{duration:still?METEOR.reducedMs:METEOR.ms,easing:'ease-out',fill:'forwards'});
      run.onfinish=()=>img.remove();
    }
    const fx=Object.freeze({launch});host.root.LoftRumbleSpecialFx=fx;return fx;
  }
  const paint=Object.freeze({mode,steps,box,install});
  root.LoftRumbleSpecialRuntime=Object.freeze({create,paint});
})(typeof globalThis!=='undefined'?globalThis:this);
