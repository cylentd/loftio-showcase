import { AUTO_STACK } from "./auto-stack-data.ts";

export type AutoActor = { id: string; x: number; y: number; surface: string; free: boolean; walking: boolean; held: boolean };

/** What the stacker needs from the room; the lobby supplies the real one, tests a fake. */
export interface AutoStackHost {
  actors(): AutoActor[];
  /** Start `id` walking to stand beside `baseId`; false when it cannot. */
  walkNear(id: string, baseId: string): boolean;
  /** Put `id` on top of `baseId`'s pile; false when the pile refuses. */
  join(id: string, baseId: string): boolean;
  /** Residents in the pile `id` stands in, or 0. */
  pileSize(id: string): number;
}

type Plan = { base: string; waiting: string[]; joined: number; since: number };
type Tunables = typeof AUTO_STACK;

/** Decides when residents stack themselves. It owns the dice and the cooldown; piles and poses stay in ResidentStacks. */
export class AutoStacker {
  private plan: Plan | null = null;
  private rollIn: number = AUTO_STACK.decisionMs;
  private quietUntil = 0;
  private readonly host: AutoStackHost;
  private readonly rand: () => number;
  private readonly tune: Tunables;
  constructor(host: AutoStackHost, rand: () => number, tune: Tunables = AUTO_STACK) {
    this.host = host; this.rand = rand; this.tune = tune;
  }

  /** `enabled` is the quiet gate: wandering on and motion not paused or reduced. */
  update(dt: number, now: number, enabled: boolean): void {
    if (!enabled) { this.plan = null; return; }
    if (this.plan) { this.advance(now); return; }
    if (now < this.quietUntil) return;
    this.rollIn -= dt;
    if (this.rollIn > 0) return;
    this.rollIn = this.tune.decisionMs;
    if (this.rand() < this.tune.chance) this.start(now);
  }

  /** Everyone home or the room changed: forget the plan. */
  reset(): void { this.plan = null; }

  private start(now: number): void {
    const free = this.host.actors().filter(a => a.free);
    const base = free[Math.floor(this.rand() * free.length)];
    if (!base) return;
    const wanted = Math.min(this.tune.maxHeight - 1, this.rand() < this.tune.thirdChance ? 2 : 1);
    const near = free.filter(a => a !== base && a.surface === base.surface
      && Math.abs(a.x - base.x) <= this.tune.reachX && Math.abs(a.y - base.y) <= this.tune.reachY)
      .sort((a, b) => Math.hypot(a.x - base.x, a.y - base.y) - Math.hypot(b.x - base.x, b.y - base.y));
    const waiting = near.slice(0, wanted).filter(a => this.host.walkNear(a.id, base.id)).map(a => a.id);
    if (waiting.length) this.plan = { base: base.id, waiting, joined: 0, since: now };
  }

  private advance(now: number): void {
    const plan = this.plan!, actors = this.host.actors();
    const base = actors.find(a => a.id === plan.base);
    if (!base || (base.held || base.walking) && !this.host.pileSize(plan.base)) return this.end(now);
    if (plan.waiting.length && now - plan.since > this.tune.giveUpMs) plan.waiting = [];
    for (const id of [...plan.waiting]) {
      const climber = actors.find(a => a.id === id);
      if (climber?.walking) continue;
      plan.waiting = plan.waiting.filter(w => w !== id);
      if (climber && !climber.held && this.host.join(id, plan.base)) plan.joined += 1;
    }
    if (!plan.waiting.length && (!plan.joined || !this.host.pileSize(plan.base))) this.end(now);
  }

  private end(now: number): void {
    this.plan = null;
    this.quietUntil = now + this.tune.cooldownMs;
  }
}
