(function(root){
  'use strict';
  // Hero art lookup (owner report 2026-11-21: a loft resident in slot 2 fought as itself but was drawn as Chomper).
  // Pure. The page's slot ids (sprout, chomper, custom) are internal keys; what a slot DRAWS comes from its resident:
  //   own     the resident's own drawn art (slot.art, a data-URL image)
  //   portrait the Rumble portrait for its resident id (LoftRumbleDemoData.results.art, the one table of known heroes)
  //   slot    the demo trio (no saved team): the page's built-in art for the slot id, exactly as before
  //   missing a roster resident with neither: no src, so a caller never lends it another hero's look; count it with missing()
  // Every hero draw (body, toast, cut-in, dock card, end screen) reads forTeam(), never the slot id.
  const KINDS=Object.freeze({own:'own',portrait:'portrait',slot:'slot',missing:'missing'});
  const known=()=>root.LoftRumbleDemoData.results.art;

  const resolve=(slot,demo)=>{
    if(demo)return Object.freeze({kind:KINDS.slot,key:slot.id,src:null});
    const key=slot.residentId;
    if(slot.art?.src)return Object.freeze({kind:KINDS.own,key,src:slot.art.src});
    if(Object.hasOwn(known(),key))return Object.freeze({kind:KINDS.portrait,key,src:known()[key]});
    return Object.freeze({kind:KINDS.missing,key,src:null});
  };

  // `team` is LoftRumbleSlotFill's result; the answer is keyed by slot id.
  const forTeam=team=>Object.freeze(Object.fromEntries(team.slots.map(slot=>[slot.id,resolve(slot,team.source!=='roster')])));
  const missing=team=>Object.values(forTeam(team)).filter(look=>look.kind===KINDS.missing).length;

  // Applies a saved team to the page: the body, toast and cut-in images (`images`, keyed by slot id) and the dock card portrait.
  // The card is marked own-art so the HUD's canonical-portrait swap and the end screen keep what the card shows. The demo trio
  // is left alone. A missing resident gets an image with no src and a card with no portrait, never another hero's.
  const OWN_ART_ATTR='data-own-art';
  const apply=(team,images,doc)=>{
    if(team?.source!=='roster')return;
    for(const [id,look] of Object.entries(forTeam(team))){
      const card=doc.querySelector('.roster [data-resident="'+id+'"]'),shown=card?.querySelector('.portrait img');
      images[id]=new root.Image();
      if(look.src)images[id].src=look.src;
      card?.setAttribute(OWN_ART_ATTR,'');
      if(!shown)continue;
      if(look.src)shown.src=look.src;else shown.removeAttribute('src');
    }
  };

  const api=Object.freeze({KINDS,resolve,forTeam,missing,apply});
  root.LoftRumbleHeroArt=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
