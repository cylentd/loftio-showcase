import { EFFECT_DEFAULTS, EFFECT_RANGE, SCENE_STORAGE_KEY, type EffectKey, type EffectValues } from "./scene-settings-data.ts";
import { LIGHTING_MODES, type LightingMode } from "./lighting-data.ts";
import { LampGlow } from "./lamp-glow.ts";

export interface SceneStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
const bounded = (value: number) => Math.round(Math.max(EFFECT_RANGE.min, Math.min(EFFECT_RANGE.max, value)) / EFFECT_RANGE.step) * EFFECT_RANGE.step;

export class SceneSettings {
  private current = { particles: EFFECT_DEFAULTS.particles, leaves: EFFECT_DEFAULTS.leaves };
  private readonly glow = new LampGlow();
  private readonly glowListeners = new Set<() => void>();
  private cue = false;
  private wandering = true;
  private favorites = false;
  /** The dock's Music tile: whether the board shows the player row. Display only; it never starts or stops sound. */
  private player = true;
  private lightingMode: LightingMode = "cycle";
  private readonly listeners = new Set<() => void>();

  private readonly storage: SceneStorage | undefined;

  constructor(storage?: SceneStorage) {
    this.storage = storage;
    try {
      const stored: unknown = JSON.parse(storage?.getItem(SCENE_STORAGE_KEY) ?? "null");
      if (!stored || typeof stored !== "object" || Array.isArray(stored)) return;
      const record = stored as Record<string, unknown>;
      for (const key of ["particles", "leaves"] as const) {
        const value = record[key];
        if (typeof value === "number" && Number.isFinite(value)) this.current[key] = bounded(value);
      }
      this.cue = record.cue === true;
      this.wandering = record.wander !== false;
      this.favorites = record.favorites === true;
      this.player = record.player !== false;
      if (LIGHTING_MODES.includes(record.lighting as LightingMode)) this.lightingMode = record.lighting as LightingMode;
      this.glow.restore(record, this.lightingMode);
    } catch {}
  }

  get lighting(): LightingMode { return this.lightingMode; }
  get showCue(): boolean { return this.cue; }
  get wander(): boolean { return this.wandering; }
  get showFavorites(): boolean { return this.favorites; }
  get showPlayer(): boolean { return this.player; }
  get(key: EffectKey): number { return key === "lights" ? this.glow.get(this.lightingMode) : this.current[key]; }
  values(): EffectValues { return { ...this.current, lights: this.get("lights") }; }
  subscribe(listener: () => void): void { this.listeners.add(listener); }
  subscribeGlow(listener: () => void): void { this.glowListeners.add(listener); }
  updateLightingBlend(blend: number): void {
    const previous = this.get("lights");
    this.glow.blend = blend;
    if (previous !== this.get("lights")) for (const listener of this.glowListeners) listener();
  }

  set(key: EffectKey, value: number): void {
    if (!Number.isFinite(value)) return;
    const next = bounded(value);
    if (this.get(key) === next) return;
    if (key === "lights") this.glow.set(this.lightingMode, next);
    else this.current[key] = next;
    this.changed();
  }

  setCue(visible: boolean): void {
    if (this.cue === visible) return;
    this.cue = visible;
    this.changed();
  }

  setWander(enabled: boolean): void {
    if (this.wandering === enabled) return;
    this.wandering = enabled;
    this.changed();
  }

  setFavorites(visible: boolean): void {
    if (this.favorites === visible) return;
    this.favorites = visible;
    this.changed();
  }

  setPlayer(shown: boolean): void {
    if (this.player === shown) return;
    this.player = shown;
    this.changed();
  }

  setLighting(mode: LightingMode): void {
    if (!LIGHTING_MODES.includes(mode) || this.lightingMode === mode) return;
    this.lightingMode = mode;
    this.changed();
  }

  reset(): void {
    this.current = { particles: EFFECT_DEFAULTS.particles, leaves: EFFECT_DEFAULTS.leaves };
    this.glow.reset();
    this.changed();
  }

  private changed(): void {
    try { this.storage?.setItem(SCENE_STORAGE_KEY, JSON.stringify({ ...this.values(), lampGlows: this.glow.values(), cue: this.cue, wander: this.wandering, favorites: this.favorites, player: this.player, lighting: this.lightingMode })); } catch {}
    for (const listener of this.listeners) listener();
  }
}
