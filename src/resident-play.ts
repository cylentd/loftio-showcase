import type { Point } from "./resident-movement";
import type { Resident } from "./resident";

/** Extra play with held residents that a game entry may add (game/src/main.ts adds lobby tossing and piles).
 *  The shared room calls these hooks and names no feature, so the showcase reaches none of them; with no play
 *  installed every hook is skipped and the room behaves as before. Each hook mirrors one moment of a hold. */
export interface ResidentPlay {
  /** A pickup began. True when the resident was taken out of play (mid-toss or from a pile), so it lifts at once. */
  catch(resident: Resident, now: number): boolean;
  /** A pointer position while holding; `first` starts a new gesture. */
  sample(point: Point, time: number, first: boolean): void;
  /** How far above the room a carried resident may go (to reach the top of a pile), or undefined for the normal limit. */
  carryTop(): number | undefined;
  /** A pointer let go. Returns the line to announce when play took the resident, or null to place it normally. */
  release(resident: Resident, time: number, scale: number, moved: boolean, mayFling: boolean): string | null;
  /** A held resident is being put down in place (pointer or keyboard). Returns the line to announce when play took it, or null. */
  place?(resident: Resident, from?: Point | null): string | null;
  /** A key while a resident is held by keyboard. Returns the line to announce, or null when the key is not play's. */
  key(resident: Resident, key: string, mayFling: boolean): string | null;
  /** Everyone home, or the room changed: end all play. */
  reset(now: number): void;
  update(dt: number, now: number): void;
  /** Debug state for browser checks. */
  snapshot(): unknown;
}
