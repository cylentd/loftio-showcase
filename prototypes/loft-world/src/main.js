// Entry: renderer, glow and light-shaft passes, the camera that glides between isles, and the small UI.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {LOOK} from './terrain-look-data.mjs';
import {ambientStep} from './terrain-props.mjs';
import { G } from './glsl.js';
import { buildWorld } from './world.js';
import { createPlay } from './play.js';
import { createAudio } from './audio.js';
import { wirePointerControls } from './pointer-controls.mjs';
import { wireMouseLock } from './mouse-lock.mjs';
import { wireJumpButton } from './jump-controls.mjs';
import { TEAM_COPY } from './teamwork-copy.mjs';
import { TRAVERSAL_COPY } from './traversal-copy.mjs';

const params = new URLSearchParams(location.search);
const canvas = document.querySelector('canvas');
const loadingCover = document.querySelector('[data-world-loading]');
const low = innerWidth < 700 || params.has('low');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('capture') });
renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1.5 : 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = LOOK.exposure;
renderer.info.autoReset=false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.3, 3000);
const world = buildWorld(scene, low);
const VIEWS = world.views;

// Light shafts from the low sun plus a vignette, in one pass over the HDR image.
const SHAFTS = {
  uniforms: { tDiffuse: { value: null }, uSunUv: { value: new THREE.Vector2(0.5, 0.5) }, uStrength: { value: 0 }, uAspect: { value: 1 }, uSpeed: { value: 0 }, uClock: { value: 0 }, uFocus: { value: 0 }, uFocusUv: { value: new THREE.Vector2(0.5, 0.5) }, uLeadUv: { value: new THREE.Vector2(0.5, 0.4) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform vec2 uSunUv; uniform float uStrength; uniform float uAspect; uniform float uSpeed; uniform float uClock; uniform float uFocus; uniform vec2 uFocusUv; uniform vec2 uLeadUv; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec3 col=texture2D(tDiffuse,vUv).rgb;
      // going fast: the edges of the view smear outward and thin streaks flicker past
      vec2 c0=vUv-.5; float r0=length(c0*vec2(uAspect,1.));
      if(uSpeed>.01){
        float amt=.1*uSpeed*smoothstep(.1,.65,r0);
        vec3 b=vec3(0.); for(int i=0;i<8;i++) b+=texture2D(tDiffuse,vUv-c0*amt*float(i)/8.).rgb;
        col=b/8.;
        float a=atan(c0.y,c0.x*uAspect);
        float spoke=hash(vec2(floor(a*38.),floor(uClock*24.)));
        col+=vec3(1.,.95,.88)*step(.94,spoke)*smoothstep(.34,.8,r0)*uSpeed*.07;
      }
      if(!(col.r==col.r)||!(col.g==col.g)||!(col.b==col.b)) col=vec3(0.);
      // slow-motion aim: sharp at the focus point, soft, cooler and darker away from it
      if(uFocus>.01){
        vec2 fd=(vUv-uFocusUv)*vec2(uAspect,1.), ld=(vUv-uLeadUv)*vec2(uAspect,1.);
        float away=smoothstep(.12,.66,min(length(fd),length(ld)+.04));
        float rad=away*uFocus*.0065, turn=hash(vUv*311.)*6.2832;
        vec3 soft=col;
        for(int i=0;i<8;i++){ float a=float(i)*.7854+turn; soft+=texture2D(tDiffuse,vUv+vec2(cos(a)/uAspect,sin(a))*rad*(1.+mod(float(i),2.))).rgb; }
        soft/=9.;
        float grey=dot(soft,vec3(.3,.59,.11));
        soft=mix(soft,mix(vec3(grey),soft,.5)*vec3(.8,.88,1.08),away*.85);
        col=mix(col,soft,uFocus)*(1.-away*uFocus*.38);
      }
      vec2 d=uSunUv-vUv; vec2 stp=d/28.*.9; vec2 uv=vUv+stp*hash(vUv*913.);
      vec3 acc=vec3(0.); float w=1.;
      for(int i=0;i<28;i++){ vec3 s=texture2D(tDiffuse,clamp(uv,0.,1.)).rgb; acc+=min(max(s-vec3(1.1),0.),vec3(3.))*w; w*=.95; uv+=stp; }
      float fall=exp(-length(d*vec2(uAspect,1.))*1.5);
      col+=acc/28.*uStrength*fall;
      // grade: a little more colour, shadows pulled toward indigo, highlights warmed
      float lum=dot(col,vec3(.3,.59,.11));
      col=mix(vec3(lum),col,1.16);
      col+=vec3(.01,.0,.028)*(1.-smoothstep(0.,.3,lum));
      col*=mix(vec3(1.),vec3(1.07,1.,.9),smoothstep(.35,1.5,lum));
      col=max(col,0.);
      vec2 q=vUv-.5; col*=1.-dot(q,q)*.7;
      gl_FragColor=vec4(col,1.);
    }`,
};

const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: low ? 0 : 4 });
const composer = new EffectComposer(renderer, target);
composer.addPass(new RenderPass(scene, camera));
// One bad pixel (not a number, or absurdly bright) makes the glow pass smear it into a flashing square.
// Clean the image before the glow sees it.
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){ vec3 c=texture2D(tDiffuse,vUv).rgb;
      if(!(c.r==c.r)||!(c.g==c.g)||!(c.b==c.b)) c=vec3(0.);
      gl_FragColor=vec4(clamp(c,0.,24.),1.); }`,
}));
const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.5, 0.7, 1.05);
composer.addPass(bloom);
const shafts = new ShaderPass(SHAFTS);
composer.addPass(shafts);
composer.addPass(new OutputPass());

