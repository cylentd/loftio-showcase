// Look data for tree size and crown variety. Sizes are multipliers on a tree kind's own height (1 = the old average).
/** Height multiplier range [min, max] per size class. */
export const TREE_SIZES = {
  sapling: [0.45, 0.65],
  medium: [0.9, 1.3],
  tall: [1.6, 2.2],
  giant: [2.4, 3.0], // the rare one that breaks the skyline
};
/** Share of trees in each class, in order sapling, medium, tall, giant (sums to 1). */
export const TREE_SIZE_SHARE = { sapling: 0.1, medium: 0.48, tall: 0.32, giant: 0.1 };
/** Crown width multiplier per shape: a tall narrow crown, the round default, a wide spreading one. */
export const TREE_SHAPES = { narrow: 0.72, round: 1, wide: 1.3 };
/** Share of trees per shape, in order narrow, round, wide (sums to 1). */
export const TREE_SHAPE_SHARE = { narrow: 0.3, round: 0.4, wide: 0.3 };
/** A taller tree widens by height to this power, so a giant is stout, not a pole. */
export const TREE_WIDTH_FROM_HEIGHT = 0.5;
/** Largest lean off vertical, radians (about 3.4 degrees). */
export const TREE_LEAN_MAX = 0.06;
/** Salts that make the size, shape and lean hashes independent of each other. */
export const TREE_HASH_SALT = { size: 1.7, within: 5.3, shape: 9.1, leanX: 13.9, leanZ: 17.3 };
/** A tree's yaw is x * x-factor + z * z-factor radians (the values the valley always used). */
export const TREE_YAW = { x: 12.9, z: 7.3 };
/** Hash constants for a position hash (sin-fract): the two multipliers and the amplitude. */
export const TREE_HASH = { x: 127.1, z: 311.7, amp: 43758.5453 };
/** Pines scale by height to this power (1 = the full factor; trees keep the whole factor, pines take most of it). */
export const PINE_HEIGHT_POWER = 0.85;
/** A trunk is planted at the lowest ground within this many crown-widths of its foot, so a wide root flare on a slope meets the ground. */
export const TREE_ROOT_REACH = 1.2;
/** How far below that lowest ground the trunk base sits, world units. */
export const TREE_SINK = 0.2;
/** How far each crown normal leans toward "straight out from the crown centre" (0 = off, today's lumpy lighting; 1 = lit as one ball). Chosen by eye. */
export const CROWN_SOFT_NORMAL = 0.5; // was 0.75 for the lumpy crowns; the merged surface has true smooth normals, so less leaning keeps its volume
/** Strength of the lighter felt rim toward a crown's silhouette (0 = off). Chosen by eye. */
export const CROWN_RIM = 0.45;
/** Debug: the URL parameter `crown=0` forces both strengths to 0 so the old picture can be captured. */
export const CROWN_DEBUG_PARAM = 'crown';
/** Merged crowns: blend radius of the smooth union, as a share of the mean blob radius. Too low leaves creases, too high makes a potato. Chosen by eye. */
export const CROWN_BLEND = 0.14;
/** The smooth union swells where many blobs overlap; the field is pulled in by this share of the mean blob radius to keep the old size. Chosen by eye. */
export const CROWN_SHRINK = 0.12;
/** Grid cell edge as a share of the mean blob radius (the grid resolution). Coarser cells are tried automatically if the triangle budget is exceeded. */
export const CROWN_CELL = 0.36;
/** Same, in phone mode (fewer triangles, cheaper to draw). */
export const CROWN_CELL_LOW = 0.28;
/** Factor a cell grows by each time the triangle budget is exceeded. */
export const CROWN_CELL_GROWTH = 1.12;
/** Empty cells kept around the blobs so the field is outside at the grid edge and the surface closes (at least 1). */
export const CROWN_PAD_CELLS = 2;
/** A blob counts toward the smooth union only within this many blend radii of its surface (exp(-8) is under 0.04%). */
export const CROWN_REACH = 8;
/** Triangles in one old blob (an icosahedron of detail 2); the merged crown may use at most blobs x this. */
export const BLOB_TRIANGLES = 320;
/** A blob whose share of a vertex is below this is skipped when blending vertex colours. */
export const MIN_BLEND_WEIGHT = 0.01;
/** Debug: `crowns=blobs` in the URL keeps the old separate-blob crowns. */
export const CROWN_MESH_PARAM = 'crowns';
export const CROWN_MESH_OLD = 'blobs';
/** Circles where no tree grows: [x, z, radius]. The route rocks (36..49, 34..49) and the knoll tree at -7.5,-5. */
export const TREE_KEEP_CLEAR = [[42.5, 41.5, 11], [-7.5, -5, 10]];
