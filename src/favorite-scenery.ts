import { ColorMatrixFilter, Container, Sprite, Texture } from "pixi.js";
import { FAVORITE_ART, FAVORITE_LIGHT } from "./favorite-scenery-data";
import { favoriteLightMatrix } from "./favorite-light-model";

function illuminatedPainting(room: Texture, polygons: number[][]): Container {
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
  const mask = new Sprite(Texture.from(canvas)); mask.position.set(left, top);
  painting.mask = mask;
  const root = new Container(); root.addChild(painting, mask); root.visible = false;
  return root;
}

export class FavoriteScenery {
  readonly root = new Container();
  private readonly furniture;
  private readonly foregroundExposure = new ColorMatrixFilter();
  private selected: string[] = [];
  constructor(room: Texture, private readonly foreground: Container) {
    this.furniture = Object.entries(FAVORITE_ART).map(([id, polygons]) => {
      const sprite = illuminatedPainting(room, polygons); this.root.addChild(sprite);
      return { id, sprite };
    });
  }
  get active(): string[] { return [...this.selected]; }
  update(ids: string[], now: number, frozen: boolean): void {
    this.selected = ids;
    const wave = (1 - Math.cos(now / FAVORITE_LIGHT.periodMs * Math.PI * 2)) / 2;
    const alpha = frozen ? FAVORITE_LIGHT.steadyAlpha : FAVORITE_LIGHT.minimumAlpha + (1 - FAVORITE_LIGHT.minimumAlpha) * wave;
    for (const { id, sprite } of this.furniture) { sprite.visible = ids.includes(id); sprite.alpha = alpha; }
    if (ids.includes("chomper")) {
      this.foregroundExposure.matrix = favoriteLightMatrix(alpha);
      this.foreground.filters = [this.foregroundExposure];
    } else this.foreground.filters = [];
  }
}
