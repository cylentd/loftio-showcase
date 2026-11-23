import type { SavedCharacter } from '../builder/records';
import type { ResidentEntry } from './registry';

export type KeptResident = { record: SavedCharacter; name: string; inLoft: boolean };

export const hasResidentCardArt = (record: SavedCharacter): boolean => !record.generation.providerId.includes('mock');

export function keptResidents(records: readonly SavedCharacter[], entries: readonly ResidentEntry[]): KeptResident[] {
  const byId = new Map(records.map(record => [record.id, record]));
  return entries.flatMap(entry => {
    const record = byId.get(entry.savedId);
    if (!record || (entry.arrival === 'waiting' && record.state !== 'kept') || !hasResidentCardArt(record)) return [];
    return [{ record, name: entry.name ?? record.resolvedSelections.creature.label, inLoft: entry.inRoom }];
  });
}
