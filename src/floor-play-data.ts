/** Feel tuning: floor travel is foreshortened; hop height is independent of depth. */
export const FLOOR_PLAY = {
  depthScale: 0.4, flickGain: 0.55, friction: 2.1, bounce: 0.55,
  gravity: 2200, hopSpeed: 420, upwardGain: 0.5, maxTossSpeed: 1150, hopBounce: 0.26, stopHop: 100, stopSpeed: 22,
  radiusRatio: 0.28, screenRadiusRatio: 0.6, maxLean: 0.2, leanSpeed: 900,
  squash: 0.18, impactDecay: 5, maxFrameMs: 64, stepMs: 8, seconds: 1000,
  keyboardX: 800, keyboardY: -250,
  // A toss that comes down inside a footprint it flew over slides out at this speed (px/s) instead of jumping to the edge:
  // 240 px/s crosses the widest centre-table half span (~240 px) in one second, under 4 world px per 16 ms frame.
  slideSpeed: 240, // magic-ok: derived in the comment above
} as const;
