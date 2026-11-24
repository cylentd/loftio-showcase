'use strict';
// One real-time slice: a cut-in pauses the whole battle (enemy clock and physics); otherwise the world steps, slowed or not.
// Entering Perfect: one pulse (not under reduced motion) and one haptic tick per entry.
function stepZone(real){s.perfectPulse=Math.max(0,(s.perfectPulse||0)-real);const zone=gaugeZone();if(zone==='perfect'&&s.gaugeZone!=='perfect'){if(!still())s.perfectPulse=FEEL.perfectPulseLife;vibrate(FEEL.perfectVibrate)}s.gaugeZone=zone}
// Toasts count real time, so they run through hit-stop and cut-ins. Only the first toastMax tick; the rest wait their turn.
// Visible toasts share one row: a lone toast centres, two split it. Each glides to its spot.
function stepToasts(real){const shown=s.toasts.slice(0,FEEL.toastMax),w=FEEL.toastW,gap=FEEL.toastGap,row=shown.length*w+(shown.length-1)*gap;
  shown.forEach((t,i)=>{const x=(s.w-row)/2+i*(w+gap);t.x=t.x===undefined||still()?x:t.x+(x-t.x)*Math.min(1,real/FEEL.toastSlide);t.life-=real});
  s.toasts=s.toasts.filter(t=>t.life>0)}
function advance(real){if(s.userPaused||s.phase==='over')return;dragFeel.tick(real);stepToasts(real);cues.tick(real);tutorial.tick(real);if(s.cutin){stepCutin(real);return}if(s.tapSpecials)specialsRt.tick(real);if(s.held&&s.pulled)s.gaugeT+=real;stepZone(real);const slow=slowed();if(slow!==s.slow){s.slow=slow;board.classList.toggle('slow',slow)}
  if(slow)s.focus=Math.max(0,s.focus-real*RT.focusDrain);else if(s.phase==='play'&&!(s.held&&s.pulled))s.focus=Math.min(RT.focusMax,s.focus+real*RT.focusMax/RT.focusRefill);
  let world=real*(slow?RT.slowFactor:1)*(s.finale?finaleRate():1);const fin=!!s.finale;while(world>0&&!s.cutin){const dt=Math.min(C.step,world);step(dt);if(s.phase==='over')return;world-=dt}
  if(fin&&finaleRate()<1)stepFx(real*(1-finaleRate())); // finale: bars, totals and pops keep real pace while the world crawls
  dangerDock()}
