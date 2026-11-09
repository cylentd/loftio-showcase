export type ResidentMotion = 'walk' | 'hop' | 'float';
const FLOATING = new Set(['cloud', 'little-ghost', 'moth']);
const HOPPING = new Set(['bunny', 'frog', 'tiny-dragon']);
export const motionFor = (creature: string): ResidentMotion => FLOATING.has(creature) ? 'float' : HOPPING.has(creature) ? 'hop' : 'walk';
