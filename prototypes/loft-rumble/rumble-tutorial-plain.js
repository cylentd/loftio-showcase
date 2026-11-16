// Loft Rumble Training, plain view: one DOM line beside the acting resident and the Skip and Replay buttons, so the run can
// be played and tested before the real view exists. The view unit (U5) replaces this file with rumble-tutorial-view.js and
// rumble-tutorial-copy.js and sets window.LoftRumbleTutorialView; the stage prefers that. No art is drawn here.
//
// The view contract: onBeat(snapshot), called on every change, where snapshot is
//   {state: {status, beat, phase, tries}, style: 'fling' | 'sling', top, anchor: {id, x, y} | null,
//    gesture: {id, from, to, launch, motion} | null}
// style is the throw style in use; the stage calls onBeat again when it changes. top is the px height of the HUD drawn
// across the board's top (the boss bar), so nothing is placed over it. anchor x, y are pixels inside the board,
// beside the acting resident. gesture is the ghost hand's drag in arena units, set only while a beat is showing its
// demonstration; to is where the hand ends, launch is the shot's angle, and motion is 'swipe' (fling: the hand moves toward
// the shot) or 'pull' (sling: it pulls back against it).
(function(root){
  'use strict';
  // Placeholder words until the copy file exists. Selectors for tests are data attributes, never these words.
  // The boss's one name is LoftRumbleDemoData.copy.boss (loaded first on the page); 'the boss' only if that file is absent.
  const boss=root.LoftRumbleDemoData?.copy.boss??'the boss';
  const copy={skip:'Skip training',replay:'Replay training',
    confirm:{title:'Restart this battle for Training?',body:'Replaying Training starts a fresh battle and drops the one in progress.',accept:'Restart',cancel:'Cancel'},
    line:{intro:{show:'Training'},weak:{show:'Hit the weak spot',try:'Hit the weak spot',cheer:'Weak spot!'},
      graduate:{show:'Training complete',cheer:'Ready to Rumble'}},
    // Beats that name the gesture, keyed by throw style (one style at a time, owner 2026-11-15). The beat id 'sling' is the
    // first lesson's name in the script, whatever the style. The id 'chain' is the bump lesson; its words say bump.
    byStyle:{
      fling:{sling:{show:'Swipe toward '+boss,try:'Swipe toward '+boss,cheer:'Nice fling!'},
        chain:{show:'Fling into a teammate',try:'Fling into a teammate',cheer:'Bump!'},
        dodge:{show:'Fling Chomper out of the lane',try:'Fling Chomper out of the lane',cheer:'Dodged!'},
        special:{show:'Fling Puff for a special',try:'Fling Puff for a special',cheer:'Special!'}},
      sling:{sling:{show:'Pull back, then let go',try:'Pull back, then let go',cheer:'Nice sling!'},
        chain:{show:'Sling into a teammate',try:'Sling into a teammate',cheer:'Bump!'},
        dodge:{show:'Sling Chomper out of the lane',try:'Sling Chomper out of the lane',cheer:'Dodged!'},
        special:{show:'Sling Puff for a special',try:'Sling Puff for a special',cheer:'Special!'}}}};
  let line=null,arenaSkip=null,menuSkip=null,dialog=null;
  const make=(tag,text,data)=>{const node=document.createElement(tag);node.textContent=text;if(data)node.dataset.tutorial=data;return node};

  function install({skip,replay,closeMenus}){
    const arena=document.getElementById('arena'),menu=document.getElementById('menu'),help=document.getElementById('help-panel');
    line=document.createElement('p');line.hidden=true;line.setAttribute('aria-live','polite');
    // The line and Skip sit over bright arena art, so they carry the dock's plate and ink (contrast, L9): rumble-stage.css.
    line.className='rumble-training-line';
    arenaSkip=make('button',copy.skip,'skip');arenaSkip.type='button';arenaSkip.onclick=skip;
    // Top right of the board, under the boss bar (onBeat sets top): the arena's own corners hold the HP readout and team bar.
    arenaSkip.className='rumble-training-skip';
    arena.append(line,arenaSkip);
    menuSkip=make('button',copy.skip,'skip');menuSkip.type='button';
    menuSkip.onclick=()=>{closeMenus();skip()};
    menu.insertBefore(menuSkip,document.getElementById('replay-tutorial'));
    document.getElementById('replay-tutorial').textContent=copy.replay;
    const again=make('button',copy.replay,'replay');again.type='button';
    again.onclick=()=>replay(again);
    const resume=help.querySelector('.help-resume');
    if(resume)resume.before(again);else help.append(again);
    dialog=document.createElement('dialog');dialog.dataset.tutorial='confirm';
    const accept=make('button',copy.confirm.accept,'confirm-accept'),cancel=make('button',copy.confirm.cancel,'confirm-cancel');
    accept.type=cancel.type='button';
    dialog.append(make('h2',copy.confirm.title),make('p',copy.confirm.body),accept,cancel);
    document.body.append(dialog);
  }

  // Destructive, so it never closes on a backdrop press: Restart or Cancel, and Escape means Cancel. Cancel returns focus to the trigger.
  function confirmReplay(accept,trigger){
    const close=()=>{dialog.close();dialog.onkeydown=dialog.oncancel=null;dialog.onclick=null};
    const cancel=()=>{close();trigger?.focus({preventScroll:true})};
    dialog.onclick=event=>{
      const choice=event.target.closest?.('[data-tutorial]')?.dataset.tutorial;
      if(choice==='confirm-cancel')cancel();
      if(choice==='confirm-accept'){close();accept()}
    };
    dialog.oncancel=event=>{event.preventDefault();cancel()};
    dialog.showModal();dialog.querySelector('[data-tutorial="confirm-cancel"]').focus({preventScroll:true});
  }

  function onBeat({state,anchor,style,top}){
    const on=state.status==='running';
    line.hidden=arenaSkip.hidden=menuSkip.hidden=!on;
    if(!on)return;
    line.dataset.tutorialBeat=state.beat;line.dataset.tutorialPhase=state.phase;
    const words=copy.byStyle[style][state.beat]??copy.line[state.beat];
    line.textContent=words[state.phase]??words.show;
    // Centred over the resident, but kept inside the board, the edge gap clear of its rim (--stage-training-edge), so a
    // resident near a wall never pushes the words onto it.
    const board=document.getElementById('board'),edge=parseFloat(getComputedStyle(line).getPropertyValue('--stage-training-edge'))||0;
    const half=line.offsetWidth/2+edge;
    const x=Math.min(Math.max(anchor.x,half),board.offsetWidth-half);
    Object.assign(line.style,{left:board.offsetLeft+x+'px',top:board.offsetTop+anchor.y+'px'});
    arenaSkip.style.top='calc('+(board.offsetTop+top)+'px + var(--gap))';
  }

  root.LoftRumbleTutorialPlain={install,onBeat,confirmReplay,copy};
})(globalThis);
