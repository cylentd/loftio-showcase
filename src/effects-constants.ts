// Traced against the installed 1920 × 1081 room painting, inset from timber and plants.
import { roomData } from "./room-layout.ts";
import { PORTRAIT_GLASS, PORTRAIT_FOLIAGE, PORTRAIT_COUCH, PORTRAIT_TABLE } from "./portrait-scenery-data.ts";
export const GLASS = roomData([
  [1220,112,1268,88,1268,175,1218,183],
  [1288,69,1332,55,1332,163,1288,172],
  [1350,47,1438,27,1438,145,1350,160],
  [1460,22,1580,0,1580,119,1460,141],
  [1644,0,1805,0,1805,87,1644,111],
  [1289,190,1332,182,1332,345,1296,350,1289,323],
  [1350,181,1438,163,1438,343,1350,350],
  [1460,160,1580,137,1580,335,1460,342],
  [1644,131,1805,106,1805,322,1644,333],
  [1829,250,1919,249,1919,318,1829,322],
  [1375,371,1438,366,1438,521,1351,520,1351,475,1375,443],
  [1460,365,1580,358,1580,525,1460,521],
  [1644,355,1805,344,1805,531,1644,527],
  [1829,343,1919,340,1919,490,1880,501,1880,529,1829,531],
  [1351,543,1438,544,1438,631,1351,623],
  [1460,546,1580,549,1580,593,1547,583,1517,635,1460,632],
  [1644,552,1805,556,1805,650,1644,640],
  [1829,557,1860,558,1860,610,1829,650],
], PORTRAIT_GLASS);
// Small leaf clusters only; boundary vertices never move, stem-side flex is attenuated.
export const FOLIAGE = roomData([
  { x: 324, y: 9, w: 83, h: 99, phase: 0.2, strength: 10 },
  { x: 450, y: 30, w: 99, h: 88, phase: 1.7, strength: 9 },
  { x: 1182, y: 18, w: 75, h: 101, phase: 2.4, strength: 10 },
  { x: 5, y: 191, w: 88, h: 117, phase: 4.1, strength: 8 },
  { x: 708, y: 320, w: 96, h: 94, phase: 0.8, strength: 8 },
  { x: 1135, y: 387, w: 91, h: 79, phase: 3.3, strength: 7 },
], PORTRAIT_FOLIAGE);
export const EFFECTS = roomData({
  maxDelta: 32, cameraX: 85, cameraY: 45, followMs: 170, overscan: 1.12,
  rainCount: 165, rainLeft: 1200, rainWidth: 720, rainSpan: 760, rainTop: 40,
  farSpeed: 0.28, nearSpeed: 0.65, rainAngle: 0.07, rainSeedStride: 97,
  trailCount: 18, trailSpeed: 0.016, trailLength: 19,
  glowBase: 0.32, glowSwing: 0.65, glowSlowMs: 1100, glowFastMs: 410, glowFloor: 0.035,
  moteCount: 36, moteAlpha: 0.72, moteSize: 6, moteSpeed: 0.012,
  moteSpan: 130, moteDrift: 24, moteDriftMs: 2600,
  meshVertices: 9, leafPeriod: 1250, leafFlutter: 530, leafFlutterStrength: 3,
  foregroundDepth: 820, castParallax: 0.24, dragDistance: 240,
}, { rainLeft: 870, rainWidth: 210, rainSpan: 540, rainTop: 0, foregroundDepth: 950, cameraX: 35, cameraY: 20 });
// Couch silhouette stays registered to the original painting; only residents pass behind it.
export const COUCH = roomData([0,756,39,741,90,734,145,735,187,750,229,788,290,813,316,836,401,845,468,875,520,920,547,976,551,1081,0,1081], PORTRAIT_COUCH);
export const DEPTH_PROPS: { depth: number; polygons: number[][] }[] = roomData([{
  depth: 815,
  polygons: [
    [750,709,780,701,842,695,930,693,1030,696,1090,702,1118,712,1118,750,1083,765,1093,797,1070,801,1052,774,953,778,952,815,907,815,904,777,805,768,796,794,763,790,773,761,750,749],
    [791,687,854,677,899,684,899,707,851,718,792,710],
    [933,594,945,597,956,606,953,619,966,626,978,640,983,659,983,693,976,708,948,716,912,713,895,704,891,692,892,658,896,641,909,626,920,620,917,607,923,598],
    [1025,620,1033,623,1035,635,1048,640,1054,649,1052,705,1045,715,1002,714,994,705,995,651,998,644,1015,635,1017,625],
  ],
}], PORTRAIT_TABLE);
