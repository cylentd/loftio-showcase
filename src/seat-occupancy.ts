import { isSitting, surfaceAt, type Point } from "./resident-movement.ts";

export function seatAvailable(target: Point, claims: readonly Point[]): boolean {
  return !isSitting(target) || !claims.some(point => surfaceAt(point) === surfaceAt(target));
}
