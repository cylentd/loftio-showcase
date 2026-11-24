'use strict';
const stage=document.getElementById('stage'),board=document.getElementById('board'),ctx=board.getContext('2d'),arena=document.getElementById('arena'),feedback=document.getElementById('feedback');
const artwork=window.LoftRumbleArt,artPaint=(...args)=>artwork?.paint(ctx,...args)??false;
// ---- Real-time rules (round 9): no turns. Fling any ready resident at any moment; the enemy acts on a clock. ----
// Seconds unless noted. Everything else (glide, aim, gauge, bars, cut-ins) is the turn-based FEEL block, unchanged.
const RT={
  hp:2800,                               // enemy HP. Round 17 sim (40 battles, recharge off, 0.8 s aim): rotating bot median 36.8 s, Heavy-only 54.1 s; bot 33-40 s matches the 45-70 s average-player target
 teamHP:100,
 recharge:{springy:1.6,piercing:2,heavy:2.4}, // ring fill time from launch; a resident flings again once it has stopped and its ring is full
 firstAttack:7,attackEvery:7,           // enemy clock: first attack, then one every attackEvery seconds (owner brief: Pulse every ~7 s)
 telegraph:3,                           // the last telegraph seconds of the countdown show the attack's locked zone (Beam, Slam) and warn for Pulse
 nameFlash:.45,                         // attack-name flash before the windup; input is never locked in real time
 pulseDamage:12,beamHit:14,slamHit:16,  // Pulse hits the team for this in total; Beam and Slam hit each resident inside the zone. Round 19: from 16/20/22 so a slow player (sim: 2.5 s between flings, no dodging) wins 61% (n=80) with horns and shield in, up from 22%
 comboWindow:.8,                        // pending damage drains this long after the last hit, as one total
 bumpShake:5,bumpSparks:10,            // two moving residents collide: shake and sparks (each fires its ability, as a bump)
 heal:24,heartRadius:14,                // heart pickup after each enemy attack
 barAliveMin:1,                         // lowest team HP the bar shows while the team lives (a heal still flying never hides it down to 0)
 statusStep:.1,                         // seconds between status-line refreshes
 rechargeRing:4,rechargeAlpha:.55,      // recharge ring width round each resting resident; art opacity while it refills
 intentArc:2,                           // width of the countdown arc round the intent chip's seconds dot
 // Round 10 bullet time: while a pulled aim is held and Focus remains, the world runs at slowFactor.
 slowFactor:.25,                        // world speed in bullet time (enemy clock, gliding residents, bolts, particles)
 focusMax:3,focusDrain:1,               // Focus: seconds of slow-mo when full; Focus spent per real second of bullet time
 focusRefill:10,focusHit:.25,           // seconds from empty to full while not slowed; Focus refilled per enemy hit
 slowVignette:.3,slowPulse:3            // bullet-time edge darkening (opacity) and its pulse (rad/s; steady under reduced motion)

};
// The saved team (#443 B3a, rumble-team-apply.js): inactive with no roster, and the fight is the demo trio as before.
const TEAM=window.LoftRumbleTeamApply.plan(window.rumbleTeam,Object.keys(traits));
C.hp=RT.hp;const ids=TEAM.ids??['sprout','chomper','custom'],TURN={order:ids,hp:RT.teamHP,heal:RT.heal,heartRadius:RT.heartRadius};
const s={w:C.arenaW,h:C.arenaH,scale:1,timing:true,gaugeT:0,custom:'springy',paused:false,bodies:{},positions:{},held:null,pointer:null,ax:0,ay:0,px:0,py:0,pulled:false,focus:RT.focusMax,slow:false,clock:0,phase:'play',hp:RT.hp,teamHP:RT.teamHP,particles:[],rings:[],popups:[],bolts:[],synHits:[],synArcs:[],synFields:[],bubbles:{},supportRings:[],teamEffects:[],reactions:{},banners:[],splash:{},introduced:{},specialCharge:{},toasts:[],flings:0,time:0};
let last=0,colors={};const images={};for(const key in art){images[key]=new Image();images[key].src=art[key]}window.LoftRumbleHeroArt.apply(window.rumbleTeam,images,document); // each slot draws its resident, not the hero its slot id names (rumble-hero-art.js)
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),kind=id=>TEAM.trait?.[id]??(id==='sprout'?'springy':id==='chomper'?'heavy':s.custom),profile=b=>traits[kind(b.id)];
let camera=null;
const cues=window.LoftRumbleCues; // rumble-cues.js: the battle cue rail; every hook is a no-op until installed
const tutorial=window.LoftRumbleTutorialStage; // rumble-tutorial-stage.js: the scripted Training run on a first visit; hooks are no-ops until installed
const stunned=body=>!!camera&&window.LoftRumbleStun.active(body);
const baseEnemy=()=>{const fallback={x:s.w*C.enemyX,y:s.h*C.enemyY,angle:s.bossAngle??C.weakAngle};return camera?window.LoftRumbleEncounters.enemy(s,fallback):fallback};
function enemy(){const e=camera?.enemy()??baseEnemy();return camera&&LoftRumbleStorybook.enabled(camera)?{...e,facing:LoftRumbleWhiplashLook.paintedFacing}:e}
const random=()=>camera?camera.random():Math.random();
function message(text){if(camera?.predicting)return;feedback.textContent=text}
function cancelHold(){if(!camera?.predicting){document.querySelector('[data-grabbed]')?.removeAttribute('data-grabbed');dragFeel.cancel();board.classList.remove('held')}s.held=null;s.pointer=null}
const names={...PAGE.name,...TEAM.names};s.synergy=TEAM.synergy;s.teamActive=TEAM.active; // mutable: the demo renames the third resident
const abilities=PAGE.abilityName,specials=PAGE.specialName;
// Prototype ability tuning: fixed damage avoids a second weak-spot multiplier.
// Ability numbers live in the synergy registry (rumble-synergy-data.js): syn('seed-burst').damage, and so on. The three read-only
// getters below keep the frozen browser checks (check_realtime*.py) working; they read the registry, they hold no number.
const SYN=window.LoftRumbleSynergy,syn=id=>SYN.numbers(id,'boss');
const A={radius:18,effectLife:.65,overdrive:1.4,heavySpecial:55,pierceSpecial:40,get shockDamage(){return syn('shockwave').damage},get shockRange(){return syn('shockwave').range},get burstCount(){return syn('seed-burst').count}};
const specialBonus={springy:0,heavy:A.heavySpecial,piercing:A.pierceSpecial}; // first-contact bonus each special adds, for the cue rail
const clockText=(t=battleSeconds())=>window.LoftRumbleDemo.clock(t);const battleSeconds=()=>camera&&window.LoftRumbleSwarmRuntime.active(camera)?window.LoftRumbleSwarmRuntime.state(camera).t:s.time; // one battle time: the swarm model's own clock when a swarm runs, so header and end card agree
function newBody(id){const [x,y]=START[id];return{id,x:s.w*x,y:s.h*y,vx:0,vy:0,angle:0,moving:false,glide:null,walls:0,cool:0,inside:false,used:[],charge:1,boost:null,special:null,specialTriggered:false,squash:null,counter:0,pulse:0,ping:0,stun:0}}
// Tap-to-fire specials (#536, ?specials=tap; special-runtime.js). applySpecial is U2b's: the effects themselves.
let specialStore=null;try{specialStore=localStorage}catch{}
// The name a cut-in and the reduced-motion banner show: the tap-to-fire special's own name with the flag on, today's name without it. One line: special-effects.test.cjs reads it from this file.
const specialLabel=id=>tapOn?window.LoftRumbleSpecials.specialFor(id,kind(id)).name:specials[kind(id)];
const specialsRt=window.LoftRumbleSpecialRuntime.create({search:location.search,s,ids,storage:specialStore,traitOf:id=>kind(id),swarm:()=>swarmOn(),moving:id=>s.bodies[id].moving||s.bodies[id].charge<1,stunned:id=>stunned(s.bodies[id]),
 showCutin:(id,done)=>{if(still()){queueBanner({text:specialLabel(id)+'!',colour:'warning',max:FEEL.cutinTime,now:true});done()}else startCutin({kind:'special',id,name:specialLabel(id),max:FEEL.cutinTime,done})},
 onActive:(what,id)=>{window.LoftRumbleStats.creditSpecial(s.fightStats,id);window.LoftRumbleSpecialFx?.launch?.(what,id);applySpecial(what,id)},onReady:id=>specialReady(id)});
