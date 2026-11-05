import type { ColorMatrix } from "pixi.js";
import { FAVORITE_LIGHT } from "./favorite-scenery-data.ts";

export function favoriteLightMatrix(strength: number): ColorMatrix {
  const amount = Math.max(0, Math.min(1, strength));
  const matrix: ColorMatrix = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
  for (const [channel, tint] of FAVORITE_LIGHT.tint.entries()) {
    for (const [source, weight] of FAVORITE_LIGHT.luminance.entries()) {
      const original = source === channel ? 1 : 0;
      const moonlit = FAVORITE_LIGHT.exposure * ((1 - FAVORITE_LIGHT.colorRetention) * weight * tint + original * FAVORITE_LIGHT.colorRetention);
      matrix[channel * FAVORITE_LIGHT.matrixStride + source] = original + (moonlit - original) * amount;
    }
    matrix[channel * FAVORITE_LIGHT.matrixStride + 4] = FAVORITE_LIGHT.lift[channel]! / FAVORITE_LIGHT.channelMax * amount;
  }
  return matrix;
}

export function favoritePixel(red: number, green: number, blue: number, matrix: ColorMatrix): number[] {
  return [0, 1, 2].map(channel => {
    const offset = channel * FAVORITE_LIGHT.matrixStride;
    return matrix[offset]! * red + matrix[offset + 1]! * green + matrix[offset + 2]! * blue + matrix[offset + 4]! * FAVORITE_LIGHT.channelMax;
  });
}
