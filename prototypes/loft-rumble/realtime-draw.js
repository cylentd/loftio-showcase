'use strict';
// ---- Simulation ----
function stopBody(b){b.vx=b.vy=0;b.boostT=0;if(!b.moving)return;b.moving=false;b.glide=null;b.boost=null;b.special=null;b.trail=null}
// Glide: full speed, then roll to rest over the last glideEase of the budget with a power-glideCurve ease-out.
function glide(b,dt){const speed=Math.hypot(b.vx,b.vy),g=b.glide,P=window.LoftRumbleSynergySupport;if(!speed||!g){stopBody(b);return}
  const ease=g.budget*FEEL.glideEase,target=(g.left>=ease?g.speed:g.speed*Math.pow(Math.max(0,g.left)/ease,(FEEL.glideCurve-1)/FEEL.glideCurve))*P.boostMultiplier(b.boostT,syn(P.ids.booster));b.boostT=P.tickBoost(b.boostT,dt);
  g.left-=target*dt;if(target<C.stopSpeed||g.left<=0){stopBody(b);return}b.vx*=target/speed;b.vy*=target/speed}
function moveBody(b,dt){if(!b.moving||stunned(b))return;glide(b,dt);if(!b.moving)return;b.cool=Math.max(0,b.cool-dt);b.x+=b.vx*dt;b.y+=b.vy*dt;
  if(b.trail&&(b.trailD+=Math.hypot(b.vx,b.vy)*dt)>=FEEL.trailGap){b.trailD=0;s.particles.push({x:b.x,y:b.y,vx:0,vy:0,life:FEEL.trailLife,max:FEEL.trailLife,color:b.trail,size:FEEL.trailSize})}
  b.angle+=b.vx*dt*.008;const r=C.radius+C.padding;
  for(const axis of ['x','y']){const limit=axis==='x'?s.w:s.h-C.hudBottom,lo=axis==='x'?r:r+C.hudTop,v=axis==='x'?'vx':'vy';
    if(b[axis]<lo){b[axis]=Math.min(2*lo-b[axis],limit-r);if(b[v]<0){b[v]*=-1;wallHit(b,axis,1,limit)}}
    if(b[axis]>limit-r){b[axis]=Math.max(2*(limit-r)-b[axis],lo);if(b[v]>0){b[v]*=-1;wallHit(b,axis,-1,limit)}}}
  bumperCheck(b);if(camera?.fixture)camera.collideBody(b);else collide(b);checkAllies(b);
  if(s.heart&&Math.hypot(b.x-s.heart.x,b.y-s.heart.y)<C.radius+TURN.heartRadius){const gain=Math.min(TURN.hp,s.teamHP+TURN.heal)-s.teamHP;s.teamHP+=gain;collisionEffect(s.heart.x,s.heart.y);flyToTeam('+'+TURN.heal,'good',{x:s.heart.x,y:s.heart.y},'','heal',gain);s.heart=null}}
// Round 19 bumpers: fixed posts. A hit reflects the resident outward at full glide speed, tops its range up past the ease-out
// plus bumperRange of the budget, and counts as a bounce for the bounce multiplier. Pinball feedback: flash, squash, a ping ring, a buzz.
const bumperSpots=()=>FEEL.bumpers.map(([x,y])=>({x:s.w*x,y:s.h*y}));
function bumperCheck(b){bumperSpots().forEach((p,i)=>{if(!b.moving)return;const dx=b.x-p.x,dy=b.y-p.y,d=Math.hypot(dx,dy)||1,reach=C.radius+FEEL.bumperRadius;if(d>=reach)return;
  const nx=dx/d,ny=dy/d,toward=b.vx*nx+b.vy*ny;b.x=p.x+nx*reach;b.y=p.y+ny*reach;if(toward>=0)return;
  b.vx-=2*toward*nx;b.vy-=2*toward*ny;const g=b.glide;if(g){g.left=Math.max(g.left,g.budget*FEEL.glideEase)+g.budget*FEEL.bumperRange;const sp=Math.hypot(b.vx,b.vy)||1;b.vx*=g.speed/sp;b.vy*=g.speed/sp}
  b.walls++;b.counter=FEEL.counterPop;b.squash={life:FEEL.wallSquashLife,nx,ny};s.bumperHits[i]=FEEL.bumperFlash;
  s.rings.push({x:p.x,y:p.y,life:FEEL.bumperPing,max:FEEL.bumperPing,colour:'primary',big:FEEL.bumperRadius+FEEL.bumperPingGrow});
  burst(p.x+nx*FEEL.bumperRadius,p.y+ny*FEEL.bumperRadius,FEEL.wallSparks,FEEL.wallSparkSpeed,'chip',FEEL.wallSparkSpread,Math.atan2(ny,nx),2);vibrate(FEEL.bumperVibrate)})}
function drawBumpers(){if(swarmOn()&&window.LoftRumbleSwarmRuntime.state(camera).crystal)return;/* defense: the crystal is the bumper, drawn by the swarm view */const calm=still();bumperSpots().forEach((p,i)=>{const k=s.bumperHits[i]/FEEL.bumperFlash,r=FEEL.bumperRadius*(calm?1:1+FEEL.bumperSquash*k);
  if(artwork?.bumper(ctx,artwork.bumperSkin(),p,r,k,camera?.uprightScale??1))return;
  circle(p.x,p.y,r,k?colors.flash:colors.card);ctx.strokeStyle=colors.primary;ctx.lineWidth=FEEL.bumperLine;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.stroke();circle(p.x,p.y,r*FEEL.bumperCore,k?colors.warning:colors.primary)})}
