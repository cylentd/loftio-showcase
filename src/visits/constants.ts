export const BASE64_TEXT = /^[A-Za-z0-9+/]*={0,2}$/;
export const ANCILLARY_CHUNK_NAME = /^[a-z][A-Za-z]{3}$/;
// Local invitation budgets: <=16 MiB decoded RGBA, four independently removable guests.
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_PNG_BYTES = 1024 * 1024;
export const MAX_DIMENSION = 2048;
export const MAX_NAME = 40;
export const MAX_GUESTS = 4;
export const DATABASE = 'loftio-visits-v1';
export const STORE = 'guests';
export const VERSION = 1;
export const KIND = 'loftio-visit';
export const FILE_NAME = 'loftio-invitation.loftio-visit';
// Hosted links (docs/architecture/VISITS.md; the endpoint's contract, fixed with the server unit, 2026-11-18).
export const LINK_ENDPOINT = '/loftio-visit-api/invitations';
export const LINK_PARAM = 'visit';
export const LINK_FLAG = 'online';
// The server issues 22 base64url characters (16 random bytes).
export const LINK_CODE = /^[A-Za-z0-9_-]{22}$/;
// Server cap: 160 KiB decoded PNG (server/constants.ts has the storage math; a test pins the two equal).
export const UPLOAD_MAX_BYTES = 163840;
// Downsize ladder: longest side in pixels, tried in order. The server accepts at most 512 per axis. The floor is 192:
// the portrait is small in a friend's loft. Chrome's PNG of every shipped crew portrait fits by 256 (max 126,333 bytes).
export const UPLOAD_SIDES = [512, 384, 320, 256, 192] as const;
// PNG specification: signature, chunk overhead and RGBA8 IHDR field offsets.
export const PNG_SIGNATURE_BYTES = 8;
export const CHUNK_OVERHEAD = 12;
export const WORD = 4;
export const HEADER_DEPTH = 24;
export const HEADER_COLOR = 25;
export const HEADER_COMPRESSION = 26;
export const HEADER_FILTER = 27;
export const HEADER_INTERLACE = 28;
export const RGBA = 6;
export const DEPTH = 8;
// RIFF WebP container offsets, little-endian fields (VP8X, VP8L and VP8).
export const WEBP = { min: 30, format: 8, type: 12, payload: 20, xWidth: 24, xHeight: 27,
  lossyWidth: 26, lossyHeight: 28, byte: 256, shift: 14, mask: 0x3fff } as const;
export const PIXEL_STRIDE = 4;
export const ALPHA_OFFSET = 3;