window.LoftRumbleReplayRuntime?.attach({s,draw,sync:()=>{roster();statusLine()},search:location.search});function frame(now){window.LoftRumbleSwarmBenchView?.frame(now);s.battleEnd=window.LoftRumbleBattleEnd.frame(s.battleEnd,now,!s.paused&&!s.userPaused&&!s.cinematic);const real=last?Math.min(C.maxFrame,(now-last)/1000):0;last=now;if(!s.paused&&!s.cinematic){if(window.LoftRumbleReplay)window.LoftRumbleReplay.frame(real,advance,draw);else{advance(real);draw()}}requestAnimationFrame(frame)}
const menuToggle=document.getElementById('menu-toggle'),menu=document.getElementById('menu');
function showMenu(open){
  if(open&&s.cinematic)return;
  if(open||s.demo)setPaused(open);
  menu.hidden=!open;menuToggle.setAttribute('aria-expanded',String(open));
  if(s.demo){if(open&&!menu.open){menu.showModal();document.getElementById('pause').focus()}else if(!open&&menu.open){menu.close();menuToggle.focus()}}
  else menu.toggleAttribute('open',open);
}
menuToggle.onclick=event=>{event.stopPropagation();showMenu(menu.hidden)};
menu.addEventListener('cancel',event=>{event.preventDefault();showMenu(false)});
function dismissBattleDialog(panel,close){
  let pressedOutside=false;
  const outside=event=>{const box=panel.getBoundingClientRect();return event.target===panel&&(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)};
  panel.addEventListener('pointerdown',event=>{pressedOutside=outside(event)});
  panel.addEventListener('pointercancel',()=>{pressedOutside=false});
  panel.addEventListener('keydown',event=>{
    if(event.key!=='Tab'||!panel.matches(':modal'))return;
    const controls=[...panel.querySelectorAll('button:not([disabled]),select:not([disabled]),a[href]')].filter(control=>control.getClientRects().length);
    const first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
  });
  panel.addEventListener('click',event=>{if(pressedOutside&&outside(event))close();pressedOutside=false});
}
dismissBattleDialog(menu,()=>showMenu(false));
document.addEventListener('click',event=>{if(!s.demo&&!menu.hidden&&!event.composedPath().includes(menu))showMenu(false)});
window.LoftRumbleRestart.install({trigger:document.getElementById('reset'),restart:playAgain,closeMenu:()=>showMenu(false),dismiss:dismissBattleDialog});document.getElementById('reroll').onclick=reroll;
// Pause (round 16): the top-bar toggle, opening settings or help, and a hidden tab all freeze the enemy clock and physics. A tap on the arena resumes.
const pauseButton=document.getElementById('pause');
function setPaused(on){s.battleEnd=window.LoftRumbleBattleEnd.frame(s.battleEnd,performance.now(),!s.paused&&!s.userPaused&&!s.cinematic);if(s.userPaused===on)return;s.userPaused=on;music.setPaused(on);pauseButton.setAttribute('aria-pressed',String(on));pauseButton.setAttribute('aria-label',on?COPY.resume:COPY.pause);if(on)cancelHold();message(on?COPY.paused:COPY.resume)}
pauseButton.onclick=e=>{e.stopPropagation();if(s.demo)showMenu(false);else setPaused(!s.userPaused)};document.addEventListener('visibilitychange',()=>{if(document.hidden){if(s.demo&&document.getElementById('help-panel').hidden)showMenu(true);else setPaused(true)}});
document.getElementById('replay-tutorial').onclick=event=>{if(tutorial.installed()){tutorial.replay(event.currentTarget);return}try{localStorage.removeItem(s.demo?window.LoftRumbleDemoData.tutorialKey:TUTOR_KEY)}catch{}reset();showMenu(false)};
function teamText(){if(camera?.predicting)return;document.getElementById('team-health').textContent=phrase(COPY.teamHealth,{now:s.teamShown,max:TURN.hp})}
// Boss bar: the top strip, full width unless bullet time needs room for the Focus meter.
// LM6b: with the living-magic frames loaded (and bullet time's Focus meter off), both bars are the frames' health channels.
function lmArt(name){return artwork?.available(name)??null}
function lmBars(){return FEEL.bulletTime?null:window.LoftRumbleHud?.channels(ctx,{width:s.w,height:s.h,strip:C.hudBottom,teamMax:TURN.hp,font:arenaFont,image:lmArt})??null}
function bossBar(){const lm=lmBars();if(lm)return lm.boss;const y=FEEL.barInset+FEEL.hudFont+4,x=FEEL.barInset;return{x,y,w:FEEL.bulletTime?Math.round(s.w*FEEL.teamBarW):s.w-x-FEEL.barInset,h:FEEL.teamBarH}}
// Team bar: one row in the bottom strip, directly above the dock: heart, "Your team", bar, HP.
function teamBar(){const lm=lmBars();if(lm)return lm.team;const x=FEEL.barInset+FEEL.teamIcon+FEEL.barInset/2+FEEL.teamLabelW;return{x,y:s.h-C.hudBottom/2-FEEL.teamBarH/2,w:s.w-x-FEEL.teamNumW-FEEL.barInset,h:FEEL.teamBarH}}
// High-contrast bar: dark track, pale pending segment, coloured value, foreground edge; `flash` (0-1) washes it with `wash`.
function drawBar(x,y,w,h,value,chip,max,fill,flash=0,wash=colors.flash){
  if(window.LoftRumbleBattleMaterials?.meter(ctx,x,y,w,h,value,chip,max,fill,flash,wash))return;
  const r=h/2;ctx.fillStyle=colors.track;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();
  ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.clip();
  ctx.fillStyle=colors.pending;ctx.fillRect(x,y,w*chip/max,h);ctx.fillStyle=fill;ctx.fillRect(x,y,w*value/max,h);
  if(flash>0){ctx.globalAlpha=flash;ctx.fillStyle=wash;ctx.fillRect(x,y,w,h);ctx.globalAlpha=1}ctx.restore();
  ctx.strokeStyle=colors.foreground;ctx.lineWidth=1.5;ctx.beginPath();ctx.roundRect(x+.75,y+.75,w-1.5,h-1.5,r);ctx.stroke();
}
function heartIcon(x,y,size,fill){const k=size/24;ctx.save();ctx.translate(x,y);ctx.scale(k,k);ctx.fillStyle=fill;ctx.beginPath();ctx.moveTo(0,10);ctx.bezierCurveTo(-24,-4,-9,-20,0,-8);ctx.bezierCurveTo(9,-20,24,-4,0,10);ctx.fill();ctx.restore()}
const threatened=()=>!!currentWarn();
// Badge icons, drawn in a 14 px box around (x,y): pulse = rings, beam = slash, slam = arrow onto the floor.
function attackIcon(id,x,y,colour){
  if(artPaint('icon-'+id,x,y,FEEL.intentH-FEEL.intentPad))return;
  ctx.save();ctx.translate(x,y);ctx.strokeStyle=colour;ctx.fillStyle=colour;ctx.lineWidth=2;ctx.lineCap='round';ctx.beginPath();
  if(id==='pulse'){ctx.arc(0,0,6,0,Math.PI*2);ctx.stroke();circle(0,0,2.5,colour)}
  else if(id==='beam'){ctx.lineWidth=3.5;ctx.moveTo(-6,5);ctx.lineTo(6,-5);ctx.stroke()}
  else{ctx.moveTo(-7,6);ctx.lineTo(7,6);ctx.moveTo(0,-7);ctx.lineTo(0,2);ctx.moveTo(-4,-1);ctx.lineTo(0,3);ctx.lineTo(4,-1);ctx.stroke()}
  ctx.restore();
}
// Both bars use one health scale a non-gamer already knows: green, amber, red. Below healthLow the bar also pulses.
const healthFill=share=>share>FEEL.healthMid?colors.good:share>FEEL.healthLow?colors.chip:colors.danger;
const lowPulse=share=>share<=FEEL.healthLow&&share>0&&!still()?FEEL.lowWash*(.5+.5*Math.sin(s.clock*FEEL.lowPulse)):0;
// Hit counter, top right under the boss bar: "23 hits". Pops on each hit, grows a little per milestone; a Beam or Slam break
// shatters it with "Combo lost" (a plain fade under reduced motion); the idle timeout only fades it.
// LM6b: the living-magic count on the left edge inside the open spiral (rumble-hud.js); a milestone hit pops it once.
function drawHits(font){const hud=window.LoftRumbleHud;if(hud){const calm=still(),left=s.hitsPop/FEEL.comboPopLife,mile=FEEL.comboMilestones.includes(s.hits);
    const L=s.hitsLost,scale=(calm?1:1+FEEL.comboPop*left)*(mile?window.LoftRumbleHudModel.milestoneScale(left,window.LoftRumbleHudData,calm):1);
    hud.combo(ctx,{hits:s.hits,word:COPY.combo,scale,reduced:calm,font,image:name=>artwork?.available(name),
      lost:L?{n:L.n,age:1-L.life/FEEL.comboLostLife,shatter:L.shatter,spread:FEEL.comboShatter,word:COPY.comboLost}:null});return}
  const {x,y}=hitsAnchor(),calm=still();ctx.save();if(s.hits&&artwork)artPaint('ui-badge-combo',x-artwork.metrics.comboBadgeWidth/2,y-artwork.metrics.comboBadgeHeight/3,artwork.metrics.comboBadgeWidth,artwork.metrics.comboBadgeHeight,true);ctx.textAlign='right';ctx.lineJoin='round';ctx.strokeStyle=colors.card;ctx.lineWidth=4;
  const text=(t,tx,ty,fill)=>{ctx.fillStyle=fill;ctx.strokeText(t,tx,ty);ctx.fillText(t,tx,ty)};
  if(s.hits>0){const miles=FEEL.comboMilestones.filter(m=>s.hits>=m).length,k=(1+FEEL.comboGrow*miles)*(calm?1:1+FEEL.comboPop*s.hitsPop/FEEL.comboPopLife);
    ctx.translate(x,y);ctx.scale(k,k);ctx.font=FEEL.textWeight+' '+FEEL.hudFont+'px '+font;const label=COPY.combo,lw=ctx.measureText(label).width;text(label,0,0,colors['muted-foreground']);
    ctx.font=FEEL.textWeight+' '+FEEL.comboFont+'px '+font;text(String(s.hits),-lw-FEEL.comboGap,0,colors.foreground)}
  else if(s.hitsLost){const L=s.hitsLost,age=1-L.life/FEEL.comboLostLife,n=String(L.n);ctx.globalAlpha=1-age;ctx.font=FEEL.textWeight+' '+FEEL.comboFont+'px '+font;
    if(L.shatter&&!calm){const chars=[...n];let cx=x-ctx.measureText(n).width;ctx.textAlign='center';
      chars.forEach((c,i)=>{const w=ctx.measureText(c).width,dir=i-(chars.length-1)/2||.5;ctx.save();ctx.translate(cx+w/2+dir*FEEL.comboShatter*age,y+FEEL.comboShatter*age*age);ctx.rotate(dir*age);text(c,0,0,colors.danger);ctx.restore();cx+=w});ctx.textAlign='right'}
    else text(n,x,y,colors['muted-foreground']);
    if(L.shatter){ctx.font=FEEL.textWeight+' '+FEEL.hudFont+'px '+font;text(COPY.comboLost,x,y+FEEL.comboPopGap*.7,colors.danger)}}
  ctx.restore()}
