// Owner-tunable Look defaults; world units and seconds, not production balance.
export const CREATURE={walk:2,hopSpeed:2.6,hopHeight:.65,hopPeriod:.8,wait:1.2,travel:2.4,hopWait:.7,
  bounds:9,turn:2.2,foot:.98,clearance:.15,maxSlope:1.5,notice:55,probeStep:.5,
  chaseBoost:2.6, // chasing is this many times patrol speed: 5.2 walking, 6.8 hopping (you walk at 10)
  chaseStop:1.8, // it stops this far from touching you
  bonkEvery:2.2, // seconds between headbutts
  bonkToss:[15,12], // sideways and upward speed a headbutt gives you
  npcSpeed:.8,npcRadius:.8,npcSize:3.4,npcWait:1.8,npcTravel:2.2,npcLook:1.1,
  shadowOpacity:.23,shadowSegments:20,shadowHeight:.06,shadowColor:'#273b32',
  goldenAngle:2.399963229728653,homeSearch:32,homeStep:1.5,frameRange:22,frameScale:1.6};
export const ENEMIES=[
 // Each is at least 80 units from the loft door, where Explore starts; they notice you at 55.
 {id:'grumble',x:-28,z:96,scale:1,style:'walk',heading:1.2}, // the south meadow
 {id:'pebble',x:64,z:-54,scale:.64,style:'hop',heading:2.4}, // the east woods
 {id:'drift',x:-74,z:40,scale:.7,style:'float',heading:.5}, // hovers over the west meadow; its weak spot is on top
];
export const NEIGHBOURS=[{id:'puff',x:9,z:25,r:3,heading:0,delay:.3},{id:'slime',x:3,z:24,r:3,heading:2,delay:1.7}];
