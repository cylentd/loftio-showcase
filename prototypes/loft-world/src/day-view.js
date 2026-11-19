// Runs the day clock and writes dayState into the shared world uniforms, the exposure and the shadow caster every frame.
import { G } from './glsl.js';
import { LOOK } from './terrain-look-data.mjs';
import { DAY, DAY_UNIFORMS } from './day-data.mjs';
import { dayState, stepClock, startClock } from './day-model.mjs';

/** slider: the "time of day" range input (or null). The slider sets the time and stops the clock. */
export function createDay({ params, slider, renderer }) {
  const day = { ...startClock(params), state: null };
  slider?.addEventListener('input', () => { day.t = Number(slider.value); day.running = false; });
  /** dt in seconds, already zero while the pause window is open. */
  day.update = (dt) => {
    if (day.running) day.t = stepClock(day.t, dt, DAY.lengthSeconds);
    const s = day.state = dayState(day.t);
    if (slider && document.activeElement !== slider) slider.value = day.t;
    for (const [key, [name]] of Object.entries(DAY_UNIFORMS)) {
      const u = G[name];
      if (Array.isArray(s[key])) u.value.set(...s[key]); else u.value = s[key];
    }
    G.uShadowDir.value.copy(G[s.shadowCaster === 'sun' ? 'uSun' : 'uMoon'].value);
    G.uCasterMoon.value = s.shadowCaster === 'moon' ? 1 : 0;
    G.uShadowStrength.value = s.shadowStrength;
    G.uLampGain.value = G.uLampBase.value * s.lampGain;
    G.uGlow.value = LOOK.emission * s.glowGain;
    renderer.toneMappingExposure = s.exposure;
  };
  day.update(0);
  return day;
}
