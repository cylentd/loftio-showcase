// Minimal PNG reading and writing, web-standard only so it runs in the dev server, a Vercel function and the browser.
// Reading answers "is this really a PNG, how big, and can it carry alpha"; whether pixels are actually transparent is
// alpha.ts's job, on decoded pixels.

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const COLOR_TYPE_GREY_ALPHA = 4;
const COLOR_TYPE_RGBA = 6;
const BIT_DEPTH_8 = 8;
const IHDR_LENGTH = 13;
const CHUNK_OVERHEAD = 12; // length + type + CRC

export type PngInfo = { width: number; height: number; hasAlphaChannel: boolean };

const chunkType = (bytes: Uint8Array, at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));

export function readPngInfo(bytes: Uint8Array): PngInfo | null {
  if (bytes.length < SIGNATURE.length + CHUNK_OVERHEAD + IHDR_LENGTH) return null;
  if (SIGNATURE.some((value, index) => bytes[index] !== value)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (chunkType(bytes, 12) !== "IHDR" || view.getUint32(8) !== IHDR_LENGTH) return null;
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  const colorType = bytes[25];
  if (!width || !height || ![0, 2, 3, 4, 6].includes(colorType ?? -1)) return null;
  let hasAlphaChannel = colorType === COLOR_TYPE_RGBA || colorType === COLOR_TYPE_GREY_ALPHA;
  let hasImageData = false;
  for (let at = SIGNATURE.length; at + CHUNK_OVERHEAD <= bytes.length;) {
    const length = view.getUint32(at);
    const end = at + CHUNK_OVERHEAD + length;
    if (end > bytes.length) return null;
    if (crc32(bytes.subarray(at + 4, end - 4)) !== view.getUint32(end - 4)) return null;
    const type = chunkType(bytes, at + 4);
    if (type === 'IDAT' && length > 0) hasImageData = true;
    if (type === 'IEND') return hasImageData && length === 0 && end === bytes.length
      ? { width, height, hasAlphaChannel } : null;
    if (type === "tRNS") hasAlphaChannel = true;
    at = end;
  }
  return null;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(CHUNK_OVERHEAD + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set([...type].map(char => char.charCodeAt(0)), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

async function deflate(raw: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([raw as BlobPart]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Encodes 8-bit RGBA pixels as a PNG. Used by the mock provider and by tests. */
export async function encodeRgbaPng(width: number, height: number, rgba: Uint8Array): Promise<Uint8Array> {
  const stride = width * 4;
  const raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  const header = new Uint8Array(IHDR_LENGTH);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header.set([BIT_DEPTH_8, COLOR_TYPE_RGBA, 0, 0, 0], 8);
  const parts = [new Uint8Array(SIGNATURE), chunk("IHDR", header), chunk("IDAT", await deflate(raw)), chunk("IEND", new Uint8Array())];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  parts.reduce((at, part) => (out.set(part, at), at + part.length), 0);
  return out;
}
