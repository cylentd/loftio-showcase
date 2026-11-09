import { TURN } from "./tune.ts";

/** A resident turning around. The body narrows only to TURN.minWidth, flips at the top of a small hop, and widens again,
 *  so the eye reads a round body spinning rather than a paper cut-out going edge-on. */
export class Turn {
  private from: number;
  private to: number;
  private t = 1;
  constructor(facing: number) { this.from = this.to = facing; }

  get turning(): boolean { return this.t < 1; }

  /** Start turning to `facing` (1 or -1). Asked to go back mid-turn, it retraces from where it is. */
  face(facing: number): void {
    if (facing === this.to) return;
    if (this.turning) { [this.from, this.to] = [this.to, this.from]; this.t = 1 - this.t; return; }
    this.from = this.to; this.to = facing; this.t = 0;
  }

  /** End any turn at once, already facing `facing`. */
  snap(facing: number): void { this.from = this.to = facing; this.t = 1; }

  advance(dt: number): void { if (this.turning) this.t = Math.min(1, this.t + dt / TURN.ms); }

  /** `sx` is the signed width (negative faces left), `sy` the height, `lift` in resident heights. */
  pose(): { sx: number; sy: number; lift: number } {
    if (!this.turning) return { sx: this.to, sy: 1, lift: 0 };
    // sin² rises from rest and settles back to rest, so the turn glides in and out instead of starting with a jolt.
    const k = Math.sin(Math.PI * this.t) ** 2;
    const side = this.t < 0.5 ? this.from : this.to;
    return { sx: side * (1 - (1 - TURN.minWidth) * k), sy: 1 + TURN.stretch * k, lift: TURN.hop * k };
  }
}
