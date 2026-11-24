import { residentName, suggestedName } from './names.ts';
import { RESIDENT_COPY as COPY } from './copy.ts';

export const GENERATED_CAPACITY = 12; // Additional residents; never evicts the six originals.
const STORAGE_KEY = 'loftio-residents-v1';
export type Position = { x: number; y: number };
export type ResidentEntry = {
  id: string; savedId: string; inRoom: boolean; arrival: 'waiting' | 'saved' | 'welcomed';
  positions: Partial<Record<'desktop' | 'portrait', Position>>; name?: string;
  deliveryPositions?: Partial<Record<'desktop' | 'portrait', Position>>;
  parcelPending?: true;
};
export const hasParcel = (entry: ResidentEntry) => entry.arrival === 'waiting' || entry.parcelPending === true;
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
    if ('parcelPending' in entry && (entry.parcelPending !== true || entry.arrival !== 'welcomed')) throw Error('Invalid resident parcel');
    if ('deliveryPositions' in entry && (!entry.deliveryPositions || typeof entry.deliveryPositions !== 'object'
      || Array.isArray(entry.deliveryPositions) || Object.entries(entry.deliveryPositions).some(([room, position]) => !['desktop', 'portrait'].includes(room) || !point(position)))) throw Error('Invalid delivery position');
    ids.add(entry.id); savedIds.add(entry.savedId);
  }
  return value.residents;
}

function nextResidentId(residents: ResidentEntry[], newId: () => string) {
  const id = 'resident:' + newId();
  if (residents.some(entry => entry.id === id)) throw Error('Resident identity collision');
  return id;
}

function withoutParcel(entry: ResidentEntry) {
  const next = { ...entry }; delete next.parcelPending; return next;
}

const hasSpace = (residents: ResidentEntry[]) => residents.filter(item => item.inRoom).length < GENERATED_CAPACITY;

export function residentRegistry(storage: Storage, newId: () => string, key = STORAGE_KEY) {
  const read = () => restore(storage.getItem(key));
  read();
  const save = (next: ResidentEntry[]) => {
    storage.setItem(key, JSON.stringify({ version: 1, residents: next }));
  };
  const change = (residents: ResidentEntry[], id: string, fields: Partial<ResidentEntry>) => {
    const next = residents.map(entry => entry.id === id ? { ...entry, ...fields } : entry);
    save(next);
    return next.find(entry => entry.id === id);
  };
  return {
    hasSpace(savedId?: string) {
      const residents = read();
      return residents.some(item => item.savedId === savedId && item.inRoom) || hasSpace(residents);
    },
    joinWithParcel(savedId: string) {
      const residents = read();
      const existing = residents.find(entry => entry.savedId === savedId);
      if (existing?.arrival === 'welcomed' && existing.inRoom) return true;
      if (!existing?.inRoom && !hasSpace(residents)) return false;
      const id = existing?.id ?? nextResidentId(residents, newId);
      const parcel = existing?.arrival === 'welcomed' ? {} : { parcelPending: true } as const;
      const entry = { id, savedId, positions: {}, ...existing, name: existing?.name ?? suggestedName(id), inRoom: true, arrival: 'welcomed', ...parcel } as const;
      save(existing ? residents.map(item => item.id === id ? entry : item) : [...residents, entry]);
      return true;
    },
    openParcel(id: string) {
      const residents = read();
      if (residents.some(entry => entry.id === id && entry.parcelPending)) save(residents.map(entry => entry.id === id ? withoutParcel(entry) : entry));
    },
    discover(savedId: string, arrival: 'waiting' | 'saved' = 'waiting') {
      const residents = read();
      const existing = residents.find(entry => entry.savedId === savedId);
      if (existing) return existing.id;
      const id = nextResidentId(residents, newId);
      save([...residents, { id, savedId, inRoom: false, arrival, positions: {} }]);
      return id;
    },
    canWelcome(id: string) {
      const residents = read();
      const entry = residents.find(entry => entry.id === id);
      return !!entry && (entry.inRoom || hasSpace(residents));
    },
    welcome(id: string) {
      const residents = read();
      const entry = residents.find(entry => entry.id === id);
      if (!entry || entry.inRoom || !hasSpace(residents)) return false;
      change(residents, id, { inRoom: true, arrival: 'welcomed' }); return true;
    },
    ...registryEdits(read, change),
    list: read,
  };
}
export type ResidentRegistry = ReturnType<typeof residentRegistry>;
type Change = (residents: ResidentEntry[], id: string, fields: Partial<ResidentEntry>) => ResidentEntry | undefined;

function registryEdits(read: () => ResidentEntry[], change: Change) {
  return {
    rename(id: string, value: string) {
      const residents = read();
      if (!residents.some(entry => entry.id === id)) throw Error(COPY.nameMissing);
      change(residents, id, { name: residentName(value) });
    },
    remove(id: string) { change(read(), id, { inRoom: false }); },
    defer(id: string) {
      const residents = read();
      const entry = residents.find(item => item.id === id);
      if (entry?.arrival !== 'waiting') return false;
      change(residents, id, { arrival: 'saved' }); return true;
    },
    position(id: string, room: 'desktop' | 'portrait', position: Position) {
      if (!point(position)) throw Error('Invalid resident position');
      const residents = read();
      const entry = residents.find(item => item.id === id);
      if (entry) change(residents, id, { positions: { ...entry.positions, [room]: { ...position } } });
    },
    deliveryPosition(id: string, room: 'desktop' | 'portrait', position: Position) {
      if (!point(position)) throw Error('Invalid delivery position');
      const residents = read();
      const entry = residents.find(item => item.id === id);
      if (entry) {
        return change(residents, id, { deliveryPositions: { ...entry.deliveryPositions, [room]: { ...position } } });
      }
    },
  };
}
