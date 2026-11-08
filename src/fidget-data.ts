/** World-pixel tuning for a soft, short-lived tabletop toy feel. */
export const FIDGET = {
  left: 300, right: 1770, top: 100, floor: 1020,
  sampleMs: 100, staleMs: 80, flickScreenSpeed: 480, maxSpeed: 2300,
  gravity: 1700, bounce: 0.68, drag: 0.36, floorDrag: 5,
  stopSpeed: 65, stepMs: 8, maxFrameMs: 64, seconds: 1000,
  impactDecay: 6, squash: 0.22, spinScale: 0.004, returnMs: 8000,
} as const;
