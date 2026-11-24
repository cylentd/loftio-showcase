'use strict';
// ---- Feel layer: wall bounces, enemy hits, enemy attack, HP bars, aim preview. Tuning lives in FEEL. ----
// Reduced motion drops shake, flashes, squash and pop; bars, numbers and the attack path stay.
const still=()=>reduced.matches;
s.haptics=true;
const dragData=window.LoftRumbleDragData;
// Fling vs sling (spec section 1): a finger still swiping at release flings along the swipe; one held still sets up a sling.
const dragFling=window.LoftRumbleDragFeedback.fling,dragAim=window.LoftRumbleDragFeedback.aim,SLING=Object.freeze({graded:true,power:1});
const holdingStill=()=>!!s.held&&!!s.gesture&&dragFling.holding(s.gesture,performance.now()); // the gauge (and sling aim dots) show only then
// Throw style setting (drag-feedback.js, throwStyle): saved under loftRumbleThrow. Changing it drops a throw in progress.
// window.LoftRumbleThrow is the hook for the settings control: get() and set('fling'|'sling').
let throwStorage=null;try{throwStorage=localStorage}catch{}
const throwPref=window.LoftRumbleDragFeedback.throwStyle.create({storage:throwStorage,onChange:()=>{if(s.held)cancelHold();showThrowStyle()}});
window.LoftRumbleThrow=throwPref;
// The Fling / Sling control in the pause settings, and every word that names the gesture, follow the style in use (unit B).
const throwCopy=dragData.throwStyle.copy,throwButtons=[...document.querySelectorAll('[data-throw]')];
const throwWords=()=>({start:throwCopy.start[throwPref.get()],cancel:throwCopy.cancel[throwPref.get()],tutor:throwCopy.tutor[throwPref.get()]});
document.getElementById('throw-style-label').textContent=throwCopy.label;
for(const button of throwButtons){button.textContent=throwCopy.names[button.dataset.throw];button.onclick=()=>throwPref.set(button.dataset.throw)}
function showThrowStyle(){
  const style=throwPref.get(),help=window.LoftRumbleDemoData.copy.throwHelp;
  for(const button of throwButtons)button.setAttribute('aria-pressed',String(button.dataset.throw===style));
  board.setAttribute('aria-label',throwCopy.board[style]);document.querySelector('.roster').setAttribute('aria-label',throwCopy.roster[style]);
  document.getElementById('team-help').textContent=help.teamHelp[style];
  document.getElementById('help').textContent=help.aimHelp[style]+(tutorial.installed()?' '+help.training:''); // the pointer only where the menu has the button
  if(s.phase==='play'&&!s.flings)message(throwWords().start);
  tutorial.restyle();
}
const heldPull=()=>({from:{x:s.ax,y:s.ay},to:{x:s.aimX,y:s.aimY}}); // press point to steady aim point, for dragFling.heldAngle
const dragFeel=window.LoftRumbleDragFeedback.create({state:s,emit:kind=>{const cue=dragData.cues[kind];vibrate(cue.buzz);tone(cue.freq,'sine',cue.life,cue.gain,cue.to)}});
const hapticsButton=document.getElementById('haptics');
function showHaptics(){hapticsButton.textContent=dragData.copy.label;hapticsButton.setAttribute('aria-pressed',String(s.haptics))}
hapticsButton.onclick=()=>{s.haptics=!s.haptics;showHaptics();if(!s.haptics){try{navigator.vibrate?.(0)}catch{}}};showHaptics();
window.LoftRumbleSwarmLab.install({doc:document,copy:window.LoftRumbleDemoData.copy.swarmLab});
if(tapOn){specialsRt.installSetting(document,window.LoftRumbleDemoData.copy.specialsMode);document.querySelector('.roster').addEventListener('click',e=>{const card=e.target.closest('[data-resident]');if(card&&s.phase==='play')specialsRt.dockTap(card.dataset.resident)})}
function tone(freq,type,life,gain,to=freq){if(camera?.predicting)return;
  if(!soundOn||!audio||audio.state!=='running')return;
  const o=audio.createOscillator(),g=audio.createGain(),now=audio.currentTime;
  o.type=type;o.frequency.setValueAtTime(freq,now);o.frequency.exponentialRampToValueAtTime(Math.max(1,to),now+life);
  g.gain.setValueAtTime(CONTACT.quiet,now);g.gain.linearRampToValueAtTime(gain,now+CONTACT.attack);g.gain.exponentialRampToValueAtTime(CONTACT.quiet,now+life);
  o.connect(g);g.connect(audio.destination);o.start(now);o.stop(now+life);o.onended=()=>{o.disconnect();g.disconnect()};
}
function noise(life,gain){if(camera?.predicting)return;
  if(!soundOn||!audio||audio.state!=='running')return;
  const length=Math.ceil(audio.sampleRate*life),buffer=audio.createBuffer(1,length,audio.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*(1-i/length);
  const src=audio.createBufferSource(),filter=audio.createBiquadFilter(),g=audio.createGain();
  src.buffer=buffer;filter.type='lowpass';filter.frequency.value=FEEL.noiseCut;g.gain.value=gain;
  src.connect(filter);filter.connect(g);g.connect(audio.destination);src.start();src.onended=()=>{src.disconnect();filter.disconnect();g.disconnect()};
}
function vibrate(pattern){if(camera?.predicting||!s.haptics||still())return;try{navigator.vibrate?.(pattern)}catch{}}
function withAlpha(color,alpha){return color.replace(/^rgb\(([^)]+)\)$/,(m,rgb)=>'rgba('+rgb+','+alpha+')')}
function burst(x,y,count,speed,color,spread=Math.PI*2,heading=0,size=3){
  const ring=spread>=Math.PI*2;
  for(let i=0;i<count;i++){const a=ring?heading+i/count*spread:heading+(random()-.5)*spread,v=speed*(1-FEEL.particleJitter*random());
    s.particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:C.particleLife,max:C.particleLife,color,size})}
}
// Wall bounce: a spark fan into the arena, a squash and a tick. Round 12: no impact ring; frozen at the wall after the resident
// had bounced away, its thin circle and five dots read as a stray empty ring.
function wallHit(b,axis,sign,limit){
  b.walls++;b.counter=FEEL.counterPop;
  const nx=axis==='x'?sign:0,ny=axis==='y'?sign:0;
  const x=axis==='x'?(sign>0?C.padding:limit-C.padding):b.x,y=axis==='y'?(sign>0?C.hudTop+C.padding:limit-C.padding):b.y;
  burst(x,y,FEEL.wallSparks,FEEL.wallSparkSpeed,'chip',FEEL.wallSparkSpread,Math.atan2(ny,nx),2);
  b.squash={life:FEEL.wallSquashLife,nx,ny};
  if(camera&&profile(b)===traits.springy)camera.seek(b);
  tone(FEEL.tickFreq+Math.min(b.walls,C.maxBonusWalls*2)*FEEL.tickStep,'square',FEEL.tickLife,FEEL.tickGain);
}
// stop=false for ability damage: the teammate contact already paused the shot.
function enemyImpact(hit,weak,nx,ny,x,y,stop=true){
  if(stop)window.LoftRumbleFeel.armStop(s,Math.min(FEEL.stopMax,FEEL.stopBase+hit*FEEL.stopPerDamage+(weak?FEEL.stopWeak:0)),s.time,{kill:s.hp<=0}); // one stop per STOP_WINDOW of fight time (rumble-feel.js)
  s.enemyFlash=FEEL.enemyFlash;s.enemyHit={life:FEEL.enemySquashLife,nx,ny,k:weak?1.5:1};
  s.shake=Math.max(s.shake,Math.min(FEEL.shakeMax,(weak?FEEL.shakeWeak:FEEL.shakeHit)+hit*FEEL.shakePerDamage));s.shakeDir={x:nx,y:ny};
  burst(x,y,weak?FEEL.weakParticles:FEEL.hitParticles,weak?FEEL.weakSparkSpeed:FEEL.hitSparkSpeed,weak?'warning':'flash');
  if(camera&&!camera.predicting)window.LoftRumbleHeat.impact(camera.game,x,y); // camera experiment only: combo heat feedback
  tone(FEEL.thudFreq,'triangle',FEEL.thudLife,FEEL.thudGain,FEEL.thudFreq/2);
  if(weak){tone(FEEL.weakFreq,'sine',FEEL.weakLife,FEEL.weakGain,FEEL.weakFreq*CONTACT.up);vibrate(FEEL.vibrateWeak)}
}
// The heart spawns at the START.hearts spot farthest from every resident, so it never sits on a sprite or its label.
function heartSpot(){const spots=START.hearts.map(([x,y])=>({x:s.w*x,y:s.h*y})),gap=p=>Math.min(...TURN.order.map(id=>s.positions[id]).filter(Boolean).map(q=>Math.hypot(p.x-q.x,p.y-q.y)));return spots.reduce((a,b)=>gap(b)>gap(a)?b:a)}
function teamCentre(){const list=Object.values(s.positions),n=list.length||1;return{x:list.reduce((t,p)=>t+p.x,0)/n,y:list.reduce((t,p)=>t+p.y,0)/n}}
// ---- Enemy attack cycle: Pulse, Beam sweep, Slam ring. The warning (zone geometry) is fixed the turn before. ----
// The rotation is fixed: no attack is ever removed (owner 2026-11-18 removed horn breaking).
const attackRotation=()=>s.demo?window.LoftRumbleDemo.rotation(s,FEEL.attacks):camera?window.LoftRumbleEncounters.rotation(s,FEEL.attacks):FEEL.attacks;
const nextAttack=()=>{const rotation=attackRotation();return rotation[s.attackIndex%rotation.length]};
const slamRadius=()=>Math.max(FEEL.slamMin,FEEL.slamRadius*Math.min(s.w,s.h));
function ensureWarn(){
  if(s.warn)return s.warn;const def=nextAttack(),e=enemy(),warn={def};
  if(def.id===window.LoftRumbleWhiplashData.id){
    warn.origin={x:e.x,y:e.y};warn.angle=e.facing??e.angle;warn.reach=window.LoftRumbleWhiplashModel.arenaReach(warn.origin,s.w,s.h);
    warn.projection=window.LoftRumbleWhiplashModel.project(window.LoftRumbleWhiplashModel.initial({origin:warn.origin,facing:warn.angle,reach:warn.reach}));
  }
  if(def.id==='beam'){const ids=TURN.order.filter(id=>s.positions[id]),p=s.positions[ids[Math.floor(random()*ids.length)]]??{x:0,y:s.h};
    warn.angle=Math.atan2(p.y-e.y,p.x-e.x)+(random()*2-1)*FEEL.beamJitter}
  window.LoftRumbleDemo?.trackWarning(s,warn,inZone);return s.warn=warn;
}
// Danger flash (round 16): in the last dangerTime before Beam or Slam fires, the residents inside the zone; their dock cards tint red.
function dangerIds(){const w=s.warn,snap=camera?camera.punishDanger():[];if(s.phase!=='play'||!w||!FEEL.dangerAttacks.includes(w.def.id)||s.enemyT>FEEL.dangerTime)return snap;return[...snap,...ids.filter(id=>inZone(w,s.bodies[id])&&!snap.includes(id))]}
function dangerDock(){if(camera?.predicting)return;const d=dangerIds();for(const card of document.querySelectorAll('.roster [data-resident]'))card.classList.toggle('danger',d.includes(card.dataset.resident))}
// A resident is in danger when its body touches the zone.
function inZone(warn,p){
  if(!p)return false;const e=enemy(),dx=p.x-e.x,dy=p.y-e.y;
  if(warn.def.id===window.LoftRumbleWhiplashData.id)return window.LoftRumbleWhiplashModel.contains(window.LoftRumbleWhiplashModel.initial({
    origin:warn.origin??{x:e.x,y:e.y},facing:warn.angle,reach:warn.reach??window.LoftRumbleWhiplashModel.arenaReach(e,s.w,s.h)}),p,C.radius);
  if(warn.def.id==='pulse')return true;
  if(warn.def.id==='slam')return Math.hypot(dx,dy)<=slamRadius()+C.radius;
  return Math.abs(-Math.sin(warn.angle)*dx+Math.cos(warn.angle)*dy)<=FEEL.beamHalf+C.radius;
}
// The bar value the player sees: the real team HP minus every heal whose number is still flying (s.heals). A living team never reads
// below barAliveMin, even when damage outweighs the HP from before a heal still in flight; the heal lands its number on top later.
const teamTarget=()=>s.teamHP<=0?0:Math.max(Math.min(s.teamHP,RT.barAliveMin),s.teamHP-s.heals.reduce((sum,h)=>sum+h.gain,0));
// A number that flies from `from` into the team bar, then flashes it. A heal (`gain` HP) waits in s.heals until its own number lands,
// even when damage lands meanwhile; damage does not wait.
function flyToTeam(text,color,from,sub,flash,gain=0){
  const bar=teamBar(),fly=still()?0:FEEL.flyTime;
  if(camera)from=camera.projection.project(from);
  s.popups.push({x:from.x,y:from.y,to:{x:bar.x+bar.w/2,y:bar.y+bar.h/2},fly,text,sub,color,big:true,hud:true,life:FEEL.payoffLife,max:FEEL.payoffLife,vy:0});
  s.teamHold=fly+FEEL.payoffDrain*.5;
  if(flash==='heal'){if(fly)s.heals.push({left:fly,gain});else{s.teamFlash=flash;s.teamBarHit=FEEL.barFlash}}
  else{s.teamFly=fly;s.teamFlyFlash=flash;if(!fly&&flash){s.teamFlash=flash;s.teamBarHit=FEEL.barFlash}}
  // Damage is already in s.teamHP, and the cue rail states it this tick, so the bar fill and readout drop now; the chip trail
  // (s.teamChip, held by s.teamHold) still shows what was lost. A heal still flying stays out of the bar (teamTarget).
  if(flash==='hurt'){s.teamShown=teamTarget();teamText()}
}
// ---- Real-time enemy clock, combos, drawing and the frame loop (round 9). ----
// Player-facing words, keyed. Attack tips live with each attack in FEEL.attacks.
// Start, cancel and the tutor's pull step name the gesture: keyed by throw style in drag-feedback-data.js (throwWords).
const COPY={...PAGE,boss:DEMO.boss,bossDown:phrase(PAGE.bossDown,{boss:DEMO.boss})};
const statusLabels=[COPY.ready,COPY.recharge,COPY.moving];
// Each wall bounce adds FEEL.bounceStep to that fling's damage multiplier, capped at FEEL.bounceCap. The weak spot's 3x sits on top.
const bounceMult=walls=>Math.min(FEEL.bounceCap,1+walls*FEEL.bounceStep);
const impactAt=()=>FEEL.windup+FEEL.travel;
const livePos=id=>s.bodies[id];
// Enemy glow envelope: rises over the name flash, holds through the attack, falls actTail after impact.
function actLevel(){const fx=s.attackFx;if(!fx)return 0;const t=fx.t,start=-RT.nameFlash;if(t<impactAt())return clamp((t-start)/RT.nameFlash,0,1);return Math.max(0,1-(t-impactAt())/FEEL.actTail)}
// The zone (and the Pulse warning) shows for the last RT.telegraph seconds; it is fixed when first shown.
function currentWarn(){if(s.phase==='over'||s.hp<=0)return null;if(s.attackFx&&(s.attackFx.whiplash?!s.attackFx.resolved:!s.attackFx.hit))return s.attackFx.warn;if(s.enemyT>RT.telegraph)return null;return ensureWarn()}
function fireAttack(){if(s.phase==='over'||s.paused||s.userPaused||s.cinematic)return null;
  if(s.attackFx)return s.attackFx;const warn=ensureWarn();if(!s.demo&&s.tutor&&FEEL.dangerAttacks.includes(warn.def.id)){s.tutor.zone=true;tutorCheck()}s.attackIndex=attackRotation().indexOf(warn.slot??warn.def)+1;s.warn=null;s.attackFx={t:-RT.nameFlash,warn,hits:[],amount:0,hit:false,rumbled:false};
  if(warn.def.id===window.LoftRumbleWhiplashData.id){s.attackFx.contacts={};s.attackFx.whiplash=window.LoftRumbleWhiplashModel.initial({origin:warn.origin,facing:warn.angle,reach:warn.reach,rig:{radius:C.enemyRadius,upright:camera?.shallow?camera.uprightScale:1,foot:window.LoftRumbleBossFightData?.storybook.bossFoot,bounds:{width:s.w,height:s.h}}});}return s.attackFx}