function drawBars(font){
  if(s.demo&&drawEndReady())return;
  // Team bar, bottom strip: a heart, "Your team", a thick bar, HP. It shakes and flashes when hit, flashes green on a heal, pulses red when low.
  const t=teamBar(),share=s.teamShown/TURN.hp,fill=healthFill(share),hit=s.teamBarHit/FEEL.barFlash,heal=s.teamFlash==='heal',mid=t.y+t.h/2;
  const ox=hit&&!heal&&!still()?Math.sin(s.clock*FEEL.lowPulse*12)*FEEL.barShake*hit:0;
  const hud=FEEL.bulletTime?null:window.LoftRumbleHud;
  if(!hud?.team(ctx,{width:s.w,height:s.h,strip:C.hudBottom,shake:ox,font,image:lmArt,
    bar:{value:s.teamShown,chip:s.teamChip,max:TURN.hp,flash:Math.max(hit*FEEL.hitWash,lowPulse(share)),wash:hit&&heal?colors.good:colors.danger}})){
  ctx.save();ctx.translate(ox,0);
  heartIcon(FEEL.barInset+FEEL.teamIcon/2,mid,FEEL.teamIcon,fill);
  ctx.font=FEEL.textWeight+' '+FEEL.hudFont+'px '+font;ctx.textBaseline='middle';ctx.fillStyle=colors.foreground;
  ctx.textAlign='left';ctx.fillText(COPY.teamName,FEEL.barInset+FEEL.teamIcon+FEEL.barInset/2,mid);ctx.textAlign='right';ctx.fillText(s.teamShown+'/'+TURN.hp,s.w-FEEL.barInset,mid);ctx.textBaseline='alphabetic';
  artwork?.bar(ctx,'ui-bar-team',t);drawBar(t.x,t.y,t.w,t.h,s.teamShown,s.teamChip,TURN.hp,fill,Math.max(hit*FEEL.hitWash,lowPulse(share)),hit&&heal?colors.good:colors.danger);
  ctx.restore()}
  // Boss bar, top strip: the enemy's name and HP over a full-width bar, same health colours, pending segment and low pulse.
  const b=bossBar(),share2=s.hp/RT.hp,fill2=healthFill(share2);
  if(swarmOn()){hud?.counter(ctx,{width:s.w,top:C.hudTop,progress:window.LoftRumbleSwarm.progress(window.LoftRumbleSwarmRuntime.state(camera)),font,image:lmArt})}else if(!hud?.boss(ctx,{width:s.w,top:C.hudTop,name:s.hp>0?COPY.boss:COPY.bossDown,font,image:lmArt,shield:hudShield(),
    bar:{value:s.hp,chip:s.enemyChip,max:RT.hp,flash:Math.max(.8*s.enemyBarFlash/FEEL.barFlash,lowPulse(share2)),wash:s.enemyBarFlash?colors.flash:colors.danger}})){
  ctx.font=FEEL.textWeight+' '+FEEL.bossLabelFont+'px '+font;ctx.fillStyle=colors.foreground;ctx.textAlign='left';ctx.fillText(s.hp>0?COPY.boss:COPY.bossDown,b.x,b.y-4);ctx.textAlign='right';ctx.fillText(phrase(COPY.hp,{hp:s.hp}),b.x+b.w,b.y-4);
  artwork?.bar(ctx,'ui-bar-boss',b);drawBar(b.x,b.y,b.w,b.h,s.hp,s.enemyChip,RT.hp,fill2,Math.max(.8*s.enemyBarFlash/FEEL.barFlash,lowPulse(share2)),s.enemyBarFlash?colors.flash:colors.danger)}
  drawHits(font);
  // The intent chip stays by the enemy: it is about the enemy's position.
  if(enemyVisible()&&!camera?.fixture)drawIntent(font,camera?camera.intentAnchor(enemy()):enemy());
}
// The enemy stays on screen until the end-of-shot total has drained its bar.
const enemyVisible=()=>!swarmOn()&&(s.hp>0||s.enemyChip>0||!!s.finale);
function drawEnemy(ground=true){
  if(swarmOn()){swarmDraw(window.LoftRumbleSwarmView.layers.body,enemy().monsterId);return}if(!enemyVisible())return;
  const whip=s.attackFx?.whiplash,projection=whip?s.attackFx.warn.projection:s.warn?.projection;
  if(projection&&window.LoftRumbleWhiplashRenderer){
    bossShadowLook();bossShieldLook('rear');
    const whipLook={projection,reduced:still(),radius:C.enemyRadius,bounds:{width:s.w,height:s.h},upright:camera?.shallow?camera.uprightScale:1};
    window.LoftRumbleWhiplashRenderer.trail?.(ctx,whipLook);
    ctx.save();ctx.translate(projection.origin.x,projection.origin.y);drawHorns(C.enemyRadius);ctx.restore();
    if(window.LoftRumbleWhiplashRenderer.body(ctx,{projection,elapsed:whip?.elapsed??0,reduced:still(),radius:C.enemyRadius,bounds:{width:s.w,height:s.h},upright:camera?.shallow?camera.uprightScale:1,feel:FEEL,timing:RT,image:name=>artwork?.available(name)})){
      const e=enemy(),R=C.enemyRadius;
      ctx.save();ctx.translate(e.x,e.y);
      artPaint('boss-weakspot',Math.cos(e.angle)*R,Math.sin(e.angle)*R,artwork?.metrics.weakspotSize);ctx.restore();return;
    }
  }
  const e=enemy(),R=C.enemyRadius,fx=s.attackFx,warn=currentWarn(),threat=!!warn,winding=fx&&!fx.hit&&fx.t>=0,col=warn?colors[warn.def.colour]:colors.danger,kind=fx?fx.warn.def.id:'';let ox=0,oy=0,grow=0;
  if(fx&&fx.t>=0&&!still()){const c=teamCentre(),dx=c.x-e.x,dy=c.y-e.y,d=Math.hypot(dx,dy)||1;
    if(kind==='slam'){if(fx.t<FEEL.windup){const k=fx.t/FEEL.windup;oy=-FEEL.slamHop*Math.sin(k*Math.PI/2);grow=FEEL.windupGrow*k}else if(!fx.hit){const k=(fx.t-FEEL.windup)/FEEL.travel;oy=-FEEL.slamHop*(1-k*k);grow=FEEL.windupGrow*(1-k)}}
    else if(fx.t<FEEL.windup){const k=fx.t/FEEL.windup;grow=FEEL.windupGrow*k;if(kind==='pulse'){ox=-dx/d*FEEL.lunge*.3*k;oy=-dy/d*FEEL.lunge*.3*k}}
    else if(kind==='pulse'){const k=Math.min(1,(fx.t-FEEL.windup)/(FEEL.travel*2)),lunge=Math.sin(k*Math.PI)*FEEL.lunge;ox=dx/d*lunge;oy=dy/d*lunge}}
  // Enemy turn: it rises and glows in the attack's colour before winding up.
  const act=actLevel(),lift=still()?0:FEEL.riseHeight*act;
  if(ground)window.LoftRumbleColosseumRelief?.ground(ctx,e.x+ox,e.y+oy,R,document.documentElement.dataset.arenaSkin);
  if(act>0){const ac=colors[fx.warn.def.colour],pulse=still()?1:.75+.25*Math.sin(s.clock*FEEL.telegraphPulse*1.5);ctx.globalAlpha=.35*act*pulse;circle(e.x+ox,e.y+oy-lift,R+6+FEEL.riseGlow*act,ac);ctx.globalAlpha=1}
  bossShadowLook();if(!window.LoftRumbleBarkShield)bossShieldLook('rear');
  ctx.save();ctx.translate(e.x+ox,e.y+oy-lift);
  if(s.finale){const k=Math.min(1,s.finale.t/FEEL.finaleTime);ctx.globalAlpha=1-k;if(!still())ctx.scale(1+FEEL.finalePop*k,1+FEEL.finalePop*k)} // finale: the enemy pops and fades
  if(s.enemyHit&&!still()){const h=s.enemyHit,k=FEEL.enemySquash*h.k*h.life/FEEL.enemySquashLife,a=Math.atan2(h.ny,h.nx);ctx.rotate(a);ctx.scale(1-k,1+k*.5);ctx.rotate(-a)}
  ctx.scale(1+grow,1+grow);drawHorns(R);
  const cue=camera?window.LoftRumbleTelegraph.read({warn,fx,remaining:s.enemyT,timing:RT,feel:FEEL}):null;
  if(threat&&!cue){const level=winding?Math.min(1,fx.t/FEEL.windup):still()?.5:.5+.5*Math.sin(s.clock*FEEL.telegraphPulse);
    ctx.globalAlpha=.2+.55*level;ctx.strokeStyle=col;ctx.lineWidth=3+level*5;ctx.beginPath();ctx.arc(0,0,R+7+level*FEEL.telegraphGlow,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1}
  const paintBody=camera?.shallow?camera.paintUpright.bind(camera):artPaint;
  const bossArt=name=>artwork?.available(name),upright=camera?.shallow?camera.uprightScale:1;
  ctx.save();const rigged=window.LoftRumbleBossFight?.body(ctx,{fx,feel:FEEL,timing:RT,clock:s.clock,radius:R,upright,reduced:still(),fade:camera?.bossFade??1,enabled:!!camera&&window.LoftRumbleStorybook.enabled(camera),image:bossArt});
  if(camera&&!rigged)window.LoftRumbleTelegraph.pose(ctx,cue,R,still());
  const skinned=rigged||paintBody(s.enemyFlash>0?'boss-hurt':'boss-body',0,0,R*(artwork?.metrics.bossSize??2),R*(artwork?.metrics.bossSize??2))||paintBody('boss-body',0,0,R*(artwork?.metrics.bossSize??2));
  if(!skinned){circle(0,0,R+5,threat?col:colors.border);circle(0,0,R,colors.secondary)}
  ctx.restore();if(!window.LoftRumbleBossFight?.sources(ctx,{cue,fx,feel:FEEL,radius:R,upright,image:bossArt})&&camera)window.LoftRumbleTelegraph.source(ctx,cue,R,colors);
  const wx=Math.cos(e.angle)*R,wy=Math.sin(e.angle)*R;
  // Round 6 (owner 2026-11-18, 'Why the heck is that yellow thing?'): no gold glow; the exposed weak spot shows only its painted art.
  if(!artPaint('boss-weakspot',wx,wy,artwork?.metrics.weakspotSize)){circle(wx,wy,10,colors.warning);circle(wx,wy,5,colors.foreground);circle(wx,wy,2,colors.warning)}
  if(!skinned){
  const ex=R*.28,ey=-R*.14;circle(-ex,ey,4,colors.foreground);circle(ex,ey,4,colors.foreground);
  ctx.strokeStyle=colors.foreground;ctx.lineWidth=2;ctx.beginPath();
  if(threat||winding){ctx.moveTo(-ex-6,ey-10);ctx.lineTo(-ex+5,ey-6);ctx.moveTo(ex+6,ey-10);ctx.lineTo(ex-5,ey-6);ctx.stroke();ctx.beginPath();ctx.arc(0,R*.4,9,Math.PI*1.15,Math.PI*1.85)}
  else ctx.arc(0,R*.13,R*.27,0,Math.PI);
  ctx.stroke();}
  if(!skinned&&s.enemyFlash>0&&!still()){ctx.globalAlpha=s.enemyFlash/FEEL.enemyFlash;circle(0,0,R+5,colors.flash);ctx.globalAlpha=1}
  ctx.restore();bossSlamLook('front');
}
// The boss Beam is on screen from the end of its windup until its fade ends (FIRE, then FADE).
const beamLive=()=>{const fx=s.attackFx;return !!fx&&fx.warn.def.id==='beam'&&fx.t>=FEEL.windup&&fx.t-FEEL.windup-FEEL.travel<FEEL.beamFade};
function drawAttack(){
  const whip=whiplashVisualFx();if(whip)LoftRumbleWhiplashRenderer.impact(ctx,whip.warn.projection,whip.hits,s.bodies,whip,still());
  const fx=s.attackFx;if(!fx||fx.t<0)return;
  if(fx.whiplash)return;
  const e=enemy(),def=fx.warn.def,col=colors[def.colour],impact=FEEL.windup+FEEL.travel,after=fx.t-impact,L=Math.hypot(s.w,s.h);
  if(def.id==='pulse'){if(fx.t<FEEL.windup)return;const k=Math.min(1,(fx.t-FEEL.windup)/FEEL.travel),ease=k*k;
    if(!fx.hit){for(const p of Object.values(s.positions)){for(let i=FEEL.orbTrail;i>=0;i--){const q=Math.max(0,ease-i*.06);ctx.globalAlpha=1-i/(FEEL.orbTrail+1);circle(e.x+(p.x-e.x)*q,e.y+(p.y-e.y)*q,FEEL.orbRadius*(1-i*.18),col)}}ctx.globalAlpha=1}
    const spread=Math.min(1,(fx.t-FEEL.windup)/(FEEL.travel*2)),far=Math.max(...Object.values(s.positions).map(p=>Math.hypot(p.x-e.x,p.y-e.y)));
    ctx.globalAlpha=Math.max(0,1-spread);ctx.strokeStyle=col;ctx.lineWidth=5;ctx.beginPath();ctx.arc(e.x,e.y,C.enemyRadius+spread*far,0,Math.PI*2);ctx.stroke();artPaint('fx-pulse-ring',e.x,e.y,(C.enemyRadius+spread*far)*2);ctx.globalAlpha=1;return}
  if(def.id==='beam'){ctx.save();ctx.translate(e.x,e.y);ctx.rotate(fx.warn.angle);
    if(window.LoftRumbleBossFight?.beam(ctx,{fx,feel:FEEL,radius:C.enemyRadius,length:L,reduced:still(),image:name=>artwork?.available(name),
      tint:{fire:colors['beam-fire'],core:colors['beam-core']},ends:beamWalls(e,fx.warn.angle),angle:fx.warn.angle,upright:camera?.shallow?camera.uprightScale:1,
      lane:(reach,half,alpha,edge)=>{ctx.globalAlpha=alpha;ctx.fillStyle=col;ctx.fillRect(-reach,-half,2*reach,2*half);
        if(edge){ctx.globalAlpha=edge.alpha;ctx.strokeStyle=col;ctx.lineWidth=edge.width;ctx.beginPath();ctx.moveTo(-reach,-half);ctx.lineTo(reach,-half);ctx.moveTo(-reach,half);ctx.lineTo(reach,half);ctx.stroke()}}})){ctx.restore();ctx.globalAlpha=1;return} // LM3: two beams from the two glows over the outlined hit lane (concept FIRE / FADE)
    if(fx.t<FEEL.windup){const k=fx.t/FEEL.windup,flicker=still()?1:.7+.3*Math.sin(s.clock*FEEL.telegraphPulse*6);ctx.globalAlpha=k*flicker;ctx.strokeStyle=col;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-L,0);ctx.lineTo(L,0);ctx.stroke()}
    else if(after<0){const k=(fx.t-FEEL.windup)/FEEL.travel;ctx.fillStyle=col;ctx.globalAlpha=.9;ctx.fillRect(-L*k,-FEEL.beamHalf*k,2*L*k,2*FEEL.beamHalf*k)}
    else if(after<FEEL.beamFade){const k=1-after/FEEL.beamFade;ctx.globalAlpha=k;ctx.fillStyle=col;ctx.fillRect(-L,-FEEL.beamHalf*k,2*L,2*FEEL.beamHalf*k);ctx.fillStyle=colors.flash;ctx.fillRect(-L,-FEEL.beamHalf*k*.3,2*L,FEEL.beamHalf*k*.6)}
    artwork?.beam(ctx,fx,FEEL,L);ctx.restore();ctx.globalAlpha=1;return}
  // Slam: the enemy hops (drawEnemy), lands, and a ground shockwave runs out to the zone edge. LM3b: the living-magic crack
  // (boss-slam ground layer) replaces the old crack sprite under the shockwave and fades through the recovery.
  const owned=after>=0&&bossSlamLook('ground');
  if(owned)bossSlamLook('behind');
  if(after>=0&&after<FEEL.slamRingLife){const k=after/FEEL.slamRingLife,r=C.enemyRadius+(slamRadius()-C.enemyRadius)*Math.sqrt(k);
    ctx.globalAlpha=1-k;if(!owned)artPaint('fx-slam-crack',e.x,e.y,artwork?.metrics.effectSize);ctx.globalAlpha=(1-k)*.35;circle(e.x,e.y,r,col);ctx.globalAlpha=1-k;ctx.strokeStyle=col;ctx.lineWidth=8*(1-k)+2;ctx.beginPath();ctx.arc(e.x,e.y,r,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1}
}
// Camera experiment only (camera-punish.js): the Root snap ring, drawn like the Slam zone on the floor, and a ring on each resident in it.
function drawRootSnap(){
  const ring=camera.punishRing();if(!ring)return;
  const e=enemy(),col=colors.slam,beat=still()?0:FEEL.zonePulse*Math.sin(s.clock*FEEL.telegraphPulse),config=window.LoftRumbleCameraConfig;
  ctx.save();ctx.globalAlpha=FEEL.zoneAlpha+beat+ring.charge*config.rootChargeAlpha;ctx.fillStyle=col;ctx.strokeStyle=col;ctx.lineWidth=2;ctx.setLineDash(config.rootDash);
  ctx.beginPath();ctx.arc(e.x,e.y,ring.radius,0,Math.PI*2);ctx.fill();ctx.globalAlpha=config.rootOutlineAlpha;ctx.stroke();ctx.restore();
  for(const id of ring.ids){const p=livePos(id);ctx.strokeStyle=col;ctx.lineWidth=config.rootDangerWidth;ctx.beginPath();ctx.arc(p.x,p.y,C.visualSize/2+FEEL.dangerMark,0,Math.PI*2);ctx.stroke()}
}
// The boss Beam's look (boss-fight-model.js): how far each beam runs to the play area's edge, for its wall glows and chevrons.
const beamWalls=(e,angle)=>window.LoftRumbleBossFightModel?.wallReach(e,angle,{left:0,top:C.hudTop,right:s.w,bottom:s.h-C.hudBottom},window.LoftRumbleBossFightData);
// Concept CHARGE: chevrons in the purple lane pointing away from the boss, in the lane's colour (beam frame).
function drawChevrons(warn,charge){
  const M=window.LoftRumbleBossFightModel,walls=beamWalls(enemy(),warn.angle);if(!M||!walls)return;
  const V=window.LoftRumbleBossFightData.beam.chevrons;
  for(const c of M.laneChevrons({...walls,half:FEEL.beamHalf,radius:C.enemyRadius,clock:s.clock,charge,reduced:still()},window.LoftRumbleBossFightData)){
    const tip=c.x+c.dir*c.size/2,back=c.x-c.dir*c.size/2;ctx.beginPath();ctx.moveTo(tip,0);ctx.lineTo(back,-c.size/2);ctx.lineTo(back,c.size/2);ctx.closePath();
    ctx.globalAlpha=c.alpha*V.fill;ctx.fill();ctx.globalAlpha=c.alpha;ctx.lineWidth=V.width;ctx.stroke()}
}
// Warning turn: positional attacks draw their zone, and residents inside it get a ring in the attack's colour.
function drawWarn(){
  if(swarmOn()){swarmDraw(window.LoftRumbleSwarmView.layers.ground);return}if(camera)drawRootSnap();
  const warn=currentWarn(),projection=s.attackFx?.whiplash?s.attackFx.warn.projection:s.warn?.projection;
  if(projection){window.LoftRumbleWhiplashRenderer?.warning(ctx,projection,colors['boss-beam']);return;}
  if(!warn||warn.def.id==='pulse')return;
  if(camera)window.LoftRumbleTelegraph.ground(ctx,window.LoftRumbleTelegraph.read({warn,fx:s.attackFx,remaining:s.enemyT,timing:RT,feel:FEEL}),enemy(),C.enemyRadius,colors,still());
  const e=enemy(),col=colors[warn.def.colour],fx=s.attackFx,charge=fx&&fx.t>=0?Math.min(1,fx.t/FEEL.windup):0,beat=still()?0:FEEL.zonePulse*Math.sin(s.clock*FEEL.telegraphPulse),L=Math.hypot(s.w,s.h);
  ctx.save();ctx.globalAlpha=FEEL.zoneAlpha+beat+charge*.15;ctx.fillStyle=col;ctx.strokeStyle=col;ctx.lineWidth=2;ctx.setLineDash([8,7]);
  // Once the art beam fires (concept FIRE) it draws the lane itself as an outline, so the warning fill steps aside.
  const artFiring=warn.def.id==='beam'&&fx&&fx.t>=FEEL.windup&&window.LoftRumbleBossFight&&artwork?.available(window.LoftRumbleBossFightData.textures.beam);
  if(warn.def.id==='beam'){if(!artFiring){ctx.translate(e.x,e.y);ctx.rotate(warn.angle);ctx.fillRect(-L,-FEEL.beamHalf,2*L,2*FEEL.beamHalf);ctx.globalAlpha=.7;ctx.beginPath();ctx.moveTo(-L,-FEEL.beamHalf);ctx.lineTo(L,-FEEL.beamHalf);ctx.moveTo(-L,FEEL.beamHalf);ctx.lineTo(L,FEEL.beamHalf);ctx.stroke();
    ctx.setLineDash([]);drawChevrons(warn,charge)}}
  else{const r=slamRadius();ctx.beginPath();ctx.arc(e.x,e.y,r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=.7;ctx.stroke()}
  ctx.restore();
  for(const id of TURN.order){const p=livePos(id);if(!inZone(warn,p))continue;ctx.strokeStyle=col;ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,C.visualSize/2+FEEL.dangerMark,0,Math.PI*2);ctx.stroke()}
}
function drawVignette(){
  if(!s.vignette||still())return;
  const a=FEEL.vignetteAlpha*s.vignette/FEEL.vignetteLife,g=ctx.createRadialGradient(s.w/2,s.h/2,Math.min(s.w,s.h)*.25,s.w/2,s.h/2,Math.hypot(s.w,s.h)/2);
  g.addColorStop(0,withAlpha(colors.danger,0));g.addColorStop(1,withAlpha(colors.danger,a));ctx.fillStyle=g;ctx.fillRect(0,0,s.w,s.h);
}
// Ease for numbers flying into a bar: slow start, fast landing.
const flyEase=k=>k*k*(3-2*k);
// Ease-out-back: scales in from 0, overshoots past 1, settles at 1.
function backEase(t){const c=FEEL.popOvershoot;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2)}
// While a danger cue shows, reward decoration (grades, combo calls) waits; damage numbers and team-health flies still draw.
function drawPopups(font){const held=cues.danger();
  for(const original of s.popups){if(held&&!original.to&&(original.big||original.hud))continue;
    const p=camera&&!original.hud?camera.projection.project(original):original;
    const size=(p.big?FEEL.popupBig:FEEL.popupSize)*(p.grow??1),age=(p.max??C.popupLife)-p.life,pop=still()?1:p.bounce?backEase(Math.min(1,age/FEEL.popBounceTime)):1+.5*Math.max(0,1-age/FEEL.popupPop);
    // Words start inside the arena: the measured half-width keeps them off both edges, and a floor keeps them under the boss bar.
    // A flight to the team bar (the result of an attack) starts lower still, below the badge and the cue rail's first lines.
    const pinned=p.hud&&!p.to;ctx.font=FEEL.textWeight+' '+size+'px '+font;const half=Math.min(s.w/2,ctx.measureText(p.text).width*pop/2+FEEL.barInset);
    let x=pinned?p.x:clamp(p.x,half,s.w-half),y=pinned?p.y:Math.max(C.hudTop+(p.to?FEEL.floatFloor:size),p.y),alpha=Math.min(1,p.life*4),scale=pop;
    if(p.grow){ctx.font=FEEL.textWeight+' '+size+'px '+font;const wide=ctx.measureText(p.text).width,room=s.w-2*FEEL.barInset;scale*=Math.min(1,room/wide);const half=wide*Math.max(1,scale)/2+FEEL.barInset;x=clamp(p.x,Math.min(half,s.w/2),Math.max(s.w-half,s.w/2))}
    if(p.to&&p.fly){const k=Math.min(1,age/p.fly),f=flyEase(k);x+=(p.to.x-x)*f;y+=(p.to.y-y)*f;scale=pop*(1-.4*f);if(k>=1)alpha=Math.max(0,1-(age-p.fly)/FEEL.flyFade)}
    // The breakdown stays where the damage happened, for the popup's whole life.
    if(p.sub){ctx.globalAlpha=Math.min(1,p.life*4);ctx.textAlign='center';ctx.lineJoin='round';ctx.strokeStyle=colors.card;ctx.lineWidth=4;ctx.font=FEEL.textWeight+' '+FEEL.popupLabel+'px '+font;ctx.fillStyle=colors.foreground;
      const sx=clamp(p.x,ctx.measureText(p.sub).width/2+FEEL.barInset,s.w-ctx.measureText(p.sub).width/2-FEEL.barInset);const sy=p.y+C.visualSize+FEEL.popupLabel;ctx.strokeText(p.sub,sx,sy);ctx.fillText(p.sub,sx,sy)}
    if(alpha<=0)continue;
    ctx.globalAlpha=alpha;ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.textAlign=p.align??'center';ctx.lineJoin='round';
    ctx.font=FEEL.textWeight+' '+size+'px '+font;if(artwork&&(String(p.text).startsWith(COPY.perfect)||String(p.text).startsWith(COPY.grade.great.toUpperCase())))artPaint(String(p.text).startsWith(COPY.perfect)?'ui-sticker-perfect':'ui-sticker-great',0,-artwork.metrics.stickerBaseline,Math.max(artwork.metrics.stickerWidth,ctx.measureText(p.text).width+artwork.metrics.stickerPadding*2),artwork.metrics.stickerHeight,true);
    ctx.strokeStyle=colors.card;ctx.lineWidth=5;ctx.fillStyle=colors[p.color]??(p.weak?colors.warning:colors.foreground);
    ctx.font=FEEL.textWeight+' '+size+'px '+font;ctx.strokeText(p.text,0,0);if(p.glow){ctx.shadowColor=colors.perfect;ctx.shadowBlur=FEEL.popGlow}ctx.fillText(p.text,0,0);ctx.shadowBlur=0;
    if(p.label){ctx.font=FEEL.textWeight+' '+FEEL.popupLabel+'px '+font;ctx.strokeText(p.label,0,-size*.85);ctx.fillText(p.label,0,-size*.85)}
    ctx.restore();
  }
  ctx.globalAlpha=1;
}
function drawPayoff(font){
  const p=s.payoff;if(!p)return;
  const e=enemy(),age=FEEL.payoffLife-p.life,pop=still()?1:1+.5*Math.max(0,1-age/FEEL.popupPop);
  ctx.textAlign='center';ctx.lineJoin='round';ctx.strokeStyle=colors.card;
  // The total flies from the last hit into the boss bar, shrinking, then fades into it as the pending segment starts to drain.
  // Reduced motion: it simply shows on the bar for the same time.
  const bb=bossBar(),bar={x:bb.x+bb.w/2,y:bb.y+bb.h/2},fly=still()?0:FEEL.flyTime,k=fly?Math.min(1,age/fly):1,f=flyEase(k);
  const alpha=fly?(k<1?1:Math.max(0,1-(age-fly)/FEEL.flyFade)):Math.min(1,p.life*3);
  if(alpha>0){const from=camera?camera.projection.project(p.from):p.from,x=from.x+(bar.x-from.x)*f,y=from.y+(bar.y-from.y)*f;
    ctx.globalAlpha=alpha;ctx.save();ctx.translate(x,y+FEEL.payoffSize*.35);ctx.scale(pop*(1-.45*f),pop*(1-.45*f));ctx.lineWidth=6;ctx.font=FEEL.textWeight+' '+FEEL.payoffSize+'px '+font;ctx.fillStyle=p.weak?colors.warning:colors.foreground;
    ctx.strokeText('-'+p.total,0,0);ctx.fillText('-'+p.total,0,0);ctx.restore()}
  ctx.globalAlpha=1;
}
function circle(x,y,r,fill){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill()}
const artSize=()=>C.visualSize*FEEL.artFill;
function queueBanner(b){const entry={life:b.max,...b};if(b.now)s.banners.splice(0,1,entry);else s.banners.push(entry)}
const windowAlpha=(t,a,b)=>Math.max(0,Math.min(1,(t-a)/FEEL.bannerFade,(b-t)/FEEL.bannerFade));
// A full-width band across the middle of the arena, edged in the banner's colour.
function drawBand(text,colour,alpha,font,size=FEEL.bannerFont){
 if(alpha<=0)return;const col=colors[colour]??colors.foreground,H=FEEL.bannerH*(size/FEEL.bannerFont)**.5,y=s.h*.5-H/2;
 ctx.globalAlpha=alpha*.94;ctx.fillStyle=colors.card;ctx.fillRect(0,y,s.w,H);ctx.globalAlpha=alpha;ctx.fillStyle=col;ctx.fillRect(0,y,s.w,3);ctx.fillRect(0,y+H-3,s.w,3);
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.font=FEEL.textWeight+' '+size+'px '+font;const fit=Math.min(1,(s.w-FEEL.barInset*2)/ctx.measureText(text).width);if(fit<1)ctx.font=FEEL.textWeight+' '+Math.floor(size*fit)+'px '+font;ctx.fillStyle=col;ctx.fillText(text,s.w/2,s.h*.5);
 ctx.textBaseline='alphabetic';ctx.globalAlpha=1;
}
// Cut-ins pause the battle in the frame loop (frame() advances only the cut-in), never inside step(): tests, hit-stop
// and the turn budget see no change. Specials: a tilted band slides across with the art, name and speed lines; tap skips.
function startCutin(c){s.cutin={life:c.max,...c};cancelHold()}
function stepCutin(dt){const c=s.cutin;if(!c)return;s.enemyFlash=Math.max(0,s.enemyFlash-dt);if(s.enemyHit&&(s.enemyHit.life-=dt)<=0)s.enemyHit=null;if((c.life-=dt)>0)return;s.cutin=null;if(c.done)c.done()}
function skipCutin(){if(s.cutin)s.cutin.life=0}
function drawCutin(font){
 const c=s.cutin;if(!c)return;const k=1,calm=still(),age=c.max-c.life;
 const enter=Math.min(1,age/FEEL.cutinSlide),leave=Math.min(1,c.life/FEEL.cutinSlide),ease=v=>1-(1-v)**3;
 ctx.globalAlpha=FEEL.cutinDim*Math.min(enter,leave);ctx.fillStyle=colors.foreground;ctx.fillRect(0,0,s.w,s.h);ctx.globalAlpha=1;
 const H=FEEL.cutinBand*k,band=colors.warning,slide=calm?0:(1-ease(enter))*-s.w*1.3+(1-ease(leave))*s.w*1.3;
 ctx.save();ctx.translate(s.w/2+slide,s.h*.5);if(!calm)ctx.rotate(FEEL.cutinTilt);
 ctx.fillStyle=band;ctx.fillRect(-s.w,-H/2,s.w*2,H);artPaint('fx-cutin-swoosh',0,0,s.w*2,H,true);ctx.fillStyle=colors.flash;ctx.fillRect(-s.w,-H/2,s.w*2,3);ctx.fillRect(-s.w,H/2-3,s.w*2,3);
 if(!calm){ctx.save();ctx.beginPath();ctx.rect(-s.w,-H/2,s.w*2,H);ctx.clip();ctx.strokeStyle=colors.flash;ctx.lineWidth=2;ctx.globalAlpha=.4;
  for(let i=0;i<FEEL.cutinLines;i++){const ly=-H/2+((i*53)%H),lx=((age*FEEL.cutinSpeed+i*131)%(s.w*2))-s.w,len=40+(i*29)%80;ctx.beginPath();ctx.moveTo(lx,ly);ctx.lineTo(lx+len,ly);ctx.stroke()}
  ctx.restore();const im=images[c.id],size=FEEL.cutinArt*k;if(im.complete&&im.naturalWidth)ctx.drawImage(im,-s.w*.3-size/2,-size/2,size,size)}
 const tx=calm?0:-s.w*.08;ctx.textAlign=calm?'center':'left';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.font=FEEL.textWeight+' '+Math.round(FEEL.cutinFont*k)+'px '+font;ctx.fillStyle=colors.card;
 // The special's name only: no subline (owner, 2026-11-15, field cues only). Cream with an ink stroke, as the visual system sets it.
 ctx.save();ctx.strokeStyle=colors['rumble-ink'];ctx.lineWidth=window.LoftRumbleHudData.textStroke*2;ctx.fillStyle=colors['rumble-cream'];ctx.strokeText(c.name+'!',tx,0);ctx.fillText(c.name+'!',tx,0);ctx.restore();
 ctx.restore();ctx.textBaseline='alphabetic';
 ctx.globalAlpha=Math.min(enter,leave);ctx.font=FEEL.textWeight+' '+FEEL.hudFont+'px '+font;ctx.textAlign='center';ctx.lineJoin='round';ctx.strokeStyle=colors.card;ctx.lineWidth=4;ctx.fillStyle=colors.foreground;ctx.strokeText(COPY.skip,s.w/2,s.h-FEEL.cutinSkipY);ctx.fillText(COPY.skip,s.w/2,s.h-FEEL.cutinSkipY);ctx.globalAlpha=1;
}
// Ally intro toast: portrait, ability name and its 4-word tagline, at the arena's bottom edge above the dock.
// Slides up and back down (fades under reduced motion). Up to toastMax share the row, oldest on the left; more wait their turn.
function drawToasts(font){const w=FEEL.toastW,calm=still(),ease=v=>1-(1-v)**3,floor=s.h-C.hudBottom;ctx.save();ctx.beginPath();ctx.rect(0,C.hudTop,s.w,floor-C.hudTop);ctx.clip();
 s.toasts.slice(0,FEEL.toastMax).forEach(t=>{if(t.x===undefined)return;const x=t.x,age=FEEL.toastLife-t.life,v=Math.min(1,age/FEEL.toastSlide,t.life/FEEL.toastSlide),
   pad=(FEEL.toastH-FEEL.toastArt)/2,room=w-pad*3-FEEL.toastArt,sub=toastLines(t.sub??COPY.ability[t.kind],room,font),line=FEEL.toastSub+FEEL.toastLeading,h=FEEL.toastH+(sub.length-1)*line,
   y=floor-FEEL.toastGap-h+(calm?0:(1-ease(v))*(h+FEEL.toastGap));
  ctx.globalAlpha=calm?v:Math.min(1,v*2);ctx.fillStyle=colors.card;ctx.strokeStyle=colors.primary;ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(x,y,w,h,FEEL.toastRadius);ctx.fill();ctx.stroke();
  const im=images[t.id];if(im.complete&&im.naturalWidth)ctx.drawImage(im,x+pad,y+(h-FEEL.toastArt)/2,FEEL.toastArt,FEEL.toastArt);
  const tx=x+pad*2+FEEL.toastArt;ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.fillStyle=colors.primary;const fit=(text,size,weight)=>{ctx.font=weight+size+'px '+font;const k=Math.min(1,room/ctx.measureText(text).width);if(k<1)ctx.font=weight+Math.floor(size*k)+'px '+font;ctx.fillText(text,tx,ty)};let ty=y+FEEL.toastH/2-2;
  fit(t.title??abilities[t.kind]+'!',FEEL.toastName,FEEL.textWeight+' ');
  ctx.fillStyle=colors.foreground;sub.forEach((text,i)=>{ty=y+FEEL.toastH/2+FEEL.toastSub+1+i*line;fit(text,FEEL.toastSub,'')});ctx.globalAlpha=1});ctx.restore()}
