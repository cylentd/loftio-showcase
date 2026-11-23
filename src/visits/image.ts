import { MAX_FILE_BYTES, MAX_PNG_BYTES, MAX_DIMENSION, VIEW_MAX_SIDE, INVITE_SIDES, OWNED_MAX_BYTES, OWNED_MAX_BASE64, KIND, VERSION, WEBP, WORD, PIXEL_STRIDE, ALPHA_OFFSET } from './constants';
import { readPngInfo } from '../builder/png';
import { cleanPng, bytesFromBase64, base64FromBytes, parseInvitation, type Invitation, type Guest } from './invite-contract';
import { COPY } from './copy';

export const sourceOf = (invite: Invitation) => 'data:image/png;base64,' + invite.png;

async function decoded(source: string): Promise<HTMLImageElement> {
  const image = new Image(); image.src = source; await image.decode();
  if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth > MAX_DIMENSION || image.naturalHeight > MAX_DIMENSION) throw Error(COPY.unsupported);
  return image;
}

/** Redraws a decoded image with its longest side at most `side` (never enlarged) and returns the PNG bytes the canvas makes.
 * No byte cap here: the invitation cap belongs to what is sent (`cleanPng`), not to what the owner looks at. */
function pngAt(image: HTMLImageElement, side: number): Uint8Array {
  const scale = Math.min(1, side / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d'); if (!context) throw Error(COPY.unsupported);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  if (!pixels.some((value, index) => index % PIXEL_STRIDE === ALPHA_OFFSET && value > 0)) throw Error(COPY.invalid);
  return bytesFromBase64(canvas.toDataURL('image/png').split(',')[1]!);
}

// Imported invitations: every cap applies (cleanPng refuses a PNG over MAX_PNG_BYTES).
async function canonicalImage(source: string): Promise<string> {
  return base64FromBytes(cleanPng(pngAt(await decoded(source), MAX_DIMENSION)));
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

/** What the viewer shows for an owned resident: `view` is the portrait to display (bounded side, no invitation cap) and
 * `invitation` the copy that may be SENT (PNG at most MAX_PNG_BYTES), or null when no step of INVITE_SIDES fits. */
export type OwnedArt = { name: string; view: string; invitation: Invitation | null };

function inviteCopy(name: string, image: HTMLImageElement): Invitation | null {
  for (const side of INVITE_SIDES) {
    const bytes = pngAt(image, side);
    if (bytes.length > MAX_PNG_BYTES) continue;
    try { return { kind: KIND, version: VERSION, name, png: base64FromBytes(cleanPng(bytes)) }; } catch { return null; }
  }
  return null;
}

/** Trusted owned art only. The caller supplies a roster source, never a source from an invite.
 * Fetch is same-origin, bounded while streaming, and never follows redirects. Viewing is not bound by the invitation caps. */
export async function ownedArt(name: string, source: string): Promise<OwnedArt> {
  const { url, release } = await ownedSource(source);
  try {
    const image = await decoded(url);
    return { name, view: 'data:image/png;base64,' + base64FromBytes(pngAt(image, VIEW_MAX_SIDE)), invitation: inviteCopy(name, image) };
  } finally { release(); }
}

async function ownedSource(source: string): Promise<{ url: string; release: () => void }> {
  if (source.startsWith('data:image/png;base64,')) {
    const payload = source.slice('data:image/png;base64,'.length);
    if (payload.length > OWNED_MAX_BASE64) throw Error(COPY.unsupported);
    declaredPngSize(bytesFromBase64(payload));
    return { url: source, release: () => {} };
  }
  const url = new URL(source, location.href);
  if (url.origin !== location.origin || !['http:', 'https:'].includes(url.protocol)) throw Error(COPY.unsupported);
  const response = await fetch(url, { redirect: 'error', credentials: 'same-origin' });
  if (!response.ok || !response.body) throw Error(COPY.unsupported);
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.length; if (size > OWNED_MAX_BYTES) throw Error(COPY.unsupported); chunks.push(value);
    }
  } finally { await reader.cancel(); }
  // Declared dimensions are read from the header before decode: only PNG and WebP are accepted.
  const bytes = new Uint8Array(await new Blob(chunks as BlobPart[]).arrayBuffer());
  const isPng = readPngInfo(bytes) !== null;
  if (isPng) declaredPngSize(bytes); else validateOwnedHeader(bytes);
  const blob = new Blob([bytes as BlobPart], { type: isPng ? 'image/png' : 'image/webp' });
  const object = URL.createObjectURL(blob);
  return { url: object, release: () => URL.revokeObjectURL(object) };
}

/** A structurally valid PNG whose declared size is at most MAX_DIMENSION per axis, checked before any decoder allocates for it.
 * No PNG byte cap: that belongs to what is sent (`cleanPng`); the owned bound is OWNED_MAX_BYTES at the source. */
function declaredPngSize(bytes: Uint8Array) {
  const info = readPngInfo(bytes);
  if (!info || info.width > MAX_DIMENSION || info.height > MAX_DIMENSION) throw Error(COPY.unsupported);
}

function validateOwnedHeader(bytes: Uint8Array) {
  if (bytes.length < WEBP.min) throw Error(COPY.unsupported);
  const tag = (at: number) => String.fromCharCode(...bytes.subarray(at, at + WORD));
  if (tag(0) !== 'RIFF' || tag(WEBP.format) !== 'WEBP') throw Error(COPY.unsupported); // neither PNG (the caller checks that first) nor WebP
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
