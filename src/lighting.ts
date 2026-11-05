import { Container, RenderTexture, Sprite, type Renderer, type Texture } from "pixi.js";
import { LAMPS } from "./cast";
import { LIGHTING, type LightingMode } from "./lighting-data";
import { lampFlicker } from "./lighting-model";
import { LightingTimeline } from "./lighting-timeline";

export class Lighting {
  readonly texture = RenderTexture.create({ width: LIGHTING.width, height: LIGHTING.height });
  readonly timeline = new LightingTimeline();
  readonly flickers = LAMPS.map(() => 1);
  private readonly painting = new Container();
  private readonly night: Sprite;
  private readonly shades: Sprite[];
  private renderedBlend = -1;
  private renderedFlickers = "";
  private readonly renderer: Renderer;

  constructor(warm: Texture, moonlit: Texture, dot: Texture, renderer: Renderer) {
    this.renderer = renderer;
    const day = new Sprite(warm);
    this.night = new Sprite(moonlit);
    day.width = this.night.width = LIGHTING.width;
    day.height = this.night.height = LIGHTING.height;
    this.painting.addChild(day, this.night);
    this.shades = LAMPS.map(lamp => {
      const shade = new Sprite(dot);
      shade.tint = LIGHTING.flickerShade;
      shade.anchor.set(0.5);
      shade.position.set(lamp.x, lamp.y);
      shade.width = shade.height = lamp.r * LIGHTING.flickerRadius * 2;
      this.painting.addChild(shade);
      return shade;
    });
    this.paint();
  }

  update(delta: number, mode: LightingMode, frozen: boolean, now: number, render = true): void {
    this.timeline.update(delta, mode, frozen);
    if (delta && !frozen) for (let index = 0; index < this.flickers.length; index += 1) this.flickers[index] = lampFlicker(now, index);
    if (render) this.paint();
  }

  private paint(): void {
    const blend = this.timeline.blend;
    const flickers = blend === 1 ? "" : this.flickers.join(",");
    if (blend === this.renderedBlend && flickers === this.renderedFlickers) return;
    this.night.alpha = blend;
    for (const [index, shade] of this.shades.entries()) shade.alpha = (1 - this.flickers[index]!) * (1 - blend) * LIGHTING.flickerShadeGain;
    this.renderer.render({ container: this.painting, target: this.texture, clear: true });
    this.renderedBlend = blend;
    this.renderedFlickers = flickers;
  }
}
