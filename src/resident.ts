import { Container, Sprite, type Texture } from "pixi.js";
import type { CastMember, Point } from "./cast";
import { DEPTH, HOP, IDLE, SHADOW, TURN } from "./tune";
import { Turn } from "./turn-pose";
import { PLACEMENT, WANDER } from "./resident-movement-data";
import { landingPose, residentDepth, residentSeat } from "./resident-movement";
import { travelRoute } from "./travel-route";
import { TRAVEL } from "./travel-data";
import { ladderPose } from "./ladder-pose";
import { SPACE } from "./personal-space-data";
import { residentLighting } from "./lighting-model";
import { seatAvailable } from "./seat-occupancy";
import { heldPose } from "./held-pose";
import { ChairBooster } from "./chair-booster";
import { cloudPose } from "./cloud-pose";

type Action = { kind: "hop" | "look" | "wiggle" | "nod" | "press" | "settle"; t: number; dur: number };
type Palette = { shadow: string; tintFront: string; tintBack: string };

const TAU = Math.PI * 2;
const WALK_LIFT = 0.02; // Gentle footfall, as a share of displayed height.
const FLOAT_LIFT = 0.08; // Small float arc; navigation still follows the existing floor route.
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => t * t * (3 - 2 * t);

function mixColour(a: string, b: string, t: number): number {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(lerp((pa >> shift) & 255, (pb >> shift) & 255, t)) << shift;
  return ch(16) | ch(8) | ch(0);
}

export function heightAt(y: number, bias: number): number {
  const t = clamp01((y - DEPTH.backY) / (DEPTH.frontY - DEPTH.backY));
  return lerp(DEPTH.backHeight, DEPTH.frontHeight, t) * bias;
}

export type CarryPose = { lift: number; sx: number; sy: number; rotation: number };
/** Extra feel for a held resident that a game feature may attach (lobby play's grab spring). Its pose is combined
 *  with the carry pose; with none attached, a held resident looks as it always did. */
export interface CarryStyle {
  start(caught: boolean, caughtLift: number): void;
  pull(dx: number, dy: number, height: number): void;
  pose(dt: number, reduced: boolean): CarryPose;
}
/** How poseAt draws a resident a feature placed: share of the shadow lost to air, stretch, lean, depth nudge. */
export type FreePose = { air: number; sx: number; sy: number; rotation: number; depth?: number; noShadow?: boolean };

export class Resident {
  carryStyle: CarryStyle | null = null;
  readonly root = new Container();
  private readonly body = new Container();
  private readonly booster = new ChairBooster();
  private supportLift = 0;
  private poseTime = 0;
  private carrySupportLift = 0;
  private readonly sprite: Sprite;
  private readonly shadow: Sprite;
  private readonly core: Sprite;
  readonly pos: Point;
  readonly home: Point;
  /** Set whenever a feature draws this resident (mid-toss, in a pile) and cleared by the room's personal-space pass. */
  posedByPlay = false;
  /** A walker's sidestep around others: added to its path, fades back, and is never part of the path itself. */
  readonly shove: Point = { x: 0, y: 0 };
  wanderAfter = 0;
  at: "home" | "interest" = "home";
  walking = false;
  held = false;
  private carryHeight = 0;
  private carryTime = 0;
  private carryOrigin: Point | null = null;
  private lighting = 0;
  placed = false;
  private hops: (Point & { climb: boolean })[] = [];
  private paused = false;
  private carriedMotion: { walking: boolean; paused: boolean } | null = null;
  private hopIndex = 0;
  private hopT = 0;
  private facing = 1;
  private readonly turn = new Turn(1);
  private action: Action | null = null;
  private queued: Action["kind"] | null = null;
  private fidgetIn: number;
  private readonly phase: number;
  /** Head height above the feet in world px, for the letter and the bubble. */
  lift = 0;
  height = 0;