// R4: first swept painted contact, per resident. No global stop, stun, shake or physics writes.
function whiplashImpact(contact){
  const fx=s.attackFx;if(!fx?.whiplash||fx.contacts[contact.id]||s.phase==='over'||s.teamHP<=0)return;
  fx.contacts[contact.id]={...contact,shownAt:fx.whiplash.elapsed};fx.hits.push(contact.id);fx.hit=true;
  const amount=tutorial.harmless()?0:guardAmount([contact.id],window.LoftRumbleWhiplashData.totalDamage/window.LoftRumbleWhiplashData.rosterSize);
  fx.amount+=amount;s.teamHP=Math.max(0,s.teamHP-amount);
  const event={...fx,hits:[contact.id],amount};cues.onImpact(event,false);tutorial.onImpact(event);
  if(s.hits&&!camera)breakCombo('attack');
  flyToTeam(amount?'-'+amount:window.LoftRumbleCuesData.copy.protectedFly,amount?'danger':'primary',contact.point,'',amount?'hurt':null);
  if(s.teamHP<=0)finishBattle(false);else if(!s.heart)s.heart=heartSpot();
}
function whiplashStep(fx,dt,previous){
  const from=fx.whiplash.elapsed,output=window.LoftRumbleWhiplashModel.next(fx.whiplash,{type:window.LoftRumbleWhiplashData.events.tick,dt,running:true});
  fx.whiplash=output.state;fx.t=fx.whiplash.elapsed-RT.nameFlash;fx.warn.projection=window.LoftRumbleWhiplashModel.project(fx.whiplash);
  const contacts=window.LoftRumbleWhiplashContact.contacts(fx.whiplash,from,fx.whiplash.elapsed,previous??s.bodies,s.bodies,C.radius,fx.hits);
  for(const contact of contacts){whiplashImpact(contact);if(s.phase==='over')return;}
  const end=fx.whiplash.config.prepare+fx.whiplash.config.telegraph+fx.whiplash.config.strike;
  if(!fx.resolved&&fx.whiplash.elapsed>=end){fx.resolved=true;
    const escaped=!!window.LoftRumbleDemo?.observeImpact(s,fx.warn,fx.hits);if(escaped)tutorCheck();
    if(!fx.hits.length){fx.hit=true;cues.onImpact(fx,escaped);tutorial.onImpact(fx);}
  }
  if(fx.whiplash.phase===window.LoftRumbleWhiplashData.phases.done){
    // Presentation alone survives cleanup, on the existing eligible FX clock.
    s.whipTail={...fx,clockBase:s.clock-fx.whiplash.elapsed};s.attackFx=null;
  }
}
// Damage is decided at impact from where residents are then, so a fling out of the zone during the telegraph dodges it.
function attackImpact(){
  const fx=s.attackFx;if(!fx||fx.whiplash||fx.hit||s.phase==='over'||s.paused||s.userPaused||s.cinematic)return;
  const e=fx.warn.origin??enemy(),def=fx.warn.def;fx.hit=true;
  fx.hits=ids.filter(id=>inZone(fx.warn,s.bodies[id]));fx.amount=def.id===window.LoftRumbleWhiplashData.id?fx.hits.length*window.LoftRumbleWhiplashData.totalDamage/window.LoftRumbleWhiplashData.rosterSize:def.id==='pulse'?RT.pulseDamage:fx.hits.length*(def.id==='beam'?RT.beamHit:RT.slamHit);
  const calm=tutorial.harmless(); // Training: the attack costs no health, the stun still lands
  if(calm)fx.amount=0;else fx.amount=guardAmount(fx.hits,fx.amount);
  s.teamHP=Math.max(0,s.teamHP-fx.amount);
  const escaped=!!window.LoftRumbleDemo?.observeImpact(s,fx.warn,fx.hits);if(escaped)tutorCheck();cues.onImpact(fx,escaped);tutorial.onImpact(fx);
  if(def.id!=='pulse'&&s.hits){if(fx.hits.length){if(!camera)breakCombo('attack')}else{const a=hitsAnchor();s.popups.push({x:a.x,y:a.y+FEEL.comboPopGap,text:COPY.comboSaved,hud:true,align:a.align,color:'good',life:C.popupLife})}}
  window.LoftRumbleFeel.armStop(s,FEEL.attackStop,s.time);
  if(fx.amount){if(!camera||!window.LoftRumbleAttackImpact.trigger(s,def.id))s.shake=FEEL.shakeAttack;s.vignette=FEEL.vignetteLife;vibrate(FEEL.vibrateAttack)}
  for(const id of fx.hits){const p=s.bodies[id];
    if(camera&&window.LoftRumbleStun.apply(p,def.id,stopBody)&&s.held===id)cancelHold();
    const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy)||1;
    s.reactions[id]={life:FEEL.flinchLife,max:FEEL.flinchLife,nx:dx/d,ny:dy/d,recoil:FEEL.flinchRecoil};
    burst(p.x,p.y,FEEL.flinchSparks,FEEL.flinchSparkSpeed,def.colour)}
  const hit=fx.hits.map(id=>s.bodies[id]),from=hit.length?{x:hit.reduce((t,p)=>t+p.x,0)/hit.length,y:hit.reduce((t,p)=>t+p.y,0)/hit.length}:teamCentre();
  flyToTeam(fx.amount?'-'+fx.amount:calm&&(fx.hits.length||def.id==='pulse')?window.LoftRumbleCuesData.copy.protectedFly:COPY.dodged,fx.amount?'danger':'primary',from,'',fx.amount?'hurt':null);
  tone(FEEL.boomFreq,'sine',FEEL.boomLife,FEEL.boomGain,FEEL.boomFreq/2);noise(FEEL.boomLife,FEEL.noiseGain);
  if(s.teamHP<=0)finishBattle(false);else if(!s.heart)s.heart=heartSpot();
}
// Camera experiment only (camera-punish.js): Root snap landed on `hit`, the residents resting in its ring. Same price as one Beam hit
// each, and the combo breaks the same way. The camera session has already knocked them clear.
function punishImpact(hit){
  const e=enemy(),amount=tutorial.harmless()?0:guardAmount(hit,hit.length*RT.beamHit); // Training: the Root snap still knocks residents clear, but costs nothing
  s.teamHP=Math.max(0,s.teamHP-amount);cues.onRoot(hit,amount);
  if(s.hits)breakCombo('punish');
  window.LoftRumbleFeel.armStop(s,FEEL.attackStop,s.time);s.shake=FEEL.shakeAttack;s.vignette=FEEL.vignetteLife;vibrate(FEEL.vibrateAttack);
  for(const id of hit){const p=s.bodies[id],dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy)||1;
    s.reactions[id]={life:FEEL.flinchLife,max:FEEL.flinchLife,nx:dx/d,ny:dy/d,recoil:FEEL.flinchRecoil};
    burst(p.x,p.y,FEEL.flinchSparks,FEEL.flinchSparkSpeed,'danger')}
  flyToTeam(amount?'-'+amount:window.LoftRumbleCuesData.copy.protectedFly,amount?'danger':'primary',{x:hit.reduce((t,id)=>t+s.bodies[id].x,0)/hit.length,y:hit.reduce((t,id)=>t+s.bodies[id].y,0)/hit.length},'',amount?'hurt':null);
  tone(FEEL.boomFreq,'sine',FEEL.boomLife,FEEL.boomGain,FEEL.boomFreq/2);noise(FEEL.boomLife,FEEL.noiseGain);
  if(s.teamHP<=0)finishBattle(false);
}
// End of a combo: one total flies from the last hit into the enemy bar, with a short breakdown, then the pending segment drains.
function showPayoff(){
  const t=s.tally;s.tally=null;if(!t||!t.total)return;s.combos++;
  const e=enemy(),h=s.lastHit??{x:e.x,y:e.y+C.enemyRadius},a=Math.atan2(h.y-e.y,h.x-e.x),out=C.enemyRadius+FEEL.payoffSize;
  s.payoff={life:FEEL.payoffLife,total:t.total,weak:t.parts.some(p=>p.weak),from:{x:clamp(e.x+Math.cos(a)*out,FEEL.payoffSize,s.w-FEEL.payoffSize),y:e.y+Math.sin(a)*out}};
  s.enemyWait=still()?0:FEEL.flyTime;if(!s.enemyWait)s.enemyBarFlash=FEEL.barFlash;
  s.enemyDrain=Math.max(1,(s.enemyChip-s.hp)/FEEL.payoffDrain);
  if(s.hp<=0&&s.phase==='play'&&!s.finale)finishBattle(true);
}
// Finale: starts once on the killing blow. The world clock (s.time, enemy clock, recharge) stops; physics run slowed; effects run at real pace.
const finaleRate=()=>still()?1:FEEL.finaleSlow;
function startFinale(){if(s.finale||s.phase!=='play'||s.finaleCount)return;s.finaleCount++;s.finale={t:0};const e=enemy(),calm=still();
  burst(e.x,e.y,FEEL.finaleSparks,FEEL.finaleSparkSpeed,'warning');burst(e.x,e.y,FEEL.finaleShards,FEEL.finaleShardSpeed,'track',Math.PI*2,0,FEEL.finaleShardSize);
  s.rings.push({x:e.x,y:e.y,life:FEEL.shockLife*2,max:FEEL.shockLife*2,colour:'warning',big:FEEL.shockRadius*2});vibrate(FEEL.finaleVibrate);if(!calm)s.shake=Math.max(s.shake,FEEL.finaleShake);
  s.hitStop=0;cancelHold();if(s.tally&&s.tally.total)showPayoff()} // the slow-mo replaces the hit-stop, which would otherwise stretch 1/finaleSlow times