// ---- Shadows: the scene's depth seen from the moon key light, in a square that follows the focus point ----
const SHADOW_SIZE = low ? 1024 : 2048, SHADOW_HALF = 75; // texels across, and half the width of ground covered
const shadowTarget = new THREE.WebGLRenderTarget(SHADOW_SIZE, SHADOW_SIZE);
shadowTarget.depthTexture = new THREE.DepthTexture(SHADOW_SIZE, SHADOW_SIZE);
const lightCam = new THREE.OrthographicCamera(-SHADOW_HALF, SHADOW_HALF, SHADOW_HALF, -SHADOW_HALF, 1, 420);
const toUv = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
const noShadow = G.uShadowMap.value, shadowFocus = new THREE.Vector3();
G.uShadowTexel.value = 1 / SHADOW_SIZE;
function renderShadows(focus) {
  const reveal = G.uRevealOn.value;
  G.uRevealOn.value = 0;
  shadowFocus.set(Math.round(focus.x), focus.y, Math.round(focus.z)); // whole steps, so shadows do not crawl as you move
  lightCam.position.copy(shadowFocus).addScaledVector(G.uMoon.value, 200);
  lightCam.lookAt(shadowFocus);
  lightCam.updateMatrixWorld();
  G.uShadowOn.value = 0; G.uShadowMap.value = noShadow; // never read the map while drawing into it
  world.terrain.meadow.visible = false; // grass receives shadows but is too fine to cast them
  const actors=play.bodies.flatMap(body=>[body.sprite,body.ghost]);
  const actorVisibility=actors.map(actor=>actor.visible);
  actors.forEach(actor=>{actor.visible=false;});
  renderer.setRenderTarget(shadowTarget);
  renderer.clear();
  renderer.render(scene, lightCam);
  renderer.setRenderTarget(null);
  actors.forEach((actor,index)=>{actor.visible=actorVisibility[index];});
  G.uRevealOn.value = reveal;
  world.terrain.meadow.visible = true;
  G.uShadowMat.value.multiplyMatrices(toUv, lightCam.projectionMatrix).multiply(lightCam.matrixWorldInverse);
  G.uShadowMap.value = shadowTarget.depthTexture; G.uShadowOn.value = 1;
}

