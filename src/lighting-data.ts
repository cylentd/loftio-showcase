export const LIGHTING_MODES = ["cycle", "lamplit", "dusk", "moonlit"] as const;
export type LightingMode = typeof LIGHTING_MODES[number];
export const LIGHTING = {
  artUrl: "art/moonlit.jpg",
  cycleMs: 240000,
  transitionMs: 1800,
  stops: [[0, 0], [30000, 0], [70000, 0.5], [95000, 0.5], [135000, 1], [185000, 1], [240000, 0]],
  phases: { lamplit: 0, dusk: 0.5, moonlit: 1 },
  moonTint: [132, 155, 197],
  channelMax: 255,
  glowDefaults: { lamplit: 20, dusk: 300, moonlit: 0 },
  channels: [16, 8, 0],
  flickerIntervalMs: 23000,
  flickerStaggerMs: 4700,
  flickerDelayMs: 11000,
  flickerDurationMs: 720,
  flickerDepth: 0.18,
  flickerShade: 0x18243c,
  flickerRadius: 0.65,
  flickerShadeGain: 1.3,

} as const;
