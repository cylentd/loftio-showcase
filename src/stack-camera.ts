export type TowerBounds = { top: number; bottom: number };
export function towerFrame(bounds: TowerBounds | null, baseScale: number, viewportHeight: number, worldHeight: number) {
  const normal = { scale: baseScale, offsetY: (viewportHeight - worldHeight * baseScale) / 2 };
  if (!bounds) return normal;
  const margin = STACK.cameraMargin;
  if (bounds.top * baseScale + normal.offsetY >= margin && bounds.bottom * baseScale + normal.offsetY <= viewportHeight - margin) return normal;
  const scale = Math.min(baseScale, Math.max(1, viewportHeight - margin * 2) / Math.max(1, bounds.bottom - bounds.top));
  const offsetY = Math.max(margin - bounds.top * scale, Math.min(viewportHeight - margin - bounds.bottom * scale, normal.offsetY));
  return { scale, offsetY };
}
import { STACK } from "./stack-data.ts";
