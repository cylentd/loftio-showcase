// Loft Rumble cue view. Pure DOM: it renders a model from rumble-cues.js and rewrites a node only when its content
// changes, so drawing every frame is cheap. Two parts: the rail (sentences for screen readers, visually hidden since
// 2026-11-14) and the field (names, markers and moments a sighted player sees; hidden from screen readers, which hear
// the same events from the rail).
(function(root){
  'use strict';
  let rail=null,alertList=null,newsList=null,alertShown='',newsShown='';
  let layer=null,attackChip=null,momentNode=null,momentKey='',options=null,shownTop=null;
  // Measured once per sticker (its peak width) and once per layer resize, never every frame.
  let momentWidth=0,layerWidth=0;
  const measureLayer=()=>{layerWidth=layer?layer.clientWidth:0};
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
    alertShown='';newsShown='';momentKey='';shownTop=null;momentNode=null;pins.clear();spirals.clear();
    preload(config.art,config.cells);
    // The arena is sized by its own resize() after boot, with no window resize, so the layer itself is observed.
    layerWidth=0;if(root.ResizeObserver)new ResizeObserver(measureLayer).observe(layer);
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

  // Dock cards: a glowing portrait while a special is ready (no READY text, owner 2026-11-15); a draining ring round the
  // greyed portrait while stunned. The ring is the card's child, laid over the portrait's cell, because camera-stun.css
  // greys the portrait and everything inside it. The card's own label already says both, so these are hidden from
  // screen readers.
  function renderDock(field){
    for(const card of document.querySelectorAll('.roster [data-resident]')){
      const id=card.dataset.resident;if(!card.querySelector('.portrait'))continue;
      let ring=card.querySelector('.rumble-stun-ring');
      if(!ring){ring=make('span','rumble-stun-ring');ring.setAttribute('aria-hidden','true');card.append(ring)}
      const ready=field.ready.includes(id),stun=field.stunned.find(item=>item.id===id);
      if(ring.hidden!==!stun)ring.hidden=!stun;
      card.classList.toggle('rumble-special-ready',ready);
      const left=stun?.left.toFixed(3);
      if(stun&&ring.style.getPropertyValue('--stun-left')!==left)ring.style.setProperty('--stun-left',left);
    }
  }

  // A word sticker is centred on its anchor, so one anchored near an arena edge would hang outside the layer and be
  // clipped. This keeps its whole width inside; one as wide as the layer or wider is centred. The width passed is the
  // pop's peak width (the rumble-word keyframes scale it past full size, about its centre), so the pop never clips.
  function clampCentre(x,width,layerWidth){
    if(width>=layerWidth)return layerWidth/2;
    return Math.min(Math.max(x,width/2),layerWidth-width/2);
  }

  // The sticker's peak width: its layout width times the pop overshoot read from the CSS (--field-word-over).
  function peakWidth(node){
    const over=parseFloat(getComputedStyle(node).getPropertyValue('--field-word-over'));
    return node.offsetWidth*(over>1?over:1);
  }

  // The one moment layer node: a cut-in or a word pop.
  function renderMoment(moment){
    const key=moment?moment.kind+(moment.id??moment.word)+(moment.at?.x??''):'';
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
        momentWidth=moment.x!=null?peakWidth(momentNode):0;
      }
    }
    if(momentNode&&moment?.x!=null){
      if(!layerWidth)measureLayer();
      const x=clampCentre(moment.x,momentWidth,layerWidth);
      momentNode.style.setProperty('--x',x+'px');momentNode.style.setProperty('--y',moment.y+'px');
    }
  }

  function render({alert,news,top,field}){
    if(!rail)return;
    if(top!==shownTop){shownTop=top;rail.style.setProperty('--cue-top',top+'px');layer.style.setProperty('--cue-top',top+'px')}
    alertShown=renderList(alertList,alert,alertShown);
    newsShown=renderList(newsList,news,newsShown);
    renderAttack(field.attack);
    sprites(pins,field.targets,'rumble-marker','targetMarker',(node,item)=>node.classList.toggle('flash',item.flash));
    sprites(spirals,field.stunned,'rumble-spiral','stunSpiral');
    renderDock(field);
    renderMoment(field.moment);
  }

  root.LoftRumbleCuesView=Object.freeze({install,render,clampCentre,hasArt:key=>!!art[key]});
})(globalThis);
