// The day cycle's numbers. Every value that varies with the time of day lives in a keyframe here and nowhere else.
// t: 0 = midnight, .25 = dawn, .5 = noon, .75 = dusk. The dusk keyframe is the owner-approved look (the old literals
// of glsl.js, sky.js and main.js); night, dawn and noon are first-pass guesses for the main thread to tune.
import { LOOK } from './terrain-look-data.mjs';

export const DAY = {
  lengthSeconds: 1200, // one full day of the clock, in seconds (owner: slow enough to live in)
  startT: 0.75, // the valley opens at dusk
  handoverBand: 0.6, // light-power gap (0..1) under which the shadow fades out, so the caster swap never pops. Was .25: the swap now
                     // happens in the short golden-hour-to-dusk span, where the powers cross fast, so the fade needs a wider band.
                     // Must stay at or under dusk's gap (.7), or the approved dusk shadows weaken.
};

/** Order of keyframes around the clock; the last wraps to the first. */
// gold (late afternoon) keeps the afternoon a daytime look: without it, 3 pm was half dusk, with lamps on and a faint aurora.
export const KEY_ORDER = [['night', 0], ['dawn', 0.25], ['noon', 0.5], ['gold', 0.6], ['dusk', 0.75]]; // gold was .66: evening fell in under 2 minutes of a 20-minute day and felt sudden (owner, 2026-11-18)

/** State key to its shader uniform name and GLSL type, one table for the declarations, the G entries and the per-frame write. */
export const DAY_UNIFORMS = {
  sunDir: ['uSun', 'vec3'], moonDir: ['uMoon', 'vec3'], moonSpotDir: ['uMoonSpot', 'vec3'], // moonSpotDir: where the moon is drawn (moonDir is where its light comes from)
  sunCol: ['uSunCol', 'vec3'], moonCol: ['uMoonCol', 'vec3'],
  ambLo: ['uAmbLo', 'vec3'], ambHi: ['uAmbHi', 'vec3'],
  skyZen: ['uSkyZen', 'vec3'], skyMid: ['uSkyMid', 'vec3'], skyLow: ['uSkyLow', 'vec3'], skyHor: ['uSkyHor', 'vec3'],
  skyAway: ['uSkyAway', 'vec3'], skyGlow: ['uSkyGlow', 'vec3'], sunHalo: ['uSunHalo', 'vec3'],
  cloudLo: ['uCloudLo', 'vec3'], cloudHi: ['uCloudHi', 'vec3'], cloudUnder: ['uCloudUnder', 'vec3'],
  seaTrough: ['uSeaTrough', 'vec3'], seaBody: ['uSeaBody', 'vec3'], seaTop: ['uSeaTop', 'vec3'], seaGlow: ['uSeaGlow', 'vec3'],
  fogScale: ['uFogScale', 'float'], stars: ['uStars', 'float'], aurora: ['uAurora', 'float'], moonDisc: ['uMoonDisc', 'float'], sunDisc: ['uSunDisc', 'float'],
};

