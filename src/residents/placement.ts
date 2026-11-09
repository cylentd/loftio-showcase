export type Point = { x: number; y: number };
/** How far apart two residents' feet must be, side to side (x) and front to back (y), in world px. */
export type Clearance = { x: number; y: number };
export type GridShape = { step: number; columns: number; rows: readonly number[] };

// Elliptical: a neighbour straight behind is as crowded as one at the shoulder, because the
// front sprite is drawn over the back one's feet until the back one stands a full height deeper.
const nearest = (point: Point, claims: Point[], clearance: Clearance) =>
  claims.reduce((least, claim) => Math.min(least,
    Math.hypot((point.x - claim.x) / clearance.x, (point.y - claim.y) / clearance.y)), Infinity);

/** Spots walking away from the door, one row at a time, each pushed onto the floor by `floor`. */
export function destinationGrid(entry: Point, shape: GridShape, floor: (point: Point) => Point): Point[] {
  return shape.rows.flatMap(offset => Array.from({ length: shape.columns }, (_, index) =>
    floor({ x: entry.x - (index + 1) * shape.step, y: entry.y + offset })));
}

export const ARRIVAL = {
  /** Where newcomers come in: the door's floor spot in each room painting. */
  entry: { desktop: { x: 1380, y: 1020 }, portrait: { x: 820, y: 1160 } },
  // Clearance between feet. x 190: a resident is about as wide as it is tall, and DEPTH puts the
  // row in front of the door at ~210 px tall for the originals, ~180 for a 0.85 newcomer, so half
  // of each is ~190. y 240: DEPTH.frontHeight, the depth at which one sprite clears another's head.
  clearance: { x: 190, y: 240 },
  // Half a clearance per column; rows 100, 220 and 340 px back from the door span the open floor
  // (PLACEMENT back 725 to front 1020) without using the front edge, where the phone tray sits.
  grid: { step: 95, columns: 12, rows: [-100, -220, -340] },
} as const;

/** The first open floor spot near the door: where a newcomer settles, and where its basket waits. */
export function arrivalPlace(entry: Point, claims: Point[], floor: (point: Point) => Point): Point {
  return pickDestination(destinationGrid(entry, ARRIVAL.grid, floor), claims, ARRIVAL.clearance);
}

// First candidate clear of every claim; if furniture or residents crowd them all, the least
// crowded one. Room capacity is the registry's job, so this never reports the room as full.
export function pickDestination(candidates: Point[], claims: Point[], clearance: Clearance): Point {
  if (!candidates.length) throw Error('No destination candidate');
  const clear = candidates.find(point => nearest(point, claims, clearance) >= 1);
  if (clear) return clear;
  return candidates.reduce((best, point) => nearest(point, claims, clearance) > nearest(best, claims, clearance) ? point : best);
}
