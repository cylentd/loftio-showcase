import { ALT_ID } from './constants.ts';
import { altKindFor } from './alt-kind.ts';
import { freshSlots, settleSlot, slotsOf, type SlotSet } from './follow-up-slots.ts';
import { FOLLOW_UPS, type FollowUpDef } from './follow-ups.ts';
import type { BuilderApi, FollowUpOutcome, FollowUpRequest } from './controller.ts';
import type { SavedCharacter } from './records.ts';
import type { FailureKind } from './provider.ts';
import { elementFor, newLoadout, parseLoadout } from '../loadout/loadout-model.ts';

export type FollowUpBase = Omit<FollowUpRequest, 'id' | 'expression' | 'kind' | 'trait' | 'element'>;

export function followUpRequest(id: string, entry: FollowUpDef, asked: FollowUpBase, slots?: SlotSet, rumble?: SavedCharacter['rumble']): FollowUpRequest {
  const expression = slots?.expression;
  const sendsExpression = entry.references.includes('expression') && expression?.status === 'ready';
  const request: FollowUpRequest = { id: entry.id, ...asked, ...(sendsExpression ? { expression: expression.image } : {}) };
  if (entry.id !== ALT_ID) return request;
  const loadout = parseLoadout(rumble) ?? newLoadout(id);
  return { ...request, kind: altKindFor(id), trait: loadout.trait, element: elementFor(loadout, id) };
}

type Recovery = {
  id: string; verify: () => Promise<string>; api: BuilderApi; saved?: SavedCharacter; slots: Map<string, SlotSet>;
  signal: AbortSignal; write: () => Promise<boolean>;
};

export async function recoverSavedAlt({ id, verify, api, saved, slots, signal, write }: Recovery): Promise<'ready' | FailureKind> {
  const entry = FOLLOW_UPS.find(item => item.id === ALT_ID);
  if (!saved || !entry || !api.recoverAlt || !('base64' in saved.image) || signal.aborted) return 'invalid';
  const current = slots.get(id) ?? slotsOf(saved) ?? {};
  if (current.alt?.slot.status === 'ready') {
    return saved.alt?.slot.status === 'ready' || await write() ? 'ready' : 'storage';
  }
  if (current.alt?.slot.status === 'pending') return 'busy';
  const pending = { ...current, alt: freshSlots(altKindFor(id)).alt };
  slots.set(id, pending);
  let outcome: FollowUpOutcome;
  const request = followUpRequest(id, entry, { requestId: saved.generation.requestId, image: saved.image }, undefined, saved.rumble);
  try { outcome = await api.recoverAlt(request, saved.generation.userSelections, verify, signal); }
  catch { outcome = { ok: false, kind: 'network' }; }
  if (signal.aborted) return 'aborted';
  slots.set(id, settleSlot(slots.get(id) ?? pending, ALT_ID, outcome, false));
  if (!(await write())) return 'storage';
  return outcome.ok ? 'ready' : outcome.kind;
}