// ---- Camera rig: glide to a view, drift a little, let a drag orbit around the look-at point ----
const eye = new THREE.Vector3(), look = new THREE.Vector3(), goalEye = new THREE.Vector3(), goalLook = new THREE.Vector3();
const orbit = { yaw: 0, pitch: 0, goalYaw: 0, goalPitch: 0, zoom: 1, goalZoom: 1 };
let viewName = VIEWS[params.get('view')] || params.get('view') === 'play' ? params.get('view') : 'all';

function go(name, snap = false) {
  pointerControls?.cancel(); held.clear(); readKeys();
  viewName = name;
  document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === name)));
  if (name === 'play') { play.start(); play.snapCamera(); return; }
  if (play.active) { mouseLock?.release(); play.stop(); snap = true; camera.fov = camera.aspect < 0.8 ? 58 : 42; camera.updateProjectionMatrix(); }
  const v = VIEWS[name], portrait = camera.aspect < 0.8;
  goalLook.set(...v.t);
  goalEye.set(...v.p);
  if (portrait) goalEye.sub(goalLook).multiplyScalar(name === 'all' ? 1.15 : 1.3).add(goalLook);
  orbit.goalYaw = orbit.goalPitch = 0; orbit.goalZoom = 1;
  if (snap) { eye.copy(goalEye); look.copy(goalLook); orbit.yaw = orbit.pitch = 0; orbit.zoom = 1; }
}

// ---- Explore mode ----
const hudEl = document.querySelector('.play-hud'), countEl = document.querySelector('[data-count]'), flashEl = document.querySelector('.flash');
const audio = createAudio({ muted: params.has('mute') });
const play = createPlay({
  scene, camera, world, sfx: audio,
  hud: {
    charge(ready) { const el=document.querySelector('[data-fling-charge]');el.textContent=TRAVERSAL_COPY[ready?'ready':'spent'];el.dataset.ready=String(ready);el.hidden=true; }, // unused while flings are unlimited
    show(on) { hudEl.hidden = !on; document.body.classList.toggle('playing', on); },
    count(n, total) { countEl.textContent = `${n} / ${total}`; },
    flash(text) { flashEl.textContent = text; flashEl.classList.remove('on'); void flashEl.offsetWidth; flashEl.classList.add('on'); },
    /** Monster health 0..1, or null to hide the bar. */
    boss(frac,name) {
      if(name)document.querySelector('.boss span').textContent=name;
      if (frac === bossShown) return;
      bossShown = frac;
      bossEl.hidden = frac === null;
      if (frac !== null) bossFill.style.width = `${Math.round(frac * 100)}%`;
    },
    /** How ready the special move is, 0..1. */
    special(ready) {
      const on = ready >= 1, step = Math.round(Math.min(Math.max(ready, 0), 1) * 50);
      if (step !== specialStep) { specialStep = step; specialButton.style.setProperty('--ready', String(step / 50)); } // the ring around the button
      if (on !== specialOn) { specialOn = on; specialButton.classList.toggle('cooling', !on); }
    },
  },
});
const bossEl = document.querySelector('.boss'), bossFill = document.querySelector('.boss i'), specialButton = document.querySelector('[data-special]');
for(const input of document.querySelectorAll('[data-creature]')){
  input.addEventListener('input',()=>{for(const e of play.monster.items)e.tuning[input.dataset.creature]=Number(input.value);});
}
let bossShown = null, specialOn = true, specialStep = -1;
specialButton.addEventListener('click', () => play.special());
wireJumpButton(document.querySelector('[data-jump]'),window,play);
document.querySelector('.hint').textContent=TEAM_COPY.hint;
document.querySelector('[data-controls]').textContent=TEAM_COPY.controls;
document.querySelector('[data-jump]').setAttribute('aria-label',TEAM_COPY.jump);
for(const input of document.querySelectorAll('[data-team]')) {
  const key=input.dataset.team;
  input.previousElementSibling.textContent=TEAM_COPY[key];
  input.value=play.support.tuning[key];
  input.addEventListener('input',()=>{play.support.tuning[key]=Number(input.value);});
}
// Keys: WASD walk, Space hop, Shift dive, Q/E or left/right arrows turn the camera.
const held = new Set();
function readKeys() {
  const k = (...codes) => (codes.some((c) => held.has(c)) ? 1 : 0);
  play.input.x = k('KeyD') - k('KeyA');
  play.input.z = k('KeyW', 'ArrowUp') - k('KeyS', 'ArrowDown');
  play.input.turn = k('KeyE', 'ArrowRight') - k('KeyQ', 'ArrowLeft');
  play.input.jumpHeld = held.has('Space');
  play.setDive(k('ShiftLeft', 'ShiftRight') === 1); // Shift: sprint on the ground, dive in the air
}
addEventListener('keydown', (e) => {
  if (!play.active || e.target.matches('input')) return;
  if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) play.input.jump = true; }
  if (e.code === 'KeyF' && !e.repeat) play.special();
  held.add(e.code); readKeys();
});
addEventListener('keyup', (e) => { held.delete(e.code); readKeys(); });
addEventListener('blur', () => { held.clear(); readKeys(); });

