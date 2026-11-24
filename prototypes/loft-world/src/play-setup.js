// Builds the context `c` that every play-*.js function reads: the world, the residents, the effects and the shared scratch vectors.
import * as THREE from 'three';
import { createToys } from './toys.js';
import { createPods } from './pods.js';
import { createLife } from './life.js';
import { createEnemies, createNeighbours } from './creature-runtime.js';
import { PLAY } from './play-constants.js';
import { createAim } from './aim-view.js';
import { createFader } from './fade-view.js';
import { createResidents } from './resident-view.js';
import { createCollisions } from './play-collisions.js';
import { createTraversal } from './traversal-runtime.mjs';
import { createDriftShots } from './drift-shots.js';
import { createCounterCue, sparkTexture } from './counter-cue.js';
import { createGround } from './play-ground.js';
import { glowTexture, createWisps, createTrail, createRings } from './play-effects.js';
import { createTeamSupport } from './play-team.js';
import { createWave, slamHit } from './play-wave.js';
import { chainBounce } from './play-step.js';

function createState(P) {
  return { active: false, diving: false, speed: 0, shake: 0, pop: 0, yaw: Math.PI, pitch: P.camPitch, zoom: 1, camIdle: 9, aim: null, skyfalls: 0, cool: 0, jumpWant: 0, charging: false, charge: 0, chain: 0, freeze: 0, slow: 0, popCool: 0,
    traversal: null }; // flings are unlimited again (owner, 2026-11-17): the charge gate is off, so nothing reads state.traversal
}

/** Inputs, state and scratch vectors. `ret` is the combo return in progress, if any. */
export function createContext({ scene, camera, world, hud, sfx, low }) {
  const P = PLAY, v = () => new THREE.Vector3();
  const c = { scene, camera, world, hud, sfx, low, P, glow: glowTexture(), H: world.terrain.heightAt, lake: world.lake, ret: null,
    input: { x: 0, z: 0, turn: 0, jump: false, jumpHeld: false, pad: false }, // pad: the touch stick is steering (x, z are then analog)
    state: createState(P), obstacles: [],
    tmp: v(), tmp2: v(), right: v(), fwd: v(), wish: v(), focusSpot: v(), // focusSpot is kept between frames, so it is never a scratch vector
    m4: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(),
    goal: v(), camPos: v(), look: v(), focusAt: v(),
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)') };
  return Object.assign(c, createGround(c));
}

/** Painted residents with a round collider, and what they bump into: toys, pods, wisps, the trail and the rings. */
export function buildResidentsAndEffects(c, leadArt) {
  const { scene, world, sfx, glow, state, P } = c;
  c.bodies = createResidents(scene, leadArt);
  [c.lead, c.buddy] = c.bodies;
  if (leadArt) addEventListener('pagehide', function releaseSavedArt(event) {
    if (event.persisted) return;
    c.lead.textures.idle.dispose();
    c.lead.ghostTextures.idle.dispose();
    removeEventListener('pagehide', releaseSavedArt);
  });
  for (const b of c.bodies) b.traversal = createTraversal(b);
  c.buddyTarget = { alive: true, pos: c.buddy.pos, radius: P.buddyRadius, id: 'chomper', at: 0 };
  c.toys = createToys({ scene, world, sfx, glow });
  c.fx = { pop(k) { state.pop = Math.max(state.pop, k); } };
  c.pods = createPods({ scene, strings: world.podStrings, sfx, burst: c.toys.burst });
  c.life = createLife({ scene, world, low: c.low, burst: c.toys.burst, sfx });
  c.wisps = createWisps(c);
  c.trail = createTrail(c);
  Object.assign(c, createRings(c));
  /** Everything a fling can lock on to: monsters, Chomper, and pods that are up. */
  c.lockable = () => [...c.monster.states, ...(c.lead.grounded ? [] : [c.buddyTarget]), ...c.pods.targets.filter((t) => t.alive)];
}

/** Monsters, neighbours, drift shots, the counter cue and Chomper's support. */
export function buildCreatures(c) {
  const { scene, world, sfx, toys, puff, hud, state, glow, lead } = c;
  c.monster = createEnemies({ scene, world, sfx, toys, puff, hud: { ...hud, shake(k) { state.shake = Math.max(state.shake, k); } } });
  c.driftShots = createDriftShots({ scene, glow, lead, monster: c.monster, world, floorAt: c.floorAt, puff, sfx });
  c.neighbours = createNeighbours({ scene, world });
  c.counterCue = createCounterCue({ scene, texture: sparkTexture(), monster: c.monster, reducedMotion: () => c.reducedMotion.matches });
  c.support = createTeamSupport(c);
}

/** The aim, the see-through fader, the collisions and the shockwave. */
export function buildContacts(c) {
  const { scene, camera, world, lake, lead, state, input, sfx, puff, hud, P, support } = c;
  const canopies = world.canopies.map(([x, y, z, radius], index) => ({ id: `canopy:${index}`, pos: { x, y, z }, radius: radius * P.canopySize }));
  c.fader = createFader({ scene, fadeables: world.fadeables });
  c.aim = createAim({ scene, camera, lead, state, floorAt: c.floorAt, radius: P.radius, speed: P.flingSpeed, glow: c.glow, props: world.terrainProps, canopies, lockable: c.lockable });
  Object.assign(c, createCollisions({ world, lake, lead, state, input, support: { landed: () => support.landed() }, sfx, puff, hud, chainBounce: (b, hard) => chainBounce(c, b, hard),
    splash: (p, hard) => { c.toys.burst(p, '#dff2ff', 14 + Math.min(hard, 30) * .6, 9, 7 + hard * .25); },
    slam: (b, fall) => slamHit(c, b, fall) })); // a Skyfall onto the ground sends a shockwave out along it
  c.wave = createWave(scene);
}
