import { TACTILE } from "./tactile-constants.ts";

export function touchPose(pressure: number) {
  const amount = Math.max(0, Math.min(1, pressure));
  return { sx: 1 + TACTILE.width * amount, sy: 1 - TACTILE.height * amount };
}

export function vibrate(kind: "touch" | "release" | "open" | "reveal" | "cancel", reduced: boolean,
  device: { vibrate?: (pattern: number | number[]) => boolean } = globalThis.navigator ?? {}): boolean {
  if (reduced && kind !== "cancel" || !device.vibrate) return false;
  const pattern = kind === "cancel" ? 0 : TACTILE[kind];
  try { return device.vibrate(Array.isArray(pattern) ? [...pattern] : pattern as number); }
  catch { return false; }
}