function endFinale(){if(s.phase!=='play'||!s.finale)return;s.finale=null;if(s.tally&&s.tally.total)showPayoff();if(s.phase==='play')finishBattle(true)}
// Horn shape in enemy-local space: a plain triangle from the body edge (painted art when available).
function drawHorns(R){for(const def of FEEL.horns){const a=def.angle,len=FEEL.hornLength,base=R*.9,tip=R+len;
  if(artwork?.horn(ctx,def,R,len))continue;
  ctx.fillStyle=colors.foreground;ctx.strokeStyle=colors.border;ctx.lineWidth=2;ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(Math.cos(a-FEEL.hornBase)*base,Math.sin(a-FEEL.hornBase)*base);
  ctx.lineTo(Math.cos(a)*tip,Math.sin(a)*tip);ctx.lineTo(Math.cos(a+FEEL.hornBase)*base,Math.sin(a+FEEL.hornBase)*base);ctx.closePath();ctx.fill();ctx.stroke()}}
// Shield plate: returns false when the plate stops the hit (Springy). First touch queues the shield toast.
const plateAngle=()=>{const sh=s.shield;return sh.angle=enemy().angle??sh.angle}; // the plate sits on the weak spot
const guardZone=angle=>GUARD_RULES.guardZone(s.shield,angle-plateAngle(),FEEL.shieldArc/2,C.weakArc);
const onShield=angle=>guardZone(angle)===GUARD_RULES.GUARD_ZONES.plate;
function shieldSpark(angle,text,colour){const e=enemy(),r=C.enemyRadius+FEEL.shieldGap,x=e.x+Math.cos(angle)*r,y=e.y+Math.sin(angle)*r;burst(x,y,FEEL.shieldSparks,FEEL.wallSparkSpeed,colour,FEEL.wallSparkSpread,angle,2);
  const o=FEEL.popupSize*FEEL.shieldPop;s.popups.push({x:x+Math.cos(angle)*o,y:y+Math.sin(angle)*o,text,color:colour,life:C.popupLife*.8,max:C.popupLife*.8})}
