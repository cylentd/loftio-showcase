export const EFFECT_RANGE = { min: 0, max: 300, step: 10, unit: 100 };
export const EFFECT_DEFAULTS = { particles: 150, leaves: 150, lights: 150 };
export const SCENE_STORAGE_KEY = "loftio.grove.scene.v1";
export const EFFECT_TUNING = { leafCompression: 0.35, maxLightAlpha: 0.92 };
export type EffectKey = keyof typeof EFFECT_DEFAULTS;
export type EffectValues = Record<EffectKey, number>;