const tapOn=specialsRt.on;s.tapSpecials=tapOn;window.LoftRumbleSpecialMode=specialsRt.setting;
// Painted Meteor smash, look round (#462, ?specials-fx=paint): a painted still at the resident's screen spot. Without the flag nothing installs.
window.LoftRumbleSpecialRuntime.paint.install({search:location.search,get reduced(){return reduced.matches},doc:document,root:window,
 place:id=>{const body=s.bodies[id];if(!body)return null;const at=camera?camera.projection.project({x:body.x,y:body.y}):body,box=document.getElementById('board').getBoundingClientRect();
  return {x:box.left+at.x*s.scale,y:box.top+at.y*s.scale,scale:s.scale}}});
// U2b: a tapped special's on-field effect. One call per tap (the engine's onActive); Meteor: the hero leaps onto the nearest live enemy (boss or swarm
// monster, burst width of the mode), the others play at the caster. With the painted Meteor look round on (?specials-fx=paint) the painted still is
// Meteor's effect, so the code-drawn one stays out of its way. Kept on one line: special-effects.test.cjs reads it from this file.
function applySpecial(what,id){const M=window.LoftRumbleSpecials,meteor=what===window.LoftRumbleSpecialData.specials.meteor.id;if(!tapOn||(meteor&&window.LoftRumbleSpecialFx))return;const b=s.bodies[id],from={x:b.x,y:b.y},spot=meteor?M.meteorSpot(from,(camera?camera.enemies():[baseEnemy()]).map(e=>({x:e.x,y:e.y,hp:1})),s.specials[id].mode):from;if(!spot)return;const fx=M.fx.start(what,meteor?{...spot,from,id}:spot);if(fx)(s.specialFx??=[]).push(fx)}
function reset(){window.LoftRumbleSwarmLab?.begin(camera);s.whipTail=null;s.battleEnd=window.LoftRumbleBattleEnd.initial();camera?.resetScene();cues.reset();s.fightStats=window.LoftRumbleStats.fresh(ids);window.LoftRumbleDemo?.reset(s);music.setPaused(false);cancelHold();for(const id in cardState)delete cardState[id];
 const stageLayout=tutorial.layout(s.demo?window.LoftRumbleStageLayoutData.options.find(layout=>layout.id===window.LoftRumbleStageLayoutData.defaultId):window.LoftRumbleStageLayouts?.current());if(stageLayout)FEEL.bumpers=stageLayout.bumpers.map(point=>[...point]);

 s.bodies=Object.fromEntries(ids.map(id=>[id,newBody(id)]));s.positions=s.bodies;
 Object.assign(s,{phase:'play',won:false,time:0,hp:RT.hp,teamHP:RT.teamHP,enemyT:RT.firstAttack,attackIndex:0,warn:null,attackFx:null,tally:null,comboT:0,combos:0,payoff:null,heart:null,hitStop:0,stopAt:null,reactions:{},particles:[],rings:[],popups:[],bolts:[],synHits:[],synArcs:[],synFields:[],bubbles:{},supportRings:[],teamEffects:[],shake:0,shakeDir:null,shakes:[],shakeN:0,attackShake:null,vignette:0,enemyFlash:0,enemyHit:null,enemyChip:RT.hp,enemyDrain:0,enemyWait:0,enemyBarFlash:0,teamShown:RT.teamHP,teamChip:RT.teamHP,teamHold:0,teamBarHit:0,teamFly:0,teamFlyFlash:null,heals:[],teamFlash:null,lastHit:null,banners:[],cutin:null,cutinSeen:{},flashes:[],splash:{},toasts:[],flings:0,statusT:0,focus:RT.focusMax,slow:false,gaugeT:0,streak:0,flash:0,kick:null,userPaused:false});board.classList.remove('slow');document.getElementById('pause')?.setAttribute('aria-pressed','false');
 s.tutor=window.rumbleArrival?.targeted!==true&&(stageLayout?.id==='tutorial'||!tutorSeen())?{pull:false,bump:false,zone:false}:null;s.bumperHits=FEEL.bumpers.map(()=>0);s.finale=null;s.finaleCount=0;s.shield={angle:FEEL.shieldStart,hp:GUARD.hp,cracks:0,down:0,seen:false,up:1};Object.assign(s,{hits:0,hitsIdle:0,hitsPeak:0,hitsPop:0,hitsLost:null,hitBreaks:{attack:0,timeout:0}});
 if(FEEL.allyIntroPerBattle)s.introduced={};s.specialCharge=Object.fromEntries(ids.map(id=>[id,0]));if(s.tapSpecials)specialsRt.reset();
 if(camera){window.LoftRumbleEncounters.apply(s,FEEL);window.LoftRumbleSwarmRuntime?.place(camera);camera.baseBumpers=structuredClone(FEEL.bumpers);s.bumperHits=FEEL.bumpers.map(()=>0);window.LoftRumbleEncounters.sync(s)}
 tutorial.reset();describe();health();teamText();statusLine();roster();message(throwWords().start);window.LoftRumbleDemo?.present(s,false)}
