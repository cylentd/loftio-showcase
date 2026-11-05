import { Sprite, Texture } from "pixi.js";
import { CHAIR_CLOUD } from "./chair-booster-data";
import type { cloudPose } from "./cloud-pose";
import { residentLighting } from "./lighting-model";

let cloudTexture: Texture | null = null;
function texture(): Texture {
  if (cloudTexture) return cloudTexture;
  const canvas = document.createElement("canvas"); canvas.width = CHAIR_CLOUD.width; canvas.height = CHAIR_CLOUD.height;
  const ink = canvas.getContext("2d")!;
  for (const lobe of CHAIR_CLOUD.lobes) {
    ink.save(); ink.translate(lobe.x, lobe.y); ink.scale(lobe.radiusX, lobe.radiusY);
    const fill = ink.createRadialGradient(0, 0, 0, 0, 0, 1);
    for (const [offset, color] of CHAIR_CLOUD.colors) fill.addColorStop(offset, color);
    ink.fillStyle = fill; ink.fillRect(-1, -1, 2, 2); ink.restore();
  }
  const grain = ink.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < grain.data.length; index += CHAIR_CLOUD.channels) {
    const noise = index * CHAIR_CLOUD.grainMultiplier % CHAIR_CLOUD.grainRange - CHAIR_CLOUD.grainRange / 2;
    for (let channel = 0; channel < CHAIR_CLOUD.channels - 1; channel += 1) grain.data[index + channel] = grain.data[index + channel]! + noise;
  }
  ink.putImageData(grain, 0, 0); cloudTexture = Texture.from(canvas);
  return cloudTexture;
}

export class ChairBooster extends Sprite {
  constructor() { super(texture()); this.anchor.set(0.5, 1); this.visible = false; }
  place(height: number, aspect: number, lift: number, lighting: number, motion: ReturnType<typeof cloudPose>): void {
    this.visible = lift > 0;
    if (!this.visible) return;
    this.width = height * aspect * CHAIR_CLOUD.widthRatio * motion.spread;
    this.height = lift + CHAIR_CLOUD.overlap; this.y = -motion.lift; this.alpha = motion.alpha;
    this.tint = residentLighting(CHAIR_CLOUD.tint, lighting);
  }
}
