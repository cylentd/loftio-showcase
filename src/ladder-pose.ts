import { LADDER_POSE } from "./ladder-data.ts";

export function ladderPose(time: number, descending: boolean) {
  const bounded = Math.max(0, Math.min(1, time));
  const rung = Math.min(LADDER_POSE.steps - 1, Math.floor(bounded * LADDER_POSE.steps));
  const phase = bounded * LADDER_POSE.steps - rung;
  let fraction = 0, squash = 0, stretch = 0, lift = 0, rotation = 0;
  if (phase < LADDER_POSE.pushEnd) {
    squash = Math.sin(phase / LADDER_POSE.pushEnd * Math.PI / 2) * LADDER_POSE.squash;
  } else if (phase < LADDER_POSE.landStart) {
    const air = (phase - LADDER_POSE.pushEnd) / (LADDER_POSE.landStart - LADDER_POSE.pushEnd);
    fraction = air * air * (3 - 2 * air);
    lift = Math.sin(air * Math.PI) * (descending ? LADDER_POSE.downLift : LADDER_POSE.upLift);
    stretch = Math.cos(air * Math.PI / 2) * LADDER_POSE.stretch;
    rotation = Math.sin(air * Math.PI * 2) * (descending ? LADDER_POSE.downSway : LADDER_POSE.upSway);
  } else {
    fraction = 1;
    squash = Math.sin((phase - LADDER_POSE.landStart) / (1 - LADDER_POSE.landStart) * Math.PI) * LADDER_POSE.squash;
  }
  return { progress: (rung + fraction) / LADDER_POSE.steps, sx: 1 + squash - stretch, sy: 1 - squash + stretch, lift, rotation };
}