function describe(){if(camera?.predicting)return;for(const id of ids){const card=document.querySelector('.roster [data-resident="'+id+'"]');card.querySelector('b').textContent=names[id];card.querySelector('em').textContent=traits[kind(id)].name}
 for(const card of document.querySelectorAll('.roster [data-resident]'))card.style.display=TEAM.showsCard(card.dataset.resident)?'':'none';   // a team of fewer than three shows only its heroes
 document.getElementById('reroll').hidden=TEAM.rerollHidden(s.demo);document.getElementById('reroll').disabled=s.flings>0}
/* A new fight is the only moment the music changes track; trait, layout and tutorial resets keep it. */
function playAgain(){music.startFight();reset()}
function reroll(){if(s.flings>0)return;const options=Object.keys(traits).filter(k=>k!==s.custom);s.custom=options[Math.floor(Math.random()*options.length)];reset();message(phrase(COPY.newTrait,{name:traits[s.custom].name}))}
// Fit the fixed logical arena into the stage, keeping its aspect; the canvas backing store follows devicePixelRatio.
// Fit by the stage's height and main's full width (not the column, which follows the arena), then size the column to the arena.
const PIXEL_SLACK=1e-6;let arenaFont='',boardAt={x:0,y:0}; // float slack, so a width that is already whole pixels is not floored one pixel short
function resize(){const edge=arena.offsetWidth-arena.clientWidth,main=stage.parentElement,pad=parseFloat(getComputedStyle(main).paddingLeft)*2,fit=Math.max(.1,Math.min((main.clientWidth-pad-edge)/C.arenaW,(stage.clientHeight-edge)/C.arenaH));
  // Whole bitmap pixels across, so the canvas transform and the board's pixel width give the same scale.
  const dpr=Math.min(window.devicePixelRatio||1,window.LoftRumbleHudData?.maxCanvasDpr??Infinity),k=Math.floor(C.arenaW*fit*dpr+PIXEL_SLACK)/(C.arenaW*dpr);arena.style.width=C.arenaW*k+edge+'px';arena.style.height=C.arenaH*k+edge+'px';s.scale=k;document.documentElement.style.setProperty('--col',Math.floor(C.arenaW*k+edge)+'px');
  board.width=Math.round(C.arenaW*k*dpr);board.height=Math.round(C.arenaH*k*dpr);ctx.setTransform(k*dpr,0,0,k*dpr,0,0);arena.style.setProperty('--k',k);arena.style.setProperty('--hud-bottom',C.hudBottom*k+'px');for(const key of ['foreground','primary','good','warning','border','secondary','muted-foreground','danger','chip','flash','track','card','pending','boss-beam','slam','perfect','seed','seed-glow','beam-fire','beam-core','rumble-cream','rumble-ink']){const probe=document.createElement('span');probe.style.color='var(--'+key+')';arena.append(probe);colors[key]=getComputedStyle(probe).color;probe.remove()}arenaFont=getComputedStyle(arena).fontFamily;boardAt={x:board.offsetLeft,y:board.offsetTop}} // read once per resize, never per frame
// A ready resident (stopped, ring full) launches at full trait speed; a charged special fires on this fling and spends the charge.
// power (0 to 1) is the share of the trait's travel range: a sling is 1, a fling is set by the fling-power switch (drag-feedback-data.js, fling).
function fling(id,angle,power=1){const b=s.bodies[id];if(!b||s.phase!=='play'||b.moving||b.charge<1||stunned(b))return false;camera?.onLaunch(names[id]);const t=profile(b),range=t.range*power;
 Object.assign(b,{moving:true,vx:Math.cos(angle)*t.speed,vy:Math.sin(angle)*t.speed,glide:{speed:t.speed,budget:range,left:range},boostT:0,walls:0,cool:0,inside:false,used:[],charge:0,boost:null,special:null,specialTriggered:false,trail:null,trailD:0,boostHit:false,fielded:false,fieldMult:1});
 if(!camera?.predicting)dragFeel.launch(b);s.flings++;window.LoftRumbleStats.credit(s.fightStats,{kind:'throw',by:id,special:!tapOn&&s.specialCharge[id]>=1});if(s.flings===1)describe();if(s.tutor)s.tutor.pull=true;
 if(!tapOn&&s.specialCharge[id]>=1){s.specialCharge[id]=0;b.special=kind(id);if(b.special==='springy'){b.vx*=A.overdrive;b.vy*=A.overdrive;b.glide.speed*=A.overdrive;b.glide.budget*=FEEL.overdriveRange;b.glide.left=b.glide.budget}
  collisionEffect(b.x,b.y,true);s.teamEffects.push({type:'wave',x:b.x,y:b.y,r:85,life:A.effectLife,label:specials[b.special]})}
 cues.onFling(id);tutorial.onFling();roster();return true}