  constructor(
    readonly cast: CastMember,
    texture: Texture,
    dot: Texture,
    private readonly palette: Palette,
    private readonly rand: () => number,
  ) {
    this.phase = rand() * TAU;
    this.pos = { ...cast.home };
    this.home = { ...cast.home };
    this.sprite = new Sprite(texture);
    this.sprite.anchor.set(0.5, 1);
    this.shadow = new Sprite(dot);
    this.shadow.anchor.set(0.5);
    this.shadow.tint = palette.shadow;
    this.core = new Sprite(dot);
    this.core.anchor.set(0.5);
    this.core.tint = palette.shadow;
    this.body.addChild(this.sprite);
    this.root.addChild(this.shadow, this.core, this.booster, this.body);
    this.fidgetIn = lerp(IDLE.fidgetMinMs, IDLE.fidgetMaxMs, rand());
    this.layout(0, 0);
  }

  get seatSupport() { return { lift: this.supportLift, visible: this.booster.visible, alpha: this.booster.alpha, cloudY: this.booster.y }; }

  get aspect(): number {
    return this.sprite.texture.width / this.sprite.texture.height;
  }

  setLighting(blend: number): void {
    this.lighting = blend;
    const depth = clamp01((this.pos.y - DEPTH.backY) / (DEPTH.frontY - DEPTH.backY));
    this.sprite.tint = residentLighting(mixColour(this.palette.tintBack, this.palette.tintFront, depth), blend);
  }

  /** `caught`: taken out of a feature's play mid-air, so the carry starts from the current lift. */
  pickUp(caught = false): void {
    this.carryStyle?.start(caught, caught ? this.lift - this.height * PLACEMENT.lift : 0);
    this.carryTime = 0;
    this.carryOrigin = { ...this.pos };
    this.carryHeight = this.height;
    this.carrySupportLift = this.supportLift;
    this.shove.x = this.shove.y = 0;
    this.held = true;
    this.turn.snap(this.facing);
    this.carriedMotion = { walking: this.walking, paused: this.paused };
    this.walking = this.paused = false;
    this.action = this.queued = null;
  }

  pull(dx: number, dy: number): void { this.carryStyle?.pull(dx, dy, this.carryHeight); }

  /** Draws the resident with its feet at (x, y), lifted `lift` px, at a spot a feature chose (mid-toss, in a pile). */
  poseAt(x: number, y: number, lift: number, pose: FreePose): void {
    this.carrySupportLift = 0;
    this.posedByPlay = true;
    this.shove.x = this.shove.y = 0;
    this.pos.x = x; this.pos.y = y;
    this.carryHeight = heightAt(y, this.cast.sizeBias);
    this.layout(lift, pose.air, pose.sx, pose.sy, pose.rotation);
    this.root.zIndex = residentDepth(this.pos) + (pose.depth ?? 0);
    if (pose.noShadow) this.shadow.alpha = this.core.alpha = 0;
  }

  putDown(placed: boolean, animate: boolean, now = 0): void {
    this.held = false;
    this.carryOrigin = null;
    this.placed ||= placed;
    if (!placed && this.carriedMotion) Object.assign(this, this.carriedMotion);
    if (placed) this.hops = [];
    this.carriedMotion = null;
    if (placed) {
      Object.assign(this.home, this.pos);
      this.at = "home";
      this.wanderAfter = now + WANDER.afterDropMs;
    }
    if (animate) this.play("settle");
  }

  resetHome(): void {
    this.carryOrigin = null;
    this.carriedMotion = null;
    this.held = this.placed = this.walking = this.paused = false;
    this.shove.x = this.shove.y = 0;
    this.action = this.queued = null;
    this.at = "home";
    Object.assign(this.pos, this.cast.home);
    Object.assign(this.home, this.cast.home);
    this.wanderAfter = 0;
  }

  get seatClaims(): Point[] {
    const current = this.carryOrigin ?? this.pos;
    const target = this.walking || this.paused || this.carriedMotion ? this.hops.at(-1) : undefined;
    return target ? [{ ...current }, { x: target.x, y: target.y }] : [{ ...current }];
  }

  get stopped(): boolean { return this.paused; }

  /** Direction of the current hop in world px, or null when not walking. */
  get heading(): Point | null {
    const a = this.hops[this.hopIndex], b = this.hops[this.hopIndex + 1];
    return this.walking && a && b ? { x: b.x - a.x, y: b.y - a.y } : null;
  }