// A contact hit against the guard: {mult (0: no damage), weak (counts as a weak-spot hit, usual x3)}. Owner rules round 4
// (2026-11-18, shield health): Chomper or heavy takes a third of the shield's HP ("Crack!"), anyone else a twelfth (a
// shield damage chip in the shield colour), piercing passes through to the weak spot. Either at 0 HP breaks it.
// First plate touch queues the shield toast. A pierce shows no spark: the weak-spot cue on the damage popup is its cue.
function shieldHit(b,angle){const sh=s.shield,plate=onShield(angle),t=kind(b.id),out=GUARD_RULES.guardHit(sh,guardZone(angle),GUARD,{trait:t,chomper:s.teamActive?t==='heavy':b.id==='chomper',inWeak:Math.abs(Math.atan2(Math.sin(angle-sh.angle),Math.cos(angle-sh.angle)))<C.weakArc,lifted:!!s.attackFx&&plateLift().lifted});Object.assign(sh,out.shield);
  if(!plate)return out;
  if(!sh.seen){sh.seen=true;s.toasts.push({id:b.id,kind:t,title:COPY.shieldToast.title,sub:COPY.shieldToast.sub,life:FEEL.toastLife})}
  if(out.event===GUARD_RULES.GUARD_EVENTS.break){const e=enemy(),r=C.enemyRadius+FEEL.shieldGap;
    burst(e.x+Math.cos(angle)*r,e.y+Math.sin(angle)*r,FEEL.shieldShards,FEEL.finaleShardSpeed,'warning',Math.PI*2,0,FEEL.finaleShardSize*.7);shieldSpark(angle,COPY.shattered,'danger');if(!still())s.shake=Math.max(s.shake,FEEL.shieldBreakShake)}
  else if(out.event===GUARD_RULES.GUARD_EVENTS.crack){shieldSpark(angle,COPY.crack,'warning');sh.hitT=FEEL.barkHitLife}
  else if(out.event===GUARD_RULES.GUARD_EVENTS.chip){shieldSpark(angle,phrase(COPY.shieldChip,{points:out.chip}),'chip');sh.hitT=FEEL.barkHitLife}
  return out}
