// Pure check for a character's themed-name pack: a name for each synergy and each special, stored as `rumble.names`.
// One bad entry is dropped alone and the pack survives; a pack with nothing left is absent. Never throws. No storage, no network.
import {
  NAME_INVISIBLE, NAME_MARK_FLOOD, NAME_MAX_LENGTH, NAME_MIN_LENGTH, NAME_PATTERN, NAME_VISIBLE, SPECIALS, SYNERGIES,
} from './loadout-data.ts';
import { isNameBlocked } from './loadout-blocklist-model.ts';

/** A name per ability id; an id with no entry falls back to its plain name. */
export type NamePack = Record<string, string>;
export type NameCheckOptions = { isBlocked: (name: string) => boolean };

const DEFAULT_CHECK: NameCheckOptions = { isBlocked: isNameBlocked };
/** Only the ids this build knows are read: an unknown key in a pack is ignored, never kept. */
const NAMED_IDS: readonly string[] = [...SYNERGIES, ...SPECIALS].map((entry) => entry.id);

/** The cleaned name, or null for one that fails any check. A blocklist that throws blocks the name. */
const cleanName = (raw: unknown, isBlocked: (name: string) => boolean): string | null => {
  if (typeof raw !== 'string') return null;
  const name = raw.normalize('NFC').trim();
  const length = [...name].length; // characters, not UTF-16 units
  if (length < NAME_MIN_LENGTH || length > NAME_MAX_LENGTH || !NAME_PATTERN.test(name)) return null;
  if (NAME_INVISIBLE.test(name) || NAME_MARK_FLOOD.test(name) || !NAME_VISIBLE.test(name)) return null;
  try {
    return isBlocked(name) ? null : name;
  } catch {
    return null;
  }
};

/** The pack with every good entry, null when the value is no pack or no entry survives. Never throws. */
export const parseNamePack = (value: unknown, options: NameCheckOptions = DEFAULT_CHECK): NamePack | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  try {
    const pack: NamePack = {};
    for (const id of NAMED_IDS) {
      if (!Object.hasOwn(value, id)) continue;
      const name = cleanName((value as Record<string, unknown>)[id], options.isBlocked);
      if (name !== null) pack[id] = name;
    }
    return Object.keys(pack).length > 0 ? pack : null;
  } catch {
    return null; // a hostile getter means the pack is not trustworthy
  }
};
