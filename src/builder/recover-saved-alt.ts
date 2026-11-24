import { ALT_ID } from './constants.ts';
import { altKindFor } from './alt-kind.ts';
import { freshSlots, settleSlot, slotsOf, type SlotSet } from './follow-up-slots.ts';
import { FOLLOW_UPS, type FollowUpDef } from './follow-ups.ts';
import type { BuilderApi, FollowUpOutcome, FollowUpRequest } from './controller.ts';
import type { SavedCharacter } from './records.ts';
import type { FailureKind } from './provider.ts';
import { elementFor, newLoadout, parseLoadout } from '../loadout/loadout-model.ts';
import { mergeSlots, sameRecordIdentity, withSharedRecord } from './saved-record-write.ts';
import type { Dependencies } from './controller-types.ts';

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

type SharedRecovery = Omit<Recovery, 'api' | 'write'> & {
  dependencies: Dependencies; show: (record: SavedCharacter) => void;
};

export class SharedAltRecovery {
  private unsaved = new Map<string, { record: SavedCharacter; outcome: Extract<FollowUpOutcome, { ok: true }> }>();

  async run(recovery: SharedRecovery): Promise<'ready' | FailureKind> {
    const { id, signal, dependencies } = recovery;
    if (signal.aborted) return 'aborted';
    if (!dependencies.altOperation || !dependencies.exclusive) return 'storage';
    try { return await dependencies.altOperation(id, () => this.draw(recovery)); }
    catch { return 'storage'; }
  }

  private async draw({ id, verify, saved, slots, signal, dependencies, show }: SharedRecovery): Promise<'ready' | FailureKind> {
    const entry = FOLLOW_UPS.find(item => item.id === ALT_ID);
    const { recoverAlt } = dependencies.api;
    if (signal.aborted) return 'aborted';
    if (!saved || !entry || !recoverAlt) return 'invalid';
    const latest = await withSharedRecord(dependencies, saved);
    if (signal.aborted) return 'aborted';
    if (!latest || !('base64' in latest.image)) return 'invalid';
    if (latest.alt?.slot.status === 'ready') {
      this.unsaved.delete(id);
      show(latest);
      return 'ready';
    }
    if (latest.alt?.slot.status === 'pending' || slots.get(id)?.alt?.slot.status === 'pending') return 'busy';
    const cached = this.unsaved.get(id);
    if (cached && !sameRecordIdentity(latest, cached.record)) { this.unsaved.delete(id); return 'invalid'; }
    const request = followUpRequest(id, entry, { requestId: latest.generation.requestId, image: latest.image }, undefined, latest.rumble);
    let outcome: FollowUpOutcome;
    try { outcome = cached?.outcome ?? await untilAborted(signal, () => recoverAlt(request, latest.generation.userSelections, verify, signal)); }
    catch { outcome = { ok: false, kind: 'network' }; }
    if (signal.aborted) return 'aborted';
    if (outcome.ok) this.unsaved.set(id, { record: latest, outcome });
    const changed = settleSlot(freshSlots(altKindFor(id)), ALT_ID, outcome, false);
    const committed = await withSharedRecord(dependencies, latest, record => signal.aborted ? record : mergeSlots(record, { alt: changed.alt }));
    this.unsaved.delete(id);
    if (signal.aborted) return 'aborted';
    if (!committed) return 'invalid';
    show(committed);
    return committed.alt?.slot.status === 'ready' || outcome.ok ? 'ready' : outcome.kind;
  }
}

async function untilAborted(signal: AbortSignal, draw: () => Promise<FollowUpOutcome>) {
  if (signal.aborted) return { ok: false, kind: 'aborted' } as const;
  let abort!: () => void;
  const stopped = new Promise<FollowUpOutcome>(resolve => {
    abort = () => resolve({ ok: false, kind: 'aborted' });
    signal.addEventListener('abort', abort, { once: true });
  });
  try { return await Promise.race([stopped, draw()]); }
  finally { signal.removeEventListener('abort', abort); }
}