// Living-magic boss look (LM3, boss-fight.js): one shield depth layer, 'rear' under the boss and 'front' over it. False until its art loads.
// LM3b: the boss's ground shadow and the Slam landing (crack 'ground', debris 'behind' and 'front'). False until their art loads.
const bossLook=()=>({fx:s.attackFx,feel:FEEL,timing:RT,clock:s.clock,enemy:enemy(),radius:C.enemyRadius,upright:camera?.shallow?camera.uprightScale:1,reduced:still(),arena:{w:s.w,h:s.h},enabled:!!camera&&window.LoftRumbleStorybook.enabled(camera),image:name=>artwork?.available(name)});
const bossSlamLook=layer=>!!window.LoftRumbleBossFight?.slam(ctx,{...bossLook(),layer});
const bossShadowLook=()=>!!window.LoftRumbleBossFight?.shadow(ctx,bossLook());
const bossShieldLook=layer=>window.LoftRumbleBossFight?.shield(ctx,{layer,shield:s.shield,enemy:enemy(),plate:C.enemyRadius+FEEL.shieldGap,arc:FEEL.shieldArc,feel:FEEL,clock:s.clock,upright:camera?.shallow?camera.uprightScale:1,reduced:still(),alive:s.hp>0,tint:{ring:colors.warning,edge:colors.foreground,flash:colors.flash,rim:colors['seed-glow']},image:name=>artwork?.available(name)});
// The plate: a thick metal arc outside the body with a sheen sliding along it and a tick per crack; it fades back in when it reforms.
// Round 2 (#439): a front-facing bark shield drawn in code (bark-shield.js) straight over the weak spot; the break flash and
// shards still come from boss-fight.js. Without bark-shield.js the older plate draws.
function drawBark(sh){const e=enemy(),r=C.enemyRadius;
  return window.LoftRumbleBarkShield?.draw(ctx,{x:e.x+Math.cos(sh.angle)*r,y:e.y+Math.sin(sh.angle)*r,size:r*FEEL.barkSize,cracks:sh.cracks,
    grow:GUARD_RULES.regrowScale(sh.up,GUARD),alpha:sh.up,hit:(sh.hitT??0)/FEEL.barkHitLife,reduced:still(),colors})}