// A toast's second line, split greedily into at most toastLines lines that fit `room` at the tagline size; the last line
// keeps the rest (fit shrinks it only if one word overflows). Short taglines stay one line.
function toastLines(text,room,font){ctx.font=FEEL.toastSub+'px '+font;const lines=[''];
  for(const word of text.split(' ')){const next=lines[lines.length-1]?lines[lines.length-1]+' '+word:word;
    if(ctx.measureText(next).width<=room||!lines[lines.length-1]||lines.length>=FEEL.toastLines)lines[lines.length-1]=next;else lines.push(word)}
  return lines}
// Tutorial step: a toast-style card above the bottom strip (above any ally toasts), until its step is done.
function drawTutor(font){const text=tutorText();if(!text)return;ctx.font=FEEL.textWeight+' '+FEEL.toastName+'px '+font;const pad=(FEEL.toastH-FEEL.toastArt)/2*2,w=ctx.measureText(text).width+pad*2,x=(s.w-w)/2,
  y=s.h-C.hudBottom-FEEL.toastGap-FEEL.toastH-(s.toasts.length?FEEL.toastH+FEEL.toastGap:0);
  ctx.fillStyle=colors.card;ctx.strokeStyle=colors.primary;ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(x,y,w,FEEL.toastH,FEEL.toastRadius);ctx.fill();ctx.stroke();
  ctx.fillStyle=colors.foreground;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,s.w/2,y+FEEL.toastH/2);ctx.textBaseline='alphabetic'}