// Screen to logical arena coordinates.
function point(e){const r=board.getBoundingClientRect(),p={x:(e.clientX-r.left)*C.arenaW/r.width,y:(e.clientY-r.top)*C.arenaH/r.height};return camera?camera.projection.unproject(p):p}
// The press takes a resident within grabRadius (a ready one first). A press in empty space takes the nearest READY resident within grabReach;
// a moving or recharging one is never taken from empty space. A charged resident's next fling is its special.
function pick(p){const dist=b=>Math.hypot(p.x-b.x,p.y-b.y),all=ids.map(id=>s.bodies[id]).sort((a,b)=>dist(a)-dist(b)),ready=b=>!b.moving&&b.charge>=1&&!stunned(b);
  const near=all.filter(b=>dist(b)<FEEL.grabRadius);if(near.length)return near.find(ready)??near[0];return all.find(b=>ready(b)&&dist(b)<FEEL.grabReach)??null}
board.addEventListener('pointerdown',e=>{if(s.phase==='over'){if(!drawEndReady())return;if(!s.demo)playAgain();return}if(s.finale){e.preventDefault();endFinale();return}if(s.userPaused){e.preventDefault();setPaused(false);return}if(s.cutin){e.preventDefault();skipCutin();return}/* the live fight's results close only through their own buttons */if(s.held||e.button>0||s.phase!=='play')return;const p=point(e),b=pick(p);if(!b){message(COPY.miss);return}
 if(stunned(b)){message(names[b.id]+window.LoftRumbleCameraCopy.stunWait);return}
 if(b.moving||b.charge<1){message(phrase(COPY.recharging,{name:names[b.id]}));return}e.preventDefault();specialsRt.press(e);board.setPointerCapture(e.pointerId);Object.assign(s,{held:b.id,pointer:e.pointerId,ax:p.x,ay:p.y,px:p.x,py:p.y,aimAt:{x:e.clientX,y:e.clientY},aimX:p.x,aimY:p.y,pulled:false,gaugeT:0,swipeGaugeT:0,gesture:dragFling.track(p.x,p.y,e.timeStamp)});board.classList.add('held');dragFeel.grab(b.id);document.querySelector('.roster [data-resident="'+b.id+'"]')?.setAttribute('data-grabbed','true');tutorial.onGrab(b.id)});
// The gauge restarts each time the pull crosses the cancel radius, so it starts with the armed aim, never with the recharge.
// Steady sling aim (drag-feedback.js, aim): the aim point trails the finger in screen px, so touch noise never turns the sling.
function steady(e){s.aimAt=dragAim.follow(s.aimAt,e.clientX,e.clientY,window.LoftRumbleDragData.aim.steadyPx);const q=point({clientX:s.aimAt.x,clientY:s.aimAt.y});s.aimX=q.x;s.aimY=q.y}
board.addEventListener('pointermove',e=>{if(!s.held||s.pointer!==e.pointerId)return;if(tapOn)specialsRt.move(e);const p=point(e);s.px=p.x;s.py=p.y;steady(e);if(dragFling.push(s.gesture,p.x,p.y,e.timeStamp,s.scale))s.swipeGaugeT=s.gaugeT;if(s.gesture.movedAt===e.timeStamp)s.gaugeT=0;const out=Math.hypot(s.ax-p.x,s.ay-p.y)>=FEEL.cancelRadius;if(out!==s.pulled){s.pulled=out;s.gaugeT=0}dragFeel.move(Math.hypot(s.ax-p.x,s.ay-p.y),out)});
// One throw mode at a time (throw style setting). A held pull aims from the steady aim point: sling opposite it, fling along it.
// shot.gradeAt 'swipe' grades the gauge as it stood when the swipe began (swipeGaugeT), else at release. The gauge only runs
// while the pull is past the cancel radius and restarts at every swipe-speed move, so a grade comes only from a gauge that was
// drawn (gradeRelease's gaugeDelay check): a swipe from rest on the resident is ungraded and keeps the streak. Full power.
board.addEventListener('pointerup',e=>{if(!s.held||s.pointer!==e.pointerId)return;const id=s.held,p=point(e),dx=s.ax-p.x,dy=s.ay-p.y;if(tapOn&&specialsRt.release(id,e)){cancelHold();if(board.hasPointerCapture(e.pointerId))board.releasePointerCapture(e.pointerId);return}steady(e);const shot=dragFling.release(s.gesture,e.timeStamp,s.scale,throwPref.get(),heldPull());cancelHold();if(board.hasPointerCapture(e.pointerId))board.releasePointerCapture(e.pointerId);
 if(Math.hypot(dx,dy)<FEEL.cancelRadius)message(throwWords().cancel);else{if(shot.gradeAt==='swipe')s.gaugeT=s.swipeGaugeT;release(id,shot.angle,shot)}});
