import { readPngInfo } from '../builder/png';
import { BASE64_TEXT, ANCILLARY_CHUNK_NAME, MAX_FILE_BYTES, MAX_PNG_BYTES, MAX_DIMENSION, MAX_NAME, KIND, VERSION,
  PNG_SIGNATURE_BYTES, CHUNK_OVERHEAD, WORD, HEADER_DEPTH, HEADER_COLOR, HEADER_COMPRESSION, HEADER_FILTER, HEADER_INTERLACE, RGBA, DEPTH } from './constants';
import { COPY } from './copy';
export type Invitation = { kind: 'loftio-visit'; version: 1; name: string; png: string };
export type Guest = Invitation & { id: string };
export const bytesFromBase64 = (value: string) => Uint8Array.from(atob(value), char => char.charCodeAt(0));
export const base64FromBytes = (bytes: Uint8Array) => btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));

export function displayName(value: unknown): string {
  if (typeof value !== 'string') throw Error(COPY.invalid);
  const name = value.normalize('NFC').trim();
  if (!name || [...name].length > MAX_NAME || !/^[\p{L}\p{M}\p{N} .'’\-]+$/u.test(name)) throw Error(COPY.invalid);
  return name;
}

export function parseInvitation(text: string): Invitation {
  if (text.length > MAX_FILE_BYTES || new TextEncoder().encode(text).length > MAX_FILE_BYTES) throw Error(COPY.large);
  let value: unknown; try { value = JSON.parse(text); } catch { throw Error(COPY.invalid); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(COPY.invalid);
  const row = value as Record<string, unknown>;
  if (Object.keys(row).sort().join(',') !== 'kind,name,png,version' || row.kind !== KIND || row.version !== VERSION
    || typeof row.png !== 'string' || row.png.length % WORD !== 0 || !BASE64_TEXT.test(row.png)) throw Error(COPY.invalid);
  const png = cleanPng(bytesFromBase64(row.png));
  return { kind: KIND, version: VERSION, name: displayName(row.name), png: base64FromBytes(png) };
}

/** Validate the full chunk/CRC structure and dimensions before any image decoder sees bytes.
 * Only static RGBA8 is portable. Strip every ancillary chunk (including text, EXIF and profiles). */
export function cleanPng(bytes: Uint8Array): Uint8Array {
  if (bytes.length > MAX_PNG_BYTES) throw Error(COPY.large);
  const info = readPngInfo(bytes);
  if (!info || info.width > MAX_DIMENSION || info.height > MAX_DIMENSION || bytes[HEADER_DEPTH] !== DEPTH
    || bytes[HEADER_COLOR] !== RGBA || bytes[HEADER_COMPRESSION] !== 0 || bytes[HEADER_FILTER] !== 0 || bytes[HEADER_INTERLACE] !== 0) throw Error(COPY.invalid);
  const parts = [bytes.slice(0, PNG_SIGNATURE_BYTES)];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let dataEnded = false, seenData = false;
  for (let at = PNG_SIGNATURE_BYTES; at < bytes.length;) {
    const length = view.getUint32(at), end = at + length + CHUNK_OVERHEAD;
    const type = String.fromCharCode(...bytes.subarray(at + WORD, at + WORD * 2));
    if (type === 'acTL' || type === 'fcTL' || type === 'fdAT' || (type === 'IHDR' && at !== PNG_SIGNATURE_BYTES)) throw Error(COPY.invalid);
    if (type === 'IDAT') { if (dataEnded) throw Error(COPY.invalid); seenData = true; }
    else if (seenData) dataEnded = true;
    if (['IHDR', 'IDAT', 'IEND'].includes(type)) parts.push(bytes.slice(at, end));
    else if (!ANCILLARY_CHUNK_NAME.test(type)) throw Error(COPY.invalid);
    at = end;
  }
  const out = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  parts.reduce((at, part) => { out.set(part, at); return at + part.length; }, 0);
  return out;
}
