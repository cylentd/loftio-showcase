// Motion values and room geometry use the selected painting's pixel coordinates.

import { roomData } from "./room-layout.ts";
import { PORTRAIT_WORLD, PORTRAIT_DEPTH } from "./portrait-movement-data.ts";
export const WORLD = roomData({ width: 1920, height: 1081 }, PORTRAIT_WORLD);

// Depth: a resident's height follows its feet's y. Back of the floor (behind the coffee table) to the front edge.
export const DEPTH = roomData({ backY: 680, frontY: 1040, backHeight: 135, frontHeight: 245 }, PORTRAIT_DEPTH);

export const ROUTINE = {
  minGapMs: 8000, // spec item 3: one walk every 8 to 20 s
  maxGapMs: 20000,
  busyMinGapMs: 600, // ?busy=1, for the FPS "busy" measure: keeps three walking
  busyMaxGapMs: 1400,
  firstWalkMs: 1800, // the first walk starts soon, so the room is visibly alive on arrival
  maxMoving: 3,
  seed: 20261103,
};

export const HOP = {
  durationMs: 440, // one hop, crouch to landing
  crouch: 0.16, // share of the hop spent crouching before take-off
  land: 0.2, // share spent landing and recovering
  length: 0.42, // hop length, in resident heights
  height: 0.28, // hop apex, in resident heights
  squash: { x: 1.16, y: 0.82 }, // crouch and landing
  stretch: { x: 0.9, y: 1.12 }, // in the air
  lean: 0.12, // radians, forward into the hop
};

/** Turning around: a quick squash-hop with the flip hidden at its top, so the flat edge of the art never shows (owner's pick, 2026-11-08). */
export const TURN = {
  ms: 420, // one turn, start to settled; 220 was too fast to see (owner, 2026-11-08)
  minWidth: 0.6, // narrowest the body gets, as a share of full width; under ~0.5 it starts to read as a card edge
  stretch: 0.08, // taller by this share at the narrowest point, so the body keeps its volume
  hop: 0.06, // apex lift, in resident heights; a hop while standing, about a fifth of a walking hop
};

export const IDLE = {
  breathMs: 2600, // one in-and-out breath
  breath: 0.03, // vertical scale swing
  fidgetMinMs: 3500, // a little hop, look-around or wiggle, per resident
  fidgetMaxMs: 9000,
  nodMs: 900,
  pressMs: 380,
};

// Two layers: a wide soft pool and a tight dark core where the body touches the floor.
export const SHADOW = { width: 1.0, height: 0.2, alpha: 0.55, coreWidth: 0.62, coreHeight: 0.085, coreAlpha: 0.9, airShrink: 0.45 };

export const CUE = { lift: 0.32, bobMs: 2200, bob: 12, sway: 0.08, size: 84 };

export const AMBIENCE = {
  rainDrops: 140,
  rainSpeed: 1.6, // world px per ms
  rainLength: 26,
  motes: 46,
  moteDrift: 0.012,
  glowFlickerMs: 6500, // a warm lamp, not a fault (matches --motion-flicker)
  parallax: 12, // world px the camera drifts with the pointer on desktop
  moteParallax: 2.4, // motes drift this many times further, so they read as nearer
};

export const BUBBLE_MS = 3000; // spec item 5
export const METER_MS = 500;
export const MAX_RESOLUTION = 2; // a phone's full-width world at DPR 3 would pass the 4096 texture limit