// Sound starts on the first tap or key, because browsers block audio before that.
const soundButton = document.querySelector('[data-sound]');
const showSound = () => { soundButton.setAttribute('aria-pressed', String(audio.on)); soundButton.setAttribute('aria-label', audio.on ? 'Sound is on' : 'Sound is off'); };
// Tutorial switch: on for a first visit, then it stays however you left it.
const helpButton = document.querySelector('[data-help]'), HELP_KEY = 'plushValleyTutorial';
const showHelp = (on) => { document.body.classList.toggle('help-on', on); helpButton.setAttribute('aria-pressed', String(on)); };
let helpOn = true;
try { helpOn = localStorage.getItem(HELP_KEY) !== 'off'; } catch { /* private mode: keep the default */ }
if (params.has('capture') && !params.has('help')) helpOn = false;
showHelp(helpOn);
helpButton.addEventListener('click', () => { helpOn = !helpOn; showHelp(helpOn); try { localStorage.setItem(HELP_KEY, helpOn ? 'on' : 'off'); } catch { /* not saved */ } });
addEventListener('keydown', (e) => { if (e.code === 'KeyH' && play.active && !e.repeat) helpButton.click(); });
document.querySelector('[data-exit]').addEventListener('click', () => {
  if (document.documentElement.hasAttribute('data-published-world')) {
    location.assign(new URL('../../?from=valley', location.href).href);
  } else go('all');
});
soundButton.addEventListener('click', (e) => { e.stopPropagation(); audio.toggle(); showSound(); });
for (const type of ['pointerdown', 'keydown']) addEventListener(type, () => audio.boot(), { once: true });
showSound();

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = camera.aspect < 0.8 ? 58 : 42;
  camera.updateProjectionMatrix();
  world.motes.material.uniforms.uPx.value = (h * renderer.getPixelRatio()) / (2 * Math.tan((camera.fov * Math.PI) / 360));
  shafts.uniforms.uAspect.value = camera.aspect;
}
addEventListener('resize', () => { resize(); if (!play.active) go(viewName); });
resize();
let pointerControls;
go(viewName, true);

