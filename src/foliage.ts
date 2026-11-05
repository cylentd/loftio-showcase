import { Container, Graphics, MeshPlane, Rectangle, Sprite, Texture } from "pixi.js";
import { COUCH, DEPTH_PROPS, EFFECTS, FOLIAGE } from "./effects-constants";
import { leafWeight } from "./effects-model";
import { EFFECT_RANGE, EFFECT_TUNING } from "./scene-settings-data";
import type { SceneSettings } from "./scene-settings";
import { LOFT_RAIL, PUZZLE_TABLE } from "./loft-data";
import { CUSHION_FRONTS } from "./lounge-data";

/** Opaque local patches replace identical art; zero boundary displacement prevents holes or doubled leaves. */
export class Foliage {
  readonly root = new Container();
  private readonly patches;

  constructor(room: Texture, private readonly settings: SceneSettings) {
    this.patches = FOLIAGE.map((p) => {
      const texture = new Texture({ source: room.source, frame: new Rectangle(p.x, p.y, p.w, p.h) });
      const mesh = new MeshPlane({ texture, verticesX: EFFECTS.meshVertices, verticesY: EFFECTS.meshVertices });
      mesh.position.set(p.x, p.y);
      this.root.addChild(mesh);
      const buffer = mesh.geometry.getAttribute("aPosition").buffer;
      return { p, buffer, original: new Float32Array(buffer.data) };
    });
  }

  update(now: number): void {
    const raw = this.settings.get("leaves") / EFFECT_RANGE.unit;
    const gain = raw / (1 + Math.max(0, raw - 1) * EFFECT_TUNING.leafCompression);
    for (const { p, buffer, original } of this.patches) {
      const sway = Math.sin(now / EFFECTS.leafPeriod + p.phase) * p.strength * gain;
      const flutter = Math.sin(now / EFFECTS.leafFlutter + p.phase) * EFFECTS.leafFlutterStrength * gain;
      for (let i = 0; i < original.length; i += 2) {
        const x = original[i]!, y = original[i + 1]!;
        const weight = leafWeight(x / p.w, y / p.h);
        buffer.data[i] = x + weight * sway;
        buffer.data[i + 1] = y + weight * flutter;
      }
      buffer.update();
    }
  }
}

export function foreground(room: Texture): Container {
  const root = new Container();
  const couch = new Sprite(room);
  const mask = new Graphics().poly(COUCH).fill(0xffffff);
  couch.mask = mask;
  root.addChild(couch, mask);
  root.zIndex = EFFECTS.foregroundDepth;
  return root;
}

export function depthProps(room: Texture): Container[] {
  return [...DEPTH_PROPS, LOFT_RAIL, PUZZLE_TABLE, ...CUSHION_FRONTS].map(({ depth, polygons }) => {
    const root = new Container();
    const painting = new Sprite(room);
    const mask = new Graphics();
    for (const polygon of polygons) mask.poly(polygon).fill(0xffffff);
    painting.mask = mask;
    root.addChild(painting, mask);
    root.zIndex = depth;
    return root;
  });
}
