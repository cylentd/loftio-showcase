// Pure geometry for the see-through fade: which scenery hides the lead resident, and how opacity eases.
// Shapes are the camera model's: a sphere {center,radius}, or a cylinder with minY/maxY.
const EPSILON = 1e-9;

/** Fraction along from->to where the segment first touches the shape grown by pad, or null. */
function segmentEntry(from, to, shape, pad) {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const fx = from.x - shape.center.x, fy = from.y - shape.center.y, fz = from.z - shape.center.z;
  const reach = shape.radius + pad;
  if (shape.minY === undefined) {
    const length2 = dx * dx + dy * dy + dz * dz;
    const t = length2 < EPSILON ? 0 : Math.min(Math.max(-(fx * dx + fy * dy + fz * dz) / length2, 0), 1);
    const gap = Math.hypot(fx + dx * t, fy + dy * t, fz + dz * t);
    return gap <= reach ? t : null;
  }
  let low = 0, high = 1;
  const a = dx * dx + dz * dz, b = 2 * (fx * dx + fz * dz), c = fx * fx + fz * fz - reach * reach;
  if (a < EPSILON) { if (c > 0) return null; }
  else {
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    low = Math.max(low, (-b - root) / (2 * a)); high = Math.min(high, (-b + root) / (2 * a));
  }
  const bottom = shape.minY - pad - from.y, top = shape.maxY + pad - from.y;
  if (Math.abs(dy) < EPSILON) { if (bottom > 0 || top < 0) return null; }
  else {
    const t1 = bottom / dy, t2 = top / dy;
    low = Math.max(low, Math.min(t1, t2)); high = Math.min(high, Math.max(t1, t2));
  }
  return low <= high ? low : null;
}

/**
 * Ids of the objects whose shapes the sight line from -> to passes through, nearest the camera first, at most max.
 * An id in faded is tested with margin + hysteresis, so an object at the edge of the line does not flicker.
 * objects: [{id, shapes: [shape, ...]}].
 */
export function blockedIds({ from, to, objects, faded, margin, hysteresis, max }) {
  const hits = [];
  for (const object of objects) {
    const pad = margin + (faded.includes(object.id) ? hysteresis : 0);
    let first = null;
    for (const shape of object.shapes) {
      const t = segmentEntry(from, to, shape, pad);
      if (t !== null && (first === null || t < first)) first = t;
    }
    if (first !== null) hits.push({ id: object.id, t: first });
  }
  return hits.sort((p, q) => p.t - q.t).slice(0, max).map((hit) => hit.id);
}

/** One step of an opacity ease: toward target by speed * dt, never past it. */
export function nextOpacity(current, target, dt, speed) {
  const step = speed * dt;
  return current < target ? Math.min(current + step, target) : Math.max(current - step, target);
}
