// Loft Rumble cue view. Pure DOM: it renders a model from rumble-cues.js and rewrites a node only when its content
// changes, so drawing every frame is cheap. Two parts: the rail (sentences for screen readers, visually hidden since
// 2026-11-14) and the field (names, markers and moments a sighted player sees; hidden from screen readers, which hear
// the same events from the rail).
(function(root){
  'use strict';
  let rail=null,alertList=null,newsList=null,alertShown='',newsShown='';
  let layer=null,attackChip=null,momentNode=null,momentKey='',options=null;
  const art={},ratio={},pins=new Map(),spirals=new Map();
  const make=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=text;return node};
  const url=path=>'url("'+path+'")';

  // Owner art loads once. Until a file has loaded (or when it is missing), nothing is drawn in its place.
  // A sheet's cell ratio (one cell's width over its height) sizes its node, so a trimmed sheet never stretches.
  function preload(paths,cells){
    for(const [key,path] of Object.entries(paths)){
      if(art[key])continue;
      const image=new Image();
      image.onload=()=>{art[key]=path;ratio[key]=image.naturalWidth/(cells[key]??1)/image.naturalHeight};
      image.src=path;
    }
  }

  function install(config){
    options=config;const copy=config.copy;
    // The rail: the one danger or stun sentence changes every frame (countdowns), so it is not live; the news list is
    // the one polite live region for outcomes and readiness. Both are visually hidden; screen readers still reach them.
    rail=make('div','rumble-cues');rail.setAttribute('aria-label',copy.cue.rail);
    alertList=make('ul','rumble-cue-list rumble-cue-alert');newsList=make('ul','rumble-cue-list rumble-cue-news');
    newsList.setAttribute('aria-live','polite');newsList.setAttribute('aria-label',copy.cue.live);
    rail.append(alertList,newsList);
    layer=make('div','rumble-field');layer.setAttribute('aria-hidden','true');
    attackChip=make('p','rumble-attack-name');attackChip.hidden=true;layer.append(attackChip);
    const arena=document.getElementById('arena');arena.append(layer,rail);
    alertShown='';newsShown='';momentKey='';momentNode=null;pins.clear();spirals.clear();
    preload(config.art,config.cells);
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

  // One positioned node per resident, kept across frames; nodes for residents no longer listed are removed.
  function sprites(store,items,className,artKey,decorate){
    const wanted=art[artKey]?items:[];
    for(const [id,node] of store)if(!wanted.some(item=>item.id===id)){node.remove();store.delete(id)}
    for(const item of wanted){
      let node=store.get(item.id);
      if(!node){
        node=make('span',className);node.dataset.resident=item.id;node.style.backgroundImage=url(art[artKey]);
        node.style.setProperty('--cell-ratio',ratio[artKey]);layer.append(node);store.set(item.id,node);
      }
      node.style.setProperty('--x',item.x+'px');node.style.setProperty('--y',item.y+'px');
      decorate?.(node,item);
    }
  }

  function renderAttack(attack){
    attackChip.hidden=!attack;
    if(attack&&attackChip.textContent!==attack.name)attackChip.textContent=attack.name;
  }

  // Dock cards: a glowing portrait and READY in the status line while a special is ready; a draining ring round the
  // greyed portrait while stunned. The ring is the card's child, laid over the portrait's cell, because camera-stun.css
  // greys the portrait and everything inside it. The card's own label already says both, so these are hidden from
  // screen readers.
  function renderDock(field){
    for(const card of document.querySelectorAll('.roster [data-resident]')){
      const id=card.dataset.resident;if(!card.querySelector('.portrait'))continue;
      let stamp=card.querySelector('.rumble-ready'),ring=card.querySelector('.rumble-stun-ring');
      if(!stamp){
        stamp=make('span','rumble-ready',options.copy.field.ready);stamp.setAttribute('aria-hidden','true');
        stamp.style.setProperty('--moment-life',options.life.ready+'s');card.append(stamp);
      }
      if(!ring){ring=make('span','rumble-stun-ring');ring.setAttribute('aria-hidden','true');card.append(ring)}
      const ready=field.ready.includes(id),stun=field.stunned.find(item=>item.id===id);
      stamp.hidden=!ready;ring.hidden=!stun;
      card.classList.toggle('rumble-special-ready',ready);
      if(stun)ring.style.setProperty('--stun-left',stun.left.toFixed(3));
      const stamping=field.moment?.kind==='ready'&&field.moment.id===id;
      if(stamping)stamp.dataset.moment='ready';else delete stamp.dataset.moment;
    }
  }

  // The one moment layer node: a cut-in or a word pop. A READY stamp is drawn on its dock portrait instead.
  function renderMoment(moment){
    const key=moment&&moment.kind!=='ready'?moment.kind+(moment.id??moment.word)+(moment.at?.x??''):'';
    if(key!==momentKey){
      momentNode?.remove();momentNode=null;momentKey=key;
      if(key){
        momentNode=make('div','rumble-moment');momentNode.dataset.moment=moment.kind;
        momentNode.style.setProperty('--moment-life',options.life[moment.kind]+'s');
        if(moment.kind==='cutin'){
          const portrait=document.querySelector('.roster [data-resident="'+moment.id+'"] .portrait img'),image=make('img');
          image.alt='';image.src=portrait?.src??'';
          momentNode.append(image,make('b',null,moment.ability));
        }else{
          momentNode.textContent=moment.text;momentNode.dataset.word=moment.word;
          const plate=art[options.plate[moment.word]];
          if(plate){momentNode.dataset.plate='';momentNode.style.backgroundImage=url(plate)}
        }
        layer.append(momentNode);
      }
    }
    if(momentNode&&moment?.x!=null){momentNode.style.setProperty('--x',moment.x+'px');momentNode.style.setProperty('--y',moment.y+'px')}
  }

  function render({alert,news,top,field}){
    if(!rail)return;
    rail.style.setProperty('--cue-top',top+'px');layer.style.setProperty('--cue-top',top+'px');
    alertShown=renderList(alertList,alert,alertShown);
    newsShown=renderList(newsList,news,newsShown);
    renderAttack(field.attack);
    sprites(pins,field.targets,'rumble-marker','targetMarker',(node,item)=>node.classList.toggle('flash',item.flash));
    sprites(spirals,field.stunned,'rumble-spiral','stunSpiral');
    renderDock(field);
    renderMoment(field.moment);
  }

  root.LoftRumbleCuesView=Object.freeze({install,render,hasArt:key=>!!art[key]});
})(globalThis);
