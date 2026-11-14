// Loft Rumble cue rail view: the cue rail over the arena top. Pure DOM. It renders a model from rumble-cues.js and
// rewrites a node only when its text changes, so drawing every frame is cheap.
(function(root){
  'use strict';
  let rail=null,alertList=null,newsList=null,alertShown='',newsShown='';
  const make=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=text;return node};

  function install({copy}){
    // Two lists in one rail: the one danger or stun line changes every frame (countdowns), so it is not live; the news
    // list is the one polite live region for outcomes and readiness, visually hidden since 2026-11-13 (screen readers
    // still hear it), and it keeps a ready special in place across other news.
    rail=make('div','rumble-cues');rail.setAttribute('aria-label',copy.cue.rail);
    alertList=make('ul','rumble-cue-list');newsList=make('ul','rumble-cue-list rumble-cue-news');
    newsList.setAttribute('aria-live','polite');newsList.setAttribute('aria-label',copy.cue.live);
    rail.append(alertList,newsList);
    document.getElementById('arena').append(rail);
    alertShown='';newsShown='';
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

  function render({alert,news,top}){
    if(!rail)return;
    rail.style.setProperty('--cue-top',top+'px');
    alertShown=renderList(alertList,alert,alertShown);
    newsShown=renderList(newsList,news,newsShown);
  }

  root.LoftRumbleCuesView=Object.freeze({install,render});
})(globalThis);
