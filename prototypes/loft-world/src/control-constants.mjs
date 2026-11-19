// Prototype defaults: screen dead zone avoids taps firing; sky range fits nearby combat.
export const AIM = { deadPixels: 12, skyRange: 30, rayRange: 160, rayStep: .5, propulsion: .5, dots: 22, dotSize: .32, reticleSize: .8, swipeShare: .32, renderOrder: 999 }; // renderOrder: drawn after every scene object (owner: aim marker visible over scenery, 2026-11-17)
// kick: upward speed after a tree bank (owner, 2026-11-18), double foliage's 10; about 9 units of height, just under Pop's 11.
export const TREE_BANK = { snapRadius: 1.85, surfaceBias: .55, propulsion: .85, reachShare: .9, previewTime: .16, kick: 20, color: '#b9f5ac' };
// Clearance exceeds the camera near plane (0.3); sample pitch catches local terrain.
export const CAMERA = { clearance: .6, terrainClearance: 3, sightClearance: 1.5, focusHeight: 1.4, samples: 64, minimum: .8 };
export const POINTER = { yaw: .0055, pitch: .004, minPitch: -.12, maxPitch: 1.25 };