// Round 3 (owner 2026-11-18: the code-drawn shield looked wrong): the painted front arc over the weak spot (boss-fight.js guardPlate).
function drawPainted(sh){const hit=sh.hitT??0,jolt=still()||!(hit>0)?0:FEEL.paintedJolt*Math.max(0,1-hit/FEEL.barkHitLife);
  return !!window.LoftRumbleBossFight?.guardPlate?.(ctx,{shield:sh,enemy:enemy(),radius:C.enemyRadius,arc:FEEL.shieldArc,feel:FEEL,
    grow:GUARD_RULES.regrowScale(sh.up,GUARD),jolt,lift:plateLift().share,top:C.hudTop,shade:colors.background,image:name=>artwork?.available(name)})}
// Lift opening (owner 2026-11-18, #445): the plate rises off the weak spot with the attack envelope that raises the body.
const plateLift=()=>GUARD_RULES.guardLift(actLevel(),GUARD,still());
// Round 5 (owner 2026-11-18): the shield's health shows in the HUD under the boss bar (rumble-hud.js shieldBar), not on
// the arena: an empty bar while broken, refilling with the regrow; none once the boss is down.
const hudShield=()=>{if(!(s.hp>0))return null;const bar=GUARD_RULES.shieldBar(s.shield,GUARD);return {fill:bar?bar.fill:0,label:COPY.shieldLabel}};
function drawShield(){if(swarmOn())return;const sh=s.shield;if(!(sh.down>0)&&s.hp>0&&drawPainted(sh))return;if(!(sh.down>0)&&s.hp>0&&drawBark(sh))return;if(bossShieldLook('front'))return;if(sh.down>0||s.hp<=0)return;if(artwork?.shield(ctx,sh,enemy(),C.enemyRadius+FEEL.shieldGap))return;const e=enemy(),r=C.enemyRadius+FEEL.shieldGap,a0=sh.angle-FEEL.shieldArc/2,a1=sh.angle+FEEL.shieldArc/2;ctx.save();ctx.globalAlpha=sh.up;ctx.lineCap='round';
  ctx.strokeStyle=colors.foreground;ctx.lineWidth=FEEL.shieldWidth+3;ctx.beginPath();ctx.arc(e.x,e.y,r,a0,a1);ctx.stroke();
  ctx.strokeStyle=colors['muted-foreground'];ctx.lineWidth=FEEL.shieldWidth;ctx.beginPath();ctx.arc(e.x,e.y,r,a0,a1);ctx.stroke();
  const k=still()?.5:(s.clock*FEEL.shieldSheenSpeed)%1,c=a0+(a1-a0)*k,half=FEEL.shieldArc*FEEL.shieldSheen/2;ctx.strokeStyle=colors.card;ctx.lineWidth=FEEL.shieldWidth*.4;ctx.beginPath();ctx.arc(e.x,e.y,r-1,Math.max(a0,c-half),Math.min(a1,c+half));ctx.stroke();
  ctx.strokeStyle=colors.card;ctx.lineWidth=1.5;for(let i=0;i<sh.cracks;i++){const a=a0+(a1-a0)*(i+1)/(FEEL.shieldCracks+1);ctx.beginPath();ctx.moveTo(e.x+Math.cos(a)*(r-FEEL.shieldWidth/2),e.y+Math.sin(a)*(r-FEEL.shieldWidth/2));ctx.lineTo(e.x+Math.cos(a+.06)*(r+FEEL.shieldWidth/2),e.y+Math.sin(a+.06)*(r+FEEL.shieldWidth/2));ctx.stroke()}
  ctx.restore()}
