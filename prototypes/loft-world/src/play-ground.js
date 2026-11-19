// Where a resident can stand: the valley floor, a bridge deck, or the lake surface when wading.
export function createGround({ world, P, H, lake }) {
  /** Height of a bridge deck under x,z, if the caller at height y is on or above it; otherwise very low. */
  function rampAt(x, z, y) {
    let best = -1e9;
    for (const r of world.ramps ?? []) {
      if (x < r.box[0] || x > r.box[1] || z < r.box[2] || z > r.box[3]) continue;
      for (let i = 0; i < r.points.length - 1; i++) {
        const a = r.points[i], b = r.points[i + 1], dx = b.x - a.x, dz = b.z - a.z;
        const t = Math.min(Math.max(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz), 0), 1);
        if (Math.hypot(x - a.x - dx * t, z - a.z - dz * t) > r.width) continue;
        const deck = a.y + (b.y - a.y) * t;
        if (y > deck - P.stepUp) best = Math.max(best, deck);
      }
    }
    return best;
  }
  const inWater = (x, z) => Math.hypot(x - lake.x, z - lake.z) < lake.r * 1.4 && H(x, z) < lake.y - 0.6;
  /** Ground under x,z. Pass your own height y to also count bridge decks you are standing on or above. */
  const floorAt = (x, z, y) => Math.max(H(x, z), Math.hypot(x - lake.x, z - lake.z) < lake.r * 1.4 ? lake.y - 0.5 : -1e9, y === undefined ? -1e9 : rampAt(x, z, y));
  return { rampAt, inWater, floorAt };
}