for(const event of ['pointercancel','lostpointercapture'])board.addEventListener(event,e=>{if(s.pointer===e.pointerId)cancelHold()});
function collisionEffect(x,y,weak=false,wall=false){
 s.rings.push({x,y,life:C.ringLife,weak,wall});
 const count=wall?5:C.particleCount;
 for(let i=0;i<count;i++){const a=i/count*Math.PI*2;s.particles.push({x,y,vx:Math.cos(a)*(wall?80:190),vy:Math.sin(a)*(wall?80:190),life:C.particleLife,wall})}
}
function sparks(x,y){for(let i=0;i<C.particleCount;i++){const a=i/C.particleCount*Math.PI*2;s.particles.push({x,y,vx:Math.cos(a)*150,vy:Math.sin(a)*150,life:C.particleLife})}}
function health(){if(s.hp<=0)startFinale();if(camera?.predicting)return;document.getElementById('health').value=s.hp;document.getElementById('health').max=RT.hp;document.getElementById('health-label').textContent=phrase(s.hp>0?COPY.bossHealth:COPY.bossDown,{boss:COPY.boss,hp:s.hp})}
// Special charge: damage dealt by a resident (its hits and the abilities it sets off) fills its special. Full fires the ready cue.
function chargeSpecial(id,amount){const was=s.specialCharge[id];if(s.phase!=='play'||was>=1||!(amount>0))return;const now=Math.min(1,was+amount*comboRate()/FEEL.specialCharge);s.specialCharge[id]=now;if(tapOn)specialsRt.charge(id,now-was);
  if(now>=1&&!tapOn)specialReady(id)} // with tap specials the engine plays the cue, once, when the hero is truly ready (special-runtime.js send)
// Hit combo: the charge-rate reward, one enemy hit, and the break (an attack catches a resident, or the idle timeout).
const comboRate=()=>1+Math.min(FEEL.comboChargeCap,(s.hits||0)*FEEL.comboCharge);
const hitsAnchor=()=>window.LoftRumbleHud?.comboAnchor()??{x:s.w-FEEL.barInset,y:C.hudTop+FEEL.comboTop,align:'right'}; // LM6b: left edge
function comboHit(){if(s.phase!=='play')return;s.hits++;s.hitsIdle=0;s.hitsPeak=Math.max(s.hitsPeak,s.hits);s.hitsPop=FEEL.comboPopLife;s.hitsLost=null;
  // The live fight pops the milestone word on the field instead (2026-11-14).
  const m=FEEL.comboMilestones.indexOf(s.hits);if(m<0||cues.onCombo(m,s.lastHit??enemy()))return;const a=hitsAnchor();s.popups=s.popups.filter(p=>!COPY.comboMiles.includes(p.text));
  s.popups.push({x:a.x,y:a.y+FEEL.comboPopGap+FEEL.popupBig/2,text:COPY.comboMiles[m],big:true,hud:true,align:a.align,color:'chip',bounce:!still(),life:C.popupLife})}
function breakCombo(why){if(!s.hits)return;s.hitBreaks[why]=(s.hitBreaks[why]??0)+1;s.hitsLost={n:s.hits,life:FEEL.comboLostLife,shatter:why!=='timeout'};s.hits=0;s.hitsIdle=0}
// Camera experiment only: the last factor is the combo payoff (camera-payoff.js). Without the experiment it is 1.
function damage(b,weak){const hit=Math.round(profile(b).damage*(weak?C.weakMultiplier:1)*bounceMult(b.walls)*(b.boost?.mult??1)*(b.fieldMult??1)*window.LoftRumbleElements.damageFactor(TEAM.element?.[b.id])*(camera?window.LoftRumblePayoff.multiplier(s.hits):1));if(b.boost)s.tally??={total:0,parts:[]},s.tally.boost=b.boost;s.focus=Math.min(RT.focusMax,s.focus+RT.focusHit);
 if(camera?.predicting)camera.predictionHits[b.id]={weak};
 window.LoftRumbleStats.credit(s.fightStats,{kind:'hit',by:b.id,amount:Math.min(hit,s.hp),weak:weak?C.weakMultiplier:1,walls:bounceMult(b.walls)});
 s.hp=Math.max(0,s.hp-hit);b.pulse=.2;const e=enemy(),a=Math.atan2(b.y-e.y,b.x-e.x),cx=e.x+Math.cos(a)*C.enemyRadius,cy=e.y+Math.sin(a)*C.enemyRadius;s.lastHit={x:cx,y:cy};
 collisionEffect(cx,cy,weak);if(b.boost&&!b.boostHit){b.boostHit=true;burst(cx,cy,FEEL.boostSparks,FEEL.weakSparkSpeed,b.trail??'warning',Math.PI*2,0,FEEL.boostSparkSize)}enemyImpact(hit,weak,Math.cos(a),Math.sin(a),cx,cy);if(camera)window.LoftRumbleStats.record(s,names[b.id],null,hit,weak);addTally(names[b.id],hit,weak);if(b.walls)s.tally.walls=Math.max(s.tally.walls??0,b.walls);
 s.popups.push({x:cx,y:cy-FEEL.popupSize,text:String(hit),weak,label:weak&&!cues.installed()?COPY.weak:'',life:C.popupLife});if(s.hp===0)sparks(e.x,e.y);health();chargeSpecial(b.id,hit);comboHit();cues.onHit(b,weak,hit);tutorial.onHit(weak);return hit}
