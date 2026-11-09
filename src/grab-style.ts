import { GRAB } from "./grab-data";
import { advanceGrab, grabPose, grabState, pullGrab } from "./grab-model";
import type { CarryPose, CarryStyle, Resident } from "./resident";

/** Lobby play's grab spring, attached to a resident as its carry style: a pull stretches it, a catch squishes it. */
export class GrabStyle implements CarryStyle {
  private state = grabState();
  private caughtLift = 0;
  private time = 0;

  start(caught: boolean, caughtLift: number): void {
    this.state = grabState(caught);
    this.caughtLift = caughtLift;
    this.time = 0;
  }

  pull(dx: number, dy: number, height: number): void { pullGrab(this.state, dx, dy, height); }

  pose(dt: number, reduced: boolean): CarryPose {
    if (!reduced) { this.time += dt; advanceGrab(this.state, dt); }
    const spring = grabPose(this.state, reduced);
    return { ...spring, lift: reduced ? 0 : this.caughtLift * Math.exp(-this.time / GRAB.liftMs) };
  }

  /** The spring's current stretch, for drawing a resident mid-toss. */
  spring() { return grabPose(this.state); }
}

/** The resident's grab spring, attaching one the first time play touches it (residents can join after boot). */
export function grabStyle(resident: Resident): GrabStyle {
  if (!(resident.carryStyle instanceof GrabStyle)) resident.carryStyle = new GrabStyle();
  return resident.carryStyle as GrabStyle;
}
