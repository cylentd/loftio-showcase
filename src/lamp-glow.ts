import { LIGHTING, LIGHTING_MODES, type LightingMode } from "./lighting-data.ts";
import { EFFECT_DEFAULTS, EFFECT_RANGE } from "./scene-settings-data.ts";

export function defaultLampGlow(blend: number): number {
  const phase = Math.max(0, Math.min(1, blend)) * 2;
  const { lamplit, dusk, moonlit } = LIGHTING.glowDefaults;
  return phase <= 1 ? lamplit + (dusk - lamplit) * phase : dusk + (moonlit - dusk) * (phase - 1);
}

export class LampGlow {
  private overrides: Partial<Record<LightingMode, number>> = {};
  blend = 0;
  get(mode: LightingMode): number {
    const fallback = mode === "cycle" ? defaultLampGlow(this.blend) : LIGHTING.glowDefaults[mode];
    return this.overrides[mode] ?? Math.round(fallback / EFFECT_RANGE.step) * EFFECT_RANGE.step;
  }
  set(mode: LightingMode, value: number): void {
    this.overrides[mode] = Math.round(Math.max(EFFECT_RANGE.min, Math.min(EFFECT_RANGE.max, value)) / EFFECT_RANGE.step) * EFFECT_RANGE.step;
  }
  reset(): void { this.overrides = {}; }
  values(): Partial<Record<LightingMode, number>> { return { ...this.overrides }; }
  restore(record: Record<string, unknown>, mode: LightingMode): void {
    const saved = record.lampGlows;
    if (saved && typeof saved === "object" && !Array.isArray(saved)) {
      for (const choice of LIGHTING_MODES) {
        const value = (saved as Record<string, unknown>)[choice];
        if (typeof value === "number" && Number.isFinite(value)) this.set(choice, value);
      }
    } else if (typeof record.lights === "number" && Number.isFinite(record.lights) && record.lights !== EFFECT_DEFAULTS.lights) this.set(mode, record.lights);
  }
}
