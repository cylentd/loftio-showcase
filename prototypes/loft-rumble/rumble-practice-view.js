// Loft Rumble practice view: the practice card under the arena, the cue rail over the arena top, and the replay confirmation.
// Pure DOM. It renders a model from rumble-practice.js and rewrites a node only when its text changes, so drawing every frame is cheap.
(function(root){
  'use strict';
  let card=null,parts=null,rail=null,alertList=null,newsList=null,dialog=null,act=null,shown='',alertShown='',newsShown='';
  const make=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=text;return node};

  function install({copy,act:onAction,replayButton}){
    act=onAction;
    card=make('section','practice-card');card.hidden=true;card.setAttribute('aria-label',copy.panelLabel);
    const head=make('div','practice-head');
    parts={title:make('h2','practice-title'),progress:make('span','practice-progress'),text:make('p','practice-instruction'),row:make('div','practice-actions'),actions:''};
    parts.badge=make('span','practice-badge');parts.badgeText=copy.badge;head.append(parts.title,parts.progress,parts.badge);
    parts.text.dataset.rumbleCue='instruction';parts.text.setAttribute('aria-live','polite');
    card.append(head,parts.text,parts.row);
    document.querySelector('main').append(card);
    // Two lists in one rail: danger and stuns change every frame (countdowns), so they are not live; the news list is the
    // one polite live region for outcomes and readiness, and it keeps a ready special in place across other news.
    rail=make('div','rumble-cues');rail.setAttribute('aria-label',copy.cue.rail);
    alertList=make('ul','rumble-cue-list');newsList=make('ul','rumble-cue-list');
    newsList.setAttribute('aria-live','polite');newsList.setAttribute('aria-label',copy.cue.live);
    rail.append(alertList,newsList);
    document.getElementById('arena').append(rail);
    dialog=make('dialog','practice-confirm');dialog.setAttribute('aria-labelledby','practice-confirm-title');
    const title=make('h2','',copy.confirm.title);title.id='practice-confirm-title';
    const body=make('p','',copy.confirm.body),row=make('div','practice-confirm-actions');
    const accept=make('button','practice-primary',copy.confirm.accept),cancel=make('button','',copy.confirm.cancel);
    accept.type=cancel.type='button';accept.dataset.confirm='accept';cancel.dataset.confirm='cancel';
    row.append(accept,cancel);dialog.append(title,body,row);document.body.append(dialog);
    const menuReplay=document.getElementById('replay-tutorial');menuReplay.textContent=copy.replay;
    const help=document.getElementById('help-panel'),replay=make('button','practice-replay',copy.replay);replay.type='button';
    replay.addEventListener('click',()=>replayButton(replay));
    const resume=help.querySelector('.help-resume');if(resume)resume.before(replay);else help.append(replay);
    shown='';alertShown='';newsShown='';
  }

  // Destructive, so it never closes on a backdrop press: Restart practice or Cancel, and Escape means Cancel.
  // The sheet that holds the trigger (pause menu or help) is covered while the question shows, so only one sheet is on screen;
  // it is uncovered before focus goes back to the trigger.
  function confirm({trigger,accept}){
    const sheet=trigger?.closest('#menu, #help-panel');if(sheet)sheet.dataset.practiceCovered='';
    const close=()=>{dialog.close();dialog.onclick=dialog.onkeydown=dialog.oncancel=null;if(sheet)delete sheet.dataset.practiceCovered};
    const cancel=()=>{close();trigger?.focus({preventScroll:true})};
    dialog.onclick=event=>{const choice=event.target.closest('[data-confirm]')?.dataset.confirm;if(choice==='cancel')cancel();if(choice==='accept'){close();accept()}};
    dialog.onkeydown=event=>{if(event.key!=='Escape')return;event.preventDefault();event.stopPropagation();cancel()};
    dialog.oncancel=event=>{event.preventDefault();cancel()};
    dialog.showModal();dialog.querySelector('[data-confirm="cancel"]').focus({preventScroll:true});
  }

  // The card's nodes persist, so its polite live instruction is updated in place and announced, not re-inserted.
  function renderCard(panel){
    const key=panel?JSON.stringify(panel):'';
    if(key===shown)return;shown=key;
    document.documentElement.toggleAttribute('data-practice',!!panel);
    card.hidden=!panel;parts.badge.textContent=panel?parts.badgeText:'';if(!panel){delete card.dataset.practiceStep;return}
    if(panel.step)card.dataset.practiceStep=panel.step;else delete card.dataset.practiceStep;
    parts.title.textContent=panel.title;parts.progress.textContent=panel.progress??'';parts.progress.hidden=!panel.progress;
    parts.text.textContent=panel.instruction;
    const actions=JSON.stringify(panel.actions);if(actions===parts.actions)return;parts.actions=actions;
    const hadFocus=parts.row.contains(document.activeElement);
    parts.row.replaceChildren(...panel.actions.map(action=>{
      const button=make('button',action.primary?'practice-primary':action.quiet?'practice-quiet':'',action.label);button.type='button';
      button.addEventListener('click',()=>act(action.id));return button}));
    if(hadFocus)(parts.row.querySelector('.practice-primary')??parts.row.firstElementChild)?.focus({preventScroll:true});
  }

  // Rewrites only the items whose text changed, so a steady ready cue is never re-inserted into the live list.
  function renderList(list,cues,previous){
    const key=JSON.stringify(cues);if(key===previous)return key;
    const items=[...list.children];
    cues.forEach((cue,index)=>{
      let item=items[index];
      if(!item){item=make('li','rumble-cue');list.append(item)}
      if(item.dataset.rumbleCue!==cue.kind)item.dataset.rumbleCue=cue.kind;
      if(item.textContent!==cue.text)item.textContent=cue.text;
    });
    for(const extra of items.slice(cues.length))extra.remove();
    return key;
  }

  // Returns true when the card changed, because the card is a grid row and the arena has to be refitted around it.
  function render({panel,alert,news,top}){
    if(!card)return false;
    const before=shown;
    renderCard(panel);rail.style.setProperty('--cue-top',top+'px');
    alertShown=renderList(alertList,alert,alertShown);
    newsShown=renderList(newsList,news,newsShown);
    return shown!==before;
  }

  root.LoftRumblePracticeView=Object.freeze({install,confirm,render});
})(globalThis);
