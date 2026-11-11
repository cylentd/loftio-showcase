import { residentName } from './names.ts';
import { RESIDENT_COPY as COPY } from './copy.ts';

export const GENERATED_CAPACITY = 12; // Additional residents; never evicts the six originals.
const STORAGE_KEY = 'loftio-residents-v1';
export type Position = { x: number; y: number };
export type ResidentEntry = {
  id: string; savedId: string; inRoom: boolean; arrival: 'waiting' | 'saved' | 'welcomed';
  positions: Partial<Record<'desktop' | 'portrait', Position>>; name?: string;
  deliveryPositions?: Partial<Record<'desktop' | 'portrait', Position>>;
};
type Storage = { getItem(key: string): string | null; setItem(key: string, value: string): void };
const point = (value: any) => value && Number.isFinite(value.x) && Number.isFinite(value.y);

function restore(raw: string | null): ResidentEntry[] {
  if (raw === null) return [];
  const value = JSON.parse(raw);
  if (value?.version !== 1 || !Array.isArray(value.residents)) throw Error('Invalid resident registry');
  const ids = new Set(), savedIds = new Set();
  for (const entry of value.residents) {
    if (!entry || typeof entry.id !== 'string' || !entry.id.startsWith('resident:') || typeof entry.savedId !== 'string'
      || typeof entry.inRoom !== 'boolean' || !['waiting', 'saved', 'welcomed'].includes(entry.arrival)
      || !entry.positions || typeof entry.positions !== 'object' || ids.has(entry.id) || savedIds.has(entry.savedId)
      || Object.entries(entry.positions).some(([room, position]) => !['desktop', 'portrait'].includes(room) || !point(position))) throw Error('Invalid resident registry');
    if ('name' in entry && residentName(entry.name) !== entry.name) throw Error(COPY.nameInvalid);
    if ('deliveryPositions' in entry && (!entry.deliveryPositions || typeof entry.deliveryPositions !== 'object'
      || Array.isArray(entry.deliveryPositions) || Object.entries(entry.deliveryPositions).some(([room, position]) => !['desktop', 'portrait'].includes(room) || !point(position)))) throw Error('Invalid delivery position');
    ids.add(entry.id); savedIds.add(entry.savedId);
  }
  return value.residents;
}

export function residentRegistry(storage: Storage, newId: () => string, key = STORAGE_KEY) {
  let residents = restore(storage.getItem(key));
  const save = (next: ResidentEntry[]) => {
    storage.setItem(key, JSON.stringify({ version: 1, residents: next }));
    residents = next;
  };
  const change = (id: string, fields: Partial<ResidentEntry>) => save(residents.map(entry => entry.id === id ? { ...entry, ...fields } : entry));
  return {
    // A resident kept before arrivals existed is discovered as 'saved', so no basket appears for it.
    discover(savedId: string, arrival: 'waiting' | 'saved' = 'waiting') {
      const existing = residents.find(entry => entry.savedId === savedId);
      if (existing) return existing.id;
      const id = 'resident:' + newId();
      if (residents.some(entry => entry.id === id)) throw Error('Resident identity collision');
      save([...residents, { id, savedId, inRoom: false, arrival, positions: {} }]);
      return id;
    },
    canWelcome(id: string) {
      const entry = residents.find(entry => entry.id === id);
      return !!entry && (entry.inRoom || residents.filter(item => item.inRoom).length < GENERATED_CAPACITY);
    },
    welcome(id: string) {
      const entry = residents.find(entry => entry.id === id);
      if (!entry || entry.inRoom || residents.filter(item => item.inRoom).length >= GENERATED_CAPACITY) return false;
      change(id, { inRoom: true, arrival: 'welcomed' }); return true;
    },
    rename(id: string, value: string) {
      if (!residents.some(entry => entry.id === id)) throw Error(COPY.nameMissing);
      change(id, { name: residentName(value) });
    },
    remove(id: string) { change(id, { inRoom: false }); },
    defer(id: string) { change(id, { arrival: 'saved' }); },
    position(id: string, room: 'desktop' | 'portrait', position: Position) {
      if (!point(position)) throw Error('Invalid resident position');
      const entry = residents.find(item => item.id === id);
      if (entry) change(id, { positions: { ...entry.positions, [room]: { ...position } } });
    },
    deliveryPosition(id: string, room: 'desktop' | 'portrait', position: Position) {
      if (!point(position)) throw Error('Invalid delivery position');
      const entry = residents.find(item => item.id === id);
      if (entry) {
        change(id, { deliveryPositions: { ...entry.deliveryPositions, [room]: { ...position } } });
        return structuredClone(residents.find(item => item.id === id));
      }
    },
    list() { return structuredClone(residents); },
  };
}
export type ResidentRegistry = ReturnType<typeof residentRegistry>;
