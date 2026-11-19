// Look data for route rocks.
/** weld: vertices closer than 1/weld world units count as one point when normals are averaged (1/1000 unit). */
export const ROCK_SMOOTH = { weld: 1000 };
/**
 * The drawn boulder. sides: segments around. profile: [height fraction base..top, radius fraction of the rock's r], a
 * tucked-in foot, a belly near a quarter of the way up, a curve in, and a top rim that stays inside the hull's landing
 * radius (0.68 r) while it is still within 3% of the top height. wobble: shrink of up to this fraction of r per angle,
 * from a hash of the rock's position, so no two rocks match. hash*: constants of that hash.
 */
export const ROCK_DOME = {
  sides: 28, wobble: 0.1, hashX: 12.9898, hashZ: 78.233, hashAmp: 43758.5453,
  profile: [[0, 0.62], [0.07, 0.84], [0.2, 0.97], [0.38, 1], [0.56, 0.95], [0.74, 0.85], [0.88, 0.76], [0.955, 0.69], [0.985, 0.62], [1, 0.46]],
};
