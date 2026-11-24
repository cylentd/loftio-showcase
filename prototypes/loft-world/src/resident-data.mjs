import {AIR_LIFT,STARTER_AIR_PIVOT_Y} from './resident-art-constants.mjs';

export const RESIDENTS = ['sprout','chomper'];
export const POSES = ['happy','determined','dizzy','back'];
export const ASSET_ROOT = 'assets/residents/';
// frontOnly is retired (owner, 2026-11-17: "the always excited pose looks fake"): residents rest in their idle painting.
export const RESIDENT_LOOK = {frontOnly:false,easing:12,walkTilt:.12,flightTilt:.18,walkBob:.1,
  excitedSpeed:13, // flying faster than this looks excited
  excitedHold:.45, // seconds the excited face lingers after it stops applying
  hopHeight:.55, // how high each walking hop lifts, in world units
  hopStretch:.2, // squash at the bottom and stretch at the top of each hop
  breathe:.018, // resting rise and fall
  turnWidth:.86, // narrowest a resident gets mid-turn, as a share of full width (it used to pinch to 0.3)
  turnHop:.28, // a turn comes with a hop this high
  blend:.14, // seconds one painting cross-fades into the next
  swapPop:.1, // a small squash at the moment of a swap, which hides the cut
  shadowReach:16, // height above the ground at which the ground shadow has faded out
  shadowOpacity:.55, // strongest the soft pool gets, under the feet
  shadowColor:'#160d2b', // deep indigo, the colour the terrain's own shadows settle to
  shadowGrow:.55, // contact shadow radius at its smallest (high in the air), in body radii
  shadowSwell:.5, // extra radius when standing on the ground
  shadowReachHeight:1.6, // how high the throwing mass counts for the moon offset, in world units
  shadowStretch:1.35, // how much longer than wide the contact shadow is along the moon's direction
  shadowOffsetCap:.8, // longest a low moon may push the shadow away from the feet, in world units
  shadowLift:.12, // how far the pool floats above the ground, so a bumpy path does not swallow it
  starterAirPivotY:STARTER_AIR_PIVOT_Y,
  airLift:AIR_LIFT,
  footSink:.02, // how far the feet settle into the grass, as a share of the sprite's height
  footFade:.1, // height above the feet over which the painting fades in, as a share of the sprite's height
  footFadeMin:.0}; // painting opacity at the very sole
// How strongly the scene's light shapes the painted residents (resident-light.js). Painted daytime brightness at 0, fully lit at 1.
export const RESIDENT_LIGHT = {
  strength:.8, // share of the scene's light mixed over the painting's own brightness
  gain:1.7, // scales the scene's light on a white surface up to where a painted colour keeps its value; trees sit near 1
  floor:.5, // light never drops below this per channel, so faces stay readable in the darkest corner
  domeCentreY:.46, // vertical middle of the fake rounded body, as a share of the picture's height
  domeRadius:.5, // half-height of that body, as a share of the picture's height
  domeFlat:.06, // smallest forward lean of the fake normal at the body's edge, so it never turns edge-on
  edgeStep:.018, // how far, in picture units, the opacity is sampled to find the outline's direction
  edgeBend:2.2, // how far the outline's direction tips the fake normal outward at the silhouette
  rim:.55, // strength of the soft moon and sun glow on the outline facing them
  footDarkness:.8, // brightness at the feet relative to the body: contact occlusion from the grass
  footReach:.3, // height above the feet, as a share of the picture, over which that darkness fades out
  fogShare:1, // 1 = the same distance fog and tint as scenery
  alphaCut:.3}; // painted opacity below which a pixel is dropped; above it the edge blends softly
// Measured 2026-11-17 from each image's opaque bounding box, so the character is the same height in every painting:
// scale = pose-sheet height share / idle height share; anchor = feet height from the bottom of the idle image.
export const IDLE_FIT = {
  sprout:{scale:.943,anchor:[.5,.095]}, // idle fills 0.848 of its frame, the pose sheet 0.800
  chomper:{scale:.97,anchor:[.5,.135]}, // idle 0.794, pose sheet 0.770
};
export function residentPose({dizzy,determined,away,frontOnly=false}) {
  if(frontOnly)return 'happy';
  return dizzy?'dizzy':determined?'determined':away?'back':'happy';
}
