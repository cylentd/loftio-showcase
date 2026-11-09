import { inspectAlpha } from './alpha.ts';
import type { GeneratedImage } from './records.ts';
import { readPngInfo } from './png.ts';
import { IMAGE_MAX_BYTES, IMAGE_MAX_SIDE } from './constants.ts';
import { COPY } from './copy.ts';
import { ProviderError } from './provider.ts';
import { validImage } from './storage-contract.ts';

export async function inspectImage(image: GeneratedImage) {
  if (!validImage(image)) throw new Error(COPY.corrupt);
  let blob: Blob;
  if (image.mime === 'image/webp') {
    // A failed download is a lost connection, not a broken image: the paid request must survive it.
    let response: Response;
    try { response = await fetch(image.url, { cache: 'force-cache' }); }
    catch { throw new ProviderError('network', COPY.network); }
    if (!response.ok || response.headers.get('content-type') !== image.mime) throw new Error(COPY.corrupt);
    try { blob = await response.blob(); }
    catch { throw new ProviderError('network', COPY.network); }
    if (blob.size !== image.bytes || blob.size > IMAGE_MAX_BYTES) throw new Error(COPY.corrupt);
  } else {
    const bytes = Uint8Array.from(atob(image.base64), character => character.charCodeAt(0));
    const info = readPngInfo(bytes);
    if (!info || info.width > IMAGE_MAX_SIDE || info.height > IMAGE_MAX_SIDE) throw new Error(COPY.corrupt);
    blob = new Blob([bytes], { type: image.mime });
  }
  const bitmap = await createImageBitmap(blob);
  try {
    if (bitmap.width !== image.width || bitmap.height !== image.height) throw new Error(COPY.corrupt);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error(COPY.corrupt);
    context.drawImage(bitmap, 0, 0);
    return inspectAlpha(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
  } finally { bitmap.close(); }
}