  /** A push from the room's personal-space pass. A walker keeps its path and takes the push as a sidestep of at most
   *  `reach` px in all; anyone else is simply moved. */
  nudge(dx: number, dy: number, reach: number): void {
    if (!this.walking) { this.pos.x += dx; this.pos.y += dy; return; }
    const x = this.shove.x + dx, y = this.shove.y + dy, size = Math.hypot(x, y), k = size > reach ? reach / size : 1;
    this.shove.x = x * k; this.shove.y = y * k;
  }

  get climbing(): boolean { return (this.walking || this.paused) && !!this.hops[this.hopIndex + 1]?.climb; }
  get ladderReserved(): boolean { return (this.walking || this.paused || !!this.carriedMotion) && this.hops.slice(this.hopIndex + 1).some(point => point.climb); }

  stopWalking(): void {
    this.paused = this.walking;
    this.walking = false;
    this.action = this.queued = null;
  }

  resumeWalking(): void {
    if (!this.paused) return;
    this.walking = true;
    this.paused = false;
  }

  walkTo(target: Point, to: "home" | "interest", ladderAvailable = true, seatClaims: readonly Point[] = []): boolean {
    if (!seatAvailable(target, seatClaims)) return false;
    const route = travelRoute(this.pos, target);
    if (!route.length || (!ladderAvailable && route.some(leg => leg.motion === "climb"))) return false;
    this.hops = [{ ...this.pos, climb: false }];
    for (const leg of route) {
      const dx = leg.to.x - leg.from.x, dy = leg.to.y - leg.from.y;
      const step = HOP.length * heightAt((leg.from.y + leg.to.y) / 2, this.cast.sizeBias);
      const count = leg.motion === "climb" ? 1 : Math.max(1, Math.ceil(Math.hypot(dx, dy) / step));
      for (let index = 1; index <= count; index += 1) this.hops.push({
        x: leg.from.x + dx * index / count, y: leg.from.y + dy * index / count, climb: leg.motion === "climb",
      });
    }
    this.hopIndex = this.hopT = 0;
    this.walking = true;
    this.paused = false;
    this.at = to;
    this.action = null;
    return true;
  }

  play(kind: Action["kind"]): void {
    if (this.walking) {
      this.queued = kind; // played on arrival, so a nod asked for mid-walk still happens
      return;
    }
    const dur = kind === "nod" ? IDLE.nodMs : kind === "press" || kind === "settle" ? IDLE.pressMs : kind === "look" ? TURN.ms * 4 : HOP.durationMs * 1.4;
    this.action = { kind, t: 0, dur };
    if (kind === "look") this.facing = -this.facing;
  }

  /** dt in ms; now in ms. With reduced motion nothing moves: the resident is drawn once, at rest. */
  update(dt: number, now: number, reduced: boolean): void {
    this.poseTime = now;
    if (this.held) {
      if (!reduced) this.carryTime += dt;
      const pose = heldPose(this.carryTime, this.phase, reduced);
      const extra = this.carryStyle?.pose(dt, reduced) ?? { lift: 0, sx: 1, sy: 1, rotation: 0 };
      this.layout(this.carryHeight * (PLACEMENT.lift + pose.lift) + extra.lift, PLACEMENT.air,
        pose.sx * extra.sx, pose.sy * extra.sy, pose.rotation + extra.rotation);
      return;
    }
    if (this.paused) return;
    if (reduced) {
      this.turn.snap(this.facing);
      this.layout(0, 0);
      return;
    }
    let sx = 1;
    let sy = 1;
    let rot = 0;
    let lift = 0;
    let air = 0;
    const h = heightAt(this.pos.y, this.cast.sizeBias);

    if (this.walking) {
      ({ sx, sy, rot, lift, air } = this.advanceTravel(dt, h));
    } else if (this.action) {
      this.action.t += dt;
      const p = clamp01(this.action.t / this.action.dur);
      ({ sx, sy, rot, lift, air } = this.actionPose(this.action.kind, p, h));
      if (p >= 1) this.action = null;
    } else {
      this.fidgetIn -= dt;
      if (this.fidgetIn <= 0) {
        const roll = this.rand();
        this.play(roll < 0.45 ? "hop" : roll < 0.75 ? "look" : "wiggle");
        const busy = this.at === "interest" ? 0.6 : 1; // busier at the thing it likes
        this.fidgetIn = lerp(IDLE.fidgetMinMs, IDLE.fidgetMaxMs, this.rand()) * busy;
      }
    }

    // Turning: a squash-hop with the flip hidden at its top (turn-pose.ts). Walking already hops, so only a standing turn adds lift.
    // Facing is read after the travel step above, which is where a walk changes it.
    this.turn.face(this.facing);
    this.turn.advance(dt);
    const turned = this.turn.pose();
    sy *= turned.sy;
    if (!this.walking) lift += turned.lift * h;

    const breath = Math.sin((now / IDLE.breathMs) * TAU + this.phase);
    sy *= 1 + IDLE.breath * breath;
    sx *= 1 - IDLE.breath * 0.6 * breath;
    this.layout(lift, air, sx, sy, rot);
  }

