import type { BuilderState, Dependencies } from './controller-types.ts';
import type { GeneratedImage, SavedCharacter } from './records.ts';
import { failPending, slotFields, slotsOf, type SlotSet } from './follow-up-slots.ts';
import { ALT_ID, EXPRESSION_ID } from './constants.ts';
import { COPY } from './copy.ts';
import { ProviderError } from './provider.ts';
import { backfillLoadout, isRerollable, parseLoadout, rollLoadout, type Loadout } from '../loadout/loadout-model.ts';

type RecordStorage = Pick<Dependencies, 'store' | 'exclusive'>;
type RecordChange = (latest: SavedCharacter) => SavedCharacter;

function sameImage(first: GeneratedImage, second: GeneratedImage) {
  if (first.width !== second.width || first.height !== second.height || first.hasAlphaChannel !== second.hasAlphaChannel) return false;
  if (first.mime === 'image/png') return second.mime === first.mime && first.base64 === second.base64;
  return second.mime === first.mime && first.url === second.url && first.originalUrl === second.originalUrl && first.bytes === second.bytes;
}

export function sameRecordIdentity(latest: SavedCharacter, expected: SavedCharacter) {
  return latest.id === expected.id && latest.generationId === expected.generationId && latest.generation.id === expected.generation.id
    && latest.generation.requestId === expected.generation.requestId && latest.generation.createdAt === expected.generation.createdAt
    && sameImage(latest.image, expected.image);
}

export function withSharedRecord({ exclusive, store }: RecordStorage, expected: SavedCharacter, change?: RecordChange) {
  if (!exclusive) throw new ProviderError('storage', COPY.lockUnavailable);
  return exclusive(async () => {
    const latest = (await store.list()).find(item => item.id === expected.id);
    if (!latest || !sameRecordIdentity(latest, expected)) return undefined;
    const next = change?.(latest) ?? latest;
    if (next !== latest) await store.put(next);
    return next;
  });
}

export function putGeneratedRecord({ exclusive, store }: RecordStorage, record: SavedCharacter) {
  if (!exclusive) return store.put(record);
  return exclusive(async () => {
    const latest = (await store.list()).find(item => item.id === record.id);
    if (!latest) await store.put(record);
    else if (!sameRecordIdentity(latest, record) || latest.state !== record.state) throw new ProviderError('storage', COPY.storage);
  });
}

export function mergeSlots(latest: SavedCharacter, changed: SlotSet) {
  const expression = latest.expression?.status === 'ready' ? undefined : changed.expression;
  const alt = latest.alt?.slot.status === 'ready' ? undefined : changed.alt;
  return expression || alt ? { ...latest, ...(expression && { expression }), ...(alt && { alt }) } : latest;
}

export function savedRecord(preview: NonNullable<BuilderState['preview']>, keptAt: string, rumble: Loadout, slots?: SlotSet): SavedCharacter {
  const generation = preview.generation;
  return structuredClone({
    schemaVersion: 2, id: generation.id, state: 'kept', generationId: generation.id,
    userSelections: generation.userSelections, resolvedSelections: generation.resolvedSelections,
    promptVersion: generation.promptVersion, providerModelId: generation.providerId + '/' + generation.modelId,
    referenceIds: generation.referenceIds, image: preview.image, generation,
    keptAt, parentId: null, identityNotes: null, rumble, ...slotFields(slots),
  });
}

export function writeSharedSlots(dependencies: RecordStorage, expected: SavedCharacter, candidate: SlotSet, changed: readonly string[]) {
  return withSharedRecord(dependencies, expected, latest => mergeSlots(latest, {
    expression: changed.includes(EXPRESSION_ID) ? candidate.expression : undefined,
    alt: changed.includes(ALT_ID) ? candidate.alt : undefined,
  }));
}

export function durableSlots(dependencies: Dependencies, set?: SlotSet) {
  return slotFields(set && dependencies.exclusive && !dependencies.api.resumeFollowUp ? failPending(set, 'network') : set);
}

export async function keepRecord(dependencies: Dependencies, resident: SavedCharacter) {
  if (!dependencies.guardPaidRequests) { await dependencies.store.put(resident); return resident; }
  const saved = await withSharedRecord(dependencies, resident, latest => latest.state === 'kept' ? latest
    : { ...latest, state: 'kept', keptAt: resident.keptAt });
  if (!saved) throw new ProviderError('storage', COPY.storage);
  return saved;
}

export async function backfillRecord(dependencies: Dependencies, item: SavedCharacter) {
  if (!dependencies.guardPaidRequests) { await dependencies.store.put(item); return undefined; }
  return withSharedRecord(dependencies, item, latest => parseLoadout(latest.rumble) ? latest : { ...latest, rumble: item.rumble });
}

function rollSavedLoadout(current: SavedCharacter, rng: () => number) {
  const old = parseLoadout(current.rumble) ?? backfillLoadout(current.id);
  if (!isRerollable(old)) return null;
  const fresh = rollLoadout(rng, undefined, old.synergy);
  return old.names ? { ...fresh, names: old.names } : fresh;
}

export async function rerollRecord(dependencies: Dependencies, current: SavedCharacter, slots?: SlotSet) {
  const rng = dependencies.rng ?? Math.random;
  if (!dependencies.guardPaidRequests) {
    const rolled = rollSavedLoadout(current, rng);
    if (!rolled) return { rolled };
    const saved = { ...current, rumble: rolled, ...slotFields(slots ?? slotsOf(current)) };
    await dependencies.store.put(saved);
    return { saved, rolled };
  }
  let rolled: Loadout | null = null;
  const saved = await withSharedRecord(dependencies, current, latest => {
    rolled = rollSavedLoadout(latest, rng);
    return rolled ? { ...latest, rumble: rolled } : latest;
  });
  return { saved, rolled };
}

export function showPendingSlots(record: SavedCharacter, pending?: SlotSet) {
  return mergeSlots(record, { expression: pending?.expression?.status === 'pending' ? pending.expression : undefined,
    alt: pending?.alt?.slot.status === 'pending' ? pending.alt : undefined });
}
