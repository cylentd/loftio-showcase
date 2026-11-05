export const PORTRAIT_WORLD = { width: 1080, height: 1350 };
export const PORTRAIT_DEPTH = { backY: 550, frontY: 1050, backHeight: 115, frontHeight: 220 };
export const PORTRAIT_PLACEMENT = { back: 615, front: 1240, backLeft: 380, backRight: 1015, frontLeft: 250, frontRight: 1000, loftKeyY: 325, groundKeyY: 850, interestRadius: 85 };
export const PORTRAIT_COUCH_SEAT = { enabled: true, depth: 800, x: 170, y: 735, back: 700, front: 755, backLeft: 90, backRight: 250, frontLeft: 80, frontRight: 310, approach: { left: 120, right: 420, back: 728, front: 840 } };
export const PORTRAIT_MESSAGE_SPOT = { x: 500, y: 1120 };
export const PORTRAIT_SURFACES = {
  window: { back: 590, front: 625, backLeft: 950, backRight: 1030, frontLeft: 940, frontRight: 1040 },
  "bed-left": { back: 275, front: 295, backLeft: 280, backRight: 410, frontLeft: 270, frontRight: 425 },
  "bed-right": { back: 300, front: 315, backLeft: 735, backRight: 800, frontLeft: 725, frontRight: 815 },
  "loft-left": { back: 310, front: 330, backLeft: 260, backRight: 610, frontLeft: 250, frontRight: 610 },
  "loft-right": { back: 320, front: 340, backLeft: 725, backRight: 825, frontLeft: 725, frontRight: 835 },
  "chair-left": { back: 545, front: 565, backLeft: 165, backRight: 240, frontLeft: 160, frontRight: 245 },
  "chair-right": { back: 525, front: 545, backLeft: 375, backRight: 420, frontLeft: 370, frontRight: 425 },
  table: { back: 490, front: 510, backLeft: 235, backRight: 355, frontLeft: 225, frontRight: 365 },
  lounge: { back: 495, front: 515, backLeft: 500, backRight: 590, frontLeft: 495, frontRight: 595 },
  ottoman: { back: 540, front: 560, backLeft: 840, backRight: 910, frontLeft: 830, frontRight: 915 },
};
export const PORTRAIT_NODES = [
  { id: "left-front", x: 440, y: 700, zone: "ground" },
  { id: "right-front", x: 810, y: 700, zone: "ground" },
  { id: "left-back", x: 450, y: 565, zone: "ground" },
  { id: "right-back", x: 810, y: 570, zone: "ground" },
  { id: "ladder-bottom", x: 735, y: 565, zone: "ground" },
  { id: "window", x: 990, y: 610, zone: "ground" },
  { id: "ladder-top", x: 640, y: 320, zone: "landing" },
  { id: "loft-left", x: 600, y: 320, zone: "loft-left" },
  { id: "loft-right", x: 735, y: 330, zone: "loft-right" },
  { id: "chair-left-approach", x: 240, y: 630, zone: "ground" },
  { id: "chair-right-approach", x: 450, y: 615, zone: "ground" },
  { id: "lounge-approach", x: 450, y: 565, zone: "ground" },
  { id: "ottoman-approach", x: 900, y: 610, zone: "ground" },
  { id: "chair-left", x: 190, y: 556, zone: "chair-left" },
  { id: "chair-right", x: 395, y: 535, zone: "chair-right" },
  { id: "lounge", x: 550, y: 505, zone: "lounge" },
  { id: "ottoman", x: 880, y: 550, zone: "ottoman" },
  { id: "table", x: 300, y: 500, zone: "table" },
  { id: "bed-left-approach", x: 450, y: 320, zone: "loft-left" },
  { id: "bed-right-approach", x: 820, y: 330, zone: "loft-right" },
  { id: "bed-left", x: 350, y: 285, zone: "bed-left" },
  { id: "bed-right", x: 760, y: 308, zone: "bed-right" },
  { id: "couch-approach", x: 420, y: 840, zone: "ground" },
  { id: "couch", x: 170, y: 735, zone: "couch" },
];
export const PORTRAIT_OBSTACLES = [
  { left: 470, right: 780, back: 580, front: 665 },
  { left: 160, right: 420, back: 490, front: 605 },
  { left: 0, right: 350, back: 600, front: 930 },
];
export const PORTRAIT_CAST = [
  { id: "sprout", home: { x: 710, y: 1010 }, interest: { x: 760, y: 308 }, spot: { x: 760, y: 308 } },
  { id: "hoodie", home: { x: 170, y: 735 }, interest: { x: 190, y: 556 }, spot: { x: 190, y: 556 } },
  { id: "puff", home: { x: 500, y: 810 }, interest: { x: 990, y: 610 }, spot: { x: 990, y: 440 } },
  { id: "chomper", home: { x: 840, y: 930 }, interest: { x: 810, y: 700 }, spot: { x: 697, y: 540 } },
  { id: "slime", home: { x: 450, y: 320 }, interest: { x: 350, y: 285 }, spot: { x: 350, y: 285 } },
  { id: "burger", home: { x: 900, y: 740 }, interest: { x: 900, y: 610 }, spot: { x: 820, y: 465 } },
];