// Pause overlay: dims the arena and says how to resume.
function drawPaused(font){if(!s.userPaused||s.demo)return;ctx.globalAlpha=FEEL.pauseDim;ctx.fillStyle=colors.foreground;ctx.fillRect(0,0,s.w,s.h);ctx.globalAlpha=1;
  const panel=artwork?.panel(ctx,s.w/2,s.h/2,Math.min(s.w-FEEL.barInset*2,artwork.metrics.panelSize),artwork.metrics.panelHeight,colors.card);
  ctx.font=FEEL.textWeight+' '+FEEL.pauseFont+'px '+font;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=panel?(window.LoftRumbleBattleMaterials?.panelInk??colors.foreground):colors.card;ctx.fillText(COPY.paused,s.w/2,s.h/2,s.w-FEEL.barInset*2);ctx.textBaseline='alphabetic'}
// Ally activation: the art pops larger with the ability name above it.
function drawSplash(a,font){const left=s.splash[a.id];if(!left)return;ctx.globalAlpha=Math.min(1,left/FEEL.bannerFade);ctx.font=FEEL.textWeight+' '+FEEL.splashFont+'px '+font;ctx.textAlign='center';ctx.lineJoin='round';ctx.strokeStyle=colors.card;ctx.lineWidth=4;ctx.fillStyle=colors.primary;
 const text=abilities[a.kind]+'!',x=clamp(a.x,ctx.measureText(text).width/2+FEEL.barInset,s.w-ctx.measureText(text).width/2-FEEL.barInset),y=a.y-artSize()/2-6;ctx.strokeText(text,x,y);ctx.fillText(text,x,y);ctx.globalAlpha=1}