  private advanceTravel(dt: number, height: number) {
    let sx = 1, sy = 1, rot = 0, lift = 0, air = 0;
    let remaining = dt;
    while (remaining > 0 && this.walking) {
      const duration = this.climbing ? TRAVEL.climbMs : HOP.durationMs;
      const consumed = Math.min(remaining, (1 - this.hopT) * duration);
      remaining -= consumed;
      this.hopT += consumed / duration;
      if (this.hopT < 1) break;
      this.hopT = 0;
      this.hopIndex += 1;
      if (this.hopIndex >= this.hops.length - 1) {
        this.walking = false;
        this.hopT = 0;
        const end = this.hops[this.hops.length - 1];
        if (end) Object.assign(this.pos, end);
        this.shove.x = this.shove.y = 0;
        this.action = null;
        if (this.queued) this.play(this.queued);
        this.queued = null;
      }
    }
    if (this.walking) {
      const a = this.hops[this.hopIndex];
      const b = this.hops[this.hopIndex + 1];
      if (a && b) {
        if (Math.abs(b.x - a.x) > 1) this.facing = Math.sign(b.x - a.x);
        if (b.climb) {
          this.shove.x = this.shove.y = 0;
          const pose = ladderPose(this.hopT, b.y > a.y);
          this.pos.x = lerp(a.x, b.x, pose.progress);
          this.pos.y = lerp(a.y, b.y, pose.progress);
          sx = pose.sx; sy = pose.sy; lift = pose.lift; rot = pose.rotation;
        } else {
          ({ sx, sy, rot, lift, air } = this.hopPose(this.hopT, a, b, height, HOP.height, 1));
          const fade = Math.exp(-SPACE.decayPerS * dt / SPACE.seconds);
          this.shove.x *= fade; this.shove.y *= fade;
          this.pos.x += this.shove.x; this.pos.y += this.shove.y;
        }
      }
    }

    return { sx, sy, rot, lift, air };
  }

