// Path-lamp light map: every number that shapes the warm pools on the ground. Copy for the pools lives nowhere (no text).
export const LAMP_MAP = {
  half: 400, // half the mapped square in world units; must equal LAND.half in terrain.js (world.js passes LAND.half)
  minHeightSpan: 0.000001, // avoids dividing by zero when every lamp stands at one height
  size: 1024, // cells across the square; 800 units / 1024 = 0.78 units a cell (was 420 / 512 = 0.82), so a pool edge stays round. 4 MB RGBA
  radius: 9, // world units from a lamp where its light reaches zero (was 7: the pool did not reach past the path edge into the grass)
  color: [255, 180, 106], // warm lamp colour, 0..255 (#ffb46a)
  gain: 2.6, // how strongly the map adds to the surface colour at full strength (was 1.1: visible on the path only, lost on green grass)
  fadeNear: 1.6, // height above or below the lamp's ground where the light starts to fade (units): grass tips and soil still lit
  fadeFar: 5.5, // height difference where the light is gone: keeps treetops and the underside of hills dark
};
