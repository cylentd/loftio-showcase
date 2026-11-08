/** Plush piles: the full six-resident cast, forgiving placement, brief settling wobble. */
export const STACK = {
  maxResidents: 6, supportHeight: 0.74, catchWidth: 0.48, catchHeight: 0.28,
  minTarget: 36, wobbleMs: 700, wobbleCycles: 2, wobble: 0.035, squash: 0.1,
  depthStep: 0.01, toppleSpeed: 180, keyboardReach: 240,
  cameraMargin: 40, cameraFollowMs: 280,
  airMaxSpeed: 300, airWidth: 0.45, airDepth: 54,
} as const;
