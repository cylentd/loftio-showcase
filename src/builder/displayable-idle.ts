import type { Bounds } from './alpha.ts';

export type ImageCheck = { verdict: string; marginOk?: boolean; bounds?: Bounds | null };

export function displayableIdle(check: ImageCheck): check is ImageCheck & { bounds: Bounds } {
  return check.verdict === 'transparent' && !!check.bounds;
}
