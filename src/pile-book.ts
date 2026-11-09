import { AUTO_STACK } from "./auto-stack-data.ts";
import { splitStack } from "./stack-model.ts";
import type { StackSounds } from "./sfx.ts";

/** Pile bookkeeping with no rendering: who stands on whom, and whether the residents made it themselves. */
export type Pile<T> = { members: T[]; age: number; auto: boolean; life: number; step: number };

export const newPile = <T>(members: T[], auto = false): Pile<T> => ({ members, age: 0, auto, life: 0, step: 0 });

/** Puts `member` on top and plops at the new height: soft when the pile is self-made, so make a pile the player's before they join it. */
export function addMember<T>(pile: Pile<T>, member: T, sound?: StackSounds): void {
  pile.members.push(member);
  sound?.plop(pile.members.length, pile.auto);
}

/** A pile flung over: one falling note per resident in it. */
export function tumblePile<T>(pile: Pile<T>, sound?: StackSounds): void {
  sound?.topple(pile.members.length, pile.auto);
}

/** The player touched a self-made pile: it is theirs now and stays until they take it apart. */
export function playerOwned<T>(pile: Pile<T>): Pile<T> { pile.auto = false; return pile; }

/** A self-made pile takes a joiner only while it is self-made, under the cap, and the joiner stands alone. */
export function canAutoJoin<T>(piles: readonly Pile<T>[], base: T, climber: T): boolean {
  if (base === climber || piles.some(p => p.members.includes(climber))) return false;
  const pile = piles.find(p => p.members.includes(base));
  return !pile || (pile.auto && pile.members[0] === base && pile.members.length < AUTO_STACK.maxHeight);
}

/** Ages a self-made pile and returns the residents that climb down this tick, top first. */
export function tickAutoPile<T>(pile: Pile<T>, dt: number): T[] {
  if (!pile.auto) return [];
  pile.life += dt;
  if (pile.life < AUTO_STACK.lifetimeMs) return [];
  pile.step -= dt;
  if (pile.step > 0) return [];
  pile.step = AUTO_STACK.descendStepMs;
  const down = [pile.members.pop()!];
  if (pile.members.length === 1) down.push(pile.members.pop()!);
  return down;
}

/** Takes `member` out of its pile exactly as a player grab does: those above fall, those below stay as a player pile. */
export function detachPile<T>(piles: readonly Pile<T>[], member: T, sound?: StackSounds): { piles: Pile<T>[]; landing: T | null; falling: T[] } | null {
  const pile = piles.find(p => p.members.includes(member));
  if (!pile) return null;
  const { lower, falling } = splitStack(pile.members, pile.members.indexOf(member));
  // A grab is the player's doing, so the cascade is never the quiet kind.
  if (falling.length) sound?.topple(falling.length, false);
  const rest = piles.filter(p => p !== pile);
  if (lower.length > 1) rest.push(newPile(lower));
  return { piles: rest, landing: lower.length === 1 ? lower[0]! : null, falling };
}
