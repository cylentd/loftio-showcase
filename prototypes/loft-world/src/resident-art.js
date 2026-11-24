import { RESIDENT_LIGHT } from './resident-data.mjs';
import { RGBA_CHANNELS, ALPHA_CHANNEL, FULL_ALPHA, STANDING_HEIGHT } from './resident-art-constants.mjs';

export function fitResidentArt({ data, width, height }) {
  const opaque = RESIDENT_LIGHT.alphaCut * FULL_ALPHA;
  let left = width, right = -1, top = height, bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * RGBA_CHANNELS + ALPHA_CHANNEL] <= opaque) continue;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  if (bottom < top) return null;
  const visibleHeight = (bottom - top + 1) / height;
  return {
    scale: STANDING_HEIGHT / visibleHeight,
    visibleHeight,
    aspect: width / height,
    anchor: [(left + right + 1) / (2 * width), 1 - (bottom + 1) / height],
  };
}

export async function decodeResidentArt(blob, { urls = URL, makeImage = () => new Image(), makeCanvas = () => document.createElement('canvas') } = {}) {
  const image = makeImage();
  const url = urls.createObjectURL(blob);
  try {
    image.src = url;
    await image.decode();
    const width = image.naturalWidth, height = image.naturalHeight;
    if (!width || !height) return null;
    const canvas = makeCanvas();
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const fit = fitResidentArt(context.getImageData(0, 0, width, height));
    return fit && { image: canvas, fit };
  } finally { urls.revokeObjectURL(url); }
}
