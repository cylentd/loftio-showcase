// Look defaults, in world units/seconds. These are owner-tunable prototype choices.
// Dusk look restored 2026-11-17 (owner: the daylight pass "looks worse"): strong glow, mist, shafts and wind.
export const LOOK={seed:17,sides:8,epsilon:1e-7,rayRange:260,exposure:1.12,glow:.24,mist:1,shafts:.2,wind:1,
  emission:2.4,feedbackSpeed:30,feedbackGain:.12,compression:.12,leafCount:650,leafRadius:.34};
export const ROUTE=[
  {id:'route-rock',material:'rock',x:36,z:38,r:3.4,height:3,base:-.4,topScale:.68,color:'#6b5a86'},
  {id:'route-step',material:'rock',x:40,z:34,r:2.2,height:1.8,base:-.3,topScale:.75,color:'#7d6c96'},
  {id:'route-spring',material:'spring',x:44,z:44,r:3,height:3.2,base:2,topScale:.65,color:'#bc7046'},
  {id:'route-shrub',material:'foliage',x:49,z:49,r:2.8,height:1.8,base:-.2,topScale:.55,color:'#42694a'},
];
export const FEEDBACK={
  rock:{sound:'dry',duration:.12,compression:.018,f0:210,f1:90,send:.02,type:'triangle'},
  spring:{sound:'elastic',duration:.42,compression:.12,f0:180,f1:520,send:.18,type:'sine'},
  foliage:{sound:'rustle',duration:.22,compression:.08,f0:1300,f1:520,send:.03,type:'lowpass'},
};
export const HABITATS=[
  {x:20,z:24,r:5,kind:'fern'}, {x:29,z:42,r:4,kind:'fern'},
  {x:37,z:33,r:4,kind:'litter'}, {x:40,z:41,r:3,kind:'litter'},
  {x:47,z:50,r:4,kind:'reed'}, {x:23,z:49,r:4,kind:'reed'},
  {x:16,z:18,r:5,kind:'fern'}, {x:52,z:56,r:4,kind:'fern'},
];
// A deep, dense meadow: 280k blades up to 1.2 units tall on desktop (the sparse 36k lawn read as bare ground).
export const MEADOW_LOOK={desktopCount:280000,phoneCount:90000,width:.075,heightMin:.3,heightSpan:.55,softness:.3,groundGrain:.1,groundMottle:.2,habitatCount:0};
