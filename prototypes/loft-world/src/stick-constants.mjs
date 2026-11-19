// Floating thumbstick numbers. Reference feel: Sky: Children of the Light, Genshin Impact, Brawl Stars.
// Pixels are CSS pixels. Region and sizes do not scale with the screen: a thumb has the same reach on a phone
// and on an unfolded Fold, so the stick stays in the bottom-left corner instead of growing with the glass.
export const STICK = {
  radius: 60, // how far the knob travels from the base; about a thumb's comfortable sweep (Genshin ~55, Brawl Stars ~65)
  baseSize: 128, // drawn base diameter, a little over 2 x radius so the knob sits inside the ring
  knobSize: 56, // drawn knob diameter; above the 48 px touch minimum
  dead: 0.1, // share of the radius where nothing happens, so a resting thumb does not creep
  full: 0.8, // share of the radius where walk speed reaches its maximum
  sprintOn: 0.96, // share of the radius where sprint starts: the outer rim
  sprintOff: 0.86, // sprint ends below this share, so a thumb on the rim does not flicker in and out
  regionWidthShare: 0.5, // the left half of a narrow screen starts the stick
  regionWidthMax: 360, // ...but never more than this, so a wide Fold keeps it near the corner
  regionHeightShare: 0.55, // the lower share of a tall screen
  regionHeightMax: 380, // ...capped for the same reason; the room above stays free for looking
  roundTo: 1000, // readings are rounded to 1/1000 so tiny float noise never reaches the walk input
};
