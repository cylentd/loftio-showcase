// Combo heat: the hit combo made visible and audible, so a player feels it grow without reading the counter.
// Feedback only. It never changes damage, charge or the combo rules. Owner brief 2026-11-09; all values are first guesses to feel-test.
(function(root){
  'use strict';
  const settings=Object.freeze({
    // Combo size that starts tiers 1 to 5. Scale (owner, 2026-11-09): at 4800 boss HP, set for a casual two-minute fight, a
    // skilled fight ends near 120 hits, so the ladder ends there. Fire is the last tier and earned (a casual fight's small combos
    // never reach 80); a rainbow trail is the tier before it. Superseded the same day: a 200-hit ladder for a 12000 HP fight.
    hits:[8,20,35,55,80],
    particles:[6,10,16,24,32],              // extra sparks per enemy hit
    speed:[220,280,340,420,480],            // their speed, units/s
    ring:[30,45,60,80,100],                 // shock ring radius, units
    shake:[1,2,4,5,6],                      // added to the hit's own shake, still capped by FEEL.shakeMax
    pitch:[1,1.122,1.26,1.498,2],           // chime pitch: up 2, 4 and 7 semitones, then the octave, so a growing combo climbs a major chord
    trailWidth:[3,5,7,9,11],trailAlpha:[0.45,0.6,0.75,0.85,0.9],trailSamples:[8,12,16,22,28],
    glow:[0.1,0.16,0.22,0.3,0.36],          // arena edge glow, peak alpha
    colours:['flash','chip','perfect','perfect','warning'], // sparks, ring and glow. Cool to hot: the fire tier is gold
    // Rainbow trail: the tier (counted from 1) whose trail cycles through the hues. Degrees of hue per trail segment and per second,
    // and the saturation and lightness (percent) of every segment.
    rainbowTier:4,rainbowStep:14,rainbowSpeed:240,rainbowSaturation:95,rainbowLightness:62,
    // Fire: flames shed per physics step by a resident in flight (the game steps 180 times a second). Only the last tier burns, and
    // it starts as embers; the blaze below grows it. These two are read by tier, never ramped, so no flame shows before the fire tier.
    // Drawn by this module, not as game particles: flat fading dots read as smoke (owner, 2026-11-09). Fire needs light that adds up,
    // and flames that cool from gold to red and shrink as they rise.
    flames:[0,0,0,0,0.25],flameSize:[0,0,0,0,6], // flames per step, and their starting radius in units
    // Colour until this share of a flame's life. No white start: added light on this pale floor already burns the core to white,
    // and with a white start the whole trail washed out. Alpha is low for the same reason.
    flameStops:[[0.55,'warning'],[1,'danger']],
    flameAlpha:0.5,flameShrink:0.7,          // peak alpha; radius falls as (1 - age) to this power, so a flame stays full early and thins late
    flameLife:0.45,flameRise:130,flameDrift:45,flameDrag:0.15, // seconds; upward speed and sideways scatter, units/s; share of the resident's own speed kept
    // Two fire styles to compare (owner, 2026-11-09). RISE: flames start all over the resident and rise, which reads as "I am on fire".
    // COMET: they start on its trailing side and stream back along its path, and a top-tier hit throws a burst, which reads as "I make fire".
    fires:['COMET','RISE'],
    cometStart:0.6,cometStream:160,cometLift:0.25, // start this share of the radius (up to all of it) behind the centre; backward speed, units/s; share of flameRise kept
    flameBurst:14,burstSpeed:200,                  // flames thrown by a top-tier hit, and their speed outward, units/s
    // Blaze: the combo count has no cap, so from the fire tier's start the fire keeps growing until this many hits, the size of a
    // perfect fight, and holds there. At full blaze: this many times the flames (2 a step), their size (17 units) and their life,
    // and this share of each flame's life is white-hot before it cools to gold.
    // (6 a step with 0.3 white burned the comet to a solid white bar on the darkened floor; 2 a step and 0.1 keep its gold and red.)
    blazeFull:120,blazeRate:8,blazeSize:2.8,blazeLife:1.4,blazeWhite:0.1,
    // The first blaze only changed the flames, and the owner saw no difference past 60 (2026-11-09). So the whole screen now follows
    // it: the arena darkens (which also lets the fire show its colour instead of washing to white on the pale floor), the edge glow
    // and its pulse grow by these factors, hits throw bigger rings and more sparks and shake harder, and embers rise everywhere.
    dimColour:'card', // the arena's dark surface token (the HUD strips). 'foreground' is the light text colour here and bleached the floor
    blazeDim:0.35,blazeGlow:2,blazePulse:2,blazeRing:1.5,blazeSparks:2,blazeShake:4,
    ambientRate:0.5,ambientSize:4,ambientLife:1.1, // embers per physics step at full blaze (90 a second), their radius and seconds alight
    roundoff:1e-9, // a rate like 2/3 summed over three steps lands a hair under 1; without this that flame would come a step late
    noiseA:12.9898,noiseB:43758.5453,       // the usual one-line shader hash; flames must not draw from the game's random stream
    chimeFreq:660,chimeLife:0.12,chimeGain:0.05,
    glowInner:0.6,glowOuter:1.2,            // the glow is an oval the shape of the play area: clear inside 0.6 of its half-width, full at 1.2
    glowPulse:5,glowDip:0.3,                // it pulses at this rate (rad/s) and dips by this share of its alpha
  });
  const numeric=['particles','speed','ring','shake','pitch','trailWidth','trailAlpha','trailSamples','glow'];
  const tier=hits=>settings.hits.filter(start=>hits>=start).length;
  const whole=['particles','trailSamples']; // counts, so rounded
  // A table holds the value at the start of each tier. In between, the value climbs hit by hit toward the next tier's, so every
  // hit is a little more than the last and nothing jumps (owner, 2026-11-09). The last tier holds its value; the blaze takes over.
  function ramp(table,hits){
    const level=tier(hits);
    if(!level)return 0;
    if(level===settings.hits.length)return table[level-1];
    const start=settings.hits[level-1],share=(hits-start)/(settings.hits[level]-start);
    return table[level-1]+(table[level]-table[level-1])*share;
  }
  function style(hits){
    const level=tier(hits);
    if(!level)return null;
    const result={tier:level,colour:settings.colours[level-1],rainbow:level===settings.rainbowTier};
    for(const key of numeric)result[key]=ramp(settings[key],hits);
    for(const key of whole)result[key]=Math.round(result[key]);
    return result;
  }
  // Hue, in degrees, of one segment of a rainbow trail: it shifts along the trail and runs with the clock.
  const trailHue=(index,clock)=>(index*settings.rainbowStep+clock*settings.rainbowSpeed)%360;
  const trailColour=(index,clock)=>`hsl(${trailHue(index,clock)} ${settings.rainbowSaturation}% ${settings.rainbowLightness}%)`;
  const byTier=(table,hits)=>table[tier(hits)-1]??0;
  // One enemy hit while the combo is hot: more sparks, a shock ring, a harder shake and a chime that climbs with the tier.
  function impact(game,x,y){
    const {s,C,FEEL}=game,heat=style(s.hits);
    if(!heat||s.phase!=='play')return;
    game.burst(x,y,Math.round(heat.particles*grown(settings.blazeSparks,s.hits)),heat.speed,heat.colour);
    s.rings.push({x,y,life:C.ringLife,max:C.ringLife,big:heat.ring*grown(settings.blazeRing,s.hits),colour:heat.colour});
    s.shake=Math.min(FEEL.shakeMax,s.shake+heat.shake+settings.blazeShake*blaze(s.hits));
    game.tone(settings.chimeFreq*heat.pitch,'sine',settings.chimeLife,settings.chimeGain);
    if(fireStyle!=='COMET'||heat.tier<settings.hits.length||game.still?.())return;
    for(let index=0;index<settings.flameBurst;index++){
      const angle=index/settings.flameBurst*Math.PI*2,speed=settings.burstSpeed*(0.5+noise());
      alight.push({...lit(s),x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-settings.flameRise*settings.cometLift});
    }
  }
  let spark=0;
  const noise=()=>{const value=Math.sin(++spark*settings.noiseA)*settings.noiseB;return value-Math.floor(value);};
  // Flames live here, outside the game's state, each stamped with the game clock at birth. Its age is read from that clock, so
  // nothing has to step them, and a clock that jumps back (a reset or a restored snapshot) simply drops them.
  let alight=[],fireStyle=settings.fires[0];
  function fire(value){
    if(value===undefined)return fireStyle;
    if(!settings.fires.includes(value))throw new RangeError('Unknown fire style');
    return fireStyle=value;
  }
  const age=(flame,clock)=>(clock-flame.born)/flame.life;
  const blaze=hits=>{const top=settings.hits.at(-1);return Math.min(1,Math.max(0,(hits-top)/(settings.blazeFull-top)));};
  const grown=(factor,hits)=>1+(factor-1)*blaze(hits);
  // What every new flame shares: when it was lit, and how big, long-lived and white-hot the combo makes it.
  const lit=s=>({born:s.clock,size:byTier(settings.flameSize,s.hits)*grown(settings.blazeSize,s.hits),
    life:settings.flameLife*grown(settings.blazeLife,s.hits),white:settings.blazeWhite*blaze(s.hits)});
  function live(clock){
    if(clock!==undefined)alight=alight.filter(flame=>age(flame,clock)>=0&&age(flame,clock)<1);
    return alight;
  }
  const flameColour=(share,white=0)=>share<white?'flash':settings.flameStops.find(([until])=>share<=until)[1];
  const flameRadius=(size,share)=>size*Math.pow(1-share,settings.flameShrink);
  // Called once per physics step for a resident in flight. Flames start inside it, then rise and scatter.
  function flames(game,body){
    const {s,C}=game,rate=byTier(settings.flames,s.hits)*grown(settings.blazeRate,s.hits);
    if(!rate||game.still?.())return; // nothing before the fire tier, and none under reduced motion
    live(s.clock);
    const speed=Math.hypot(body.vx,body.vy);
    body.ember=(body.ember??0)+rate;
    while(body.ember>=1-settings.roundoff){
      body.ember-=1;
      alight.push({...lit(s),...(fireStyle==='COMET'&&speed?comet(body,C.radius,speed):rising(body,C.radius))});
    }
  }
  function rising(body,radius){
    const angle=noise()*Math.PI*2,offset=noise()*radius;
    return {x:body.x+Math.cos(angle)*offset,y:body.y+Math.sin(angle)*offset,
      vx:body.vx*settings.flameDrag+(noise()-0.5)*settings.flameDrift,vy:-settings.flameRise*(0.5+noise())};
  }
  // (bx,by) points back along the path; (-by,bx) is across it. The start point stays inside the resident's circle.
  function comet(body,radius,speed){
    const bx=-body.vx/speed,by=-body.vy/speed,back=settings.cometStart+(1-settings.cometStart)*noise();
    const across=(noise()-0.5)*2*Math.sqrt(1-back*back),stream=settings.cometStream*(0.5+noise()),drift=(noise()-0.5)*settings.flameDrift;
    return {x:body.x+(bx*back-by*across)*radius,y:body.y+(by*back+bx*across)*radius,
      vx:bx*stream-by*drift,vy:by*stream+bx*drift-settings.flameRise*settings.cometLift};
  }
  // Called once per physics step. As the blaze grows, embers start all over the play area and rise.
  let drift=0;
  function ambient(game){
    const {s,C}=game,heat=blaze(s.hits);
    if(!heat||game.still?.())return;
    live(s.clock);
    drift+=settings.ambientRate*heat;
    while(drift>=1){
      drift-=1;
      alight.push({...lit(s),size:settings.ambientSize,life:settings.ambientLife,white:0,
        x:noise()*s.w,y:C.hudTop+noise()*(s.h-C.hudTop-C.hudBottom),vx:(noise()-0.5)*settings.flameDrift,vy:-settings.flameRise*(0.3+0.7*noise())});
    }
  }
  const dimAlpha=hits=>settings.blazeDim*blaze(hits);
  const glowAlpha=hits=>(style(hits)?.glow??0)*grown(settings.blazeGlow,hits);
  // Drawn over the backdrop and under everything that stands on it, so residents, the boss and the fire stay bright.
  function dim(game){
    const {ctx,s,C}=game,alpha=dimAlpha(s.hits);
    if(!alpha||s.phase!=='play')return;
    // Alpha goes on the context, not into the colour: the game's withAlpha only rewrites a plain rgb() colour, this token is not
    // one, and it came back untouched, so the first hit past the top tier dropped the full-strength dim at once.
    ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=game.colors[settings.dimColour];ctx.fillRect(0,C.hudTop,s.w,s.h-C.hudTop-C.hudBottom);ctx.restore();
  }
  // Light adds up where flames overlap, which is what makes a hot core without drawing one.
  function drawFlames(game){
    const {ctx,s}=game;
    ctx.save();ctx.globalCompositeOperation='lighter';
    for(const flame of live(s.clock)){
      const share=age(flame,s.clock),seconds=s.clock-flame.born;
      ctx.globalAlpha=settings.flameAlpha*(1-share);ctx.fillStyle=game.colors[flameColour(share,flame.white)];
      ctx.beginPath();ctx.arc(flame.x+flame.vx*seconds,flame.y+flame.vy*seconds,flameRadius(flame.size,share),0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  // The arena's edges glow in the tier's colour. Drawn in screen space over the play area; steady under reduced motion.
  function glow(game){
    const {ctx,s,C}=game,heat=style(s.hits);
    if(!heat||s.phase!=='play')return;
    const top=C.hudTop,height=s.h-C.hudTop-C.hudBottom,half=s.w/2;
    const pulse=game.still()?1:1-settings.glowDip*(0.5+0.5*Math.sin(s.clock*settings.glowPulse*grown(settings.blazePulse,s.hits)));
    const colour=game.colors[heat.colour],gradient=ctx.createRadialGradient(0,0,half*settings.glowInner,0,0,half*settings.glowOuter);
    gradient.addColorStop(0,game.withAlpha(colour,0));gradient.addColorStop(1,game.withAlpha(colour,Math.min(1,glowAlpha(s.hits)*pulse)));
    ctx.save();ctx.translate(half,top+height/2);ctx.scale(1,height/s.w);ctx.fillStyle=gradient;ctx.fillRect(-half,-half,s.w,s.w);ctx.restore();
  }
  root.LoftRumbleHeat={settings,tier,style,trailHue,trailColour,fire,blaze,ambient,dim,dimAlpha,glowAlpha,impact,flames,live,flameColour,flameRadius,drawFlames,glow};
})(globalThis);
