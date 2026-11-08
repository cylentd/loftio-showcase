import { STACK } from "./stack-data";
import { chooseStack, splitStack } from "./stack-model";
import { PLACEMENT } from "./resident-movement-data";
import { heightAt, type Resident } from "./resident";
import type { Scene } from "./scene";
import { airborneStack } from "./air-stack-model";
import type { FloorBody } from "./floor-play-model";

type Pile = { members: Resident[]; age: number };
type Release = (resident: Resident, velocity: { x: number; y: number }) => void;

export class ResidentStacks {
  private piles: Pile[] = [];
  constructor(private scene: Scene, private release: Release, private land: (resident: Resident, now: number) => void) {}

  contains(r: Resident): boolean { return this.piles.some(p => p.members.includes(r)); }
  isBase(r: Resident): boolean { return this.piles.some(p => p.members[0] === r); }

  private tops(resident: Resident): Resident[] {
    return this.scene.residents.filter(r => {
      if (r === resident || r.walking || r.climbing) return false;
      const pile = this.piles.find(p => p.members.includes(r));
      if (pile) return pile.members.at(-1) === r && pile.members.length < STACK.maxResidents;
      return !r.held && r.seatSupport.lift === 0 && r.pos.y >= PLACEMENT.back && r.pos.y <= PLACEMENT.front;
    });
  }

  private candidates(tops: Resident[]) {
    return tops.map(r => ({ id: r.cast.id, x: r.pos.x, y: r.pos.y, lift: r.lift, height: r.height,
      width: r.height * r.aspect, count: this.piles.find(p => p.members.includes(r))?.members.length ?? 1 }));
  }

  tryLand(resident: Resident, previous: FloorBody, current: FloorBody, moving: Set<Resident>): boolean {
    const tops = this.tops(resident).filter(r => !moving.has(r));
    const id = airborneStack(previous, current, this.candidates(tops));
    const target = tops.find(r => r.cast.id === id);
    return target ? this.attach(resident, target) : false;
  }

  tryPlace(resident: Resident, keyboard = false): boolean {
    const tops = this.tops(resident), candidates = this.candidates(tops);
    const foot = { x: resident.pos.x, y: resident.pos.y - resident.lift };
    const nearest = keyboard ? candidates.filter(c => Math.hypot(c.x - foot.x, c.y - resident.pos.y) <= STACK.keyboardReach)
      .sort((a, b) => Math.hypot(a.x - foot.x, a.y - resident.pos.y) - Math.hypot(b.x - foot.x, b.y - resident.pos.y))[0]?.id : chooseStack(foot, candidates);
    const target = tops.find(r => r.cast.id === nearest);
    return target ? this.attach(resident, target) : false;
  }

  private attach(resident: Resident, target: Resident): boolean {
    let pile = this.piles.find(p => p.members.includes(target));
    if (!pile) { target.pickUp(); pile = { members: [target], age: 0 }; this.piles.push(pile); }
    if (!resident.held) resident.pickUp();
    pile.members.push(resident); pile.age = 0;
    this.update(0, false);
    return true;
  }

  detach(resident: Resident, now: number): boolean {
    const pile = this.piles.find(p => p.members.includes(resident));
    if (!pile) return false;
    const { lower, falling } = splitStack(pile.members, pile.members.indexOf(resident));
    this.piles = this.piles.filter(p => p !== pile);
    if (lower.length > 1) this.piles.push({ members: lower, age: 0 });
    else if (lower[0]) this.land(lower[0], now);
    falling.forEach((r, i) => this.release(r, { x: (i % 2 ? -1 : 1) * STACK.toppleSpeed, y: 0 }));
    return true;
  }

  topple(base: Resident, velocity: { x: number; y: number }): void {
    const pile = this.piles.find(p => p.members[0] === base);
    if (!pile) return;
    this.piles = this.piles.filter(p => p !== pile);
    pile.members.slice(1).forEach((r, i) => this.release(r, { x: velocity.x + (i % 2 ? -1 : 1) * STACK.toppleSpeed, y: velocity.y }));
  }

  reset(now: number): void {
    for (const pile of this.piles) for (const resident of pile.members) this.land(resident, now);
    this.piles = [];
  }

  update(dt: number, frozen: boolean): void {
    for (const pile of this.piles) {
      if (!frozen) pile.age += dt;
      const base = pile.members[0]!;
      let lift = 0;
      pile.members.forEach((resident, level) => {
        resident.renderStack(base.pos.x, base.pos.y, lift, level, pile.age, frozen);
        lift += resident.height * STACK.supportHeight;
      });
    }
  }

  snapshot() { return this.piles.map(p => p.members.map(r => r.cast.id)); }

  bounds() {
    if (!this.piles.length) return null;
    return { top: Math.min(...this.piles.map(p => {
      const base = p.members[0]!, top = p.members.at(-1)!;
      const lift = p.members.slice(0, -1).reduce((total, r) => total + r.height * STACK.supportHeight, 0);
      const actualTop = base.pos.y - lift - top.height;
      if (p.members.length >= STACK.maxResidents) return actualTop;
      const nextHeight = Math.max(...this.scene.residents.filter(r => !p.members.includes(r)).map(r => heightAt(base.pos.y, r.cast.sizeBias)));
      return Math.min(actualTop, base.pos.y - lift - top.height * STACK.supportHeight - nextHeight);
    })), bottom: Math.max(...this.piles.map(p => p.members[0]!.pos.y)) };
  }
}
