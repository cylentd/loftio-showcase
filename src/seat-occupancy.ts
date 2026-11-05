import { isSitting, surfaceAt, type Point } from "./resident-movement.ts";

export function seatAvailable(target: Point, claims: readonly Point[]): boolean {
  return !isSitting(target) || !claims.some(point => surfaceAt(point) === surfaceAt(target));
}

export function seatDrop(target: Point, origin: Point, claims: readonly Point[]): { position: Point; blocked: boolean } {
  const blocked = !seatAvailable(target, claims);
  return { position: { ...(blocked ? origin : target) }, blocked };
}
