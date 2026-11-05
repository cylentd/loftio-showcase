import { roomData } from "./room-layout.ts";
import { PORTRAIT_NODES, PORTRAIT_OBSTACLES } from "./portrait-movement-data.ts";
export const TRAVEL = roomData({
  climbMs: 4800, climbDepth: 460,
  groundZone: "ground", ladderBottom: "ladder-bottom", ladderTop: "ladder-top",
}, { climbDepth: 355 });
export const TRAVEL_OBSTACLES = roomData([
  { left: 735, right: 1135, back: 710, front: 825 },
  { left: 225, right: 555, back: 620, front: 752 },
], PORTRAIT_OBSTACLES);
export const TRAVEL_NODES = roomData([
  { id: "left-front", x: 600, y: 850, zone: "ground" },
  { id: "right-front", x: 1200, y: 850, zone: "ground" },
  { id: "left-back", x: 620, y: 690, zone: "ground" },
  { id: "right-back", x: 1190, y: 690, zone: "ground" },
  { id: "ladder-bottom", x: 980, y: 690, zone: "ground" },
  { id: "window", x: 1570, y: 700, zone: "ground" },
  { id: "ladder-top", x: 932, y: 400, zone: "landing" },
  { id: "loft-left", x: 820, y: 400, zone: "loft-left" },
  { id: "loft-right", x: 1050, y: 400, zone: "loft-right" },
  { id: "chair-left-approach", x: 300, y: 780, zone: "ground" },
  { id: "chair-right-approach", x: 580, y: 760, zone: "ground" },
  { id: "lounge-approach", x: 770, y: 700, zone: "ground" },
  { id: "ottoman-approach", x: 1250, y: 730, zone: "ground" },
  { id: "chair-left", x: 300, y: 698, zone: "chair-left" },
  { id: "chair-right", x: 535, y: 680, zone: "chair-right" },
  { id: "lounge", x: 770, y: 622, zone: "lounge" },
  { id: "ottoman", x: 1250, y: 646, zone: "ottoman" },
  { id: "table", x: 405, y: 645, zone: "table" },
  { id: "bed-left-approach", x: 650, y: 395, zone: "loft-left" },
  { id: "bed-right-approach", x: 1170, y: 400, zone: "loft-right" },
  { id: "bed-left", x: 510, y: 345, zone: "bed-left" },
  { id: "bed-right", x: 1090, y: 365, zone: "bed-right" },
], PORTRAIT_NODES);
export const TRAVEL_LINKS = [
  ["ladder-bottom", "ladder-top"], ["ladder-top", "loft-left"], ["ladder-top", "loft-right"],
  ["chair-left-approach", "chair-left"], ["chair-right-approach", "chair-right"],
  ["lounge-approach", "lounge"], ["ottoman-approach", "ottoman"],
  ["chair-right", "table"], ["bed-left-approach", "bed-left"], ["bed-right-approach", "bed-right"],
  ["couch-approach", "couch"],
];
