import { BUBBLE_LAYOUT } from "./bubble-data.ts";

export function bubbleMetrics(height: number): { width: number; scale: number } {
  return {
    width: Math.max(BUBBLE_LAYOUT.minimumWidth, Math.min(BUBBLE_LAYOUT.maximumWidth, height * BUBBLE_LAYOUT.widthPerHeight)),
    scale: Math.max(BUBBLE_LAYOUT.minimumScale, Math.min(BUBBLE_LAYOUT.maximumScale, height / BUBBLE_LAYOUT.referenceHeight)),
  };
}
