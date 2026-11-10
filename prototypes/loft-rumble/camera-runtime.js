(function (root) {
  'use strict';
  const config = root.LoftRumbleCameraConfig;

  function cloneState(state) {
    const cutin=state.cutin;
    const cloned=structuredClone({...state,cutin:cutin?{...cutin,done:undefined}:cutin});
    if(cutin?.done)cloned.cutin.done=cutin.done;
    return cloned;
  }

  class CameraSession {
    constructor(game) {
      this.game = game;
      this.projection = root.LoftRumbleProjection.create({top:game.C.hudTop,bottom:game.s.h-game.C.hudBottom});
      this.predicting = false;
      this.debugEnabled = false;
      this.comboLock = 0;
      game.FEEL.comboTimeout = config.comboTimeout;
      game.RT.hp = config.bossHp;
      game.reset(); // the battle was set up at the game's own HP before this session existed
      this.artPack = new URLSearchParams(location.search).get('art')==='original'?'ORIGINAL':'STORYBOOK';
      if(this.artPack==='STORYBOOK')this.projection.setMode('SHALLOW_2_5D');
      root.LoftRumbleStorybook.load().then(()=>this.game.draw());
      this.target = null;
      this.launchState = null;
      this.forecast = null;
      this.baseBumpers = structuredClone(game.FEEL.bumpers);
      this.resetScene();
    }

    get shallow() { return this.projection.mode === 'SHALLOW_2_5D'; }
    get fixture() { return this.game.s.cameraScene?.name !== 'BASELINE'; }
    get active() { return this.shallow || this.fixture || this.debugEnabled; }
    get uprightScale() { return this.projection.uprightScale; }

    resetScene() {
      if (this.baseBumpers) this.game.FEEL.bumpers=structuredClone(this.baseBumpers);
      this.game.s.cameraScene = {name:'BASELINE',elapsed:0,enemies:[],paths:{},inside:{},randomState:config.randomSeed,punish:root.LoftRumblePunish.initial()};
      this.launchState = null;
      this.forecast = null;
      this.controls?.sync();
    }

    random() {
      const scene=this.game.s.cameraScene;
      scene.randomState=(config.randomMultiplier*scene.randomState+config.randomIncrement)>>>0;
      return scene.randomState/config.randomDivisor;
    }

    enemy() { return this.target ?? this.game.s.cameraScene?.enemies[0] ?? null; }

    enemies() {
      const {s,C} = this.game;
      return s.cameraScene.enemies.length ? s.cameraScene.enemies : [{id:'enemy-0',type:'boss',...this.game.baseEnemy(),radius:C.enemyRadius}];
    }

    withEnemy(target, operation) {
      const {s,C} = this.game;
      const saved = {target:this.target,radius:C.enemyRadius,horns:s.horns,shield:s.shield,banned:s.banned};
      this.target = target;
      C.enemyRadius = target.radius;
      if (this.fixture) { s.horns=target.horns;s.shield=target.shield;s.banned=target.banned; }
      try { return operation(); }
      finally {
        this.target=saved.target;C.enemyRadius=saved.radius;
        s.horns=saved.horns;s.shield=saved.shield;s.banned=saved.banned;
      }
    }

    collideBody(body) {
      const contacts = this.game.s.cameraScene.inside[body.id] ??= {};
      const original = body.inside;
      for (const target of this.enemies()) {
        body.inside = contacts[target.id] ?? false;
        this.withEnemy(target, () => this.game.collide(body));
        contacts[target.id] = body.inside;
      }
      body.inside = original;
    }

    // Test combo (Camera lab slider): while set, the hit combo is held at that number so its effects can be looked at. 0 is normal play.
    combo(value) {
      const hits=Number(value);
      if (!Number.isInteger(hits)||hits<0||hits>config.comboTestMax) throw new RangeError('Test combo must be a whole number from 0 to '+config.comboTestMax);
      this.comboLock=hits;
      Object.assign(this.game.s,{hits,hitsIdle:0});
      this.game.draw();
      this.controls?.sync();
    }

    // Springy seek: called as a Springy resident leaves a wall. It turns toward the nearest enemy, by no more than the cap.
    seek(body) {
      const near=this.enemies().reduce((best,target)=>{
        const distance=Math.hypot(target.x-body.x,target.y-body.y);
        return distance<best.distance?{target,distance}:best;
      },{target:null,distance:Infinity}).target;
      if (near) Object.assign(body,root.LoftRumbleSeek.turn(body.vx,body.vy,near.x-body.x,near.y-body.y));
    }

    // Root snap (camera-punish.js). It runs only in a live fight on the real battle: never in a lab fixture, never in the aim forecast
    // (which steps the real simulation on a snapshot), and not through a finale, cut-in, pause or the end screen.
    get punishLive() {
      const {s} = this.game;
      return !this.predicting && !this.fixture && s.phase==='play' && !s.finale && !s.cutin && !s.userPaused && s.hp>0;
    }

    punishResting() {
      const {s,C,ids} = this.game,punish=root.LoftRumblePunish;
      return punish.resting(ids.map(id => ({id,x:s.bodies[id].x,y:s.bodies[id].y,moving:s.bodies[id].moving})),this.game.enemy(),C.enemyRadius);
    }

    punish(dt) {
      if (!this.punishLive) return;
      const {s} = this.game,punish=root.LoftRumblePunish,state=s.cameraScene.punish ??= punish.initial();
      const event=punish.tick(state,dt,this.punishResting().length>0);
      if (event!=='snap') return;
      const boss=this.game.enemy(),hit=this.punishResting(),{knockSpeed,slide}=punish.settings;
      for (const id of hit) {
        if (s.held===id) this.game.cancelHold();
        const body=s.bodies[id],{vx,vy}=punish.knock(body,boss);
        Object.assign(body,{moving:true,vx,vy,glide:{speed:knockSpeed,budget:slide,left:slide},walls:0,cool:0,inside:true,used:[],
          special:null,specialTriggered:false,boost:null,boostHit:false,trail:null});
      }
      if (hit.length) this.game.punishImpact(hit);
    }

    // Residents to flash red on the dock while the ring shows.
    punishDanger() {
      return this.punishLive && this.game.s.cameraScene.punish?.warn!=null ? this.punishResting() : [];
    }

    // What to draw: the ring's radius, how far the warning has run (0 to 1), and the residents inside it. Null when there is no warning.
    punishRing() {
      const {s,C} = this.game,punish=root.LoftRumblePunish,warn=s.cameraScene.punish?.warn;
      if (!this.punishLive || warn==null) return null;
      return {radius:punish.ring(C.enemyRadius),charge:1-warn/punish.settings.warnTime,ids:this.punishResting()};
    }

    // Boss HP (Camera lab slider). The fight restarts, because a bar that changes size mid-fight tells the player nothing.
    bossHp(value) {
      const hp=Number(value);
      if (!Number.isInteger(hp)||hp<config.bossHpMin||hp>config.bossHpMax) throw new RangeError(`Boss HP must be a whole number from ${config.bossHpMin} to ${config.bossHpMax}`);
      this.game.RT.hp=hp;
      this.scene(this.game.s.cameraScene.name);
    }

    // Seconds without a hit before the combo drops (Camera lab slider).
    timeout(value) {
      const seconds=Number(value);
      if (!(seconds>=config.comboTimeoutMin&&seconds<=config.comboTimeoutMax)) throw new RangeError(`Combo timeout must be from ${config.comboTimeoutMin} to ${config.comboTimeoutMax} seconds`);
      this.game.FEEL.comboTimeout=seconds;
      this.controls?.sync();
    }

    beforeStep(dt) {
      if (this.comboLock) Object.assign(this.game.s,{hits:this.comboLock,hitsIdle:0});
      const scene = this.game.s.cameraScene;
      scene.elapsed += dt;
      for (const target of scene.enemies) {
        if(this.game.s.phase==='play'&&!this.game.s.finale)this.game.stepShield(target.shield,dt);
        if (!target.moving) continue;
        target.x=target.baseX+Math.sin(scene.elapsed*config.movingRate)*config.movingAmplitude;
        target.y=target.baseY+Math.sin(scene.elapsed*config.movingRate/2)*config.movingAmplitude;
      }
    }

    afterStep() {
      if (this.predicting) return;
      const {s,ids} = this.game;
      if (!this.predicting) root.LoftRumbleHeat.ambient(this.game);
      for (const id of ids) {
        const body=s.bodies[id],path=s.cameraScene.paths[id] ??= [];
        if (!body.moving) continue;
        if (!this.predicting) root.LoftRumbleHeat.flames(this.game,body);
        path.push({x:body.x,y:body.y});
        if (path.length>config.pathLimit) path.shift();
      }
    }

    snapshot() {
      return {state:cloneState(this.game.s),bumpers:structuredClone(this.game.FEEL.bumpers)};
    }

    restore(snapshot, copy=true) {
      const {s,FEEL} = this.game;
      for (const key of Object.keys(s)) if (!(key in snapshot.state)) delete s[key];
      Object.assign(s,copy?cloneState(snapshot.state):snapshot.state);
      FEEL.bumpers=copy?structuredClone(snapshot.bumpers):snapshot.bumpers;
      this.forecast=null;
      this.target=null;
    }

    // name: the resident being launched, for the fight stats. A forecast's launch is counted too, then undone with the rest of its state.
    onLaunch(name) {
      if (!this.predicting) this.launchState=this.snapshot();
      if (name) root.LoftRumbleStats.mark(this.game.s,name,'launches');
    }

    scene(name) {
      if (name!=='BASELINE' && !root.LoftRumbleCameraScenes[name]) throw new RangeError('Unknown camera encounter');
      const {s,FEEL,C,reset,roster} = this.game;
      const frozen=s.paused;
      reset();
      s.paused=frozen;
      s.cameraScene.name=name;
      if (name!=='BASELINE') {
        s.cameraScene.enemies=structuredClone(root.LoftRumbleCameraScenes[name]).map(target => ({...target,baseX:target.x,baseY:target.y,
          horns:structuredClone(s.horns),shield:structuredClone(s.shield),banned:[]}));
        s.enemyT=config.fixtureAttackDelay;
        s.toasts=[];s.banners=[];s.tutor=null;
        FEEL.bumpers=name==='BUMPER_CHAIN'?structuredClone(config.fixtureBumpers):structuredClone(this.baseBumpers);
        for (const [id,position] of Object.entries(config.parkedResidents)) Object.assign(s.bodies[id],{x:position[0],y:position[1],angle:0});
        s.bumperHits=FEEL.bumpers.map(()=>0);
      }
      this.launchState=this.snapshot();
      this.forecast=null;
      roster();
      this.game.draw();
      this.controls?.sync();
    }

    // solo: the aim line's forecast. Allies in flight are taken off the floor first, because where they will be at release is a
    // guess that changed every frame and made the line jump. A hit counts only while this resident is touching an enemy, so damage
    // from anything else never marks a point on its path.
    predict(id, angle, steps=config.predictionSteps, solo=false) {
      if (this.predicting) return [];
      const points=[],{s,C,ids,FEEL}=this.game,saved={state:{...s},bumpers:FEEL.bumpers};
      Object.assign(s,cloneState(s));
      FEEL.bumpers=structuredClone(FEEL.bumpers);
      this.predicting=true;
      try {
        if (solo) for (const other of ids) if (other!==id&&s.bodies[other].moving) Object.assign(s.bodies[other],{moving:false,vx:0,vy:0,x:config.offstage,y:config.offstage});
        if (!this.game.fling(id,angle)) return [];
        for (let index=0;index<steps;index++) {
          const hp=s.hp;
          this.predictionHits={};
          this.game.step(C.step);
          const body=s.bodies[id],reach=Math.hypot(body.vx,body.vy)*C.step+config.hitSlack;
          const touching=this.enemies().some(target=>Math.hypot(body.x-target.x,body.y-target.y)<=C.radius+target.radius+reach);
          const contact=this.predictionHits[id];
          points.push({x:body.x,y:body.y,vx:body.vx,vy:body.vy,walls:body.walls,hit:!!contact||(s.hp<hp&&touching),weak:contact?.weak??false});
          if (solo&&!body.moving) break;
        }
        return points;
      } finally { this.restore(saved,false);this.predicting=false;this.predictionHits=null; }
    }

    route(body, angle) {
      const {s,C} = this.game;
      const aimAngle=Math.round(angle/config.predictionAngleStep)*config.predictionAngleStep;
      const key=[body.id,aimAngle,body.x,body.y,Math.floor(s.cameraScene.elapsed/config.predictionRefresh)].join(':');
      if (this.forecast?.key===key) return this.forecast.route;
      const origin={x:body.x,y:body.y},points=this.predict(body.id,aimAngle,config.predictionSteps,true),vertices=[origin];
      let prior={vx:Math.cos(aimAngle),vy:Math.sin(aimAngle),walls:0},hit=null;
      for (const point of points) {
        const speed=Math.hypot(point.vx,point.vy),before=Math.hypot(prior.vx,prior.vy);
        if ((speed && before && (point.vx*prior.vx+point.vy*prior.vy)/(speed*before)<config.cornerDot)||point.walls>prior.walls) vertices.push({...point,bounce:true});
        if (point.hit&&!hit) hit={...point,seg:vertices.length-1};
        prior=point;
      }
      vertices.push(points.at(-1)??{x:body.x,y:body.y});
      const route={pts:vertices,hit,walls:prior.walls??0,end:vertices.at(-1),samples:points};
      this.forecast={key,route};
      return route;
    }

    // Where the attack label hangs. The game puts it one radius above this point, so tall art reports its crown, not its collider.
    intentAnchor(target) {
      const point=this.projection.project(target);
      if(!root.LoftRumbleStorybook.enabled(this))return point;
      const radius=this.game.C.enemyRadius; // the plain battle's enemy carries no radius of its own
      const top=this.projection.project({x:target.x,y:root.LoftRumbleCameraRenderer.bounds(this,{radius,...target}).y}).y;
      return {...point,y:top+radius};
    }

    paintUpright(name, x, y, width, height=width) {
      const {ctx,artPaint} = this.game;
      if(name.startsWith('boss-')&&root.LoftRumbleStorybook.boss(this,x,y,width))return true;
      if (!this.shallow) return artPaint(name,x,y,width,height);
      ctx.save();ctx.translate(x,y);ctx.scale(1,this.uprightScale);
      const painted=artPaint(name,0,0,width,height);
      ctx.restore();
      return painted;
    }

    mode(value) {
      if (value===undefined) return this.projection.mode;
      this.projection.setMode(value);
      this.game.draw();
      this.controls?.sync();
      return value;
    }

    freeze(value) {
      this.game.s.paused=value;
      this.game.draw();
      this.controls?.sync();
    }

    publicAPI() {
      return {
        art:value=>{if(!['ORIGINAL','STORYBOOK'].includes(value))throw new RangeError('Unknown art pack');this.artPack=value;this.game.draw();this.controls?.sync();},
        mode:value=>this.mode(value),scene:name=>this.scene(name),
        fire:value=>{root.LoftRumbleHeat.fire(value);this.controls?.sync();},combo:value=>this.combo(value),
        stats:()=>root.LoftRumbleStats.summary(this.game.s),
        seek:value=>{root.LoftRumbleSeek.cap(value);this.forecast=null;this.controls?.sync();},
        timeout:value=>this.timeout(value),bossHp:value=>this.bossHp(value),payoff:value=>{root.LoftRumblePayoff.peak(value);this.controls?.sync();},
        tilt:value=>{this.projection.setTilt(Number(value));this.game.draw();this.controls?.sync();},
        debug:value=>{this.debugEnabled=value;this.game.draw();this.controls?.sync();},
        freeze:value=>this.freeze(value),simulation:()=>cloneState(this.game.s),
        enemies:()=>structuredClone(this.enemies()),predict:(...args)=>this.predict(...args),
        place:(id,point)=>{Object.assign(this.game.s.bodies[id],point);this.game.draw();},
        advanceSteps:count=>{for(let index=0;index<count;index++)this.game.step(this.game.C.step);this.game.draw();},
        restore:()=>{if(this.launchState)this.restore(this.launchState);this.game.roster();this.game.draw();},
        replay:()=>{this.scene(this.game.s.cameraScene.name);const start=this.snapshot();this.freeze(false);this.game.fling('chomper',config.replayAngles[this.game.s.cameraScene.name]??config.replayAngle);this.launchState=start;},
        renderInfo:()=>root.LoftRumbleCameraRenderer.info(this),
        status:()=>({mode:this.projection.mode,tilt:this.projection.tilt,scene:this.game.s.cameraScene.name,debug:this.debugEnabled,frozen:this.game.s.paused,artPack:this.artPack,fire:root.LoftRumbleHeat.fire(),combo:this.comboLock,
          timeout:this.game.FEEL.comboTimeout,bossHp:this.game.RT.hp,seek:root.LoftRumbleSeek.cap(),payoff:root.LoftRumblePayoff.peak()}),
      };
    }
  }

  root.LoftRumbleCameraExperiment={create(game){
    const session=new CameraSession(game);
    // The Camera lab panel and its tuning API are for development: only ?lab=1 gets them.
    if(new URLSearchParams(location.search).get('lab')!=='1')return session;
    root.rumbleCamera=session.publicAPI();
    session.controls=root.LoftRumbleCameraControls.mount(root.rumbleCamera);
    return session;
  }};
})(globalThis);
