(function(root){
  'use strict';
  function install({trigger,restart,closeMenu,dismiss}){
    const copy=root.LoftRumbleDemoData.copy.restart;
    const panel=document.createElement('dialog');panel.id='battle-restart';
    panel.setAttribute('aria-labelledby','battle-restart-title');
    const title=document.createElement('h2');title.id='battle-restart-title';title.textContent=copy.title;
    const body=document.createElement('p');body.textContent=copy.body;
    const actions=document.createElement('div');actions.className='restart-actions';
    const confirm=document.createElement('button');confirm.textContent=copy.confirm;
    const cancel=document.createElement('button');cancel.textContent=copy.cancel;
    const settings=trigger.closest('dialog');
    let previousInert=false,previousHidden=null;
    const restoreSettings=()=>{settings.inert=previousInert;
      if(previousHidden===null)settings.removeAttribute('aria-hidden');else settings.setAttribute('aria-hidden',previousHidden)};
    const close=()=>{panel.close();restoreSettings();trigger.focus({preventScroll:true})};
    cancel.onclick=close;
    confirm.onclick=()=>{panel.close();restoreSettings();restart();closeMenu()};
    panel.addEventListener('cancel',event=>{event.preventDefault();close()});
    panel.addEventListener('click',event=>event.stopPropagation());
    // Escape is an explicit cancellation; do not let the underlying settings handler consume it too.
    panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close()}});
    dismiss(panel,close);
    actions.append(confirm,cancel);panel.append(title,body,actions);document.body.append(panel);
    trigger.onclick=()=>{if(!panel.open){previousInert=settings.inert;previousHidden=settings.getAttribute('aria-hidden');
      settings.inert=true;settings.setAttribute('aria-hidden','true');panel.showModal();cancel.focus()}};
  }
  root.LoftRumbleRestart=Object.freeze({install});
})(globalThis);
