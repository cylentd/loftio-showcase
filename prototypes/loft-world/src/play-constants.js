// Tuning. Speeds in world units per second; the loft knoll is about 60 units wide.
export const PLAY = {
  gravity: 22,
  diveGravity: 60, // extra pull while Dive is held
  drag: 0.12,
  flingSpeed: 30, // direct fling, world units per second (was 22; the owner found it weak)
  flingCooldown: 0.15, // seconds between flings; otherwise unlimited, on the ground or in the air
  airFlings: Infinity,
  revealRadius: 3.5,
  stepUp: 1.4, // a ledge or deck this far below your feet is still walked onto; more than that is a fall
  wade: 0.55, // walking speed in water, as a share of normal
  reticleLift: 1.6, // with the mouse captured the view looks a little above the resident, so there is more to see ahead
  encounterRange: 62, // a monster that has noticed you and is this close means a fight is on (they notice at 55)
  encounterLinger: 3.5, // seconds the battle music holds after the last such monster is gone
  fightFrame: 30, // a monster this close pulls the view toward it
  fightLean: 0.32, // how far the view leans from you toward that monster at point-blank
  camMin: 6.5, // the camera never comes closer to the leader than this; it rises over an obstacle instead
  buddySide: 6.5, // Chomper floats this far to one side of your flight...
  buddyAhead: 5, // ...this far ahead along it...
  buddyLift: 3, // ...and this far above it
  returnChance: 0.6, // share of your monster hits that Chomper answers by batting you back in
  returnEvery: 3.5, // seconds before he can do it again
  returnLead: 0.3, // he meets you this many seconds along your rebound
  returnWait: 0.9, // if you have not reached him by then, he gives up
  returnSpeed: 34, // slowest speed he sends you back at
  buddyBack: 6, // while you walk, Chomper's spot is this far behind your path...
  buddySlotSide: 3.5, // ...and this far to one side (he used to sit 2.5 back and 1.7 across, on top of you)
  buddyRoam: [4.5, 8.5], // while you stand, he wanders to spots between these distances from you
  buddyRoamEvery: [2.5, 6], // seconds between his wanders, shortest and longest
  buddyLeapFrom: 17, // further than this once you have landed, he leaps over
  buddyLeapSpeed: 21, // sets how long a leap takes: distance over this, between 0.75 and 1.7 s
  buddyLeapEvery: 1.4, // seconds between leaps
  buddyLeapMax: 75, // beyond this he pops across instead
  buddyAttackEvery: 2.6, // seconds between his own flings at a monster
  buddyAttackRange: 36, // he only fights monsters this close to him and to you
  buddyRadius: 2.6, // touching him inside this is a bump; also his size as an aim target
  buddyBoost: 1.15, // a bump sends you off this much faster than you arrived
  buddyMin: 30, // ...and never slower than this
  buddyUp: 15, // ...and always at least this fast upward
  buddyTime: 3.2, // seconds he waits in the air before dropping back
  canopySize: 0.72, // share of a tree crown's outline that is springy
  focusZoom: 9, // degrees the view narrows during slow-motion aim
  focusLean: 0.35, // how far the view turns from you toward your target during slow-motion aim
  flingGrab: 0.16, // a press this close to the leader (share of the short screen side) starts a fling; elsewhere it turns the camera
  groundBounce: 0.45,
  groundGrip: 0.8, // share of sideways speed kept on a ground bounce
  rollUnder: 9, // hitting the ground softer than this rolls instead of bouncing
  rollFriction: 0.5, // speed lost per second while rolling
  restSpeed: 3.5, // slower than this on gentle ground and the resident settles
  walkAccel: 70, // how fast walking reaches full speed
  walkStop: 95, // how fast it stops
  coyote: 0.12, // seconds after walking off a ledge that a hop still works
  jumpBuffer: 0.14, // a hop pressed this early before landing still fires
  chargeTime: 0.85, // seconds of holding Space on the ground for a full charge
  chargeJump: 34, // a full charge launches about 26 units high (a tap hops 4.5)
  chargeLeap: 16, // extra forward speed a full charge adds when a direction is held
  bounceKeep: 0.85, // holding Space as you land keeps this share of your fall speed...
  bounceBonus: 4, // ...plus this much, so each bounce in a chain goes a little higher
  bounceMax: 42, // a chain tops out about 40 units high
  spin: 0.45, // radians of spin per unit travelled in the air
  sprint: 1.7, // Shift on the ground multiplies walking speed
  popRange: 16, // the shockwave reaches this far (was 11)
  popCooldown: 4, // seconds; longer than before because it now does real work
  popLift: 22, // in the air it throws you upward at this speed, about 11 units of height
  popLaunch: 19, // from the ground it launches you about 8 units up
  popTime: 0.55, // seconds the wave takes to cross its range
  aimSlow: 0.25, // time runs at this rate while you aim a fling in the air
  hitStop: 0,
  hitStopRate: 0.35, // how slow time runs during that dip: a dip, not a stop
  hitSlow: [0.35, 0.3], // then this rate, for this many seconds
  camDistance: 15,
  camPitch: 0.3, // radians above level
  camRecenter: 2.5, // seconds without touching the camera before it drifts behind your movement again
  restSlope: 0.86, // ground normal's up-component above which a resident can settle
  skyfallAfter: 0.7, // seconds of Dive that earn a Skyfall bounce
  skyfallLaunch: 34, // Skyfall sends you back up about 26 units
  splash: 16, // slowest speed the lake pops you back out with
  canopyBounce: 0.55,
  canopyMin: 12,
  rockBounce: 0.85,
  rockMin: 16,
  radius: 1.05,
  spriteSize: 2.9,
  wispRadius: 2.1,
  leash: 215, // past this distance from the middle, the wind turns you around
  walk: 10, // WASD speed on the ground
  jump: 14, // hop speed: about 4.5 units high
  airControl: 16, // WASD push while in the air
  turn: 1.5, // how fast Q/E and the arrow keys swing the camera, radians per second
};

