import { LIGHTING } from "./lighting-data.ts";

export function cycleBlend(time: number): number {
  const phase = ((time % LIGHTING.cycleMs) + LIGHTING.cycleMs) % LIGHTING.cycleMs;
  for (let index = 1; index < LIGHTING.stops.length; index += 1) {
    const [end, value] = LIGHTING.stops[index]!;
    const [start, previous] = LIGHTING.stops[index - 1]!;
    if (phase > end) continue;
    const progress = (phase - start) / (end - start);
    return previous + (value - previous) * progress * progress * (3 - 2 * progress);
  }
  return 0;
}

export function lampFlicker(time: number, index: number): number {
  const elapsed = time - LIGHTING.flickerDelayMs - index * LIGHTING.flickerStaggerMs;
  if (elapsed < 0) return 1;
  const event = Math.floor(elapsed / LIGHTING.flickerIntervalMs);
  const offset = event % 3 * LIGHTING.flickerDurationMs;
  const phase = elapsed % LIGHTING.flickerIntervalMs - offset;
  if (phase < 0 || phase >= LIGHTING.flickerDurationMs) return 1;
  const envelope = Math.sin(phase / LIGHTING.flickerDurationMs * Math.PI);
  return 1 - LIGHTING.flickerDepth * envelope * envelope;
}

export function residentLighting(tint: number, blend: number): number {
  const bounded = Math.max(0, Math.min(1, blend));
  return LIGHTING.channels.reduce<number>((colour, shift, index) => {
    const channel = (tint >> shift) & LIGHTING.channelMax;
    const gain = 1 + (LIGHTING.moonTint[index]! / LIGHTING.channelMax - 1) * bounded;
    return colour | Math.round(channel * gain) << shift;
  }, 0);
}
