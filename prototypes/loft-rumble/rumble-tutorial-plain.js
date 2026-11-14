// Loft Rumble Training, plain view: one DOM line beside the acting resident and the Skip and Replay buttons, so the run can
// be played and tested before the real view exists. The view unit (U5) replaces this file with rumble-tutorial-view.js and
// rumble-tutorial-copy.js and sets window.LoftRumbleTutorialView; the stage prefers that. No art is drawn here.
//
// The view contract: onBeat(snapshot), called on every change, where snapshot is
//   {state: {status, beat, phase, tries}, anchor: {id, x, y} | null, gesture: {id, from, to, launch} | null}
// anchor x, y are pixels inside the board, beside the acting resident. gesture is the ghost hand's drag in arena units,
// set only while a beat is showing its demonstration; to is the point the hand pulls back to, and launch is the shot's angle.
(function(root){
  'use strict';
  // Placeholder words until the copy file exists. Selectors for tests are data attributes, never these words.
  const copy={skip:'Skip training',replay:'Replay training',
    confirm:{title:'Restart this fight for Training?',body:'Replaying Training starts a fresh fight and drops the one in progress.',accept:'Restart',cancel:'Cancel'},
    line:{intro:{show:'Training'},sling:{show:'Pull back, then let go',try:'Pull back, then let go',cheer:'Nice sling!'},
      chain:{show:'Sling into a teammate',try:'Sling into a teammate',cheer:'Chain!'},
      weak:{show:'Hit the gold spot',try:'Hit the gold spot',cheer:'Weak spot!'},
      dodge:{show:'Sling Chomper out of the lane',try:'Sling Chomper out of the lane',cheer:'Dodged!'},
      special:{show:'Sling Puff for a special',try:'Sling Puff for a special',cheer:'Special!'},
      graduate:{show:'Training complete',cheer:'Ready to Rumble'}}};
  let line=null,arenaSkip=null,menuSkip=null,dialog=null;
  const make=(tag,text,data)=>{const node=document.createElement(tag);node.textContent=text;if(data)node.dataset.tutorial=data;return node};

  function install({skip,replay,closeMenus}){
    const arena=document.getElementById('arena'),menu=document.getElementById('menu'),help=document.getElementById('help-panel');
    line=document.createElement('p');line.hidden=true;line.setAttribute('aria-live','polite');
    Object.assign(line.style,{position:'absolute',pointerEvents:'none',transform:'translate(-50%,-150%)',margin:0,padding:'var(--gap)',background:'var(--card)',color:'var(--foreground)',borderRadius:'var(--radius)'});
    arenaSkip=make('button',copy.skip,'skip');arenaSkip.type='button';arenaSkip.onclick=skip;
    Object.assign(arenaSkip.style,{position:'absolute',top:'var(--gap)',right:'var(--gap)'});
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

  function onBeat({state,anchor}){
    const on=state.status==='running';
    line.hidden=arenaSkip.hidden=menuSkip.hidden=!on;
    if(!on)return;
    line.dataset.tutorialBeat=state.beat;line.dataset.tutorialPhase=state.phase;
    line.textContent=copy.line[state.beat][state.phase]??copy.line[state.beat].show;
    const board=document.getElementById('board');
    Object.assign(line.style,{left:board.offsetLeft+anchor.x+'px',top:board.offsetTop+anchor.y+'px'});
  }

  root.LoftRumbleTutorialPlain={install,onBeat,confirmReplay};
})(globalThis);
