import {
  VP8_KEYFRAME_HEIGHT_OFFSET, VP8_KEYFRAME_SIGNATURE_OFFSET, VP8_KEYFRAME_WIDTH_OFFSET,
  VP8X_CANVAS_SIDE_SHIFT, WEBP_FOURCC_BYTES,
} from './constants';

// Static RIFF WebP container and VP8/VP8L frame headers. Check the real dimensions before allocating a decoded bitmap.
const RIFF_SIZE_OFFSET = 4;
const RIFF_SIZE_BASE = 8;
const RIFF_HEADER = 12;
const CHUNK_HEADER = 8;
const VP8_HEADER = 10;
const VP8L_HEADER = 5;
const VP8L_SIGNATURE = 0x2f;
const VP8_SIGNATURE = [0x9d, 0x01, 0x2a];
const SIDE_MASK = 0x3fff;
const SIDE_BITS = 14;
const EXTENDED_HEADER = 10;
const ANIMATION_FLAG = 0x02;
const CANVAS_WIDTH_OFFSET = 4;
const CANVAS_HEIGHT_OFFSET = 7;
const fourCC = (bytes: Uint8Array, offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + WEBP_FOURCC_BYTES));
const side = (view: DataView, offset: number) => view.getUint16(offset, true) & SIDE_MASK;

function frame(data: Uint8Array, kind: string) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (kind === 'VP8L' && data.length >= VP8L_HEADER && data[0] === VP8L_SIGNATURE) {
    const dimensions = view.getUint32(1, true);
    return { width: (dimensions & SIDE_MASK) + 1, height: ((dimensions >>> SIDE_BITS) & SIDE_MASK) + 1 };
  }
  if (kind === 'VP8 ' && data.length >= VP8_HEADER && !(data[0]! & 1)
    && VP8_SIGNATURE.every((byte, index) => data[index + VP8_KEYFRAME_SIGNATURE_OFFSET] === byte)) {
    return { width: side(view, VP8_KEYFRAME_WIDTH_OFFSET), height: side(view, VP8_KEYFRAME_HEIGHT_OFFSET) };
  }
  return null;
}

const canvasSide = (view: DataView, offset: number) => (view.getUint32(offset - 1, true) >>> VP8X_CANVAS_SIDE_SHIFT) + 1;

export function matchesStaticWebp(bytes: Uint8Array, width: number, height: number): boolean {
  if (bytes.length < RIFF_HEADER || fourCC(bytes, 0) !== 'RIFF' || fourCC(bytes, RIFF_SIZE_BASE) !== 'WEBP') return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(RIFF_SIZE_OFFSET, true) + RIFF_SIZE_BASE !== bytes.length) return false;
  let foundFrame = false;
  let offset = RIFF_HEADER;
  while (offset + CHUNK_HEADER <= bytes.length) {
    const kind = fourCC(bytes, offset);
    const size = view.getUint32(offset + RIFF_SIZE_OFFSET, true);
    const start = offset + CHUNK_HEADER;
    const next = start + size + (size % 2);
    if (next > bytes.length || kind === 'ANIM' || kind === 'ANMF') return false;
    if (kind === 'VP8X' && (offset !== RIFF_HEADER || size !== EXTENDED_HEADER || (bytes[start]! & ANIMATION_FLAG)
      || canvasSide(view, start + CANVAS_WIDTH_OFFSET) !== width || canvasSide(view, start + CANVAS_HEIGHT_OFFSET) !== height)) return false;
    if (kind === 'VP8 ' || kind === 'VP8L') {
      const image = frame(bytes.subarray(start, start + size), kind);
      if (foundFrame || image?.width !== width || image?.height !== height) return false;
      foundFrame = true;
    }
    offset = next;
  }
  return foundFrame && offset === bytes.length;
}
