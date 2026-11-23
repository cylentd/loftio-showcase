import type { FailureKind } from './provider.ts';
import { validImage } from './records.ts';
import type { GeneratedImage } from './records.ts';

/** One follow-up image of a resident (today only the expression). `pending` covers queued and running. */
export type FollowUpSlot =
  | { status: 'pending' }
  | { status: 'ready'; image: GeneratedImage; promptVersion: string; createdAt: string }
  | { status: 'failed'; kind: FailureKind };

export type FollowUpEvent =
  | { type: 'succeed'; image: GeneratedImage; promptVersion: string; createdAt: string }
  | { type: 'fail'; kind: FailureKind }
  | { type: 'restart' }; // the worker restarted mid-run: the slot is never rerun

/** Every FailureKind a slot may hold, checked at the type level so a new kind cannot be forgotten silently. */
const FAILURE_KINDS = ['invalid', 'network', 'safety', 'corrupt', 'aborted', 'cap', 'busy', 'storage', 'preparation', 'tickets'] as const satisfies readonly FailureKind[];
const KIND_SET: ReadonlySet<string> = new Set(FAILURE_KINDS);

/** The one transition: pending -> ready | failed. ready and failed are final. A restart fails a pending slot as `network`. */
export function transitionFollowUp(slot: FollowUpSlot, event: FollowUpEvent): FollowUpSlot {
  if (slot.status !== 'pending') return slot;
  if (event.type === 'succeed') return { status: 'ready', image: event.image, promptVersion: event.promptVersion, createdAt: event.createdAt };
  if (event.type === 'fail') return { status: 'failed', kind: event.kind };
  return { status: 'failed', kind: 'network' };
}

/** A stored slot, or null when it is malformed. Never throws: one bad slot must not fail a resident list. */
export function parseFollowUp(value: unknown): FollowUpSlot | null {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const slot = value as Record<string, unknown>;
    if (slot.status === 'pending') return { status: 'pending' };
    if (slot.status === 'failed') {
      return typeof slot.kind === 'string' && KIND_SET.has(slot.kind) ? { status: 'failed', kind: slot.kind as FailureKind } : null;
    }
    if (slot.status !== 'ready' || !validImage(slot.image)) return null;
    if (typeof slot.promptVersion !== 'string' || typeof slot.createdAt !== 'string') return null;
    return { status: 'ready', image: slot.image as GeneratedImage, promptVersion: slot.promptVersion, createdAt: slot.createdAt };
  } catch { return null; }
}
