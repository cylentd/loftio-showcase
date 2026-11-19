// Explore mode: walk, hop and fling residents across the valley; bounce off ground, trunks, pads and rocks.
// This file only assembles the pieces. The behaviour lives in the play-*.js modules, each reading the shared context `c`
// that play-setup.js builds: play-update.js (a frame), play-step.js (airborne physics), play-walk.js (walking),
// play-team.js and play-buddy.js (Chomper), play-camera.js, play-wave.js (Pop and Skyfall), play-effects.js, play-api.js.
import { createContext, buildResidentsAndEffects, buildCreatures, buildContacts } from './play-setup.js';
import { createAimApi, createViewApi, createLifeApi } from './play-api.js';
import { updateFrame } from './play-update.js';

export { PLAY } from './play-constants.js';

export function createPlay({ scene, camera, world, hud, sfx, low }) {
  const c = createContext({ scene, camera, world, hud, sfx, low });
  buildResidentsAndEffects(c);
  buildCreatures(c);
  buildContacts(c);
  const { state, lead, input, monster, bodies, support, neighbours, P, pods, driftShots, fader, wisps, trail } = c;
  return Object.assign({
    state, lead, input, monster, bodies, support, neighbours, tuning: P, pods, driftShots, fader,
    get active() { return state.active; },
    get collected() { return wisps.collected; },
    total: wisps.list.length,
    get trail() { return trail.points; }, // read by the QA scripts: is the flight trail still drawn?
    update(dt, time) { updateFrame(c, dt, time); },
  }, createAimApi(c), createViewApi(c), createLifeApi(c));
}