// The centre-ring aim is a choice (owner, 2026-11-17: "not sure I like the reticle"), remembered between visits.
const aimRing = document.querySelector('[data-aim-ring]'), AIM_KEY = 'plushValleyAimRing';
try { aimRing.checked = localStorage.getItem(AIM_KEY) !== 'off'; } catch { /* private mode: keep the default */ }
aimRing.addEventListener('change', () => {
  if (!aimRing.checked) mouseLock?.release();
  document.body.classList.toggle('aim-drag', !aimRing.checked);
  try { localStorage.setItem(AIM_KEY, aimRing.checked ? 'on' : 'off'); } catch { /* not saved */ }
});
document.body.classList.toggle('aim-drag', !aimRing.checked);
// Mouse lock must be wired first, so that while the mouse is captured it handles the events instead.
const lockNote = document.querySelector('[data-lock-note]');
const mouseLock = params.has('capture') || params.has('nolock') ? null : wireMouseLock({
  canvas, doc: document, play, size: () => ({ width: innerWidth, height: innerHeight }), ring: document.querySelector('.aim-ring'),
  enabled: () => aimRing.checked,
  onChange(on) { play.state.reticle = on; document.body.classList.toggle('mouse-locked', on); lockNote.textContent = on ? 'Esc frees the mouse' : 'Click the game to capture the mouse'; },
});
pointerControls = wirePointerControls({canvas,win:window,play,orbit,size:()=>({width:innerWidth,height:innerHeight})});
canvas.addEventListener('wheel', (e) => { e.preventDefault(); if (play.active) { play.zoom(e.deltaY > 0 ? 1.1 : 0.9); return; } orbit.goalZoom = THREE.MathUtils.clamp(orbit.goalZoom * (e.deltaY > 0 ? 1.08 : 0.92), 0.55, 1.5); }, { passive: false });
addEventListener('keydown', (e) => {
  if (play.active) return;
  const names = Object.keys(VIEWS), i = names.indexOf(viewName);
  if (e.key === 'ArrowRight') go(names[(i + 1) % names.length]);
  if (e.key === 'ArrowLeft') go(names[(i + names.length - 1) % names.length]);
});
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => go(b.dataset.view)));

// ---- Tune panel ----
const tune = { glow: LOOK.glow, mist: LOOK.mist, shafts: LOOK.shafts, wind: LOOK.wind, motes: 1 };
document.querySelectorAll('[data-tune]').forEach((input) => {
  input.value = tune[input.dataset.tune];
  input.addEventListener('input', () => { tune[input.dataset.tune] = Number(input.value); });
});

const clock = new THREE.Clock(), sunWorld = new THREE.Vector3(), forward = new THREE.Vector3(), off = new THREE.Vector3();
const state = { frames: 0, time: 0, go, ready: true, play, terrainProps:world.terrainProps };
state.audioState = () => audio.debug();
state.focusInfo = () => ({strength:shafts.uniforms.uFocus.value,x:shafts.uniforms.uFocusUv.value.x,y:shafts.uniforms.uFocusUv.value.y});
state.podTargets = () => play.pods.targets;
state.rampPoints = world.ramps.at(-1).points; // the long bridge, for scripted checks
window.loftWorld = state;
let time = Number(params.get('t') ?? 0);

function frame() {
  renderer.info.reset();
  const dt = Math.min(clock.getDelta(), 0.1), still = reduced.matches;
  time = ambientStep(time,dt,still).time;
  G.uTime.value = time;
  G.uFog.value = 0.0065 * tune.mist;
  G.uWind.value = tune.wind;
  bloom.strength = tune.glow;
  world.motes.material.uniforms.uAmount.value = tune.motes;
  world.update(time);

  shafts.uniforms.uClock.value = time;
  world.terrain.focus.copy(play.active ? play.lead.pos : look);
  mouseLock?.update();
  if (play.active) {
    play.update(ambientStep(time,dt,still).dt, time);
    world.woodland.update(dt,still);
    const s = play.state, rush = THREE.MathUtils.smoothstep(s.speed, 30, 70) + (s.diving ? 0.25 : 0);
    shafts.uniforms.uSpeed.value += (Math.min(rush, 1) - shafts.uniforms.uSpeed.value) * Math.min(dt * 4, 1);
  } else {
    shafts.uniforms.uSpeed.value = 0;
    viewCamera(dt, still);
  }

  // where the sun sits on screen, and whether we face it
  sunWorld.copy(camera.position).addScaledVector(G.uSun.value, 1000).project(camera);
  camera.getWorldDirection(forward);
  const facing = THREE.MathUtils.smoothstep(forward.dot(G.uSun.value), 0.2, 0.75);
  shafts.uniforms.uSunUv.value.set(sunWorld.x * 0.5 + 0.5, sunWorld.y * 0.5 + 0.5);
  shafts.uniforms.uStrength.value = tune.shafts * facing;

  // slow-motion aim keeps the thing you are aiming at sharp
  const focus = play.active ? play.state.focus || 0 : 0;
  shafts.uniforms.uFocus.value = still ? 0 : focus;
  if (focus > 0.01) {
    sunWorld.copy(play.state.focusPoint || play.lead.pos).project(camera);
    shafts.uniforms.uFocusUv.value.set(sunWorld.x * 0.5 + 0.5, sunWorld.y * 0.5 + 0.5);
    sunWorld.copy(play.lead.pos).project(camera);
    shafts.uniforms.uLeadUv.value.set(sunWorld.x * 0.5 + 0.5, sunWorld.y * 0.5 + 0.5);
  }
  G.uViewEye.value.copy(camera.position);
  if (!params.has('noshadow')) renderShadows(world.terrain.focus);
  composer.render();
  if (loadingCover?.isConnected) dispatchEvent(new Event('world-first-frame'));
  state.frames++; state.time = time; state.render={...renderer.info.render,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures};
  requestAnimationFrame(frame);
}