export const DAY_KEYS = {
  dusk: {
    sunDir: [-0.38, 0.13, -1], moonDir: [0.45, 0.75, 0.55], moonSpotDir: [-0.52, 0.46, -0.72], // as the old sky.js moon spot and the old G.uSun and G.uMoon; normalised on use
    sunCol: [0.65, 0.46, 0.32], moonCol: [0.38, 0.5, 0.76], ambLo: [0.085, 0.05, 0.11], ambHi: [0.085, 0.12, 0.32],
    skyZen: [0.004, 0.009, 0.032], skyMid: [0.018, 0.035, 0.09], skyLow: [0.065, 0.085, 0.14], skyHor: [0.24, 0.19, 0.19],
    skyAway: [0.035, 0.075, 0.2], skyGlow: [0.12, 0.08, 0.12], sunHalo: [0.24, 0.15, 0.2],
    cloudLo: [0.025, 0.04, 0.07], cloudHi: [0.12, 0.1, 0.16], cloudUnder: [0.05, 0.035, 0.13],
    seaTrough: [0.012, 0.012, 0.06], seaBody: [0.085, 0.06, 0.2], seaTop: [0.3, 0.17, 0.36], seaGlow: [1.3, 0.5, 0.22],
    fogScale: 0.8, stars: 1, aurora: 1, moonDisc: 1, sunDisc: 1, mist: 1, // sunDisc: the sun drawn in the sky (0 hides it); mist: multiplier on the panel's mist density (1 = the approved dusk)
    lampGain: 1, glowGain: 1, exposure: LOOK.exposure, shafts: 1, // lamp and glow are multipliers on the existing gains; shafts on the panel slider
    sunPower: 0.3, moonPower: 1, shadowMax: 1, // which light casts shadows (the stronger one) and how strongly at most
  },
  night: {
    sunDir: [0, -0.6, 0.2], moonDir: [0.3, 0.8, 0.5], moonSpotDir: [-0.15, 0.85, -0.2], // the moon is high at midnight
    sunCol: [0, 0, 0], moonCol: [0.3, 0.42, 0.8], ambLo: [0.05, 0.04, 0.1], ambHi: [0.06, 0.1, 0.3],
    skyZen: [0.003, 0.006, 0.025], skyMid: [0.012, 0.025, 0.075], skyLow: [0.03, 0.05, 0.11], skyHor: [0.06, 0.08, 0.16],
    skyAway: [0.025, 0.055, 0.17], skyGlow: [0.02, 0.02, 0.05], sunHalo: [0, 0, 0],
    cloudLo: [0.02, 0.03, 0.06], cloudHi: [0.05, 0.06, 0.11], cloudUnder: [0.03, 0.03, 0.1],
    seaTrough: [0.008, 0.01, 0.05], seaBody: [0.04, 0.05, 0.16], seaTop: [0.1, 0.12, 0.3], seaGlow: [0.15, 0.2, 0.4],
    fogScale: 0.8, stars: 1, aurora: 1, moonDisc: 1, sunDisc: 0, mist: 1.26, // 65% on the slider when the panel is at its 50% default (owner, 2026-11-18: more atmospheric; at night you should not see far)
    lampGain: 1, glowGain: 1, exposure: LOOK.exposure, shafts: 0,
    sunPower: 0, moonPower: 1, shadowMax: 1,
  },
  dawn: {
    sunDir: [0.38, 0.13, 1], moonDir: [-0.3, 0.3, -0.6], moonSpotDir: [0.75, 0.2, 0.3], // the moon sets low, well to the side of the rising sun; the sun comes up opposite to where it sets
    sunCol: [0.85, 0.55, 0.4], moonCol: [0.15, 0.2, 0.3], ambLo: [0.12, 0.08, 0.12], ambHi: [0.18, 0.2, 0.34],
    skyZen: [0.03, 0.06, 0.16], skyMid: [0.12, 0.12, 0.25], skyLow: [0.4, 0.28, 0.3], skyHor: [0.8, 0.5, 0.35],
    skyAway: [0.1, 0.14, 0.3], skyGlow: [0.2, 0.1, 0.08], sunHalo: [0.5, 0.3, 0.2],
    cloudLo: [0.12, 0.1, 0.14], cloudHi: [0.5, 0.32, 0.3], cloudUnder: [0.15, 0.1, 0.2],
    seaTrough: [0.05, 0.04, 0.1], seaBody: [0.25, 0.17, 0.3], seaTop: [0.7, 0.45, 0.5], seaGlow: [1.4, 0.7, 0.4],
    fogScale: 0.8, stars: 0.15, aurora: 0.1, moonDisc: 0.3, sunDisc: 1, mist: 0.8, // a little morning haze, thinner than dusk so the pink sky does not swallow the trees
    lampGain: 0.35, glowGain: 0.7, exposure: 1.05, shafts: 1,
    sunPower: 0.7, moonPower: 0.1, shadowMax: 0.7, // gap .6 = the handover band, so dawn shadows keep their full .7
  },
  gold: { // golden hour: a low warm sun, peach horizon under a still-blue sky, long shadows, no stars yet (first pass, 2026-11-18)
    sunDir: [-0.3, 0.42, -0.8], moonDir: [0.3, 0.2, 0.6], moonSpotDir: [-0.6, 0.3, -0.7], // hidden; a little under its dusk spot, so it rises as it fades in
    sunCol: [0.95, 0.68, 0.42], moonCol: [0.05, 0.07, 0.12], ambLo: [0.15, 0.12, 0.13], ambHi: [0.2, 0.25, 0.42],
    skyZen: [0.05, 0.13, 0.4], skyMid: [0.13, 0.24, 0.52], skyLow: [0.4, 0.42, 0.55], skyHor: [0.85, 0.6, 0.4],
    skyAway: [0.14, 0.26, 0.55], skyGlow: [0.2, 0.12, 0.08], sunHalo: [0.5, 0.32, 0.2],
    cloudLo: [0.3, 0.3, 0.42], cloudHi: [0.9, 0.65, 0.5], cloudUnder: [0.35, 0.3, 0.45],
    seaTrough: [0.1, 0.15, 0.35], seaBody: [0.3, 0.35, 0.55], seaTop: [0.8, 0.6, 0.55], seaGlow: [1.3, 0.7, 0.35],
    fogScale: 0.85, stars: 0, aurora: 0, moonDisc: 0, sunDisc: 1, mist: 0.5, // moonDisc 0: the moon sits at one fixed spot in the sky, close to the afternoon sun's path, so it stays hidden until evening
    lampGain: 0.15, glowGain: 0.5, exposure: 0.95, shafts: 1,
    sunPower: 0.9, moonPower: 0.1, shadowMax: 0.85,
  },
  noon: {
    sunDir: [0.25, 0.9, 0.3], moonDir: [-0.3, -0.6, 0.5], moonSpotDir: [0.3, -0.6, 0.1], // hidden, under the horizon
    // Tuned 2026-11-18 after the first pass read as milky white: thinner mist, a deeper blue sky, a dimmer warmer sun and
    // darker ambient so greens stay saturated and the sand is not blown out.
    sunCol: [0.82, 0.74, 0.58], moonCol: [0, 0, 0], ambLo: [0.16, 0.15, 0.14], ambHi: [0.2, 0.3, 0.48],
    skyZen: [0.05, 0.17, 0.5], skyMid: [0.11, 0.28, 0.62], skyLow: [0.25, 0.43, 0.72], skyHor: [0.48, 0.62, 0.8],
    skyAway: [0.14, 0.32, 0.68], skyGlow: [0.1, 0.08, 0.04], sunHalo: [0.4, 0.35, 0.25],
    cloudLo: [0.42, 0.5, 0.64], cloudHi: [0.85, 0.86, 0.88], cloudUnder: [0.45, 0.52, 0.66],
    seaTrough: [0.12, 0.25, 0.5], seaBody: [0.3, 0.5, 0.75], seaTop: [0.7, 0.82, 0.92], seaGlow: [1.1, 1, 0.85],
    fogScale: 0.85, stars: 0, aurora: 0, moonDisc: 0, sunDisc: 1, mist: 0.2, // clear midday air (was .35; owner, 2026-11-18: mist at noon makes it read as morning). Less haze over the far grass edge is the price
    lampGain: 0, glowGain: 0.35, exposure: 0.85, shafts: 0.5,
    sunPower: 1, moonPower: 0, shadowMax: 0.9,
  },
};