// Hits pile into one combo: the model (s.hp) drops at once; the total flies into the bar RT.comboWindow after the last hit.
function addTally(source,amount,weak){s.tally??={total:0,parts:[]};s.tally.total+=amount;let part=s.tally.parts.find(p=>p.source===source);if(!part)s.tally.parts.push(part={source,amount:0,weak:0});part.amount+=amount;if(weak)part.weak++;s.comboT=RT.comboWindow}
function collide(b){const e=enemy(),t=profile(b),dx=b.x-e.x,dy=b.y-e.y,distance=Math.hypot(dx,dy),reach=C.radius+C.enemyRadius;if(distance>=reach+2){b.inside=false;return}if(distance>reach)return;const nx=distance?dx/distance:-1,ny=distance?dy/distance:0,toward=b.vx*nx+b.vy*ny;if(toward>=0&&!b.inside)return;const angle=Math.atan2(dy,dx),delta=Math.atan2(Math.sin(angle-e.angle),Math.cos(angle-e.angle));
  if(s.hp>0&&!b.inside&&b.cool<=0&&Math.hypot(b.vx,b.vy)>C.stopSpeed){const guard=shieldHit(b,angle);if(guard.mult)damage(b,!guard.plain&&(guard.weak||Math.abs(delta)<C.weakArc));if(b.special&&!b.specialTriggered){b.specialTriggered=true;if(b.special==='heavy')abilityDamage(A.heavySpecial,specials.heavy,null,b.id,true);if(b.special==='piercing')abilityDamage(A.pierceSpecial,specials.piercing,null,b.id,true);if(b.special!=='springy')cues.onSpecialBonus(b.id,specialBonus[b.special]);tutorial.onSpecial()}b.cool=C.hitCooldown;b.inside=true}
  if(t===traits.piercing)return;let cx=nx,cy=ny;
  // Reflect at the true contact point (back up along the velocity to the surface), so the fling follows the route preview.
  if(toward<0){const sp=Math.hypot(b.vx,b.vy),ux=b.vx/sp,uy=b.vy/sp,k=dx*ux+dy*uy,back=k+Math.sqrt(Math.max(0,k*k-(dx*dx+dy*dy-reach*reach)));
    cx=(dx-back*ux)/reach;cy=(dy-back*uy)/reach;const d=b.vx*cx+b.vy*cy;b.vx-=2*d*cx;b.vy-=2*d*cy;if(b.glide)b.glide.left-=enemyCost(b);
    b.x=e.x+cx*(reach+1)+b.vx/sp*back;b.y=e.y+cy*(reach+1)+b.vy/sp*back}
  else{b.x=e.x+cx*(reach+1);b.y=e.y+cy*(reach+1)}b.vx*=t.bounce;b.vy*=t.bounce}
// Restitution maps to budget: a Heavy hitter (bounce .72) loses 28% of its range off the enemy, Springy only 2%.
const enemyCost=b=>(1-profile(b).bounce)*profile(b).range*FEEL.enemyBudgetCost;
// owner: the resident whose ability or special this is. by is the one whose launch set it off. special: a special's bonus, not an ability.
function abilityDamage(amount,label,by,owner,special=false){if(s.hp<=0)return;if(camera){amount=Math.round(amount*window.LoftRumblePayoff.multiplier(s.hits));window.LoftRumbleStats.record(s,owner?names[owner]:label,owner?label:null,amount)}
 window.LoftRumbleStats.credit(s.fightStats,special?{kind:'special',by:owner,amount:Math.min(amount,s.hp)}:{kind:'ability',by,owner,amount:Math.min(amount,s.hp)});s.hp=Math.max(0,s.hp-amount);if(by)chargeSpecial(by,amount);const e=enemy();collisionEffect(e.x,e.y,true);enemyImpact(amount,false,0,-1,e.x,e.y,false);addTally(label,amount,false);health();comboHit()}
// A moving resident touching a resting one triggers the resting one's ability, once per fling per teammate.
function activateAlly(m,o){if(stunned(m)||stunned(o))return;m.used.push(o.id);if(s.tutor){s.tutor.bump=true;tutorCheck()}const a={id:o.id,kind:kind(o.id),x:o.x,y:o.y},hpBefore=s.hp;contactFeedback(m,a);abilityAt(a,m);cues.onAlly(m,o,hpBefore-s.hp);tutorial.onAlly();
 // Every activation splashes in place. The first in a battle also names the ability: a portrait cut-in in the live fight
 // (2026-11-14), else a bottom toast (Training, the lab). Nothing pauses.
 if(!s.introduced[a.id]){s.introduced[a.id]=true;if(!cues.onAllyIntro(a.id))s.toasts.push({id:a.id,kind:a.kind,life:FEEL.toastLife})}s.splash[a.id]=FEEL.splashTime
}
// One ability effect at a point; its damage credits m (the resident whose launch set it off).
function abilityAt(a,m){window.LoftRumbleStats.credit(s.fightStats,{kind:'activation',by:m.id,owner:a.id});const e=enemy(),sid=synergyOf(a),label=SYN.name(sid)??abilities[a.kind],inRange=Math.hypot(e.x-a.x,e.y-a.y)<=syn('shockwave').range+C.enemyRadius;
 // The look (hero-ability-fx.js, LM2) tags each effect with its kind, order and contact point; damage below never reads it.
 const look=(extra)=>{const fx=window.LoftRumbleHeroFx;s.fxSeq=(s.fxSeq??0)+1;return fx?fx.effect(a.kind,s.fxSeq,a,{x:(a.x+m.x)/2,y:(a.y+m.y)/2},extra):{x:a.x,y:a.y,life:A.effectLife,label:'',...extra}};
 if(sid==='seed-burst'){const n=syn(sid);for(let i=0;i<n.count;i++)s.bolts.push({x:a.x,y:a.y,delay:i*n.stagger,life:n.boltLife,by:m.id,owner:a.id});s.teamEffects.push(look({type:'wave',r:n.waveRadius}))}
 if(sid==='shockwave'){s.teamEffects.push(look({type:'wave',r:syn(sid).range,label:inRange?'':COPY.missed}));if(inRange)abilityDamage(syn(sid).damage,label,m.id,a.id)}
 if(sid==='piercing-beam'){s.teamEffects.push(look({type:'beam',tx:e.x,ty:e.y}));abilityDamage(syn(sid).damage,label,m.id,a.id)}
 if(window.LoftRumbleSynergyEngine.handles.includes(sid))projectileSynergy(sid,a,m,look);
 if(window.LoftRumbleSynergyField.handles.includes(sid))fieldSynergy(sid,a,m,look);
 if(window.LoftRumbleSynergySupport.handles.includes(sid))supportSynergy(sid,a,m,look)}
