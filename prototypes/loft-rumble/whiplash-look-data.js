// LM4b visual tokens, independent of combat tuning.
globalThis.LoftRumbleWhiplashLook=Object.freeze({
  // Painted anchors measured on the source sheets; overlap hides soft alpha edges.
  rootX:.06,rootY:.72,join:.84,shoulderX:.56,shoulderY:.08, // owner 2026-11-18: grows from the trunk's side, not the eye (was .48,-.58)

  // Quiet purple floor wash and crisp, finite radial boundaries.
  fill:.18,edge:.8,line:2,
  // Folded reach, windup angle and radians per eligible second; fourth-power recoil.
  knot:.085,grownAtWarning:.42,trailAngle:.21,trailWidth:8,trailReach:.84,chipWidth:3,fold:.62,coil:.35,wind:.12,recoilPower:4,reducedPose:.5,
  // Fixed frontal painting faces down the arena; independent of the weakspot angle.
  paintedFacing:Math.PI/2,
  minimumThickness:26,impactRing:26,impactColour:'#fff0b8',impactInk:'#542c37',
  // Planted 2D rig deformation: shoulder load, follow-through and resident contact pose.
  twistLoad:.10,twistHold:.04,twistFollow:.08,lift:.6,
  // R5 Look: readable held recoil and ease; brightness remains a single brief contact.
  hitRecoil:8,hitHold:.22,hitAccentLife:.8,hitBrightness:1.8,hitFlashLife:.12,
  // Broad early bark; recovery retains its tightly curled physical settle.
  liftBendRadius:180,readyAngle:.85,
  // Clockwise tapered floor leaves remain inside the finite sector.
  leafCount:9,leafRadius:.32,leafHalfWidth:5,leafArc:.22,leafShoulder:.28,leafTail:.035,leafAlpha:.82,leafColour:'#dfc878',
  // Sap follows bark only. Source-sized veins are alpha-masked, with no outline halo.
  sapWidth:512,sapPeriod:1.25,sapBand:.2,sapLine:3,sapAlpha:.8,sapColour:'#f4d879',
  sapVeins:[.38,.51,.64],sapBend:.075,sapFork:.12,
  socketRadius:13,socketAlpha:.22,socketColour:'#f2c66d',
  rigRadius:40,rigFoot:1.1,bendSlices:32,settleRadius:12,
  impactRays:6,impactRayLength:12,impactLine:4,
  // Owner 2026-11-18 anime round. Strike angle eases in (k^2): starts slow, ends at full speed.
  strikeEase:2,
  // Windup charge: socket glow and sap brighten toward the strike; gold motes drift into the socket.
  chargeAlpha:.7,chargeRadius:22,sapCharge:.2,moteCount:5,moteDistance:48,moteSize:2.4,moteRate:.8,moteAlpha:.9,
  // Smear: crescent behind the bark, gold edge and white core; deepest at the head; 0.25 s tail after the swing.
  smearFade:.25,smearDepth:.34,smearCore:.5,smearSegments:28,smearCoreColour:'#ffffff',smearEdgeAlpha:.85,smearReducedAlpha:.2,
  // Speed lines: thin radial streaks over the swept arc, strike only, hashed so they do not flicker.
  speedLineCount:11,speedLineInner:.32,speedLineOuter:.98,speedLineJitter:.22,speedLineWidth:1.5,speedLineAlpha:.6,
  // Impact: render-only hit-stop (brief: 40-60 ms), 2-frame white flash (1 reduced), leaf/spark burst, first-contact shake.
  hitStop:.05,flashFrames:2,reducedFlashFrames:1,frameTime:1/60,flashFilter:'brightness(0) invert(1)',
  burstCount:7,burstTravel:30,burstLife:.35,burstSize:4,shakeAmplitude:4,shakeLife:.12,
  // Constants moved out of the code for the magic-number check; each value is the one the code used before.
  flashMargin:.5, // half a frame of margin on the flash window
  smoothstepEdge:3, // cubic smoothstep: k*k*(3-2k)
  sapControl:[1/3,2/3], // x of the two bezier control points along a sap vein, as a share of its width
  sapForkStart:.5,sapForkControl:2/3, // sap fork: start and control x as a share of the width
  hashSeed:12.9898,hashScale:43758.5453, // the classic fract(sin(x*12.9898)*43758.5453) hash, so speed lines do not flicker
  speedLineCentre:.5, // a streak sits mid-slice
  burstSpin:.37,burstShrink:.5,burstSquash:.5 // burst: per-hit angle offset, size lost by the end, ellipse height share
});
