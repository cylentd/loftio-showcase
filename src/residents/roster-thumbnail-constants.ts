/** The encoding of a published thumbnail. WebP keeps its alpha channel and is smaller than PNG; a browser that cannot encode it (Safari) falls back to PNG, and both are `data:image/` URLs the reader accepts. */
export const THUMB_MIME = 'image/webp';
/** Lossy quality for a thumbnail, 0 to 1. Source: the browser's own default for WebP; the art is 256 px or less, so artefacts stay below what Loft Rumble draws at. */
export const THUMB_QUALITY = 0.8;
