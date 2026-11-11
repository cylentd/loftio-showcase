import { FLOOR_PLAY as P } from "./floor-play-data";
import { floorBody, fitFloor, launchFloor, stepFloor, type FloorBody } from "./floor-play-model";
import { floorPosition } from "./resident-movement";
import { PLACEMENT } from "./resident-movement-data";
import { heightAt, type Resident } from "./resident";
import type { Scene } from "./scene";
import type { Look } from "./look";
import { ResidentStacks } from "./resident-stacks";
import { grabStyle } from "./grab-style";
import type { StackSounds } from "./sfx";

/** Floor positions own depth; independent height supplies the little hops. */
export class LobbyFidget {
  private flights = new Map<Resident, FloorBody>();
  private stackable = new Set<Resident>();
  readonly stacks: ResidentStacks;
  constructor(private scene: Scene, private look: Look, sound?: StackSounds, onFull?: (resident: Resident) => void) {
    this.stacks = new ResidentStacks(scene, (r, v) => this.throwResident(r, v, false), (r, now) => this.land(r, now), sound, onFull);
  }

  private view() {
    const { scale, left, x } = this.look;
    const visibleLeft = left / scale + x - this.scene.cast.x;
    return { left: visibleLeft, right: visibleLeft + innerWidth / scale };
  }

  private radius(resident: Resident, y: number): number {
    return heightAt(y, resident.cast.sizeBias) * resident.aspect * P.radiusRatio;
  }

  throwResident(resident: Resident, velocity: { x: number; y: number }, canStack = true): void {
    if (canStack) this.stackable.add(resident); else this.stackable.delete(resident);
    if (!resident.held) resident.pickUp();
    const ground = floorPosition(resident.pos);
    const flight = floorBody(ground.x, ground.y, this.radius(resident, ground.y));
    flight.edgeRadius = flight.radius * P.screenRadiusRatio / P.radiusRatio;
    fitFloor(flight, this.view());
    flight.z = Math.max(0, flight.y - resident.pos.y + resident.lift);
    launchFloor(flight, velocity);
    this.flights.set(resident, flight);
    this.draw(resident, flight);
  }

  catch(resident: Resident, now = 0): boolean {
    grabStyle(resident);
    this.stackable.delete(resident);
    return this.flights.delete(resident) || this.stacks.detach(resident, now);
  }

  reset(now: number, clearStacks = true): void {
    for (const resident of this.flights.keys()) this.land(resident, now);
    this.flights.clear();
    this.stackable.clear();
    if (clearStacks) this.stacks.reset(now);
  }

  private land(resident: Resident, now: number): void {
    this.stackable.delete(resident);
    Object.assign(resident.pos, floorPosition(resident.pos));
    resident.putDown(true, !this.look.frozen, now);
    resident.update(0, now, this.look.frozen);
  }

  update(dt: number, now: number): void {
    if (this.look.frozen) { this.reset(now, false); this.stacks.update(0, true); return; }
    if (!this.flights.size) { this.stacks.update(dt, false, now); return; }
    this.stacks.update(0, false);
    const bodies = new Map(this.flights), view = this.view();
    for (const resident of this.scene.residents) {
      if (bodies.has(resident)) continue;
      if ((resident.held && !this.stacks.isBase(resident)) || resident.falling || resident.walking || resident.climbing || resident.seatSupport.lift > 0) continue;
      if (resident.pos.y < PLACEMENT.back || resident.pos.y > PLACEMENT.front) continue;
      const radius = this.radius(resident, resident.pos.y);
      if (resident.pos.x - radius < view.left || resident.pos.x + radius > view.right) continue;
      bodies.set(resident, floorBody(resident.pos.x, resident.pos.y, radius));
    }
    for (const [resident, b] of bodies) {
      b.radius = this.radius(resident, b.y);
      b.edgeRadius = b.radius * P.screenRadiusRatio / P.radiusRatio;
    }
    const owners = new Map([...bodies].map(([r, b]) => [b, r]));
    stepFloor([...bodies.values()], dt, view, (before, b) => {
      const resident = owners.get(b)!;
      if (!this.stackable.has(resident)) return false;
      const moving = new Set([...bodies].filter(([, body]) => !body.asleep).map(([r]) => r));
      if (!this.stacks.tryLand(resident, before, b, moving)) return false;
      this.flights.delete(resident); this.stackable.delete(resident); bodies.delete(resident);
      return true;
    });
    for (const [resident, b] of bodies) {
      if (!this.flights.has(resident)) {
        if (b.asleep) continue;
        this.stacks.topple(resident, { x: b.vx, y: b.vy });
        resident.pickUp(); this.flights.set(resident, b);
      }
      this.draw(resident, b);
      if (b.asleep) { this.land(resident, now); this.flights.delete(resident); }
    }
    this.stacks.update(dt, false, now);
  }

  private draw(resident: Resident, b: FloorBody): void {
    const squash = b.impact * P.squash;
    const lean = Math.max(-1, Math.min(1, b.vx / P.leanSpeed)) * P.maxLean;
    const spring = grabStyle(resident).spring();
    resident.poseAt(b.x, b.y, b.z, { air: Math.min(1, b.z / heightAt(b.y, resident.cast.sizeBias)),
      sx: (1 + squash) * spring.sx, sy: (1 - squash) * spring.sy, rotation: lean });
  }

  snapshot() { return { flights: [...this.flights].map(([resident, b]) => ({ id: resident.cast.id, ...b })), stacks: this.stacks.snapshot() }; }
}
