// Checks a generated image's real pixels: is the background actually transparent, is the subject inside the frame
// with margins, and does an opaque image look like a painted-on checkerboard. Pure, so tests feed it synthetic pixels;
// the browser feeds it canvas getImageData.

/** Alpha at or below this counts as background. Anti-aliased edges sit above it. */
const TRANSPARENT_ALPHA_MAX = 8;
/** Smallest gap between subject and canvas edge, as a share of the side: the template asks for comfortable margins. */
const MIN_MARGIN_SHARE = 0.03;
/** Corner sample used to spot a baked checkerboard, in pixels. Covers at least two squares of a typical 8-16 px pattern. */
const CORNER_SAMPLE = 32;
/** A checkerboard is two light greys, each covering a large share of the corner sample. */
const CHECKER_MIN_SHARE = 0.3;
const CHECKER_MIN_LIGHTNESS = 150;
const CHECKER_MAX_CHROMA = 12;

export type AlphaVerdict = "transparent" | "opaque" | "checkerboard-suspect" | "empty";
export type Bounds = { left: number; top: number; right: number; bottom: number };
export type AlphaReport = {
  verdict: AlphaVerdict;
  cornersTransparent: boolean;
  marginOk: boolean;
  bounds: Bounds | null;
  /** Subject height as a share of canvas height; the template asks for about 0.8. */
  fillHeightShare: number;
};

type Pixels = Uint8Array | Uint8ClampedArray;

const alphaAt = (rgba: Pixels, width: number, x: number, y: number) => rgba[(y * width + x) * 4 + 3] ?? 0;

function subjectBounds(rgba: Pixels, width: number, height: number): Bounds | null {
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alphaAt(rgba, width, x, y) <= TRANSPARENT_ALPHA_MAX) continue;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  return right < 0 ? null : { left, top, right, bottom };
}

function looksLikeCheckerboard(rgba: Pixels, width: number, height: number): boolean {
  const side = Math.min(CORNER_SAMPLE, width, height);
  const counts = new Map<string, number>();
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const at = (y * width + x) * 4;
      const [r = 0, g = 0, b = 0] = [rgba[at], rgba[at + 1], rgba[at + 2]];
      const grey = Math.max(r, g, b) - Math.min(r, g, b) <= CHECKER_MAX_CHROMA && Math.min(r, g, b) >= CHECKER_MIN_LIGHTNESS;
      const key = grey ? `${r},${g},${b}` : "other";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const total = side * side;
  const greys = [...counts].filter(([key, count]) => key !== "other" && count / total >= CHECKER_MIN_SHARE);
  return greys.length === 2;
}

export function inspectAlpha(rgba: Pixels, width: number, height: number): AlphaReport {
  const corners = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]] as const;
  const cornersTransparent = corners.every(([x, y]) => alphaAt(rgba, width, x, y) <= TRANSPARENT_ALPHA_MAX);
  const bounds = subjectBounds(rgba, width, height);
  const marginX = Math.ceil(width * MIN_MARGIN_SHARE);
  const marginY = Math.ceil(height * MIN_MARGIN_SHARE);
  const marginOk = bounds !== null && cornersTransparent && bounds.left >= marginX && bounds.top >= marginY
    && bounds.right <= width - 1 - marginX && bounds.bottom <= height - 1 - marginY;
  const fillHeightShare = bounds ? (bounds.bottom - bounds.top + 1) / height : 0;
  const verdict: AlphaVerdict = !bounds ? 'empty' : cornersTransparent ? "transparent"
    : looksLikeCheckerboard(rgba, width, height) ? "checkerboard-suspect" : "opaque";
  return { verdict, cornersTransparent, marginOk, bounds, fillHeightShare };
}
