// Pure thumbstick maths. Screen pixels in, walk inputs out. No DOM, no clock.
const clamp01 = (v) => Math.min(Math.max(v, 0), 1);

/**
 * Thumb offset from where the touch began (dx right, dy down, pixels) -> walk reading.
 * x is right and z is forward, each in -1..1 scaled by mag, the same axes as the W A S D keys.
 * knobX, knobY are where to draw the knob, kept inside the radius.
 */
export function stickReading(dx, dy, wasSprint, cfg) {
  const dist = Math.hypot(dx, dy), ratio = dist / cfg.radius;
  const keep = Math.min(dist, cfg.radius), knobX = dist ? dx / dist * keep : 0, knobY = dist ? dy / dist * keep : 0;
  const mag = clamp01((ratio - cfg.dead) / (cfg.full - cfg.dead));
  const sprint = ratio >= cfg.sprintOn || (wasSprint && ratio >= cfg.sprintOff);
  const r = (v) => Math.round(v * cfg.roundTo) / cfg.roundTo;
  if (mag === 0) return { x: 0, z: 0, mag: 0, sprint: false, knobX: r(knobX), knobY: r(knobY) };
  return { x: r(dx / dist * mag), z: r(0 - dy / dist * mag), mag: r(mag), sprint, knobX: r(knobX), knobY: r(knobY) };
}

/** The corner where a new touch starts the stick: lower-left, capped so a wide screen keeps it near the corner. */
export function inStickRegion(x, y, width, height, cfg) {
  const w = Math.min(width * cfg.regionWidthShare, cfg.regionWidthMax);
  const h = Math.min(height * cfg.regionHeightShare, cfg.regionHeightMax);
  return x <= w && y >= height - h;
}
