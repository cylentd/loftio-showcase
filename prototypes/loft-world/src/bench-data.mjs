// Constants for the polish benchmark: the three fixed viewpoints, the flight and the measuring rules.
// A viewpoint is { p: eye, t: look-at } in world units, like the entries of world.views.

/** The three places art is judged from. Coordinates were chosen by looking at captures of the valley (loft knoll at
 *  3.6,0.4; Moonwater village and beach cafe near 72..94, 63..73; the lake at 85,25 with radius 30). */
export const BENCH_VIEWS = {
  // the meadow path from behind Sprout and Chomper (they stand at 18,22 and 16.6,24.2, as a play session starts them), about a play camera away
  meadow: { p: [7.8, 9, 14.3], t: [17.3, 5, 23.1] },
  // the village and its lamps seen across the lake, from the far shore
  village: { p: [64, 7, 14], t: [82, 5, 66] },
  // the tree line against the sky, looking west over the meadow
  treeline: { p: [30, 14, 40], t: [-60, 22, 30] },
};
/** Extra `?shot=` viewpoints for captures only; never part of the flight. rocks: the route rocks (36,38 and 40,34). */
export const STAGED_VIEWS = { rocks: { p: [28, 7, 46], t: [38, 2, 36] } };
/** Flight order: starts at the first, passes the second, ends on the third. */
export const BENCH_ORDER = ['meadow', 'village', 'treeline'];

/** The owner's brief: a flight of about 30 seconds. */
export const BENCH_SECONDS = 30;
/** World clock value for every shot and the start of the flight, so two captures of one viewpoint match. */
export const BENCH_TIME_OF_DAY = 12;
/** Frames to wait after the flight for the GPU timer queries still in flight. */
export const GPU_DRAIN_FRAMES = 10;

/** `?bench&off=<names>` switches parts off for one run, to measure what each costs. Scene parts hide the objects
 *  tagged `userData.part` with that name; pass parts skip a render step. */
export const BENCH_SCENE_PARTS = ['grass', 'flowers', 'trees', 'water', 'sky', 'life'];
export const BENCH_PASS_PARTS = ['shadow', 'bloom', 'shafts', 'msaa'];
export const BENCH_PARTS = [...BENCH_SCENE_PARTS, ...BENCH_PASS_PARTS];
/** `?bench=<seconds>` shortens the flight; zero, negative or unreadable values keep the default. */
export const BENCH_MIN_SECONDS = 0;
export const BENCH_OFF_SEPARATOR = ',';

export const MS_PER_SECOND = 1000; // fps = 1000 / average frame milliseconds
export const P95_FRACTION = 0.95; // the "p95" in the report

/** Result panel look; chosen to sit small in a corner, away from the scene. */
export const PANEL_STYLE = 'position:fixed;left:12px;top:12px;z-index:99;padding:10px 12px;background:rgba(10,14,20,.82);color:#e8f0f2;font:12px/1.4 ui-monospace,monospace;border-radius:6px;white-space:pre';
/** Everything but the canvas and the panel is hidden, so captures show only the scene. */
export const CLEAN_CSS = 'body>*:not(canvas):not([data-bench-panel]){visibility:hidden!important}';
export const GPU_EXTENSION = 'EXT_disjoint_timer_query_webgl2';
