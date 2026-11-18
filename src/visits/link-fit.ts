import { UPLOAD_MAX_BYTES, UPLOAD_SIDES } from './constants';
import { cleanPng, bytesFromBase64 } from './invite-contract';

/** Try each longest-side size in order and return the first PNG that fits the server's byte cap, else null. */
export async function fitForUpload(render: (side: number) => Promise<Uint8Array>): Promise<Uint8Array | null> {
  for (const side of UPLOAD_SIDES) {
    const png = await render(side);
    if (png.length <= UPLOAD_MAX_BYTES) return png;
  }
  return null;
}

/** Browser renderer: redraws the portrait with its longest side at most `side` (never enlarged) and re-encodes it as
 * a metadata-free RGBA PNG. Needs a canvas, so it is not unit tested; the ladder above is. */
export async function renderAtSide(pngBase64: string, side: number): Promise<Uint8Array> {
  const image = new Image(); image.src = 'data:image/png;base64,' + pngBase64; await image.decode();
  const scale = Math.min(1, side / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d'); if (!context) throw Error('canvas unavailable');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return cleanPng(bytesFromBase64(canvas.toDataURL('image/png').split(',')[1]!));
}
