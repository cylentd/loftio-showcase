import sprout from "../ui/assets/crew/sprout-idle.png";
import hoodie from "../ui/assets/crew/hoodie-idle.png";
import puff from "../ui/assets/crew/puff-idle.png";
import chomper from "../ui/assets/crew/chomper-idle.png";
import slime from "../ui/assets/crew/slime-idle.png";
import burger from "../ui/assets/crew/burger-idle.png";
import { TRAVEL_NODES } from "./travel-data";

const SPROUT_SOFA = TRAVEL_NODES.find(node => node.id === "bed-right")!;

export type Point = { x: number; y: number };
export type CastMember = { id: string; art: string; home: Point; interest: Point; spot: Point; sizeBias: number };

// Feet positions in room-desktop.jpg pixels. The room has no easel, kitchen or snack table, so each interest is the
// nearest thing the art does have, named in the comment.
export const CAST: CastMember[] = [
  { id: "sprout", art: sprout, home: { x: 1290, y: 1000 }, interest: { x: SPROUT_SOFA.x, y: SPROUT_SOFA.y }, spot: { x: SPROUT_SOFA.x, y: SPROUT_SOFA.y }, sizeBias: 0.92 },
  // puzzle table: the low wooden table on the left rug
  { id: "hoodie", art: hoodie, home: { x: 750, y: 965 }, interest: { x: 290, y: 698 }, spot: { x: 300, y: 700 }, sizeBias: 1 },
  // easel: none in the art, so Puff paints by the rain window
  { id: "puff", art: puff, home: { x: 1010, y: 895 }, interest: { x: 1600, y: 770 }, spot: { x: 1540, y: 540 }, sizeBias: 0.95 },
  // snack table: the round table with the terrarium and lantern
  { id: "chomper", art: chomper, home: { x: 1490, y: 945 }, interest: { x: 1125, y: 800 }, spot: { x: 1025, y: 680 }, sizeBias: 1 },
  { id: "slime", art: slime, home: { x: 650, y: 400 }, interest: { x: 520, y: 390 }, spot: { x: 460, y: 330 }, sizeBias: 0.85 },
  // kitchen counter: the side table with the stacked books
  { id: "burger", art: burger, home: { x: 1700, y: 770 }, interest: { x: 1200, y: 740 }, spot: { x: 1195, y: 580 }, sizeBias: 0.95 },
];

// Lamps in the art that get a live glow over them.
export const LAMPS: (Point & { r: number })[] = [
  { x: 262, y: 245, r: 120 },
  { x: 232, y: 465, r: 110 },
  { x: 355, y: 462, r: 70 },
  { x: 1023, y: 680, r: 90 },
  { x: 935, y: 660, r: 110 },
  { x: 1147, y: 515, r: 90 },
  { x: 1040, y: 32, r: 70 },
  { x: 932, y: 212, r: 60 },
  { x: 1233, y: 352, r: 70 },
];

// The rain window: rain falls only inside this box.
export const WINDOW_BOX = { x: 1215, y: 0, width: 705, height: 650 };
