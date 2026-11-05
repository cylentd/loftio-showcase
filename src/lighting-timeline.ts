import { LIGHTING, type LightingMode } from "./lighting-data.ts";
import { cycleBlend } from "./lighting-model.ts";

export class LightingTimeline {
  blend = 0;
  elapsed = 0;
  private mode: LightingMode = "cycle";
  private transition: number = LIGHTING.transitionMs;
  private from = 0;

  update(delta: number, mode: LightingMode, frozen: boolean): number {
    if (mode !== this.mode) {
      this.mode = mode;
      this.from = this.blend;
      this.transition = 0;
      this.elapsed = 0;
      if (frozen && mode !== "cycle") {
        this.transition = LIGHTING.transitionMs;
        this.blend = LIGHTING.phases[mode];
      }
    }
    if (frozen) return this.blend;
    this.elapsed += delta;
    this.transition = Math.min(LIGHTING.transitionMs, this.transition + delta);
    const target = mode === "cycle" ? cycleBlend(this.elapsed) : LIGHTING.phases[mode];
    const progress = this.transition / LIGHTING.transitionMs;
    this.blend = this.from + (target - this.from) * progress * progress * (3 - 2 * progress);
    return this.blend;
  }
}
