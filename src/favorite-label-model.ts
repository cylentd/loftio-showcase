export type Point = { x: number; y: number };
/** A screen box in client pixels; a DOMRect fits. */
export type Box = { left: number; top: number; right: number; bottom: number };
type Size = { width: number; height: number };
type Look = { scale: number; x: number; y: number; offsetY: number };
type Frame = {
  origin: { left: number; top: number }; viewport: { width: number; height: number };
  gutter: number; gap: number; size: Size;
};
/** Where a label went: `left`/`top` in the world layer's pixels, `offset` from its anchor on screen (feed it back as `previous`). */
export type Placement = { left: number; top: number; offset: Point };
export type LabelRequest = { anchor: Point; size: Size; previous?: Point };

/** Top centre of a favorite's painted mask: the label hangs above the thing that lights, not above where its resident stands. */
export function favoriteAnchor(polygons: number[][]): Point {
  const xs = polygons.flatMap(polygon => polygon.filter((_, index) => index % 2 === 0));
  const ys = polygons.flatMap(polygon => polygon.filter((_, index) => index % 2 === 1));
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: Math.min(...ys) };
}

const area = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
const grow = (b: Box, by: number): Box => ({ left: b.left - by, top: b.top - by, right: b.right + by, bottom: b.bottom + by });
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/**
 * Screen position of a label above `anchor`. Rule: centred above the spot if that is clear; else the previous place if it
 * is still clear; else the clear place nearest centred-above, tried beside and above or below every box in the way. Clear
 * means `gap` from every box in `avoid` and from the anchor itself, and `gutter` inside the screen. Nothing clear: least overlap.
 */
export function favoriteLabelPlacement(anchor: Point, look: Look, frame: Frame, avoid: Box[] = [], previous?: Point): Placement {
  const { origin, viewport, gutter, gap, size: { width, height } } = frame;
  const ax = origin.left + (anchor.x - look.x) * look.scale, ay = origin.top + (anchor.y - look.y) * look.scale + look.offsetY;
  const obstacles = [{ left: ax, top: ay, right: ax, bottom: ay }, ...avoid];
  const keepOut = obstacles.map(box => grow(box, gap));
  const at = (x: number, y: number) => {
    const left = clamp(x, gutter, viewport.width - gutter - width), top = clamp(y, gutter, viewport.height - gutter - height);
    const box = { left, top, right: left + width, bottom: top + height };
    return { left, top, overlap: keepOut.reduce((sum, out) => sum + area(box, out), 0) };
  };
  const home = { x: ax - width / 2, y: ay - height - gap };
  const centred = at(home.x, home.y);
  const kept = previous && at(ax + previous.x, ay + previous.y);
  const xs = [home.x, ...obstacles.flatMap(box => [Math.floor(box.left - gap - width), Math.ceil(box.right + gap)])];
  const ys = [home.y, ...obstacles.flatMap(box => [Math.floor(box.top - gap - height), Math.ceil(box.bottom + gap)])];
  const distance = (spot: { left: number; top: number }) => Math.hypot(spot.left - home.x, spot.top - home.y);
  const best = centred.overlap === 0 ? centred : kept && kept.overlap === 0 ? kept
    : xs.flatMap(x => ys.map(y => at(x, y))).reduce((a, b) =>
      b.overlap < a.overlap || (b.overlap === a.overlap && distance(b) < distance(a)) ? b : a, centred);
  return { left: best.left - origin.left, top: best.top - origin.top, offset: { x: best.left - ax, y: best.top - ay } };
}

/** Places labels in order; each one also keeps clear of the labels placed before it. `avoid` is in client pixels. */
export function favoriteLabelLayout(requests: LabelRequest[], look: Look, frame: Omit<Frame, "size">, avoid: Box[]): Placement[] {
  const taken = [...avoid];
  return requests.map(({ anchor, size, previous }) => {
    const placed = favoriteLabelPlacement(anchor, look, { ...frame, size }, taken, previous);
    const left = placed.left + frame.origin.left, top = placed.top + frame.origin.top;
    taken.push({ left, top, right: left + size.width, bottom: top + size.height });
    return placed;
  });
}
