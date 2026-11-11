import { Texture } from "pixi.js";
import { Resident } from "../resident";
import { css, seeded, type Scene } from "../scene";
import type { Position } from "./registry";
import { DELIVERY } from "./delivery-constants";

let texture: Promise<Texture> | undefined;
let contact: Texture | undefined;
let portrait: string | undefined;
export const deliveryPortrait = () => portrait;

function contactTexture(): Texture {
  if (contact) return contact;
  const canvas = document.createElement("canvas");
  canvas.width = DELIVERY.contactWidth; canvas.height = DELIVERY.contactHeight;
  const context = canvas.getContext("2d")!;
  context.filter = `blur(${DELIVERY.contactBlur}px)`;
  context.fillStyle = "white"; context.beginPath();
  DELIVERY.contactCorners.forEach(([x, y], index) => index === 0 ? context.moveTo(x, y) : context.lineTo(x, y));
  context.closePath(); context.fill();
  return contact = Texture.from(canvas);
}

function paintedCarton(): Promise<Texture> {
  return texture ??= (async () => {
    const images = await Promise.all(["front", "right", "lid", "seal"].map(async face => {
      const image = new Image(); image.src = import.meta.env.BASE_URL + `brand/box-${face}.webp`;
      await image.decode(); return image;
    }));
    const canvas = document.createElement("canvas");
    canvas.width = DELIVERY.textureWidth; canvas.height = DELIVERY.textureHeight;
    const context = canvas.getContext("2d")!;
    const face = (image: HTMLImageElement, matrix: readonly number[], width: number, height: number, shade = false) => {
      context.save(); context.setTransform(matrix[0]!, matrix[1]!, matrix[2]!, matrix[3]!, matrix[4]!, matrix[5]!);
      context.drawImage(image, 0, 0, width, height);
      if (shade) { context.globalAlpha = DELIVERY.sideShade; context.fillStyle = css("--box-ink"); context.fillRect(0, 0, width, height); }
      context.restore();
    };
    face(images[0]!, DELIVERY.frontMatrix, DELIVERY.frontWidth, DELIVERY.frontHeight);
    face(images[1]!, DELIVERY.sideMatrix, DELIVERY.sideWidth, DELIVERY.frontHeight, true);
    face(images[2]!, DELIVERY.lidMatrix, DELIVERY.frontWidth, DELIVERY.sideWidth);
    face(images[3]!, DELIVERY.sealMatrix, DELIVERY.sealSize, DELIVERY.sealSize);
    portrait = canvas.toDataURL();
    return Texture.from(canvas);
  })().catch(error => { texture = undefined; throw error; });
}

export async function deliveryArt(scene: Scene, id: string, point: Position) {
  const texture = await paintedCarton();
  return new Resident({ id, art: "", home: point, interest: point, spot: point, sizeBias: DELIVERY.sizeBias },
    texture, scene.dot, { shadow: css("--grove-shadow"), tintFront: css("--grove-tint-front"), tintBack: css("--grove-tint-back") }, seeded(id.length),
    { shadowTexture: contactTexture(), shadow: DELIVERY.contactShadow, airShadowTexture: scene.dot, airShadow: DELIVERY.carryShadow, seatSupport: false });
}