  private hopPose(t: number, a: Point, b: Point, h: number, height: number, travel: number) {
    if (travel && this.cast.motion && this.cast.motion !== 'hop') {
      const progress = easeInOut(t);
      this.pos.x = lerp(a.x, b.x, progress); this.pos.y = lerp(a.y, b.y, progress);
      const lift = Math.sin(Math.PI * t) * h * (this.cast.motion === 'float' ? FLOAT_LIFT : WALK_LIFT);
      return { sx: 1, sy: 1, rot: 0, lift, air: this.cast.motion === 'float' ? Math.sin(Math.PI * t) : 0 };
    }
    let sx = 1;
    let sy = 1;
    let rot = 0;
    let lift = 0;
    let air = 0;
    const airEnd = 1 - HOP.land;
    if (t < HOP.crouch) {
      const k = Math.sin((t / HOP.crouch) * (Math.PI / 2));
      sx = lerp(1, HOP.squash.x, k);
      sy = lerp(1, HOP.squash.y, k);
      Object.assign(this.pos, a);
    } else if (t < airEnd) {
      const q = (t - HOP.crouch) / (airEnd - HOP.crouch);
      const k = Math.abs(Math.cos(Math.PI * q)); // stretched at take-off and touch-down, round at the top
      sx = lerp(1, HOP.stretch.x, k);
      sy = lerp(1, HOP.stretch.y, k);
      air = Math.sin(Math.PI * q);
      lift = air * height * h;
      rot = this.facing * HOP.lean * (1 - q * 1.6) * travel; // leans in, then rocks back to land
      const e = easeInOut(q);
      this.pos.x = lerp(a.x, b.x, e);
      this.pos.y = lerp(a.y, b.y, e);
    } else {
      const r = (t - airEnd) / HOP.land;
      const k = Math.sin(Math.PI * Math.min(1, r * 1.2)) * (1 - r * 0.4);
      sx = lerp(1, HOP.squash.x, k);
      sy = lerp(1, HOP.squash.y, k);
      Object.assign(this.pos, b);
    }
    return { sx, sy, rot, lift, air };
  }

  private actionPose(kind: Action["kind"], p: number, h: number) {
    if (kind === "settle") { const pose = landingPose(p); return { ...pose, lift: pose.lift * h }; }
    if (kind === "hop") return this.hopPose(p, this.pos, this.pos, h, HOP.height * 0.55, 0);
    if (kind === "press") {
      const k = Math.sin(Math.PI * p) * (1 - p);
      return { sx: 1 + 0.18 * k, sy: 1 - 0.2 * k, rot: 0, lift: 0, air: 0 };
    }
    if (kind === "nod") {
      const k = Math.max(0, Math.sin(p * TAU * 2)) * (1 - p * 0.5);
      return { sx: 1 + 0.06 * k, sy: 1 - 0.12 * k, rot: this.facing * 0.1 * k, lift: 0, air: 0 };
    }
    if (kind === "wiggle") {
      const k = Math.sin(p * TAU * 3) * Math.sin(Math.PI * p);
      return { sx: 1, sy: 1, rot: 0.1 * k, lift: 0, air: 0 };
    }
    return { sx: 1, sy: 1, rot: 0, lift: 0, air: 0 }; // look: the turn itself is the motion
  }

  private layout(lift: number, air: number, sx = 1, sy = 1, rot = 0): void {
    const seat = residentSeat(this.pos, heightAt(this.pos.y, this.cast.sizeBias));
    const h = this.held ? this.carryHeight : seat.height;
    const cloud = cloudPose(this.poseTime, this.phase);
    const support = seat.lift > 0 ? seat.lift + cloud.lift : 0;
    this.supportLift = this.held ? this.carrySupportLift : this.walking ? 0 : support;
    this.booster.place(h, this.aspect, this.held || this.walking ? 0 : seat.lift, this.lighting, cloud);
    const base = h / this.sprite.texture.height;
    this.root.position.set(this.pos.x, this.pos.y);
    this.root.zIndex = this.held ? PLACEMENT.heldDepth : this.climbing ? TRAVEL.climbDepth : residentDepth(this.pos, this.walking);
    this.body.position.set(0, -lift - this.supportLift);
    this.body.rotation = rot;
    this.sprite.scale.set(base * sx * this.turn.pose().sx, base * sy);
    this.setLighting(this.lighting);
    const shrink = 1 - SHADOW.airShrink * air;
    const footW = h * this.aspect;
    this.shadow.width = footW * SHADOW.width * shrink;
    this.shadow.height = h * SHADOW.height * shrink;
    this.shadow.alpha = this.climbing ? 0 : SHADOW.alpha * (1 - 0.5 * air);
    this.core.width = footW * SHADOW.coreWidth * shrink * sx;
    this.core.height = h * SHADOW.coreHeight * shrink;
    this.core.alpha = this.climbing ? 0 : SHADOW.coreAlpha * (1 - air);
    this.lift = lift + this.supportLift;
    this.height = h;
  }
}