const splashScale=id=>{const left=s.splash[id];return left&&!still()?1+FEEL.splashGrow*Math.sin(Math.PI*(1-left/FEEL.splashTime)):1};
document.addEventListener('visibilitychange',()=>{s.battleEnd=window.LoftRumbleBattleEnd.frame(s.battleEnd,performance.now(),!s.paused&&!s.userPaused&&!s.cinematic);s.paused=document.hidden;music.setHidden(document.hidden);last=0;if(s.paused)cancelHold()});document.documentElement.style.setProperty('--aspect',C.arenaW/C.arenaH);
const timingButton=document.getElementById('timing');function showTiming(){timingButton.setAttribute('aria-pressed',String(s.timing));setLabel(timingButton,s.timing?PAGE.timingOn:PAGE.timingOff,[PAGE.timingOn,PAGE.timingOff])}
timingButton.onclick=()=>{s.timing=!s.timing;showTiming()};showTiming();
const rechargeButton=document.getElementById('recharge');function showRecharge(){rechargeButton.setAttribute('aria-pressed',String(FEEL.recharge));setLabel(rechargeButton,FEEL.recharge?COPY.rechargeOn:COPY.rechargeOff,[COPY.rechargeOn,COPY.rechargeOff]);roster()}
rechargeButton.onclick=()=>{FEEL.recharge=!FEEL.recharge;showRecharge()};showRecharge();
const helpToggle=document.getElementById('help-toggle'),helpPanel=document.getElementById('help-panel');
function showHelp(open){if(s.demo)showMenu(false);helpPanel.hidden=!open;if(open||s.demo)setPaused(open);helpToggle.setAttribute('aria-expanded',String(open));if(s.demo){if(open&&!helpPanel.open)helpPanel.showModal();else if(!open&&helpPanel.open){helpPanel.close();menuToggle.focus()}}else helpPanel.toggleAttribute('open',open)}
helpPanel.addEventListener('cancel',event=>{event.preventDefault();showHelp(false)});
dismissBattleDialog(helpPanel,()=>showHelp(false));
helpToggle.onclick=()=>showHelp(helpPanel.hidden);
document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;if(!helpPanel.hidden){showHelp(false);menuToggle.focus()}else if(!menu.hidden){showMenu(false);menuToggle.focus()}});
document.addEventListener('click',event=>{if(!s.demo&&!helpPanel.hidden&&!event.composedPath().includes(helpPanel)&&!event.composedPath().includes(helpToggle))showHelp(false)});
document.getElementById('hint-close').onclick=()=>{document.getElementById('portrait-hint').hidden=true};
function startRealtime(direct){
function resizeScene(){resize();draw()}
if(window.LoftRumbleArenaSkins)addEventListener(window.LoftRumbleArenaSkins.changeEvent,draw);
if(window.LoftRumbleStageLayouts)addEventListener(window.LoftRumbleStageLayouts.changeEvent,()=>{reset();showMenu(false);draw()});
new ResizeObserver(resizeScene).observe(stage);addEventListener('resize',resizeScene);resize();s.custom=Object.keys(traits)[Math.floor(Math.random()*Object.keys(traits).length)];reset();if(new URLSearchParams(location.search).get('camera')!=='0'&&document.documentElement.dataset.camera!=='0')camera=window.LoftRumbleCameraExperiment.create({s,C,FEEL,RT,ids,cancelHold,punishImpact,ctx,artwork,artPaint,artSize,baseEnemy,enemy,reset,roster,draw,step,stepShield,fling,collide,bumperSpots,contactPose,splashScale,still,drawWarn,drawHeart,drawBumpers,drawAttack,drawEnemy,drawShield,drawParticles,drawBodies,drawBodyEffects,drawFlashes,aim,burst,tone,colors,withAlpha,finishBattle,swarmFx});if(camera){window.LoftRumbleEncounters.install({s,reset,draw,close:()=>showMenu(false)});window.LoftRumbleDemo.install({s,names,reset,again:playAgain,draw,ready:artwork?.ready,keep:TEAM.active,direct});const swarmMode=window.LoftRumbleEncounters.stageMode(location.search,{live:window.LoftRumbleSwarmData.SWARM_LIVE,lab:window.LoftRumbleLabPolicy.local(location,document.documentElement)});if(swarmMode){const bench=window.LoftRumbleSwarmBench.fromSearch(swarmMode,location.search);window.LoftRumbleSwarmRuntime.start(camera,{mode:swarmMode,bench});if(bench)window.LoftRumbleSwarmBenchView.install(document,()=>window.LoftRumbleSwarmRuntime.state(camera).monsters)}
  if(s.demo&&!direct)tutorial.install({s,RT,ids,roster,reset,stop:stopBody,cancelHold,enemy,attacks:FEEL.attacks,camera:()=>camera,view:window.LoftRumbleTutorialView??window.LoftRumbleTutorialPlain,closeMenus:()=>{showHelp(false);showMenu(false)},throwStyle:()=>throwPref.get(),hudTop:C.hudTop});
  if(s.demo&&!tutorial.installed())document.getElementById('replay-tutorial').remove()} // no Training without ?training, so no Replay either
showThrowStyle(); // after the demo install, which builds the help panel this writes
}
