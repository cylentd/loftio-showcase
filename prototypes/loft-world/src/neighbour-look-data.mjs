// Puff and Slime, built in code. World units with the ground at y 0 and the face toward +z.
// Proportions are measured from the painted sprites they replace (art/crew/v1/puff-idle.png and
// slime-idle.png, shown 3.4 units tall: one sprite pixel was 3.4/512 = 0.0066 units).
// Motion numbers are Look defaults for the owner to judge, not tuned balance.

export const NEIGHBOUR_COLORS={
 puffFur:'#5aaef0', // the sprite's mid blue
 puffShade:'#2c6fc4', // its underside, in the shadow of the body
 puffLight:'#9ad6ff', // its top, where the sky light lands
 puffRim:'#ffb26a', // the warm back light on its upper edge
 eyeWhite:'#fffaf2',
 pupil:'#15101c',
 catchlight:'#ffffff',
 mouth:'#5a1430',
 tongue:'#ff7f9e',
 slimeTop:'#0e9fac', // the sprite's teal crown, a step deeper: the jelly's rim light and sky reflection lift it
 slimeBase:'#b4f26a', // its lime puddle
 glint:'#ffffff',
 bubble:'#e8fff4',
};

export const NEIGHBOUR_LOOK={
 /** Shared by both: how they turn, blink, breathe and look around. */
 motion:{
  turnRate:3, // radians a second: a half turn in about one second, calm next to Grumble's 1.0
  maxOff:Math.PI*2/9, // while walking, the face stays within 40 degrees of the camera; at 60 both eyes slid to the edge
  idleAside:-.2, // when idle they look a little past the camera, so a still frame is not a stare. Negative turns
  // the face toward the viewer's left, which brings the right-of-centre eyes back to the middle of the silhouette
  moveEase:4, // per second: how fast walking blends in and out, about a quarter second
  minStep:1e-4, // a position change smaller than this is not travel
  blinkPeriod:{puff:3.7,slime:4.6}, // seconds between blinks; different so they never blink together
  blinkLength:.16, // seconds a blink takes, a quick cartoon blink
  blinkDepth:.92, // a shut eye keeps 8% of its height, so it reads as a lid line, not a hole
  breathPeriod:{puff:2.6,slime:1.9},
  breathAmount:{puff:.03,slime:.035},
  gazeEase:3, // per second: pupils settle on a new look in about a third of a second
  jiggleRate:17, // radians a second: googly pupils rattle about three times a second while travelling
  jiggleAmount:.16, // radians of rattle
  rattleSide:.5, // the side-to-side rattle is half the up-and-down one: hops shake vertically
 },
 eye:{
  segments:[16,12], // sphere detail: smooth at the size they are seen, about 336 triangles
  pupilSegments:[12,8],
  pupilSize:.58, // pupil radius as a share of the eye: the sprites' very large pupils
  pupilDepth:.32, // a flattened pupil disc sitting on the eye's front
  catchSize:.17,catchAt:[-.32,.36], // a small white catchlight up and to the left, toward the warm light
  catchSegments:[6,4],
  glow:.18, // a little self-light so the whites read in dusk light, as the sprites' whites did
  gloss:.85,
 },
 puff:{
  lobeDetail:2, // icosahedron detail: 320 triangles a lobe
  footDetail:1,
  lump:.05,lumpFreq:3.2,seed:31, // a soft fur-clump wobble on the surface; any seed, kept fixed so Puff looks the same every load
  // [x, y, z, sx, sy, sz] for each cloud lobe: the sprite's cloud, 2.7 wide and 2.1 tall
  lobes:[[0,.95,0,1.2,.85,.9],[-.8,.78,.05,.62,.6,.62],[.82,.82,.05,.6,.6,.6],[-.3,1.55,-.05,.62,.55,.6],[.42,1.45,-.05,.55,.5,.55]],
  feet:[[-.52,.27,.62,.43,.3,.43],[.52,.27,.62,.43,.3,.43]], // two round fluffy feet in front
  shadeBelow:.45,lightAbove:1.7, // the fur fades to shade under this height and to light above this one
  shadeAmount:.5,lightAmount:1.2, // how far: half shade at the ground; full light 0.8 units above lightAbove
  // eyes: [x, y, z, radius, gaze x, gaze y]. The sprite's left eye is the bigger and lower; both look up and right.
  // In 3D they sit nearer the middle than on the sprite: any turn slides right-of-centre eyes off the silhouette.
  eyes:[[-.34,1.05,.86,.42,.38,.32],[.42,1.4,.72,.35,.38,.32]],
  mouth:[.2,.84,.88,.21,.18,.1], // an open smile below and between the eyes, as on the sprite
  tongue:[.22,.73,.94,.12,.07,.06],
  mouthSegments:[14,8],
  // scale: tufts per unit; strand: the fraying edge is this much coarser than the grain, so it reads as tufts, not pixels
  fur:{scale:9,strand:2.2,edge:.45,grain:.4,tuft:.35,self:.12,halo:.35,rim:.9},
  hopPeriod:.42, // seconds a hop: a quick bouncy step
  hopHeight:.32,hopSquash:.14,
  lean:.12, // radians it leans into its travel
 },
 slime:{
  segments:40, // around the dome: 40 x 15 x 2 = 1,200 triangles
  // [radius, height] from the bottom middle up: puddle skirt, waist, dome. The sprite's jelly, 2.5 wide and 1.7 tall.
  profile:[[0,.02],[1.12,.02],[1.24,.07],[1.25,.14],[1.18,.24],[1.06,.34],[1.01,.48],[1,.66],[.96,.86],[.88,1.06],[.76,1.26],[.6,1.42],[.42,1.54],[.22,1.62],[.08,1.65],[0,1.66]],
  depth:.9, // a little flatter front to back, like the sprite
  lobes:3,lobeAmount:.07,lobeTop:.4, // three soft puddle lobes on the skirt, fading out by this height
  eyes:[[-.4,.92,.8,.38,.36,-.04],[.4,.94,.78,.34,.36,-.04]], // big, close and looking to the right
  mouth:{at:[.08,.72,.95],radius:.07,tube:.018,arc:Math.PI*.8,segments:[6,12]}, // a tiny smile
  bubbles:[[-.62,.42,.62,.11],[-.5,.28,.76,.06],[.35,.36,.5,.08],[-.2,.62,.45,.05]], // [x,y,z,radius]
  bubbleSegments:[8,6], // small enough that 8 x 6 reads round; keeps Slime under 3,000 triangles
  topY:1.3, // the colour is all teal above this height
  // alphaCore: the middle hides 80% of what is behind, so grass blurs into the jelly instead of reading as glass;
  // glint: a specular power low enough for the sprite's broad upper-left highlight
  glass:{alphaCore:.8,alphaRim:.97,self:.48,sub:.6,glint:45,fres:3},
  jiggle:.035, // vertex ripple while sliding
  slideJiggle:{period:.55,amount:.06}, // the faster wobble while it travels
  lean:.1,
 },
};
