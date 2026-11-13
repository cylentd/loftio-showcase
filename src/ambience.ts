import { Container, Graphics, Sprite, Texture } from "pixi.js";
import { LAMPS } from "./cast";
import { EFFECTS, GLASS } from "./effects-constants";
import { rainPosition } from "./effects-model";
import { EFFECT_RANGE, EFFECT_TUNING } from "./scene-settings-data";
import type { SceneSettings } from "./scene-settings";


const TEXTURE_SIZE = 128;
const HALF = 0.5;
type Colours = { rain: string; mote: string; glow: string };

/** Created once; shared by contact shadows, light pools and sparse dust. */
export function softDot(): Texture {
  const c = document.createElement("canvas");
  c.width = c.height = TEXTURE_SIZE;
  const g = c.getContext("2d")!;
  const half = TEXTURE_SIZE / 2;
  const grad = g.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, "#fff");
  grad.addColorStop(HALF, "rgb(255 255 255 / .35)");
  grad.addColorStop(1, "rgb(255 255 255 / 0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  return Texture.from(c);
}

export class Ambience {
  readonly back = new Container();
  readonly front = new Container();
  private readonly rain = new Container();
  private drops: { s: Sprite; seed: number; near: boolean }[] = [];
  private trails: { s: Sprite; seed: number }[] = [];
  private glows: { s: Sprite; phase: number }[] = [];
  private motes: { s: Sprite; x: number; y: number; phase: number }[] = [];
  private dustVisible = true;

  private readonly settings: SceneSettings;

  constructor(dot: Texture, colours: Colours, rand: () => number, settings: SceneSettings) {
    this.settings = settings;
    this.makeRain(dot, colours, rand);
    for (const [index, lamp] of LAMPS.entries()) {
      const s = new Sprite(dot);
      s.anchor.set(HALF);
      s.tint = colours.glow;
      s.blendMode = "add";
      s.width = s.height = lamp.r * 2;
      s.position.set(lamp.x, lamp.y);
      this.front.addChild(s);
      this.glows.push({ s, phase: index * 2 });
    }
    this.back.addChild(this.rain);
    const capacity = EFFECTS.moteCount * EFFECT_RANGE.max / EFFECT_RANGE.unit;
    for (let i = 0; i < capacity; i += 1) {
      const lamp = LAMPS[i % LAMPS.length]!;
      const s = new Sprite(dot);
      s.anchor.set(HALF);
      s.tint = colours.mote;
      s.blendMode = "add";
      s.width = s.height = EFFECTS.moteSize * (HALF + rand() * HALF);
      this.front.addChild(s);
      this.motes.push({ s, x: lamp.x + (rand() - HALF) * lamp.r * 2, y: lamp.y, phase: rand() * Math.PI * 2 });
    }
    this.update(0);
  }

  private makeRain(dot: Texture, colours: Colours, rand: () => number): void {
    const mask = new Graphics();
    for (const polygon of GLASS) mask.poly(polygon).fill(0xffffff);
    this.rain.mask = mask;
    this.back.addChild(mask);
    for (let i = 0; i < EFFECTS.rainCount; i += 1) {
      const near = i % 2 === 0;
      const s = new Sprite(dot);
      s.tint = colours.rain;
      s.width = near ? 2 : 1;
      s.height = near ? EFFECTS.trailLength * 2 : EFFECTS.trailLength;
      s.alpha = near ? HALF : HALF / 2;
      s.rotation = EFFECTS.rainAngle;
      this.rain.addChild(s);
      this.drops.push({ s, seed: rand(), near });
    }
    for (let i = 0; i < EFFECTS.trailCount; i += 1) {
      const s = new Sprite(dot);
      s.tint = colours.rain;
      s.width = 2;
      s.height = EFFECTS.trailLength;
      s.alpha = HALF;
      this.rain.addChild(s);
      this.trails.push({ s, seed: rand() });
    }
  }

  update(now: number, night = 0, flickers: number[] = []): void {
    const lightGain = this.settings.get("lights") / EFFECT_RANGE.unit;
    const particleGain = this.settings.get("particles") / EFFECT_RANGE.unit;
    const count = Math.round(EFFECTS.moteCount * particleGain);
    for (const d of this.drops) {
      const p = rainPosition(d.seed, now, d.near);
      d.s.position.set(p.x, p.y);
    }
    for (const d of this.trails) {
      d.s.position.set(EFFECTS.rainLeft + d.seed * EFFECTS.rainWidth,
        (d.seed * EFFECTS.rainSpan + now * EFFECTS.trailSpeed) % EFFECTS.rainSpan);
    }
    for (const [index, g] of this.glows.entries()) {
      const swell = Math.sin(now / EFFECTS.glowSlowMs + g.phase);
      const tremble = Math.sin(now / EFFECTS.glowFastMs + g.phase * 2) / 2;
      const glow = Math.max(EFFECTS.glowFloor, EFFECTS.glowBase * (1 + EFFECTS.glowSwing * (swell + tremble)));
      g.s.alpha = Math.min(EFFECT_TUNING.maxLightAlpha, glow * lightGain) * (1 - night) * (flickers[index] ?? 1);
    }
    for (const [index, m] of this.motes.entries()) {
      m.s.visible = this.dustVisible && index < count;
      const drift = now / EFFECTS.moteDriftMs + m.phase;
      const progress = ((now * EFFECTS.moteSpeed + m.phase * EFFECTS.moteSpan) % EFFECTS.moteSpan) / EFFECTS.moteSpan;
      m.s.position.set(m.x + Math.sin(drift) * EFFECTS.moteDrift,
        m.y + EFFECTS.moteSpan / 2 - progress * EFFECTS.moteSpan);
      m.s.alpha = Math.min(1, EFFECTS.moteAlpha * Math.sqrt(particleGain)) * Math.sin(progress * Math.PI) * (1 - night / 2);
    }
  }

  inspectRain(): void {
    for (const glow of this.glows) glow.s.visible = false;
  }

  setDustVisible(visible: boolean): void {
    this.dustVisible = visible;
    const count = Math.round(EFFECTS.moteCount * this.settings.get("particles") / EFFECT_RANGE.unit);
    for (const [index, mote] of this.motes.entries()) mote.s.visible = visible && index < count;
  }
}
