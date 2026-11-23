// Pure model for the Rumble roster snapshot: which residents the loft publishes for Loft Rumble, and in what order.
// No DOM, no storage, no clock of its own (`now` is injected). The snapshot types live here, not in roster-contract.ts:
// a model may not import a contract (GAME-LAYERS.md); the contract imports these and re-exports them.
import { ORIGINAL_LOADOUTS } from './loadout-data.ts';
import { elementFor, parseLoadout } from './loadout-model.ts';
import type { Loadout } from './loadout-model.ts';

/** The snapshot's schema version: a reader that sees another number reads nothing (ICD.md, loftio-rumble-roster-v1). */
export const ROSTER_VERSION = 1;
/** Which room wrote the snapshot; the room loaded last wins. */
export const ROSTER_MODES = ['mock', 'local', 'online'] as const;
/**
 * The name a made resident is published under when neither its room entry nor its saved record has one. A player's
 * resident is never dropped for want of a name (owner decision 2026-11-18).
 */
export const UNNAMED_RESIDENT_NAME = 'Resident';

export type RosterMode = (typeof ROSTER_MODES)[number];
/** A thumbnail as published: a data URL plus its pixel size. */
export type RosterArt = { src: string; width: number; height: number };
export type RosterResident = {
  id: string; kind: 'original' | 'made'; castId?: string; name: string; inRoom: boolean; art: RosterArt | null; rumble: Loadout;
};
export type RosterSnapshot = { version: typeof ROSTER_VERSION; mode: RosterMode; writtenAt: number; residents: RosterResident[] };

/** A room entry as the resident registry holds it; declared here so the model does not import view code. */
export type RoomEntry = { id: string; savedId: string; inRoom: boolean; arrival: 'waiting' | 'saved' | 'welcomed'; name?: string };
/** A saved character as the roster needs it; `image` is already a thumbnail. Structural, not a builder import. */
export type SavedInput = { id: string; name?: string; image?: RosterArt | null; rumble?: Loadout };
/** An original resident as the lineup lists it, with its display name; the model adds its fixed loadout. */
export type OriginalInput = { id: string; name: string; inRoom: boolean };
export type RosterInput = {
  residents: readonly RoomEntry[]; saved: readonly SavedInput[]; originals: readonly OriginalInput[];
  mode: RosterMode; now: () => number;
};

/** The loadout as published: `element` is always present, the stored one or the roll from the resident's published id. */
const withElement = (loadout: Loadout, residentId: string): Loadout => ({ ...loadout, element: elementFor(loadout, residentId) });

const originalEntries =(originals: readonly OriginalInput[]): RosterResident[] =>
  originals.flatMap((original): RosterResident[] => {
    const fixed = ORIGINAL_LOADOUTS[original.id];
    if (!fixed) return []; // an id with no fixed loadout is never guessed
    const rumble = withElement(fixed, original.id);
    return [{ id: original.id, kind: 'original', castId: original.id, name: original.name, inRoom: original.inRoom, art: null, rumble }];
  });

/** An unopened parcel (waiting), or a deferred one (kept, not in the room), is not a resident yet. */
const isParcel = (entry: RoomEntry): boolean => entry.arrival === 'waiting' || (entry.arrival === 'saved' && !entry.inRoom);

const madeEntries = (residents: readonly RoomEntry[], saved: readonly SavedInput[]): RosterResident[] =>
  residents.flatMap((entry): RosterResident[] => {
    const record = saved.find((item) => item.id === entry.savedId);
    const stored = parseLoadout(record?.rumble); // a missing or malformed loadout is never guessed
    if (!record || !stored || isParcel(entry)) return [];
    const name = entry.name ?? record.name ?? UNNAMED_RESIDENT_NAME;
    return [{ id: entry.id, kind: 'made', name, inRoom: entry.inRoom, art: record.image ?? null, rumble: withElement(stored, entry.id) }];
  });

/** Originals first in the order given, then made residents in room order. */
export const buildRoster = (input: RosterInput): RosterSnapshot => ({
  version: ROSTER_VERSION,
  mode: input.mode,
  writtenAt: input.now(),
  residents: [...originalEntries(input.originals), ...madeEntries(input.residents, input.saved)],
});
