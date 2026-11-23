import type { SavedCharacter } from '../builder/records';
import type { ResidentEntry } from './registry';

export type KeptResident = { record: SavedCharacter; name: string; inLoft: boolean };

export function keptResidents(records: readonly SavedCharacter[], entries: readonly ResidentEntry[]): KeptResident[] {
  const byId = new Map(records.map(record => [record.id, record]));
  return entries.flatMap(entry => {
    const record = byId.get(entry.savedId);
    if (record?.state !== 'kept' || record.generation.providerId.includes('mock')) return [];
    return [{ record, name: entry.name ?? record.resolvedSelections.creature.label, inLoft: entry.inRoom }];
  });
}
