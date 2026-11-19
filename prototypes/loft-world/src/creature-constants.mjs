// Owner-tunable Look defaults; world units and seconds, not production balance.
export const CREATURE={walk:2,hopSpeed:2.6,hopHeight:.65,hopPeriod:.8,wait:1.2,travel:2.4,hopWait:.7,
  bounds:9,turn:2.2,foot:.98,clearance:.15,maxSlope:1.5,notice:55,probeStep:.5,
  chaseBoost:2.6, // chasing is this many times patrol speed: 5.2 walking, 6.8 hopping (you walk at 10)
  chaseStop:1.8, // it stops this far from touching you
  bonkEvery:2.2, // seconds between headbutts
  bonkToss:[15,12], // sideways and upward speed a headbutt gives you
  npcSpeed:.8,npcRadius:.8,npcWait:1.8,npcTravel:2.2,npcLook:1.1,
  shadowOpacity:.23,shadowSegments:20,shadowHeight:.06,shadowColor:'#273b32',
  linkAngleCos:.5, // a lead hit counts as a new angle when its contact normal is 60 degrees or more from the last one
  // F is a counter, not a free pass (owner, 2026-11-18). Timed against a telegraph it slips the attack; untimed, the monster reads it.
  counterAfter:.6, // seconds after a stomp, headbutt or gust that F still counters: the follow-through, inside the 1.6 s commit
  counterLock:3, // seconds a countered monster stays locked in its swing: Chomper's approach (.85) plus the whole zip (2.2)
  readTime:3, // seconds a monster that read an untimed F keeps turning on Sprout: the same approach plus zip
  // Readable attacks (owner, 2026-11-18: "I can't really read enemy attacks"): every attack winds up before it lands.
  bonkWindup:.5, // seconds a headbutt rears back: shorter than the stomp's .9 crouch, it is the close-range attack
  bonkLean:.35, // radians it leans back while rearing, about 20 degrees, plain from behind the camera
  gustWindup:.6, // seconds a gust swells, a touch longer than the headbutt because it reaches 15 units
  gustSwell:.25, // the floater puffs up to 1.25 times its size before it blows
  // Skyfall (owner, 2026-11-18): the higher the dive, the harder it hits. Heights are fall distance in world units.
  dropMin:10, // a plain hop is about 6 units; under 10 earns no height bonus
  dropCap:80, // the dive tops out near 75 speed, about 128 units of free fall; 80 is a sky-high drop and the bonus stops here
  dropPerUnit:.05, // each unit past dropMin adds 5% damage: a full-height diving hit is 4.5 times a short one
  slamMin:14, // a Skyfall must fall this far to shake the ground
  slamRange:[10,34], // shockwave reach on the ground, smallest to biggest drop: about a Pop's range up to a giant's
  slamDamage:60, // damage to a monster at the centre of the biggest shockwave
  slamStun:1.6, // seconds the biggest shockwave staggers it, like a Pop's 1.3 a little longer
  slamShove:22, // speed it is shoved back at by the biggest shockwave, a Pop's 26 a little softer
  slamEdgeLoss:.5, // share of the shockwave's damage lost at its edge: the centre takes all of it, the edge half
  slamColor:'#ffd58a', // the gold of the burst a monster gives off when a shockwave hits it, the Skyfall's gold
  readTurn:8, // radians per second it whirls while reading: a half turn in .4 s, faster than the zip laps a Grumble (48/9.2 = 5.2)
  goldenAngle:2.399963229728653,homeSearch:32,homeStep:1.5,frameRange:22,frameScale:1.6};
export const ENEMIES=[
 // Each is at least 80 units from the loft door, where Explore starts; they notice you at 55.
 {id:'grumble',x:-28,z:96,scale:1,style:'walk',heading:1.2}, // the south meadow
 {id:'pebble',x:64,z:-54,scale:.64,style:'hop',heading:2.4}, // the east woods
 {id:'drift',x:-74,z:40,scale:.7,style:'float',heading:.5}, // hovers over the west meadow; its weak spot is on top
 // Combo test dummy (owner, 2026-11-18): three Grumbles tall, 15x the health, so a long Chomp chain never runs out of monster.
 // (80,100) is open ground for its 15.6 radius and over 100 units from the others, so it fights alone.
 {id:'giant',x:80,z:100,scale:3,style:'walk',heading:3.6,health:1500}, // the south-east meadow
];
export const NEIGHBOURS=[{id:'puff',x:9,z:25,r:3,heading:0,delay:.3},{id:'slime',x:3,z:24,r:3,heading:2,delay:1.7}];