function finishBattle(won){if(s.phase==='over')return;
  const presentation=window.LoftRumbleSwarmRuntime?.active(camera)?null:window.LoftRumbleFinishModel.capture({s,C,FEEL,RT,ids,camera,contactPose,artSize,splashScale,enemy,bumperSpots,colors,artwork,skin:document.documentElement.dataset.arenaSkin});
  s.battleEnd=window.LoftRumbleBattleEnd.terminal(s.battleEnd,performance.now(),{won,hp:s.hp,maxHP:RT.hp,presentation});if(s.demo)s.banners=[];if(s.tutor&&!s.demo)tutorDone();s.phase='over';s.won=won;s.warn=null;s.attackFx=null;cancelHold();s.bolts=[];s.synHits=[];s.synArcs=[];s.synFields=[];s.bubbles={};s.supportRings=[];for(const id of ids)stopBody(s.bodies[id]);
  message(won?phrase(COPY.won,{time:clockText()})+'!':phrase(COPY.lost,{time:clockText()})+'. '+COPY.again+'.');statusLine();roster()}const swarmOn=()=>!!camera&&window.LoftRumbleSwarmRuntime.active(camera);const swarmFx={hurt(amount,x,y){s.teamBarHit=FEEL.barFlash;s.teamFlash=null;s.shake=Math.max(s.shake,FEEL.shakeAttack);s.popups.push({x,y,text:'-'+amount.toFixed(1).replace('.0',''),color:'danger',life:C.popupLife})},killed(ev){burst(ev.x,ev.y,FEEL.weakParticles,FEEL.weakSparkSpeed,'warning')},crystalHit(ev){s.teamBarHit=FEEL.barFlash;s.teamFlash=null;s.teamShown=teamTarget();teamText();window.LoftRumbleSwarmView.crystalHit(ev)}};function swarmDraw(layer=window.LoftRumbleSwarmView.layers.top,id){if(!swarmOn())return;ctx.save();window.LoftRumbleSwarmView.draw(ctx,{state:window.LoftRumbleSwarmRuntime.state(camera),image:lmArt,reduced:still(),layer,id,upright:camera.shallow?camera.uprightScale:1});ctx.restore()}
function statusLine(){if(camera?.predicting)return;document.getElementById('turn-label').textContent=phrase(COPY.battle,{time:clockText()});
  document.getElementById('attack-count').textContent=swarmOn()?'':s.phase==='over'?COPY.battleOver:phrase(COPY.attackIn,{attack:nextAttack().name,seconds:Math.max(0,Math.ceil(s.enemyT))})}
// Dock portraits: status only. The ring is the recharge (the only continuous meter); the portrait fills with gold as the special charges (never the recharge); a charged special glows with a badge.
const cardState={};
function roster(){if(camera?.predicting)return;document.querySelector('.roster').classList.toggle('no-recharge',!FEEL.recharge);for(const card of document.querySelectorAll('.roster [data-resident]')){const id=card.dataset.resident,b=s.bodies[id];if(!b)continue;
  const disabled=stunned(b),ready=s.phase==='play'&&!disabled&&s.specialCharge[id]>=1,label=disabled?window.LoftRumbleCameraCopy.stunned:b.moving?COPY.moving:b.charge<1?COPY.recharge:COPY.ready;
  const residentKind=kind(id),motion=disabled?'stunned':b.moving?'moving':b.charge<1?'recharging':'available';
  const charge=Math.round(s.specialCharge[id]*40)/40,stunRemaining=Math.ceil((b.stun??0)*10)/10,key=[label,ready,residentKind,stunRemaining].join(),was=cardState[id]; // charge alone: meter only, no glyph rebuild
  if(was?.charge!==charge)card.style.setProperty('--charge',charge);if(was?.key===key){if(was.charge!==charge){was.charge=charge;window.LoftRumbleHeroCards?.charge(card,charge)}continue}cardState[id]={key,charge};
  card.classList.toggle('ready',ready);card.classList.toggle('stunned',disabled);
  card.querySelector('.badge').textContent=COPY.special;setLabel(card.querySelector('small'),label,statusLabels);
  window.LoftRumbleHeroCards?.update(card,{name:names[id],specialCharge:charge,stunRemaining,trait:residentKind,traitLabel:traits[residentKind].name,description:traits[residentKind].description,motion,stateLabel:label,accessibleLabel:names[id]+', '+traits[residentKind].name+', '+label+(ready?COPY.ready_sr:'')})}}
