// Prototype defaults: screen dead zone avoids taps firing; sky range fits nearby combat.
export const AIM = { deadPixels: 12, skyRange: 30, rayRange: 160, rayStep: .5, propulsion: .5, dots: 22, dotSize: .32, reticleSize: .8, swipeShare: .32 };
// Clearance exceeds the camera near plane (0.3); sample pitch catches local terrain.
export const CAMERA = { clearance: .6, terrainClearance: 3, sightClearance: 1.5, focusHeight: 1.4, samples: 64, minimum: .8 };
export const POINTER = { yaw: .0055, pitch: .004, minPitch: -.12, maxPitch: 1.25 };
