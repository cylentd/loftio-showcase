import type { FailureKind } from './provider.ts';
import { ALT_ID, EXPRESSION_ID } from './constants.ts';
import type { AltKind } from './alt-kind.ts';
import type { AltReference, GeneratedImage, SavedAlt, SavedCharacter } from './records.ts';
import { transitionFollowUp, type FollowUpSlot } from './follow-up-model.ts';

/** The follow-up state of one resident: the expression slot and the alt, which wraps its own slot. Absent key = never asked for. */
export type SlotSet = { expression?: FollowUpSlot; alt?: SavedAlt };

const PENDING: FollowUpSlot = { status: 'pending' };

/** A new build's follow-ups, all pending. The alt's kind is fixed here, from the record id. */
export const freshSlots = (kind: AltKind): SlotSet => ({
  expression: PENDING, alt: { schemaVersion: 1, kind, slot: PENDING },
});

/** What a saved record already holds, or undefined for none. */
export function slotsOf(item: SavedCharacter | undefined): SlotSet | undefined {
  if (!item || (!item.expression && !item.alt)) return undefined;
  return { ...(item.expression ? { expression: item.expression } : {}), ...(item.alt ? { alt: item.alt } : {}) };
}

/** The record fields for a set, with no key for a slot that does not exist, so a record never gains `expression: undefined`. */
export const slotFields = (set: SlotSet | undefined): Pick<SavedCharacter, 'expression' | 'alt'> => ({
  ...(set?.expression ? { expression: set.expression } : {}), ...(set?.alt ? { alt: set.alt } : {}),
});

/** The slot a follow-up entry fills. */
export function slotOf(set: SlotSet | undefined, id: string): FollowUpSlot | undefined {
  return id === ALT_ID ? set?.alt?.slot : id === EXPRESSION_ID ? set?.expression : undefined;
}

/** The set with one entry's slot replaced. `references` is kept on the alt only, and only when given (a ready alt). */
export function withSlot(set: SlotSet, id: string, slot: FollowUpSlot, references?: AltReference[]): SlotSet {
  if (id === ALT_ID && set.alt) return { ...set, alt: { ...set.alt, slot, ...(references ? { references } : {}) } };
  return id === EXPRESSION_ID ? { ...set, expression: slot } : set;
}

export type SlotOutcome =
  | { ok: true; image: GeneratedImage; promptVersion: string; createdAt: string; references?: AltReference[] }
  | { ok: false; kind: FailureKind };

/** The set after one entry's outcome. A ready alt records the images it was drawn from: the api's own word, else what the request carried. */
export function settleSlot(set: SlotSet, id: string, outcome: SlotOutcome, sentExpression: boolean): SlotSet {
  const event = outcome.ok
    ? { type: 'succeed', image: outcome.image, promptVersion: outcome.promptVersion, createdAt: outcome.createdAt } as const
    : { type: 'fail', kind: outcome.kind } as const;
  const carried: AltReference[] = sentExpression ? ['idle', 'expression'] : ['idle'];
  const references = outcome.ok && id === ALT_ID ? outcome.references ?? carried : undefined;
  return withSlot(set, id, transitionFollowUp(PENDING, event), references);
}

/** Every slot still pending becomes failed with `kind`: the work that would have settled it is gone (a reload with no worker to ask). */
export function failPending(set: SlotSet, kind: FailureKind): SlotSet {
  const failed: FollowUpSlot = { status: 'failed', kind };
  return {
    ...(set.expression ? { expression: set.expression.status === 'pending' ? failed : set.expression } : {}),
    ...(set.alt ? { alt: set.alt.slot.status === 'pending' ? { ...set.alt, slot: failed } : set.alt } : {}),
  };
}
