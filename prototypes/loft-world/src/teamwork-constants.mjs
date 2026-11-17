// Look defaults: deliberately bounded support, awaiting owner feel approval.
export const TEAM = {
  // boost raised from 20 (2026-11-17): his bump should carry you clearly higher, about 16 units
  delay:.22, boost:27, approachSpeed:36, approachTime:.75, recoverTime:.35,
  below:1.8, contact:.9, followSpeed:8.5, followRange:45, stopGap:1.6, // slower and less fussy: he no longer shuffles to an exact spot
  followGain:1.5, leash:215, slotBack:2.5, slotSide:1.7,
  poseSpeed:.5, dizzyTime:.35, frameSize:640, baseline:608,
  approachClearance:.3, // Keep the approach above terrain when the second press is early.
  minStep:.001, historyLimit:32, recoverCarry:.5, // Numerical floor, bounded debug history, soft departure.
};