// Support synergies (ledger #462, A4). Mend heals the shared team pool; Bubble guard puts one bubble on the bumper (m), the hero who
// made the contact. The bubble pays off in guardAmount below, the one seam every boss hit on the team passes through.
function supportSynergy(sid,a,m,look){const P=window.LoftRumbleSynergySupport;
 if(sid===P.ids.mend){const next=P.mend(s.teamHP,RT.teamHP,syn(sid)),gain=next-s.teamHP;s.teamHP=next;if(gain)flyToTeam('+'+gain,'good',{x:a.x,y:a.y},'','heal',gain);s.supportRings.push({x:a.x,y:a.y,life:window.LoftRumbleSynergyFx.ringLife})}
 else if(sid===P.ids.booster)m.boostT=P.grantBoost(syn(sid));else s.bubbles=P.grantBubble(s.bubbles,m.id,syn(sid));
 s.teamEffects.push(look({type:'wave',r:syn('seed-burst').waveRadius}))}
// The boss hit `hitIds` for `amount` in all. Each hero holding a bubble absorbs its share of the hit (the bubble pops, no team damage);
// the rest of the amount lands. Returns the amount that still lands on the team.
function guardAmount(hitIds,amount){if(!hitIds.length||!amount)return amount;let open=0;
 for(const id of hitIds){const r=window.LoftRumbleSynergySupport.absorb(s.bubbles,id);s.bubbles=r.bubbles;if(r.absorbed)s.supportRings.push({x:s.bodies[id].x,y:s.bodies[id].y,life:window.LoftRumbleSynergyFx.ringLife});else open++}
 return Math.round(amount*open/hitIds.length)}
// Field synergies (ledger #462, A3): a Poison cloud on the boss, a Power field where the hero activated. Numbers live in the registry.
function fieldSynergy(sid,a,m,look){const e=enemy(),F=window.LoftRumbleSynergyField,field=F.place(sid,{x:a.x,y:a.y},{x:e.x,y:e.y});
 s.synFields=F.add(s.synFields,{...field,by:m.id,owner:a.id,label:SYN.name(sid)});
 s.teamEffects.push(look({type:'wave',r:syn('seed-burst').waveRadius}))}
// Poison wears the boss down without a hit: no combo, no impact flash, just the health bar and the hero's credit.
function poisonDamage(amount,label,by,owner){if(s.hp<=0)return;window.LoftRumbleStats.credit(s.fightStats,{kind:'ability',by,owner,amount:Math.min(amount,s.hp)});s.hp=Math.max(0,s.hp-amount);health()}
// A hero flung through a live Power field keeps its bonus for the rest of that fling (touched once, no cooldown).
function stepFields(dt){const F=window.LoftRumbleSynergyField,r=F.step(s.synFields,dt,RT.hp);s.synFields=r.fields;r.ticks.forEach((t,i)=>poisonDamage(t,r.sources[i].label,r.sources[i].by,r.sources[i].owner));
 for(const id of ids){const b=s.bodies[id],bonus=b.moving&&!b.fielded?F.bonusFor(s.synFields,b):1;if(bonus>1){b.fielded=true;b.fieldMult=bonus}}}
// Projectile synergies (ledger #462, A2). A hero's synergy is its saved slot when the build is ready for it, else its trait's default.
function synergyOf(a){const pick=s.synergy?.[a.id];return SYN.ready(pick)?pick:SYN.defaultFor(a.kind)}
function projectileSynergy(sid,a,m,look){const e=enemy(),plan=window.LoftRumbleSynergyEngine.launch(sid,{x:a.x,y:a.y},{x:e.x,y:e.y,radius:C.enemyRadius},{w:s.w,h:s.h});
 for(const seed of plan.seeds)s.bolts.push({...seed,by:m.id,owner:a.id,synergy:sid});
 for(const hit of plan.hits)s.synHits.push({...hit,by:m.id,owner:a.id,label:SYN.name(sid)});
 s.teamEffects.push(look({type:'wave',r:syn('seed-burst').waveRadius}))}
function stepSynergies(dt){stepFields(dt);for(const h of s.synHits){h.delay-=dt;if(h.delay>0)continue;h.done=true;if(s.hp>0){abilityDamage(h.damage,h.label,h.by,h.owner);s.synArcs.push({from:h.from,via:h.via,to:h.to,seed:s.synArcs.length+h.damage,life:window.LoftRumbleSynergyFx.life})}}
 s.synHits=s.synHits.filter(h=>!h.done);for(const arc of s.synArcs)arc.life-=dt;s.synArcs=s.synArcs.filter(arc=>arc.life>0);
 for(const r of s.supportRings)r.life-=dt;s.supportRings=s.supportRings.filter(r=>r.life>0)}
function checkAllies(m){if(s.hp<=0||Math.hypot(m.vx,m.vy)<=C.stopSpeed)return;for(const id of ids){const o=s.bodies[id];if(o===m||o.moving||m.used.includes(id))continue;if(Math.hypot(m.x-o.x,m.y-o.y)<C.radius+A.radius)activateAlly(m,o)}}
function stepTeam(dt){stepSynergies(dt);const burst=syn('seed-burst');for(const bolt of s.bolts){bolt.life-=dt;bolt.delay-=dt;if(bolt.delay>0||s.hp<=0)continue;const e=enemy();
 if(bolt.synergy){const target={x:e.x,y:e.y,radius:C.enemyRadius},eng=window.LoftRumbleSynergyEngine;if(eng.seedHits(bolt,target,dt)){bolt.life=0;abilityDamage(bolt.damage,SYN.name(bolt.synergy),bolt.by,bolt.owner)}else eng.moveSeed(bolt,dt);continue}
 const dx=e.x-bolt.x,dy=e.y-bolt.y,d=Math.hypot(dx,dy);if(d<=C.enemyRadius+burst.speed*dt){bolt.life=0;abilityDamage(burst.damage,SYN.name('seed-burst'),bolt.by,bolt.owner)}else{bolt.x+=dx/d*burst.speed*dt;bolt.y+=dy/d*burst.speed*dt}}s.bolts=s.bolts.filter(b=>b.life>0&&s.hp>0);for(const effect of s.teamEffects)effect.life-=dt;s.teamEffects=s.teamEffects.filter(e=>e.life>0)}
