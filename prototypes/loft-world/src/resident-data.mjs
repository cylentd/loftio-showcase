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
  shadowOpacity:.34};
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
