import { MAX_FILE_BYTES, MAX_DIMENSION, KIND, VERSION, WEBP, WORD, PIXEL_STRIDE, ALPHA_OFFSET } from './constants';
import { cleanPng, bytesFromBase64, base64FromBytes, parseInvitation, type Invitation, type Guest } from './invite-contract';
import { COPY } from './copy';

export const sourceOf = (invite: Invitation) => 'data:image/png;base64,' + invite.png;

async function canonicalImage(source: string): Promise<string> {
  const image = new Image(); image.src = source; await image.decode();
  if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth > MAX_DIMENSION || image.naturalHeight > MAX_DIMENSION) throw Error(COPY.unsupported);
  const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d'); if (!context) throw Error(COPY.unsupported);
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  if (!pixels.some((value, index) => index % PIXEL_STRIDE === ALPHA_OFFSET && value > 0)) throw Error(COPY.invalid);
  const png = cleanPng(bytesFromBase64(canvas.toDataURL('image/png').split(',')[1]!));
  return base64FromBytes(png);
}

export async function canonicalGuest(invitation: Invitation): Promise<Guest> {
  const validated = parseInvitation(JSON.stringify(invitation));
  const png = await canonicalImage(sourceOf(validated));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(validated.name + '\n' + png));
  const HEX = 16, HEX_DIGITS = 2;
  const id = 'guest:' + Array.from(new Uint8Array(digest), byte => byte.toString(HEX).padStart(HEX_DIGITS, '0')).join('');
  return { ...validated, png, id };
}

export async function importFile(file: File): Promise<Guest> {
  if (file.size > MAX_FILE_BYTES) throw Error(COPY.large);
  return canonicalGuest(parseInvitation(await file.text()));
}

/** Trusted owned art only. The caller supplies a roster source, never a source from an invite.
 * Fetch is same-origin, bounded while streaming, and never follows redirects. */
export async function ownedArt(name: string, source: string): Promise<Invitation> {
  if (source.startsWith('data:image/png;base64,')) {
    if (source.length > MAX_FILE_BYTES) throw Error(COPY.large);
    const png = cleanPng(bytesFromBase64(source.slice('data:image/png;base64,'.length)));
    return { kind: KIND, version: VERSION, name, png: await canonicalImage('data:image/png;base64,' + base64FromBytes(png)) };
  }
  const url = new URL(source, location.href);
  if (url.origin !== location.origin || !['http:', 'https:'].includes(url.protocol)) throw Error(COPY.unsupported);
  const response = await fetch(url, { redirect: 'error', credentials: 'same-origin' });
  if (!response.ok || !response.body) throw Error(COPY.unsupported);
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.length; if (size > MAX_FILE_BYTES) throw Error(COPY.large); chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const blob = new Blob(chunks as BlobPart[], { type: 'image/webp' });
  // Owned WebP dimensions are read from its header before decode too.
  const bytes = new Uint8Array(await blob.arrayBuffer()); validateOwnedHeader(bytes);
  const object = URL.createObjectURL(blob);
  try { return { kind: KIND, version: VERSION, name, png: await canonicalImage(object) }; }
  finally { URL.revokeObjectURL(object); }
}

function validateOwnedHeader(bytes: Uint8Array) {
  if (bytes.length < WEBP.min) throw Error(COPY.unsupported);
  const tag = (at: number) => String.fromCharCode(...bytes.subarray(at, at + WORD));
  if (tag(0) !== 'RIFF' || tag(WEBP.format) !== 'WEBP') { cleanPng(bytes); return; }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0, height = 0;
  const uint24 = (at: number) => bytes[at]! + WEBP.byte * bytes[at + 1]! + WEBP.byte * WEBP.byte * bytes[at + 2]!;
  if (tag(WEBP.type) === 'VP8X') {
    if (bytes[WEBP.payload]! & 2) throw Error(COPY.unsupported); // animated WebP
    width = 1 + uint24(WEBP.xWidth); height = 1 + uint24(WEBP.xHeight);
  } else if (tag(WEBP.type) === 'VP8L') {
    const packed = view.getUint32(WEBP.payload + 1, true);
    width = 1 + (packed & WEBP.mask); height = 1 + ((packed >>> WEBP.shift) & WEBP.mask);
  } else if (tag(WEBP.type) === 'VP8 ') {
    width = view.getUint16(WEBP.lossyWidth, true) & WEBP.mask; height = view.getUint16(WEBP.lossyHeight, true) & WEBP.mask;
  }
  if (!width || !height || width > MAX_DIMENSION || height > MAX_DIMENSION) throw Error(COPY.unsupported);
}