// First-battle tutorial (round 16): three tiny steps in the toast style. A stored flag hides it for good once done or once the battle ends.
const TUTOR_KEY='loftRumbleTutorialSeen';
function tutorSeen(){try{return localStorage.getItem(s.demo?window.LoftRumbleDemoData.tutorialKey:TUTOR_KEY)==='1'}catch{return false}}
function tutorDone(){s.tutor=null;if(camera?.predicting)return;try{localStorage.setItem(s.demo?window.LoftRumbleDemoData.tutorialKey:TUTOR_KEY,'1')}catch{}}
// In the demo the Training run (rumble-tutorial-stage.js) replaces this tutorial and clears s.tutor.
function tutorCheck(){const t=s.tutor;if(!cues.installed()&&t&&t.pull&&t.bump&&t.zone)tutorDone()}
function tutorText(){const t=s.tutor,w=s.warn;if(!t||s.phase!=='play'||cues.installed())return null;
  if(!t.zone&&w&&FEEL.dangerAttacks.includes(w.def.id)&&s.enemyT<=RT.telegraph)return s.demo?window.LoftRumbleDemoData.copy.throwHelp.zone[throwPref.get()]:COPY.tutor.zone;return !t.pull?throwWords().tutor:!t.bump?COPY.tutor.bump:null}
// Ready ping (round 16): a recharged resident pops its ring and dock card and ticks once. Reduced motion: a brief highlight, no pop.
function readyPing(id){s.bodies[id].ping=FEEL.pingLife;vibrate(FEEL.readyVibrate);if(camera?.predicting)return;const card=document.querySelector('.roster [data-resident="'+id+'"]');if(card){const run=card.getAnimations({subtree:true}).filter(a=>a.effect?.target?.matches?.('.portrait'));if(run.length)for(const a of run)a.currentTime=0;else{card.classList.remove('ping');requestAnimationFrame(()=>card.classList.add('ping'))}}} // restart without a forced layout
// The first time any special charges, a one-time hint says how to use it.
function specialReady(id){roster();const rb=s.bodies[id];if(rb&&!still())burst(rb.x,rb.y,FEEL.readyBurst,FEEL.readyBurstSpeed,'warning');if(!cues.installed())message(names[id]+COPY.ready_sr)}
// Release: grade the gauge (Timing on); a charged resident plays its special's cut-in (battle paused), then flings. Only a release is graded.
// Perfect streak: counts consecutive Perfects for the PERFECT xN pop only; damage stays at the grade. Any other release resets it.
// A release before the gauge shows (gaugeDelay) is a normal shot: no grade, and the streak is left as it was.
function gradeRelease(){if(s.timing&&s.gaugeT<FEEL.gaugeDelay)return null;const g=gaugeGrade();if(!g?.perfect){s.streak=0;return g}s.streak++;
  return{...g,streak:s.streak}}
// shot.graded false would skip the gauge (no grade, no boost, streak kept); both throw styles send graded:true since 2026-11-15. shot.power is the travel share.
function release(id,angle,shot=SLING){if(stunned(s.bodies[id]))return;const k=kind(id),grade=shot.graded?gradeRelease():null;if(camera&&grade?.perfect)window.LoftRumbleStats.mark(s,names[id],'perfects');
  // Round 15: the cut-in plays on a resident's first special each battle; later ones flash gold and launch with no pause.
  const b=s.bodies[id];if(!tapOn&&s.specialCharge[id]>=1&&b&&!b.moving&&b.charge>=1&&s.phase==='play'){
    if(s.cutinSeen[id])s.flashes.push({x:b.x,y:b.y,life:FEEL.specialFlash});
    else{s.cutinSeen[id]=true;if(still())queueBanner({text:specials[k]+'!',colour:'warning',max:FEEL.cutinTime,now:true});
      else return startCutin({kind:'special',id,name:specials[k],max:FEEL.cutinTime,done:()=>fire(id,angle,grade,shot.power)})}}
  fire(id,angle,grade,shot.power)}
// A graded release: freeze, shockwave, pop, trail and haptic. Perfect adds a flash and a camera kick along the shot. Reduced motion keeps colour, text and streak.
function fire(id,angle,grade,power){if(!fling(id,angle,power)||!grade)return;const b=s.bodies[id],calm=still(),pf=grade.perfect,colour=pf?'perfect':'chip';b.boost=grade;b.trail=colour;
  const steps=pf?Math.min(grade.streak-1,FEEL.streakPopMax):0,text=pf?(grade.streak>1?phrase(COPY.perfectStreak,{streak:grade.streak}):COPY.perfect+'!'):grade.name+'!';
  s.popups.push({x:b.x,y:b.y-artSize()/2-FEEL.popupSize,text,big:true,color:colour,grow:(pf?FEEL.perfectPopScale:FEEL.greatPopScale)*(1+steps*FEEL.streakPopGrow),bounce:!calm,glow:pf,life:C.popupLife});
  s.rings.push({x:b.x,y:b.y,life:FEEL.shockLife,max:FEEL.shockLife,colour,big:pf?FEEL.shockRadius:FEEL.greatShockRadius});
  vibrate(pf?FEEL.perfectBuzz:FEEL.greatBuzz);if(pf)chargeSpecial(id,FEEL.perfectCharge);if(calm)return;
  window.LoftRumbleFeel.armStop(s,pf?FEEL.perfectFreeze:FEEL.greatFreeze,s.time);
  if(pf){burst(b.x,b.y,FEEL.weakParticles,FEEL.weakSparkSpeed,'perfect');s.flash=FEEL.perfectFlash;s.kick={x:Math.cos(angle),y:Math.sin(angle),life:FEEL.kickLife}}}
