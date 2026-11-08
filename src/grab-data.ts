/** Short, damped deformation: responsive to a finger without delaying placement. */
export const GRAB = {
  gain: 2.4, limit: 0.38, stiffness: 210, damping: 22,
  stretch: 0.65, compress: 0.35, lean: 0.45,
  catchSquash: 0.18, catchMs: 180, liftMs: 220,
  stepMs: 8, maxFrameMs: 64, seconds: 1000,
} as const;
