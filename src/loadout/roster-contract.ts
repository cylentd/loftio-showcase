// The boundary of the Rumble roster snapshot: the localStorage key and the lenient reader Loft Rumble's side mirrors
// (docs/architecture/ICD.md, loftio-rumble-roster-v1). The reader never throws and never guesses: a malformed
// resident is dropped, the rest are kept. The snapshot types are defined in roster-model.ts and re-exported here.
import { parseLoadout } from './loadout-model.ts';
import { ROSTER_MODES, ROSTER_VERSION } from './roster-model.ts';
import type { RosterArt, RosterMode, RosterResident, RosterSnapshot } from './roster-model.ts';

export type { RosterArt, RosterResident, RosterSnapshot } from './roster-model.ts';

/** The one localStorage key, shared by every mode; Loft Rumble reads it, the room never does. */
export const ROSTER_KEY = 'loftio-rumble-roster-v1';
/** A thumbnail's `src` must start like this: only an inline image is ever drawn, never a web or script address. */
export const ART_SRC_PREFIX = 'data:image/';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isPositiveSide = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;

/** True for art the reader keeps: a data-URL image with positive finite sides. The publisher uses it to normalise. */
export const isRosterArt = (value: unknown): value is RosterArt =>
  isObject(value) && typeof value['src'] === 'string' && value['src'].startsWith(ART_SRC_PREFIX)
  && isPositiveSide(value['width']) && isPositiveSide(value['height']);

/** The identity fields of one resident, or null when any is the wrong type. */
const readIdentity = (raw: Record<string, unknown>): Pick<RosterResident, 'id' | 'kind' | 'name' | 'inRoom'> | null => {
  const { id, kind, name, inRoom } = raw;
  if (typeof id !== 'string' || typeof name !== 'string' || typeof inRoom !== 'boolean') return null;
  if (kind !== 'original' && kind !== 'made') return null;
  return { id, kind, name, inRoom };
};

const parseResident = (raw: unknown): RosterResident | null => {
  try {
    if (!isObject(raw)) return null;
    const identity = readIdentity(raw);
    const art = raw['art'];
    const rumble = parseLoadout(raw['rumble']);
    if (identity === null || rumble === null || (art !== null && !isRosterArt(art))) return null;
    const castId = raw['castId'];
    if (castId !== undefined && typeof castId !== 'string') return null;
    if (identity.kind === 'original' && castId === undefined) return null;
    const resident: RosterResident = { ...identity, art: art === null ? null : { src: art.src, width: art.width, height: art.height }, rumble };
    if (castId !== undefined) resident.castId = castId;
    return resident;
  } catch {
    return null; // a hostile getter means the entry is not trustworthy
  }
};

const isMode = (value: unknown): value is RosterMode => (ROSTER_MODES as readonly unknown[]).includes(value);

/** The snapshot for a valid value (malformed residents dropped, order kept), null for an unusable one. Never throws. */
export const parseRoster = (value: unknown): RosterSnapshot | null => {
  try {
    if (!isObject(value) || value['version'] !== ROSTER_VERSION) return null;
    const { mode, writtenAt, residents } = value;
    if (!isMode(mode) || typeof writtenAt !== 'number' || !Number.isFinite(writtenAt) || !Array.isArray(residents)) return null;
    const kept = residents.map(parseResident).filter((resident): resident is RosterResident => resident !== null);
    return { version: ROSTER_VERSION, mode, writtenAt, residents: kept };
  } catch {
    return null;
  }
};