// A button whose label changes keeps the width of its widest label (hidden copies share its grid cell).
function setLabel(button,text,all){button.replaceChildren(...[text,...all].map((t,i)=>{const span=document.createElement('span');span.textContent=t;if(i)span.setAttribute('aria-hidden','true');return span}))}
// Contact tuning in seconds/CSS pixels. Recoil is visual; team anchors never move.
const CONTACT={stop:.045,life:.3,recoil:10,squash:.24,tilt:.18,attack:.008,toneLife:.14,gain:.07,quiet:.001,up:1.5};
const TONES={springy:660,heavy:180,piercing:880};
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const soundKey=window.LoftRumbleDemoData.soundKey;
let audio=null,soundOn=true;
try{soundOn=localStorage.getItem(soundKey)!=='off'}catch{} // a muted player stays muted after a reload
const music=window.LoftRumbleMusic.create();
const musicButton=document.getElementById('music'),musicConfig=window.LoftRumbleMusicData,musicPicker=window.LoftRumbleMusic.picker(music,musicButton);
let musicOn=true;
try{musicOn=localStorage.getItem(musicConfig.preferenceKey)!=='off'}catch{}
music.setEnabled(soundOn&&musicOn);
// Each settings row keeps one label and shows its state once, in the switch. Music cannot play while Sound is off, so its row is
// disabled then, and says why to assistive technology.
// It stays in the Tab order (aria-disabled, not disabled) and shows a short hint, which is part of its accessible name.
function showMusic(){musicButton.replaceChildren(DEMO.music);musicButton.setAttribute('aria-pressed',String(musicOn));musicButton.setAttribute('aria-disabled',String(!soundOn));musicPicker.disabled=!soundOn||!musicOn;
  if(!soundOn){const hint=document.createElement('data');hint.className='settings-hint';hint.textContent=DEMO.musicHint;musicButton.append(hint)}} // data: no UA style. small shrinks it under the 13 px helper floor, and a span child takes the menu's grid-area 1/1 rule
musicButton.onclick=async()=>{if(!soundOn)return;musicOn=!musicOn;try{localStorage.setItem(musicConfig.preferenceKey,musicOn?'on':'off')}catch{}music.setEnabled(soundOn&&musicOn);await startAudio();showMusic()};
const soundButton=document.getElementById('sound');
const showSound=()=>{soundButton.textContent=DEMO.sound;soundButton.setAttribute('aria-pressed',String(soundOn));showMusic()};
async function startAudio(){if(!soundOn)return;try{audio??=new AudioContext();music.unlock(audio);await audio.resume()}catch{soundOn=false;music.setEnabled(false);showSound()}}
soundButton.onclick=async()=>{soundOn=!soundOn;try{localStorage.setItem(soundKey,soundOn?'on':'off')}catch{}music.setEnabled(soundOn&&musicOn);await startAudio();showSound()};
showSound();
function activationSound(kind){
  if(camera?.predicting||!soundOn||!audio||audio.state!=='running')return;
  const oscillator=audio.createOscillator(),gain=audio.createGain(),now=audio.currentTime;
  oscillator.type=kind==='heavy'?'triangle':'sine';oscillator.frequency.setValueAtTime(TONES[kind],now);
  oscillator.frequency.exponentialRampToValueAtTime(TONES[kind]*CONTACT.up,now+CONTACT.toneLife);
  gain.gain.setValueAtTime(CONTACT.quiet,now);gain.gain.linearRampToValueAtTime(CONTACT.gain,now+CONTACT.attack);
  gain.gain.exponentialRampToValueAtTime(CONTACT.quiet,now+CONTACT.toneLife);
  oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(now);oscillator.stop(now+CONTACT.toneLife);
  oscillator.onended=()=>{oscillator.disconnect();gain.disconnect()};
}
function contactFeedback(m,ally){
  const speed=Math.hypot(m.vx,m.vy)||1;
  s.reactions[ally.id]={life:CONTACT.life,nx:m.vx/speed,ny:m.vy/speed};
  window.LoftRumbleFeel.armStop(s,window.LoftRumbleSwarmRuntime?.calm(camera,CONTACT.stop)??CONTACT.stop,s.time);m.pulse=CONTACT.squash; // the cream contact tick (hero-ability-fx.js) and the ally's activation ring mark the contact; no gold burst (owner, 2026-11-15)
  activationSound(ally.kind);
}
function stepContact(dt){
  s.hitStop=Math.max(0,s.hitStop-dt);
  for(const [id,reaction] of Object.entries(s.reactions)){
    reaction.life-=dt;if(reaction.life<=0)delete s.reactions[id];
  }
}
function whiplashVisualFx(){
  if(s.attackFx?.whiplash)return s.attackFx;
  const tail=s.whipTail;if(!tail)return null;
  return {...tail,whiplash:{...tail.whiplash,elapsed:s.clock-tail.clockBase}};
}
function contactPose(id){
  const whipPose=window.LoftRumbleWhiplashRenderer?.residentPose(whiplashVisualFx(),id,s.bodies[id],reduced.matches);
  if(whipPose)return whipPose;
  const reaction=s.reactions[id];
  if(!reaction||reduced.matches)return{x:0,y:0,sx:1,sy:1,rotation:0};
  const t=1-reaction.life/(reaction.max??CONTACT.life),envelope=(1-t)*(1-t),recoil=Math.sin(t*Math.PI*2)*envelope,distance=reaction.recoil??CONTACT.recoil;
  return{x:reaction.nx*distance*recoil,y:reaction.ny*distance*recoil,
    sx:1+CONTACT.squash*envelope,sy:1-CONTACT.squash*envelope,rotation:reaction.nx*CONTACT.tilt*recoil};
}