// ---- Opening: one slow flight over the valley's four places, ending on the wide view. Any click or key skips it. ----
const INTRO_SECONDS = 15;
const intro = { on: false, t: 0, eyes: null, looks: null };
function startIntro() {
  const stops = [{ p: [-150, 62, 150], t: [-40, 8, 20] }, VIEWS.camp, VIEWS.loft, VIEWS.cafe, VIEWS.glade, VIEWS.all];
  const lifted = (v, i) => (i === 0 || i === stops.length - 1 ? new THREE.Vector3(...v.p)
    : new THREE.Vector3(...v.p).sub(new THREE.Vector3(...v.t)).multiplyScalar(2.1).add(new THREE.Vector3(...v.t)).add(new THREE.Vector3(0, 14, 0)));
  intro.eyes = new THREE.CatmullRomCurve3(stops.map(lifted), false, 'centripetal');
  intro.looks = new THREE.CatmullRomCurve3(stops.map((v) => new THREE.Vector3(...v.t)), false, 'centripetal');
  intro.on = true; intro.t = 0;
  document.body.classList.add('intro');
}
function endIntro() {
  if (!intro.on) return;
  intro.on = false;
  document.body.classList.remove('intro');
  go('all', true);
}
for (const type of ['pointerdown', 'keydown']) addEventListener(type, () => endIntro());
if (viewName === 'all' && !params.has('capture') && !params.has('view') && !params.has('nointro') && !reduced.matches) startIntro();

function viewCamera(dt, still) {
  if (intro.on) {
    intro.t = Math.min(intro.t + dt / INTRO_SECONDS, 1);
    const f = intro.t * intro.t * (3 - 2 * intro.t); // ease in at the start and out at the end
    intro.eyes.getPoint(f, camera.position); intro.looks.getPoint(f, look);
    camera.position.y = Math.max(camera.position.y, world.terrain.heightAt(camera.position.x, camera.position.z) + 20);
    camera.lookAt(look);
    if (intro.t >= 1) endIntro();
    return;
  }
  const k = 1 - Math.exp(-dt * 1.7);
  eye.lerp(goalEye, k); look.lerp(goalLook, k);
  orbit.yaw += (orbit.goalYaw - orbit.yaw) * k * 2; orbit.pitch += (orbit.goalPitch - orbit.pitch) * k * 2; orbit.zoom += (orbit.goalZoom - orbit.zoom) * k * 2;
  const driftYaw = still ? 0 : Math.sin(time * 0.09) * 0.07, driftY = still ? 0 : Math.sin(time * 0.13) * 0.6;
  off.subVectors(eye, look).multiplyScalar(orbit.zoom);
  const dist = off.length(), yaw = Math.atan2(off.x, off.z) + orbit.yaw + driftYaw;
  const pitch = THREE.MathUtils.clamp(Math.asin(off.y / dist) + orbit.pitch, -0.35, 1.2);
  camera.position.set(look.x + Math.sin(yaw) * Math.cos(pitch) * dist, look.y + Math.sin(pitch) * dist + driftY, look.z + Math.cos(yaw) * Math.cos(pitch) * dist);
  camera.lookAt(look);
}
requestAnimationFrame(frame);
