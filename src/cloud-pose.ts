import { CHAIR_CLOUD } from "./chair-booster-data.ts";

export function cloudPose(time: number, phase: number) {
  const angle = time / (CHAIR_CLOUD.periodMs + phase * CHAIR_CLOUD.phaseMs) * Math.PI * 2;
  return {
    lift: Math.sin(angle) * CHAIR_CLOUD.bob,
    spread: 1 + Math.sin(angle / 2) * CHAIR_CLOUD.spread,
    alpha: CHAIR_CLOUD.alpha + Math.sin(angle) * CHAIR_CLOUD.alphaVariation,
  };
}
