// Pure size rule for a published thumbnail: no DOM, no canvas. The caller supplies the cap (`THUMB_MAX_SIDE`).

/** The size of `width` x `height` scaled down so its longest side is at most `maxSide`; null for a size that is not a positive finite pair. Never enlarges, never goes below one pixel. */
export const fitWithin = (width: number, height: number, maxSide: number): { width: number; height: number } | null => {
  if (!(Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0)) return null;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const side = (value: number) => Math.min(maxSide, Math.max(1, Math.round(value * scale)));
  return { width: side(width), height: side(height) };
};
