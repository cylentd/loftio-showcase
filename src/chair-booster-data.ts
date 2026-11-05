export const CHAIR_CLOUD = {
  width: 256, height: 112,
  lobes: [
    { x: 65, y: 60, radiusX: 58, radiusY: 34 },
    { x: 120, y: 46, radiusX: 59, radiusY: 42 },
    { x: 182, y: 59, radiusX: 54, radiusY: 36 },
    { x: 126, y: 77, radiusX: 109, radiusY: 27 },
  ],
  colors: [[0, "rgba(245, 233, 211, 0.9)"], [0.45, "rgba(222, 216, 209, 0.65)"], [0.78, "rgba(183, 187, 200, 0.22)"], [1, "rgba(183, 187, 200, 0)"]],
  widthRatio: 0.96, overlap: 8, tint: 0xffffff,
  alpha: 0.55, alphaVariation: 0.025, bob: 3, spread: 0.025, periodMs: 6200, phaseMs: 350,
  grainRange: 7, grainMultiplier: 17, channels: 4,
} as const;