// Two moving residents meeting: each fires its ability exactly as a bump does (round 18: no named Synergy), once per pair per flight; then an equal-mass bounce along the contact normal.
function bumpBodies(){const moving=ids.map(id=>s.bodies[id]).filter(b=>b.moving&&!stunned(b));
  for(let i=0;i<moving.length;i++)for(let j=i+1;j<moving.length;j++){const a=moving[i],b=moving[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,min=C.radius*2;if(d>=min)continue;if(!a.used.includes(b.id)&&!b.used.includes(a.id)){activateAlly(a,b);activateAlly(b,a)}
    const nx=dx/d,ny=dy/d,rel=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;if(rel<=0)continue;
    a.vx-=rel*nx;a.vy-=rel*ny;b.vx+=rel*nx;b.vy+=rel*ny;const push=(min-d)/2;a.x-=nx*push;a.y-=ny*push;b.x+=nx*push;b.y+=ny*push;
    a.pulse=b.pulse=CONTACT.squash;const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
    collisionEffect(mx,my,true);burst(mx,my,RT.bumpSparks,FEEL.hitSparkSpeed,'chip');s.shake=Math.max(s.shake,window.LoftRumbleSwarmRuntime?.calm(camera,RT.bumpShake)??RT.bumpShake)}}
function stepFx(dt,previous){if(s.phase==='over'||s.paused||s.userPaused||s.cinematic||!Number.isFinite(dt)||dt<0)return;
  if(camera)window.LoftRumbleAttackImpact.tick(s,dt);
  if(s.specialFx?.length)stepSpecialFx(dt); // no live effect is the common case: skip the call
  s.flash=Math.max(0,(s.flash||0)-dt);for(const f of s.flashes)f.life-=dt;s.flashes=s.flashes.filter(f=>f.life>0);if(s.kick&&(s.kick.life-=dt)<=0)s.kick=null;
  for(const id of ids){const b=s.bodies[id];if(!b.moving&&b.angle){const up=Math.round(b.angle/(2*Math.PI))*2*Math.PI,d=b.angle-up;b.angle-=Math.sign(d)*Math.min(Math.abs(d),FEEL.settleSpin*dt);if(b.angle===up)b.angle=0}
    if(b.squash&&(b.squash.life-=dt)<=0)b.squash=null;b.counter=Math.max(0,b.counter-dt);b.pulse=Math.max(0,b.pulse-dt);b.ping=Math.max(0,(b.ping||0)-dt)}
  const banner=s.banners[0];if(banner&&(banner.life-=dt)<=0)s.banners.shift();for(const id in s.splash)if((s.splash[id]-=dt)<=0)delete s.splash[id];
  s.clock+=dt;window.LoftRumbleFeel.ingestShake(s,s.clock); // the scalar becomes an event; the offset is drawn from s.shakes
  if(s.whipTail&&s.clock-s.whipTail.clockBase>=Math.max(0,...Object.values(s.whipTail.contacts).map(c=>c.shownAt))+LoftRumbleWhiplashLook.hitAccentLife)s.whipTail=null;
  s.vignette=Math.max(0,s.vignette-dt);s.enemyFlash=Math.max(0,s.enemyFlash-dt);
  s.enemyBarFlash=Math.max(0,s.enemyBarFlash-dt);s.teamBarHit=Math.max(0,s.teamBarHit-dt);
  if(s.enemyHit&&(s.enemyHit.life-=dt)<=0)s.enemyHit=null;
  const fx=s.attackFx;
  if(fx?.whiplash){
    whiplashStep(fx,dt,previous);if(s.phase==='over')return;
  }else if(fx){fx.t+=dt;if(!fx.rumbled&&fx.t>=0){fx.rumbled=true;tone(FEEL.rumbleFreq,'triangle',FEEL.windup,FEEL.rumbleGain,FEEL.rumbleFreq/2)}
    if(!fx.hit&&fx.t>=FEEL.windup+FEEL.travel)attackImpact();if(s.phase==='over')return;if(fx.t>=FEEL.attackResponse+FEEL.vignetteLife)s.attackFx=null}
  if(s.payoff&&(s.payoff.life-=dt)<=0)s.payoff=null;
  // Combo window: it runs in real time (hit-stop included), so the total lands a steady beat after the last hit.
  if(s.tally&&s.tally.total&&(s.comboT-=dt)<=0)showPayoff();if(s.phase==='over')return;
  for(const h of s.heals)h.left-=dt;
  if(s.heals.some(h=>h.left<=0)){s.heals=s.heals.filter(h=>h.left>0);s.teamFlash='heal';s.teamBarHit=FEEL.barFlash}
  if(s.teamFly>0&&(s.teamFly-=dt)<=0){s.teamFly=0;if(s.teamFlyFlash){s.teamFlash=s.teamFlyFlash;s.teamBarHit=FEEL.barFlash}}
  const shown=s.teamShown;if(!fx||fx.hit)s.teamShown=teamTarget();if(shown!==s.teamShown)teamText();
  s.teamHold=Math.max(0,s.teamHold-dt);if(!s.teamHold)s.teamChip-=FEEL.chipRate*TURN.hp*dt;s.teamChip=Math.max(s.teamChip,s.teamShown);
  if(s.enemyWait>0&&(s.enemyWait-=dt)<=0){s.enemyWait=0;s.enemyBarFlash=FEEL.barFlash}
  if(s.enemyDrain&&!s.enemyWait){s.enemyChip-=s.enemyDrain*dt;if(s.enemyChip<=s.hp){s.enemyDrain=0;if(s.hp<=0){const e=enemy();burst(e.x,e.y,FEEL.weakParticles*2,FEEL.weakSparkSpeed,'warning');s.shake=Math.max(s.shake,FEEL.shakeWeak)}}}
  s.enemyChip=Math.max(s.enemyChip,s.hp);
}
function stepShield(sh,dt){Object.assign(sh,GUARD_RULES.guardStep(sh,{dt,angle:enemy().angle},GUARD));if(sh.hitT>0)sh.hitT=Math.max(0,sh.hitT-dt)} // exposed timer, regrow; the plate follows the weak spot
function step(dt){if(s.phase==='over'||s.paused||s.userPaused||s.cinematic||!Number.isFinite(dt)||dt<0)return;const stopped=s.hitStop>0,whip=s.attackFx?.whiplash,previous=whip?Object.fromEntries(ids.map(id=>[id,{x:s.bodies[id].x,y:s.bodies[id].y}])):null;stepContact(dt);if(!whip)stepFx(dt);if(s.phase==='over')return;if(s.finale&&(s.finale.t+=dt/finaleRate())>=FEEL.finaleTime)endFinale();if(stopped||s.phase==='over'){if(whip)stepFx(dt);return;}camera?.beforeStep(dt);
  if(s.phase==='play'&&!s.finale&&(!s.demo||s.flings>0)){s.time+=dt;
    if(s.demo&&!camera?.predicting&&!camera?.fixture&&window.LoftRumbleDemo.advance(s,RT)){message(window.LoftRumbleDemoData.copy.enrage)}if(!camera?.fixture)stepShield(s.shield,dt);s.enemyT-=dt;if(s.hits&&(s.hitsIdle+=dt)>=FEEL.comboTimeout)breakCombo('timeout');if(s.enemyT<=0&&!s.attackFx){fireAttack();s.enemyT+=s.demo?window.LoftRumbleDemo.interval(s,RT):RT.attackEvery}
    camera?.punish(dt);if(s.phase==='over')return;
    for(const id of ids){const b=s.bodies[id],was=b.charge;if(stunned(b)){if(window.LoftRumbleStun.tick(b,dt))readyPing(id);continue}b.charge=FEEL.recharge?Math.min(1,b.charge+dt/RT.recharge[kind(id)]):b.moving?0:1;if(was<1&&b.charge>=1)readyPing(id)}}
  for(const id of ids)moveBody(s.bodies[id],dt);bumpBodies();stepTeam(dt);camera?.afterStep();if(whip){stepFx(dt,previous);if(s.phase==='over')return;}
  for(const p of s.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt}s.particles=s.particles.filter(p=>p.life>0);for(const ring of s.rings)ring.life-=dt;s.rings=s.rings.filter(r=>r.life>0);
  for(const popup of s.popups){popup.life-=dt;popup.y+=(popup.vy??-FEEL.popupRise)*dt}s.popups=s.popups.filter(p=>p.life>0);s.bumperHits=s.bumperHits.map(t=>Math.max(0,t-dt));s.hitsPop=Math.max(0,s.hitsPop-dt);if(s.hitsLost&&(s.hitsLost.life-=dt)<=0)s.hitsLost=null;
  if((s.statusT-=dt)<=0){s.statusT=RT.statusStep;statusLine();roster()}tutorial.step(dt)}
// ---- Drawing ----
function drawBanners(font){const b=s.banners[0];if(b)drawBand(b.text,b.colour,windowAlpha(b.max-b.life,0,b.max),font)}
// A quick attack-name flash in the attack's colour; play never pauses for it.
function drawEnemyName(font){const fx=s.attackFx;if(!fx||fx.whiplash||fx.t>=0)return;const def=fx.warn.def,k=(fx.t+RT.nameFlash)/RT.nameFlash,pop=still()?1:1+.25*Math.max(0,1-k*4);
  const e=enemy(),text=def.name.toUpperCase()+'!',y=e.y+C.enemyRadius+FEEL.nameFont;ctx.globalAlpha=windowAlpha(fx.t,-RT.nameFlash,0);ctx.save();ctx.translate(s.w/2,y);ctx.scale(pop,pop);
  ctx.textAlign='center';ctx.lineJoin='round';ctx.font=FEEL.textWeight+' '+FEEL.nameFont+'px '+font;const fit=Math.min(1,(s.w-FEEL.barInset*2)/ctx.measureText(text).width);ctx.scale(fit,fit);
  ctx.strokeStyle=colors.card;ctx.lineWidth=6;ctx.fillStyle=colors[def.colour];ctx.strokeText(text,0,0);ctx.fillText(text,0,0);ctx.restore();ctx.globalAlpha=1}
function drawIntent(font,e){
 if(s.phase==='over'||s.hp<=0)return;
 if((s.attackFx?.warn??currentWarn())?.def.id===window.LoftRumbleWhiplashData.id||(!s.attackFx&&!currentWarn()&&nextAttack().id===window.LoftRumbleWhiplashData.id))return;
 if(camera){const warn=currentWarn(),def=warn?warn.def:nextAttack();window.LoftRumbleIntent.draw(ctx,{anchor:e,width:s.w,top:C.hudTop,bottom:s.h-C.hudBottom,enemyRadius:C.enemyRadius,attack:def,remaining:s.enemyT,interval:RT.attackEvery,warning:!!warn,acting:!!s.attackFx&&!s.attackFx.hit,reduced:still(),clock:s.clock,colors,icon:attackIcon});return;}
 ctx.save();
 const warn=currentWarn(),def=warn?warn.def:nextAttack(),col=colors[def.colour],threat=!!warn,H=FEEL.intentH,P=FEEL.intentPad,icon=H-P;
 ctx.font=FEEL.textWeight+' '+FEEL.intentFont+'px '+font;
 const nameW=ctx.measureText(def.name).width,clockW=FEEL.intentClockWidth,w=P+icon+P/2+nameW+P+clockW+P,x=clamp(e.x-w/2,FEEL.barInset,s.w-w-FEEL.barInset),y=Math.max(C.hudTop+FEEL.barInset/2,e.y-C.enemyRadius-FEEL.enemyBarGap-H);
 if(threat&&!still()){ctx.globalAlpha=.25+.25*Math.sin(s.clock*FEEL.telegraphPulse);ctx.strokeStyle=col;ctx.lineWidth=6;ctx.beginPath();ctx.roundRect(x-3,y-3,w+6,H+6,(H+6)/2);ctx.stroke();ctx.globalAlpha=1}
 if(window.LoftRumbleBattleMaterials)window.LoftRumbleBattleMaterials.intent(ctx,x,y,w,H,false,col);else{ctx.fillStyle=colors.card;ctx.beginPath();ctx.roundRect(x,y,w,H,H/2);ctx.fill()}
 ctx.strokeStyle=col;ctx.lineWidth=RT.intentArc;ctx.beginPath();ctx.roundRect(x,y,w,H,H/2);ctx.stroke();
 attackIcon(def.id,x+P+icon/2,y+H/2,col);
 ctx.textBaseline='middle';ctx.textAlign='left';ctx.fillStyle=colors.foreground;ctx.fillText(def.name,x+P+icon+P/2,y+H/2+1);
 const clockX=x+w-P-clockW,inset=FEEL.intentClockInset,clockY=y+inset,clockH=H-inset*2,cx=clockX+clockW/2,cy=y+H/2,acting=!!s.attackFx&&!s.attackFx.hit,left=acting?0:clamp(s.enemyT/RT.attackEvery,0,1);
 ctx.fillStyle=col;ctx.beginPath();ctx.roundRect(clockX,clockY,clockW,clockH,clockH/2);ctx.fill();
 ctx.textAlign='center';ctx.fillStyle=colors.card;ctx.fillText(acting?COPY.attackNow:String(Math.max(1,Math.ceil(s.enemyT)))+COPY.secondsSuffix,cx,cy+1);
 const railX=clockX+inset,railY=y+H-inset/2,railW=clockW-inset*2;
 ctx.lineWidth=FEEL.intentRailWidth;ctx.lineCap='round';ctx.strokeStyle=withAlpha(col,.25);ctx.beginPath();ctx.moveTo(railX,railY);ctx.lineTo(railX+railW,railY);ctx.stroke();
 if(left>0){ctx.strokeStyle=col;ctx.beginPath();ctx.moveTo(railX,railY);ctx.lineTo(railX+railW*left,railY);ctx.stroke()}
 ctx.restore();
}
// Route preview for the held resident: same travel budget, wall and enemy reflections as the fling itself.
function trace(b,angle){
  if(camera)return camera.route(b,angle);
  const t=profile(b),r=C.radius+C.padding,e=enemy(),reach=C.radius+C.enemyRadius,pierce=t===traits.piercing;
  let x=b.x,y=b.y,dx=Math.cos(angle),dy=Math.sin(angle),left=t.range*(!tapOn&&s.specialCharge[b.id]>=1&&kind(b.id)==='springy'?FEEL.overdriveRange:1),hit=null,walls=0;const pts=[{x,y}];
  for(let guard=0;guard<FEEL.aimSegments&&left>0;guard++){
    const tx=dx>0?(s.w-r-x)/dx:dx<0?(r-x)/dx:Infinity,ty=dy>0?(s.h-C.hudBottom-r-y)/dy:dy<0?(r+C.hudTop-y)/dy:Infinity,tw=Math.max(0,Math.min(tx,ty));
    const fx=x-e.x,fy=y-e.y,k=fx*dx+fy*dy,disc=k*k-(fx*fx+fy*fy-reach*reach),te=disc>=0?-k-Math.sqrt(disc):Infinity;
    if(te>1e-6&&te<tw&&te<=left&&(!pierce||!hit)){const hx=x+dx*te,hy=y+dy*te,a=Math.atan2(hy-e.y,hx-e.x);
      if(!hit)hit={x:hx,y:hy,seg:pts.length-1,weak:Math.abs(Math.atan2(Math.sin(a-e.angle),Math.cos(a-e.angle)))<C.weakArc};
      if(!pierce){const nx=(hx-e.x)/reach,ny=(hy-e.y)/reach,d=dx*nx+dy*ny;x=hx;y=hy;dx-=2*d*nx;dy-=2*d*ny;left-=te+enemyCost(b);pts.push({x,y});continue}}
    if(tw>=left){x+=dx*left;y+=dy*left;pts.push({x,y});break}
    x+=dx*tw;y+=dy*tw;left-=tw;walls++;pts.push({x,y,bounce:true});if(tx<=ty)dx=-dx;else dy=-dy;
  }
  return{pts,hit,walls,end:pts[pts.length-1]};
}
function aim(font){
  const b=s.held&&s.bodies[s.held];
  // The pull line ends on the steady aim point, the same point the dots and the release aim from, so they never disagree.
  window.LoftRumbleDragRenderer.draw(ctx,{feedback:s.dragFeedback,body:b,pointer:{x:s.aimX,y:s.aimY},origin:{x:s.ax,y:s.ay},colors,reduced:still(),style:throwPref.get()});if(!b)return;
  const length=Math.hypot(s.ax-s.px,s.ay-s.py),angle=dragFling.heldAngle(throwPref.get(),heldPull()); // the dots point where the release will go: sling opposite the pull, fling along it (steady aim)
  if(length<FEEL.cancelRadius||!holdingStill())return; // a moving finger is a fling in the making: no dots, no gauge (gaugeT restarts at each swipe-speed move, and the gauge needs gaugeDelay > holdStill)
  if(s.timing)drawGauge(b,C.visualSize/2+FEEL.powerRing);
  const special=!tapOn&&s.specialCharge[b.id]>=1,dots=special?colors.warning:colors.flash,{pts,hit}=trace(b,angle),path=[pts[0]],start=C.visualSize/2+FEEL.powerRing,full=start+FEEL.aimDots*FEEL.aimGap;let atHit=false;
  for(let i=1;i<pts.length&&path.length<3;i++){if(hit&&hit.seg===i-1){path.push(hit);atHit=true;break}path.push(pts[i]);if(!pts[i].bounce)break}
  const lens=path.slice(1).map((p,i)=>Math.hypot(p.x-path[i].x,p.y-path[i].y)),total=lens.reduce((a,c)=>a+c,0),reach=Math.min(full,total);
  for(let i=1;i<=FEEL.aimDots;i++){let d=start+i*FEEL.aimGap;if(d>reach)break;let k=0;while(k<lens.length-1&&d>lens[k]){d-=lens[k];k++}
    const a=path[k],c=path[k+1],f=lens[k]?d/lens[k]:0;window.LoftRumbleDragRenderer.aimDot(ctx,{x:a.x+(c.x-a.x)*f,y:a.y+(c.y-a.y)*f,color:dots,alpha:1-FEEL.aimFade*(i-1)/FEEL.aimDots})}
  ctx.globalAlpha=1;
  if(atHit&&hit.weak&&total<=full){ctx.strokeStyle=colors.warning;ctx.lineWidth=2;ctx.beginPath();ctx.arc(hit.x,hit.y,C.radius,0,Math.PI*2);ctx.stroke();
    ctx.font=FEEL.textWeight+' '+FEEL.hudFont+'px '+font;ctx.textAlign='center';ctx.fillStyle=colors.warning;ctx.fillText(phrase(COPY.multiplier,{multiplier:C.weakMultiplier}),hit.x,hit.y-C.radius-6)}
  if(special){ctx.font=FEEL.textWeight+' '+FEEL.hudFont+'px '+font;ctx.textAlign='center';ctx.lineJoin='round';ctx.strokeStyle=colors.card;ctx.lineWidth=4;ctx.fillStyle=colors.warning;
    const half=ctx.measureText(COPY.special).width/2,x=clamp(b.x,half+FEEL.barInset,s.w-half-FEEL.barInset),y=Math.max(C.hudTop+FEEL.hudFont,b.y-C.visualSize/2-FEEL.powerRing-FEEL.gaugeGap-FEEL.gaugeWidth-FEEL.specialTagGap);
    ctx.strokeText(COPY.special,x,y);ctx.fillText(COPY.special,x,y)}
}
// Special in the arena: nothing until full (the dock fill shows progress). Full: a gold ring that breathes over auraBreath seconds
// (steady while aiming that resident, and under reduced motion); it hides while moving.
function drawAura(b,R){if(s.phase!=='play'||b.moving||s.specialCharge[b.id]<1)return;const breath=still()||s.held===b.id?1:.5-.5*Math.cos(s.clock*2*Math.PI/FEEL.auraBreath),alpha=FEEL.auraAlphaMin+(FEEL.auraAlphaMax-FEEL.auraAlphaMin)*breath;
  ctx.globalAlpha=alpha;ctx.strokeStyle=colors.warning;ctx.lineWidth=FEEL.auraWidth;ctx.beginPath();ctx.arc(b.x,b.y,R+FEEL.auraGap,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1}
// A later special's gold flash at the launch point: a filled disc that grows and fades.
function drawFlashes(){for(const f of s.flashes){const k=f.life/FEEL.specialFlash;ctx.globalAlpha=k*.6;circle(f.x,f.y,C.visualSize/2+(still()?0:(1-k)*FEEL.specialFlashGrow),colors.warning)}ctx.globalAlpha=1}
// Focus meter, right of the team bar: the bullet-time budget. It brightens while slowed.
function drawFocus(font){if(!FEEL.bulletTime)return;const t=bossBar(),x=t.x+t.w+FEEL.barInset,w=s.w-FEEL.barInset-x;ctx.font=FEEL.textWeight+' '+FEEL.hudFont+'px '+font;ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.fillStyle=colors.foreground;ctx.fillText(COPY.focus,x,t.y-4);
  drawBar(x,t.y,w,t.h,s.focus,s.focus,RT.focusMax,colors.primary,s.slow?.35:0,colors.flash)}
// Bullet time: the canvas desaturates (CSS) and the edges darken, pulsing gently unless reduced motion is on.
function drawSlow(){if(!s.slow)return;const a=RT.slowVignette*(still()?1:.8+.2*Math.sin(s.clock*RT.slowPulse/RT.slowFactor)),g=ctx.createRadialGradient(s.w/2,s.h/2,Math.min(s.w,s.h)*.3,s.w/2,s.h/2,Math.hypot(s.w,s.h)/2);
  g.addColorStop(0,withAlpha(colors.foreground,0));g.addColorStop(1,withAlpha(colors.foreground,a));ctx.fillStyle=g;ctx.fillRect(0,0,s.w,s.h)}
// Timing gauge round the held resident: track, Great band, Perfect band, the sweep and its head.
function drawGauge(b,inner){const shown=s.gaugeT-FEEL.gaugeDelay;if(shown<0)return;const fade=still()?1:Math.min(1,shown/FEEL.gaugeFade);
  const R=inner+FEEL.gaugeGap,at=v=>-Math.PI/2+v*Math.PI*2,arc=(a,c,col,width,alpha)=>{ctx.globalAlpha=alpha*fade;ctx.strokeStyle=col;ctx.lineWidth=width;ctx.beginPath();ctx.arc(b.x,b.y,R,at(a),at(c));ctx.stroke()},v=gaugeValue();
  arc(0,1,colors.track,FEEL.gaugeWidth,1);
  arc(FEEL.gaugeCenter-FEEL.greatHalf,FEEL.gaugeCenter+FEEL.greatHalf,colors.chip,FEEL.gaugeWidth,.55);
  arc(FEEL.gaugeCenter-FEEL.perfectHalf,FEEL.gaugeCenter+FEEL.perfectHalf,colors.warning,FEEL.gaugeWidth+2,1);
  const zc=zoneColour();arc(0,v,zc,FEEL.gaugeWidth*.5,.9);ctx.globalAlpha=1;
  ctx.globalAlpha=fade;circle(b.x+Math.cos(at(v))*R,b.y+Math.sin(at(v))*R,FEEL.gaugeWidth,gaugeZone()?zc:colors.foreground);ctx.globalAlpha=1;
}
// The zone the sweep is in now: 'perfect', 'great' or null (also null with Timing off or no pulled aim).
function gaugeZone(){if(!s.timing||!s.held||!s.pulled||s.gaugeT<FEEL.gaugeDelay)return null;const d=Math.abs(gaugeValue()-FEEL.gaugeCenter);return d<=FEEL.perfectHalf?'perfect':d<=FEEL.greatHalf?'great':null}
const zoneColour=()=>colors[FEEL.gaugeColours[gaugeZone()??'none']];
function gaugeValue(){const t=(Math.max(0,s.gaugeT-FEEL.gaugeDelay)/FEEL.gaugeCycle)%1;return 1-Math.abs(1-2*t)}
function gaugeGrade(){if(!s.timing)return null;const d=Math.abs(gaugeValue()-FEEL.gaugeCenter);
  return d<=FEEL.perfectHalf?{name:COPY.grade.perfect,mult:FEEL.perfectMult,perfect:true}:d<=FEEL.greatHalf?{name:COPY.grade.great,mult:FEEL.greatMult}:null}
// Residents: a ring that fills while recharging (full and solid when ready), the special aura, the art, and its ability name. Swarm (C3): the crystal under the heroes, and a ground light per hero.
function drawBodies(font,onlyId=null,extras=true,ground=true){if(extras)drawFlashes();
  const danger=dangerIds();
  for(const id of onlyId?[onlyId]:ids){if(meteorHides(id))continue;const b=s.bodies[id],R=C.visualSize/2+4,pose=contactPose(id),im=images[id];if(swarmOn()){swarmDraw(window.LoftRumbleSwarmView.layers.crystal);window.LoftRumbleSwarmView.heroMark(id,{body:b,r:R,...window.LoftRumbleSwarmView.heroTint(id,{ink:colors.foreground,surface:colors.card})})}
    if(!stunned(b)&&!b.moving&&(FEEL.recharge||b.ping>0)){const ping=b.ping>0?b.ping/FEEL.pingLife:0,pr=R*(1+(still()?0:FEEL.pingGrow*Math.sin(Math.PI*(1-ping))*(ping>0)));
      ctx.lineWidth=FEEL.ringLine;
      if(FEEL.recharge){ctx.globalAlpha=FEEL.ringTrackAlpha;ctx.strokeStyle=colors.track;ctx.beginPath();ctx.arc(b.x,b.y,pr,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
        ctx.strokeStyle=b.charge>=1?colors.foreground:colors['muted-foreground'];ctx.beginPath();ctx.arc(b.x,b.y,pr,-Math.PI/2,-Math.PI/2+Math.PI*2*b.charge);ctx.stroke()}
      // Ready ping: a thin cream ring that pops a little and fades with the ping (amber is kept for special-ready).
      if(ping>0){ctx.globalAlpha=ping;ctx.strokeStyle=colors.foreground;ctx.beginPath();ctx.arc(b.x,b.y,pr,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1}
}
    else if(!stunned(b)&&!b.moving&&!FEEL.recharge&&!swarmOn()){ctx.globalAlpha=FEEL.restAlpha;ctx.lineWidth=FEEL.restLine;ctx.strokeStyle=colors.border;ctx.beginPath();ctx.arc(b.x,b.y,R,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1}
    if(ground){if(window.LoftRumbleBattleMaterials)window.LoftRumbleBattleMaterials.ground(ctx,b.x,b.y,artSize()/2,document.documentElement.dataset.arenaSkin);else window.LoftRumbleColosseumRelief?.ground(ctx,b.x,b.y,artSize()/2,document.documentElement.dataset.arenaSkin);}
    drawAura(b,R);
    // Activation: the ally that fired gets a thin cream ring that widens a little and fades over the splash.
    if(s.splash[id]>0){const k=1-s.splash[id]/FEEL.splashTime;ctx.globalAlpha=FEEL.activationRingAlpha*(1-k);ctx.lineWidth=FEEL.ringLine;ctx.strokeStyle=colors.foreground;
      ctx.beginPath();ctx.arc(b.x,b.y,R+FEEL.activationRingGap+(still()?0:FEEL.activationRingGrow*k),0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1}
    // Stunned: faded, but full strength with a dark halo inside a live Beam so the core never washes the hero out.
    const stunLook=camera?window.LoftRumbleStun.look(b,{beamLive:beamLive(),inside:!!s.attackFx&&inZone(s.attackFx.warn,b)}):{alpha:null,halo:0};
    ctx.globalAlpha=stunLook.alpha??(b.moving||b.charge>=1?1:RT.rechargeAlpha);
    const grabPose=dragFeel.pose(id,still());ctx.save();if(stunLook.halo){ctx.shadowColor=window.LoftRumbleStun.haloColour;ctx.shadowBlur=stunLook.halo}ctx.translate(b.x+pose.x,b.y+pose.y-grabPose.lift);if(camera?.shallow)ctx.scale(1,camera.uprightScale);
    if(b.squash&&!still()){const k=FEEL.wallSquash*b.squash.life/FEEL.wallSquashLife,a=Math.atan2(b.squash.ny,b.squash.nx);ctx.rotate(a);ctx.scale(1-k,1+k*.6);ctx.rotate(-a)}
    const held=s.held===id,stretch=held?grabPose.stretch:b.pulse,k=grabPose.scale*splashScale(id)*(FEEL.artBalance[id]??1)*(held&&s.perfectPulse>0?1+FEEL.perfectPulse*s.perfectPulse/FEEL.perfectPulseLife:1);
    ctx.rotate(b.angle+pose.rotation);ctx.scale((1+stretch)*pose.sx*k,(1-stretch*.5)*pose.sy*k);
    const whipFlash=window.LoftRumbleWhiplashRenderer?.hitFlash(whiplashVisualFx(),id,still())??0; // owner 2026-11-18: white anime flash, one frame with reduced motion
    if(whipFlash)ctx.filter=LoftRumbleWhiplashLook.flashFilter;
    if(window.LoftRumbleBattleMaterials)window.LoftRumbleBattleMaterials.resident(ctx,im,artSize(),document.documentElement.dataset.arenaSkin);else if(im.complete&&im.naturalWidth)ctx.drawImage(im,-artSize()/2,-artSize()/2,artSize(),artSize());ctx.restore();ctx.globalAlpha=1;
    if(danger.includes(id)){if(still()){ctx.strokeStyle=colors.danger;ctx.lineWidth=3;ctx.beginPath();ctx.arc(b.x,b.y,R+2,0,Math.PI*2);ctx.stroke()}
      else{ctx.globalAlpha=FEEL.dangerAlpha*(.5+.5*Math.sin(s.clock*FEEL.dangerBlink));circle(b.x,b.y,R,colors.danger);ctx.globalAlpha=1}}
    if(b.moving&&b.walls)drawCounter(b,font)}
  if(extras)drawBodyEffects(font);
}
// ---- Tapped-special effects (#536 U2b). State and numbers: special-model.js fx, special-data.js fx. Code-drawn, no art. ----
// Look numbers, "#536 U2b look defaults, 2026-11-22, owner may overrule": widths and alphas of the strokes below.
const FX_RING_W=8,FX_RING_ALPHA=.95,FX_GLOW_ALPHA=.45,FX_MARK_W=5,FX_EDGE_ALPHA=.4,FX_EDGE_PAD=5,FX_MARK_DELAY=.12,FX_SPOKES=10,FX_SPOKE_W=5,FX_FLASH_ALPHA=.8,FX_TRAIL=5,FX_TRAIL_STEP=.045,FX_FADE_FROM=.8,FX_RING2_AT=.2,FX_SHADOW_ALPHA=.3,FX_PUFF=16,FX_BURST_PUFF_MIN=3,FX_PLUSH_SLAM_AT=.28,FX_GHOST_ALPHA=.3,FX_PRESS=.25;
const fxOut=t=>1-(1-t)*(1-t),fxPart=(t,from)=>Math.min(1,Math.max(0,(t-from)/(1-from)));
function stepSpecialFx(dt){if(!s.specialFx?.length)return;s.specialFx=window.LoftRumbleSpecials.fx.step(s.specialFx,dt);
  for(const e of s.specialFx)if(e.justLanded&&!still()){s.shake=Math.max(s.shake,FEEL.shakeWeak);burst(e.x,e.y,FEEL.weakParticles,FEEL.weakSparkSpeed,'warning')}}
function fxRing(x,y,r,colour,width,alpha){if(alpha<=0)return;ctx.beginPath();ctx.arc(x,y,Math.max(0,r),0,Math.PI*2);
  ctx.globalAlpha=alpha*FX_EDGE_ALPHA;ctx.strokeStyle=colors['rumble-ink'];ctx.lineWidth=width+FX_EDGE_PAD;ctx.stroke(); // dark edge: a pale ring reads on the sand floor
  ctx.globalAlpha=alpha;ctx.strokeStyle=colour;ctx.lineWidth=width;ctx.stroke();ctx.globalAlpha=1}
function fxPlus(x,y,arm,alpha){ctx.save();ctx.globalAlpha=alpha;ctx.lineCap='round';for(const [colour,width] of [[colors.card,FX_MARK_W+3],[colors.good,FX_MARK_W]]){ctx.strokeStyle=colour;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x-arm,y);ctx.lineTo(x+arm,y);ctx.moveTo(x,y-arm);ctx.lineTo(x,y+arm);ctx.stroke()}ctx.restore()}
// Picnic: a ring of heal light spreads from the caster, each hero glows and plus marks rise off it.
function drawPicnicFx(e,L,D){const R=C.visualSize/2+6;fxRing(e.x,e.y,R+D.reach*fxOut(L.t),colors.good,FX_RING_W*L.fade,FX_RING_ALPHA*L.fade);
  fxRing(e.x,e.y,R+D.reach*fxOut(fxPart(L.t,FX_RING2_AT)),colors.foreground,FX_RING_W/2*L.fade,FX_RING_ALPHA*L.fade);
  for(const id of ids){const b=s.bodies[id];ctx.globalAlpha=FX_GLOW_ALPHA*L.fade;circle(b.x,b.y,R*(1+.25*L.t),colors.good);ctx.globalAlpha=1;
    for(let k=0;k<D.marks;k++){const t=fxPart(L.t,k*FX_MARK_DELAY),x=b.x+(k-(D.marks-1)/2)*D.mark*2.2;
      if(t>0)fxPlus(x,b.y-R*.4-D.rise*fxOut(t),D.mark*(1-.3*t),(t<FX_FADE_FROM?1:(1-t)/(1-FX_FADE_FROM))*L.fade)}}}
// The hero's own art at any spot, lifted off the ground and scaled (the same art call drawBodies makes).
function fxHero(id,x,y,lift,grow,alpha,squash){const im=images[id],k=(FEEL.artBalance[id]??1)*grow;ctx.save();ctx.globalAlpha=alpha;ctx.translate(x,y-lift);if(camera?.shallow)ctx.scale(1,camera.uprightScale);ctx.scale(k*(1+squash),k*(1-squash));
  if(window.LoftRumbleBattleMaterials)window.LoftRumbleBattleMaterials.resident(ctx,im,artSize(),document.documentElement.dataset.arenaSkin);else if(im.complete&&im.naturalWidth)ctx.drawImage(im,-artSize()/2,-artSize()/2,artSize(),artSize());ctx.restore()}
// Meteor leaps, so its caster's real art is hidden while the leap draws it: through the fall and the press, and for the whole effect with reduced motion.
function meteorHides(id){if(!s.specialFx?.length)return false;const M=window.LoftRumbleSpecials,SD=window.LoftRumbleSpecialData,D=SD.fx.meteor,kind=SD.specials.meteor.id; // the id, not a string literal: the copy scan reads the page's literals as words
  return s.specialFx.some(e=>{if(e.kind!==kind||e.id!==id)return false;const p=M.fx.at(e);return still()||p.fall<1||p.impact<D.pressAt})}
// Meteor: the hero leaps from where it stands onto the target (a ring marks the landing, a shadow runs under it), presses flat on landing, then a flash, a shock ring and spokes burst out.
function drawMeteorFx(e,L,D){const home=e.from??e,reach=e.radius??D.reach,calm=still(),R=C.visualSize/2;
  if(L.impact===0&&!calm){const f=L.fall,arc=4*f*(1-f),x=home.x+(e.x-home.x)*f,y=home.y+(e.y-home.y)*f;
    fxRing(e.x,e.y,reach*(.35+.65*f),colors.warning,FX_RING_W/2,FX_RING_ALPHA*f);
    ctx.globalAlpha=FX_SHADOW_ALPHA*(1-.5*arc);circle(x,y,R*(1-.3*arc),colors.foreground);ctx.globalAlpha=1;
    for(let i=FX_TRAIL;i>0;i--){const g=Math.max(0,f-i*FX_TRAIL_STEP),a=4*g*(1-g);fxHero(e.id,home.x+(e.x-home.x)*g,home.y+(e.y-home.y)*g,D.leap*a,1+D.grow*a,FX_GHOST_ALPHA*(1-i/(FX_TRAIL+1)),0)}
    fxHero(e.id,x,y,D.leap*arc,1+D.grow*arc,1,0);return}
  const k=fxOut(L.impact),fade=1-L.impact;ctx.globalAlpha=FX_FLASH_ALPHA*fade;circle(e.x,e.y,reach*.6*(1-L.impact*.5),colors.warning);ctx.globalAlpha=1;
  fxRing(e.x,e.y,reach*k,colors.danger,FX_RING_W*fade+2,FX_RING_ALPHA*fade);fxRing(e.x,e.y,reach*k*.7,colors.foreground,FX_RING_W/2*fade,FX_RING_ALPHA*fade);
  ctx.save();ctx.globalAlpha=fade;ctx.strokeStyle=colors.warning;ctx.lineWidth=FX_SPOKE_W*fade+1;ctx.lineCap='round';ctx.beginPath();
  for(let i=0;i<FX_SPOKES;i++){const a=i/FX_SPOKES*Math.PI*2;ctx.moveTo(e.x+Math.cos(a)*reach*k*.5,e.y+Math.sin(a)*reach*k*.5);ctx.lineTo(e.x+Math.cos(a)*reach*k*.9,e.y+Math.sin(a)*reach*k*.9)}
  ctx.stroke();ctx.restore();
  if(calm||L.impact<D.pressAt)fxHero(e.id,e.x,e.y,0,1,1,calm?FX_PRESS:FX_PRESS*(1-L.impact/D.pressAt))}
// Big Plush: the puffed hero drops its weight: a shadow squashes under it, then two shock rings and dust puffs roll out from its feet.
function drawPlushFx(e,L,D){const R=C.visualSize/2*window.LoftRumbleSpecialData.specials.bigPlush.size,slam=fxPart(L.t,FX_PLUSH_SLAM_AT),fade=1-slam;
  if(L.t<FX_PLUSH_SLAM_AT){fxRing(e.x,e.y,R*(1+.15*(1-L.t/FX_PLUSH_SLAM_AT)),colors.warning,FX_RING_W,FX_RING_ALPHA);return}
  ctx.globalAlpha=FX_SHADOW_ALPHA*fade;circle(e.x,e.y,R*(1+.2*slam),colors.foreground);ctx.globalAlpha=1;
  fxRing(e.x,e.y,R+D.reach*fxOut(slam),colors.warning,FX_RING_W*fade+1,FX_RING_ALPHA*fade);fxRing(e.x,e.y,R+D.reach*fxOut(fxPart(slam,FX_RING2_AT)),colors.foreground,FX_RING_W/2*fade,FX_RING_ALPHA*fade);
  for(let i=0;i<D.puffs;i++){const a=i/D.puffs*Math.PI*2,d=R+D.reach*.8*fxOut(slam);ctx.globalAlpha=fade;circle(e.x+Math.cos(a)*d,e.y+Math.sin(a)*d,FX_BURST_PUFF_MIN+FX_PUFF*fade,colors['rumble-cream'])}ctx.globalAlpha=1}
function drawSpecialFx(){const M=window.LoftRumbleSpecials,Dfx=window.LoftRumbleSpecialData.fx,draw={picnic:drawPicnicFx,meteor:drawMeteorFx,bigPlush:drawPlushFx};
  for(const e of s.specialFx??[]){const p=M.fx.at(e),calm=still(),hold=calm?(p.t>FX_FADE_FROM?(1-p.t)/(1-FX_FADE_FROM):1):1-p.t;
    const L=calm?{...p,t:Dfx.stillAt,impact:Dfx.stillAt,fall:1,fade:hold}:{...p,fade:1-p.t};draw[e.kind]?.(e,L,Dfx[e.kind])}}
function drawBodyEffects(font){
  drawSpecialFx();
  if(camera&&!cues.drawsStun())for(const id of ids)window.LoftRumbleStun.draw(ctx,s.bodies[id],{clock:s.time,reduced:still(),upright:camera.shallow?camera.uprightScale:1,colour:colors.warning});
  const art=window.LoftRumbleHeroFx?.draw(ctx,{effects:s.teamEffects,bolts:s.bolts,enemy:enemy(),enemyRadius:C.enemyRadius,image:name=>artwork?.available(name),colour:key=>colors[key],reduced:still(),upright:camera?.shallow?camera.uprightScale:1,danger:!!currentWarn()});
  window.LoftRumbleSynergyFx.drawFields(ctx,{fields:s.synFields,colours:{glow:colors.primary,core:colors.foreground},still:still(),time:s.time});
  window.LoftRumbleSynergyFx.drawSupport(ctx,{bubbles:Object.keys(s.bubbles).map(id=>s.bodies[id]).filter(Boolean),rings:s.supportRings,colours:{glow:colors.primary,core:colors.foreground},still:still(),time:s.time});
  window.LoftRumbleSynergyFx.draw(ctx,{arcs:s.synArcs,colours:{glow:colors.primary,core:colors.foreground}}); // synergy bolts, field cues only
  if(!art)for(const bolt of s.bolts){if(bolt.delay<=0){circle(bolt.x,bolt.y,7,colors.primary);circle(bolt.x,bolt.y,3,colors.foreground)}}
  for(const f of s.teamEffects){const age=1-f.life/(f.max??A.effectLife);if(art&&f.fx){if(f.label){ctx.globalAlpha=1-age;ctx.fillStyle=colors.primary;ctx.font=FEEL.textWeight+' 13px '+font;ctx.textAlign='center';ctx.fillText(f.label,clamp(f.x,65,s.w-65),f.y-38-age*15);ctx.globalAlpha=1}continue}ctx.globalAlpha=1-age;ctx.strokeStyle=colors.primary;ctx.lineWidth=f.type==='beam'?10*(1-age)+2:3;ctx.beginPath();if(f.type==='beam'){ctx.moveTo(f.x,f.y);ctx.lineTo(f.tx,f.ty)}else ctx.arc(f.x,f.y,10+age*f.r,0,Math.PI*2);ctx.stroke();ctx.fillStyle=colors.primary;ctx.font=FEEL.textWeight+' 13px '+font;ctx.textAlign='center';ctx.fillText(f.label,clamp(f.x,65,s.w-65),f.y-38-age*15);ctx.globalAlpha=1}
  // Ability names go last, over the beam and crescents, so an effect never covers its own name.
  for(const id of ids){const b=s.bodies[id];drawSplash({id,kind:kind(id),x:b.x,y:b.y},font)}
}
// The one floating number over a moving resident: its bounce multiplier, growing with each bounce and gold at the cap.
// Hidden while a PERFECT pop is near, so numbers never stack. Weak, Great and Perfect are one-shot pops.
function drawCounter(b,font){if(s.popups.some(p=>String(p.text).startsWith(COPY.perfect)&&Math.hypot(p.x-b.x,p.y-b.y)<FEEL.counterHide))return;
  const mult=bounceMult(b.walls),grow=(mult-1)/(FEEL.bounceCap-1),capped=mult>=FEEL.bounceCap,pop=still()?1:1+.6*b.counter/FEEL.counterPop,size=Math.round(FEEL.counterSize*(1+FEEL.counterGrow*grow));
  ctx.save();ctx.translate(clamp(b.x,C.visualSize*1.2,s.w-C.visualSize*1.2),Math.max(C.hudTop+size+4,b.y-C.visualSize/2-10));ctx.scale(pop,pop);ctx.textAlign='center';ctx.lineJoin='round';ctx.strokeStyle=colors.card;ctx.lineWidth=4+2*grow;ctx.fillStyle=capped?colors.warning:colors.chip;
  ctx.font=FEEL.textWeight+' '+size+'px '+font;const text=phrase(COPY.multiplier,{multiplier:mult.toFixed(2)});ctx.strokeText(text,0,0);ctx.fillText(text,0,0);ctx.restore();
}
function drawHeart(){if(!s.heart)return;const{x,y}=s.heart;if(artPaint('pickup-heart',x,y,FEEL.bumperRadius*2))return;ctx.fillStyle=colors.good;ctx.beginPath();ctx.moveTo(x,y+12);ctx.bezierCurveTo(x-28,y-5,x-10,y-24,x,y-10);ctx.bezierCurveTo(x+10,y-24,x+28,y-5,x,y+12);ctx.fill();ctx.font='11px '+arenaFont;ctx.textAlign='center';ctx.fillStyle=colors.foreground;ctx.fillText(COPY.heal,x,y+29)}
// End screen: waits for the last total, or the knockout attack, to land; shows the battle time.
// The end screen shows once the last total (or the knockout attack) has landed; only then does a tap start a new battle.
const drawEndReady=()=>s.phase==='over'&&!!s.battleEnd&&window.LoftRumbleBattleEnd.ready(s.battleEnd);
function drawEnd(font){
  if(s.demo||swarmOn()){window.LoftRumbleDemo.present(s,drawEndReady(),playAgain);return}
  if(!drawEndReady())return;
  const won=s.battleEnd.result.won,backgroundArt=artPaint('bg-title',s.w/2,s.h/2,s.w,s.h,true);
  ctx.save();ctx.globalAlpha=backgroundArt?artwork.metrics.endScrim:FEEL.scrim;ctx.fillStyle=backgroundArt?colors.track:colors.card;ctx.fillRect(0,0,s.w,s.h);ctx.globalAlpha=1;ctx.textAlign='center';ctx.lineJoin='round';
  const baseline=s.h*.45,title=won?phrase(COPY.won,{time:clockText()}):COPY.ko;
  const resultPanel=artwork?.panel(ctx,s.w/2,baseline+FEEL.bannerSize*artwork.metrics.resultPanelOffset,Math.min(s.w-FEEL.barInset*2,artwork.metrics.panelSize),artwork.metrics.panelHeight,colors.card);
  const ribbon=artPaint(won?'ui-banner-victory':'ui-banner-defeat',s.w/2,baseline-FEEL.bannerSize/2,Math.min(s.w-FEEL.barInset*2,artwork?.metrics.endBannerWidth),artwork?.metrics.endBannerHeight,true);
  ctx.strokeStyle=ribbon?colors.foreground:colors.card;ctx.lineWidth=ribbon?artwork.metrics.resultStroke:6;ctx.font=FEEL.textWeight+' '+FEEL.bannerSize+'px '+font;ctx.fillStyle=resultPanel?(window.LoftRumbleBattleMaterials?.panelInk??colors.foreground):ribbon?colors.card:won?colors.warning:colors.danger;
  if(!resultPanel)ctx.strokeText(title,s.w/2,baseline);ctx.fillText(title,s.w/2,baseline);
  ctx.font=FEEL.textWeight+' '+FEEL.hudFont+'px '+font;ctx.strokeStyle=colors.card;ctx.fillStyle=resultPanel?(window.LoftRumbleBattleMaterials?.panelMuted??colors.foreground):colors.foreground;
  if(!resultPanel)ctx.strokeText(COPY.again,s.w/2,baseline+FEEL.bannerSize*.8);ctx.fillText(COPY.again,s.w/2,baseline+FEEL.bannerSize*.8);ctx.restore();
}
function drawParticles(){
 for(const p of s.particles){ctx.globalAlpha=Math.max(0,p.life/(p.max??C.particleLife));circle(p.x,p.y,p.size??(p.wall?2:3),colors[p.color]??(p.wall?colors.primary:colors.warning))}ctx.globalAlpha=1;for(const ring of s.rings){const age=1-ring.life/(ring.max??C.ringLife);ctx.globalAlpha=1-age;ctx.strokeStyle=colors[ring.colour]??(ring.wall?colors.primary:colors.warning);ctx.lineWidth=ring.big?1+FEEL.shockWidth*(1-age):ring.weak?4:2;ctx.beginPath();ctx.arc(ring.x,ring.y,5+age*(ring.big??(ring.weak?45:25)),0,Math.PI*2);ctx.stroke()}ctx.globalAlpha=1;
}
function draw(){
 const font=arenaFont,whipShake=whiplashVisualFx(),quake=still()?0:(whipShake?.whiplash?window.LoftRumbleWhiplashFx.shake(whipShake.contacts,whipShake.whiplash.elapsed,false):0),off=still()?{x:0,y:0}:window.LoftRumbleFeel.shakeOffset(s.shakes,s.clock,FEEL.shakeMax);
 ctx.clearRect(0,0,s.w,s.h);if((camera&&window.LoftRumbleStorybook.background(camera))||artPaint('bg-arena',s.w/2,s.h/2,s.w,s.h,true)){if(lmBars()){/* LM6b: the arena shows behind the slim frames */}else if(window.LoftRumbleBattleMaterials)window.LoftRumbleBattleMaterials.hud(ctx,s.w,s.h,C.hudTop,C.hudBottom);else{ctx.fillStyle=colors.card;ctx.fillRect(0,0,s.w,C.hudTop);ctx.fillRect(0,s.h-C.hudBottom,s.w,C.hudBottom)}}ctx.save();
  ctx.beginPath();ctx.rect(0,C.hudTop,s.w,s.h-C.hudTop-C.hudBottom);ctx.clip(); // the play area: zones and effects never spill into the HUD strips
  if(window.LoftRumbleBattleEnd.presenting(s.battleEnd)){
    window.LoftRumbleFinishRenderer.draw(ctx,s.battleEnd.presentation,s.battleEnd.elapsed,still(),{images,artwork});
    ctx.restore();drawBars(font);drawPaused(font);return;
  }
 if(s.finale&&!still()){const boss=enemy(),e=camera?camera.projection.project(boss):boss,k=1+FEEL.finaleZoom*flyEase(Math.min(1,s.finale.t/FEEL.finaleZoomIn));ctx.translate(e.x,e.y);ctx.scale(k,k);ctx.translate(-e.x,-e.y)} // finale zoom, play area only
 if(quake>Math.hypot(off.x,off.y))ctx.translate((Math.random()*2-1)*quake,(Math.random()*2-1)*quake);else if(off.x||off.y)ctx.translate(off.x,off.y);
 const attackKick=camera?window.LoftRumbleAttackImpact.offset(s,still()):null;if(attackKick)ctx.translate(attackKick.x,attackKick.y);
 if(s.kick&&!still()){const k=FEEL.kickDist*s.kick.life/FEEL.kickLife;ctx.translate(s.kick.x*k,s.kick.y*k)}
 if(camera?.active){window.LoftRumbleCameraRenderer.draw(camera,font);swarmDraw()}else{
 drawWarn();drawHeart();drawBumpers();drawAttack();drawEnemy();drawShield();
 drawParticles();
 artwork?.effects(ctx,s,C,FEEL,enemy(),still());drawBodies(font);if(s.phase==='play')aim(font);}
 ctx.restore();
 if(camera)window.LoftRumbleHeat.glow(camera.game);
 if(s.flash>0&&!still()){ctx.globalAlpha=FEEL.flashAlpha*s.flash/FEEL.perfectFlash;ctx.fillStyle=colors.perfect;ctx.fillRect(0,0,s.w,s.h);ctx.globalAlpha=1}
 drawVignette();drawSlow();drawBars(font);drawFocus(font);drawPayoff(font);drawPopups(font);drawEnemyName(font);drawBanners(font);drawToasts(font);drawTutor(font);drawEnd(font);if(camera&&!s.demo&&!swarmOn()&&drawEndReady())window.LoftRumbleStats.draw(camera.resultsGame(),font,window.LoftRumbleCameraCopy.stats);drawCutin(font);drawPaused(font);installCues();cues.render();
}
// Bullet time: while a pulled aim is held and Focus remains, the world runs at RT.slowFactor. Focus counts real seconds.
const slowed=()=>FEEL.bulletTime&&!!s.held&&s.pulled&&s.focus>0&&s.phase==='play';
// The cue rail joins the page once Training is not running (at once for a returning player, on Skip or Done for a first visit).
function installCues(){if(!s.demo||cues.installed()||!tutorial.settled()||tutorial.state().status==='running')return;
  cues.install({s,RT,ids,names,throwStyle:()=>throwPref.get(),abilities,specials,specialBonus,kind,stunned,inZone,hudTop:C.hudTop,weakMultiplier:C.weakMultiplier,paused:()=>tutorial.state().status==='running',
    place:p=>{const at=camera?camera.projection.project(p):p;return{x:boardAt.x+at.x*s.scale,y:boardAt.y+at.y*s.scale}}, // a logical point in arena CSS px
    camera:()=>camera,rootDanger:()=>camera?camera.punishDanger():[],rootWarn:()=>s.cameraScene?.punish?.warn??null})}
