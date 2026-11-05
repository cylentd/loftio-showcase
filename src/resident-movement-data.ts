import { roomData } from "./room-layout.ts";
import { PORTRAIT_PLACEMENT, PORTRAIT_SURFACES, PORTRAIT_NODES, PORTRAIT_COUCH_SEAT } from "./portrait-movement-data.ts";
export const COUCH_SEAT = roomData({ ...PORTRAIT_COUCH_SEAT, enabled: false }, PORTRAIT_COUCH_SEAT);
export const PLACEMENT = roomData({ back: 725, front: 1020, backLeft: 390, backRight: 1710, frontLeft: 300, frontRight: 1770, threshold: 8, keyStep: 24, fineStep: 6, lift: 0.14, air: 0.5, heldDepth: 2000, interestRadius: 110, loftKeyY: 400, groundKeyY: 800 }, PORTRAIT_PLACEMENT);
export const LANDING = { touchDown: 0.45, squashX: 0.1, squashY: 0.14 };
export const SEATING_DEPTH = roomData({ chair: 658, table: 690, lounge: 620, ottoman: 645 }, { chair: 515, table: 525, lounge: 500, ottoman: 545 });
export const CHAIR_SUPPORT = roomData({ headroom: 170 }, { headroom: 0 });
export const SURFACE_SPLIT = roomData({ y: 570, x: 940 }, { y: 420, x: 650 });
const desktopSurfaces = {
  window: { back: 685, front: 725, backLeft: 1400, backRight: 1830, frontLeft: 1380, frontRight: 1840 },
  "bed-left": { back: 332, front: 358, backLeft: 420, backRight: 610, frontLeft: 400, frontRight: 635 },
  "bed-right": { back: 352, front: 378, backLeft: 1040, backRight: 1135, frontLeft: 1020, frontRight: 1150 },
  ground: PLACEMENT,
  "loft-left": { back: 380, front: 410, backLeft: 365, backRight: 840, frontLeft: 350, frontRight: 840 },
  "loft-right": { back: 380, front: 410, backLeft: 1040, backRight: 1200, frontLeft: 1040, frontRight: 1220 },
  "chair-left": { back: 680, front: 712, backLeft: 245, backRight: 350, frontLeft: 245, frontRight: 350 },
  "chair-right": { back: 660, front: 700, backLeft: 505, backRight: 570, frontLeft: 505, frontRight: 570 },
  table: { back: 626, front: 658, backLeft: 285, backRight: 500, frontLeft: 270, frontRight: 515 },
  lounge: { back: 608, front: 630, backLeft: 710, backRight: 825, frontLeft: 710, frontRight: 835 },
  ottoman: { back: 632, front: 654, backLeft: 1200, backRight: 1300, frontLeft: 1190, frontRight: 1305 },
};
export const SURFACES = roomData(desktopSurfaces, { ...PORTRAIT_SURFACES, ground: { ...PLACEMENT, ...PORTRAIT_PLACEMENT } });
export const WANDER = { afterDropMs: 8000, loftRangeX: 120, loftRangeY: 20 };
export const WANDER_DESTINATIONS = roomData([
  { x: 300, y: 698 }, { x: 535, y: 680 }, { x: 770, y: 622 },
  { x: 1250, y: 646 }, { x: 510, y: 345 }, { x: 1090, y: 365 },
  { x: 1570, y: 700 },
], PORTRAIT_NODES.filter(node => ["chair-left", "chair-right", "lounge", "ottoman", "bed-left", "bed-right", "window", "couch"].includes(node.id)).map(({ x, y }) => ({ x, y })));
