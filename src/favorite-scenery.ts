import { ColorMatrixFilter, Container, Sprite, Texture } from "pixi.js";
import { FAVORITE_ART, FAVORITE_IN_FRONT, FAVORITE_LIGHT } from "./favorite-scenery-data";
import { favoriteLightMatrix } from "./favorite-light-model";

function illuminatedPainting(room: Texture, polygons: number[][]) {
  const horizontal = polygons.flatMap(polygon => polygon.filter((_, index) => index % 2 === 0));
  const vertical = polygons.flatMap(polygon => polygon.filter((_, index) => index % 2 === 1));
  const left = Math.min(...horizontal) - FAVORITE_LIGHT.padding;
  const top = Math.min(...vertical) - FAVORITE_LIGHT.padding;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(...horizontal) - left + FAVORITE_LIGHT.padding;
  canvas.height = Math.max(...vertical) - top + FAVORITE_LIGHT.padding;
  const brush = canvas.getContext("2d")!;
  brush.fillStyle = "white";
  brush.filter = "blur(" + FAVORITE_LIGHT.feather + "px)";
  for (const polygon of polygons) {
    brush.beginPath();
    for (let index = 0; index < polygon.length; index += 2) {
      const x = polygon[index]! - left, y = polygon[index + 1]! - top;
      if (index === 0) brush.moveTo(x, y); else brush.lineTo(x, y);
    }
    brush.closePath(); brush.fill();
  }
  const painting = new Sprite(room);
  const filter = new ColorMatrixFilter(); filter.matrix = favoriteLightMatrix(1);
  painting.filters = [filter];
  const maskTexture = Texture.from(canvas);
  const mask = new Sprite(maskTexture); mask.position.set(left, top);
  painting.mask = mask;
  const root = new Container(); root.addChild(painting, mask); root.visible = false;
  return { root, maskTexture, filter };
}

export class FavoriteScenery {
  readonly root = new Container();
  private readonly furniture;
  private selected: string[] = [];
  /** `front`: the painted prop that hides the room behind the residents; a favorite inside it is lit there, on its own mask only. */
  constructor(room: Texture, front: Container) {
    this.furniture = Object.entries(FAVORITE_ART).map(([id, polygons]) => {
      const { root: sprite, maskTexture, filter } = illuminatedPainting(room, polygons);
      (FAVORITE_IN_FRONT.includes(id) ? front : this.root).addChild(sprite);
      return { id, sprite, maskTexture, filter };
    });
  }
  get active(): string[] { return [...this.selected]; }
  destroy(): void {
    for (const { maskTexture, filter } of this.furniture) {
      maskTexture.destroy(true);
      filter.destroy();
    }
  }
  update(ids: string[], now: number, frozen: boolean): void {
    this.selected = ids;
    const wave = (1 - Math.cos(now / FAVORITE_LIGHT.periodMs * Math.PI * 2)) / 2;
    const alpha = frozen ? FAVORITE_LIGHT.steadyAlpha : FAVORITE_LIGHT.minimumAlpha + (1 - FAVORITE_LIGHT.minimumAlpha) * wave;
    for (const { id, sprite } of this.furniture) { sprite.visible = ids.includes(id); sprite.alpha = alpha; }
  }
}
