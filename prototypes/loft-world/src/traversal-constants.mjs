// Prototype traversal bounds: retain base 22; carry adds at most 10, never lateral energy.
// 2026-11-17: base fling raised to 30 and bounces made livelier (owner: "not bouncing off things chaotically").
export const TRAVERSAL = { carryShare:.5, carryMax:12, launchMax:44,
  contactSpeed:2, settleSpeed:.5, settleTime:.18, responseMax:55,
  maxStep:1/120, maxTravel:.45, maxSubsteps:64, historyLimit:64, contactSquash:.8 };
// Restitution, tangential retention, optional powered upward response and cap.
export const MATERIALS = {
  soil:{restitution:.62,tangent:.92}, rock:{restitution:.95,tangent:1},
  spring:{restitution:1.15,tangent:.95,lift:24,cap:46},
  foliage:{restitution:.8,tangent:.95,lift:10}, enemy:{restitution:1.05,tangent:1},
  wood:{restitution:.9,tangent:1}, water:{restitution:.6,tangent:.9,lift:18},
};
