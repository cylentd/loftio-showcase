import type { Loadout } from '../loadout/loadout-model.ts';
import type { UserSelections, ResolvedSelections } from './selections.ts';
import type { FollowUpSlot } from './follow-up-model.ts';
import type { AltKind } from './alt-kind.ts';
import { ALT_ID, FOLLOW_UP_IDS, IMAGE_MAX_BYTES, IMAGE_MAX_SIDE } from './constants.ts';
import { readPngInfo } from './png.ts';

export type GenerationRecord = {
  id: string;
  requestId: string;
  userSelections: UserSelections;
  resolvedSelections: ResolvedSelections;
  promptVersion: string;
  prompt: string;
  referenceIds: readonly string[];
  providerId: string;
  modelId: string;
  attempts: number;
  createdAt: string;
};

export type GeneratedImage = {
  base64: string;
  mime: 'image/png';
  width: number;
  height: number;
  hasAlphaChannel: boolean;
} | {
  schemaVersion: 2;
  mime: 'image/webp';
  url: string;
  originalUrl: string;
  bytes: number;
  width: number;
  height: number;
  hasAlphaChannel: boolean;
};

export type SavedCharacter = {
  schemaVersion?: 2;
  id: string;
  state: 'kept' | 'draft';
  generationId: string;
  userSelections: UserSelections;
  resolvedSelections: ResolvedSelections;
  promptVersion: string;
  providerModelId: string;
  referenceIds: readonly string[];
  image: GeneratedImage;
  generation: GenerationRecord;
  keptAt: string;
  parentId: string | null;
  identityNotes: string | null;
  rumble?: Loadout; // the Rumble combat loadout; a record saved before loadouts existed has none until load() backfills it
  expression?: FollowUpSlot; // the happy-welcome image drawn after the idle; absent on a record saved before it existed
  alt?: SavedAlt; // the alt art drawn after the expression; absent on a record saved before it existed
};

/** Which earlier images an alt request carried as references. */
export type AltReference = 'idle' | 'expression';
export const ALT_REFERENCES: readonly AltReference[] = ['idle', 'expression'];

/** The alt art: its kind (A action, B quiet) is fixed at creation; `references` is set once the alt was requested and says what was sent. */
export type SavedAlt = { schemaVersion: 1; kind: AltKind; slot: FollowUpSlot; references?: AltReference[] };

/**
 * Whether a resident's alt art is unlocked. True for every resident until the earn rules exist (they come after the demo); callers
 * must ask this, never assume it, so the rules can land in one place.
 */
export const altUnlocked = (_record: SavedCharacter): boolean => true;

const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The artifact URL pairs a stored webp image may use: the idle's, and one per follow-up id, all under the record's UUID. */
const ARTIFACT_PAIRS: readonly { preview: string; original: string; opaque: boolean }[] = [
  { preview: 'preview.webp', original: 'original.png', opaque: false },
  // Only the alt pair may be opaque: the idle and the expression are transparent sprites.
  ...FOLLOW_UP_IDS.map(id => ({ preview: `${id}.webp`, original: `${id}.png`, opaque: id === ALT_ID })),
];
const UUID = '([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})';

function validWebp(value: Record<string, unknown>) {
  if (typeof value.url !== 'string') return false;
  for (const pair of ARTIFACT_PAIRS) {
    const match = new RegExp(`^/loftio-builder-api/artifacts/${UUID}/${pair.preview.replace('.', '\\.')}$`).exec(value.url);
    if (match) return webpFields(value, `/loftio-builder-api/artifacts/${match[1]}/${pair.original}`, pair.opaque);
  }
  return false;
}

function webpFields(value: Record<string, unknown>, originalUrl: string, opaque: boolean) {
  return value.schemaVersion === 2 && value.originalUrl === originalUrl
    && (opaque ? typeof value.hasAlphaChannel === 'boolean' : value.hasAlphaChannel === true) && Number.isInteger(value.bytes) && Number(value.bytes) > 0 && Number(value.bytes) <= IMAGE_MAX_BYTES
    && [value.width, value.height].every(side => Number.isInteger(side) && Number(side) > 0 && Number(side) <= IMAGE_MAX_SIDE);
}

/** Is this a stored GeneratedImage: a bounded real PNG, or a webp artifact reference for the idle or a follow-up. */
export function validImage(value: unknown) {
  if (object(value) && value.mime === 'image/webp') return validWebp(value);
  if (!object(value) || value.mime !== 'image/png' || typeof value.base64 !== 'string'
    || value.base64.length > IMAGE_MAX_BYTES * 2 || typeof value.hasAlphaChannel !== 'boolean') return false;
  try {
    const bytes = Uint8Array.from(atob(value.base64), character => character.charCodeAt(0));
    const info = readPngInfo(bytes);
    return !!info && bytes.length <= IMAGE_MAX_BYTES && info.width === value.width && info.height === value.height
      && info.width <= IMAGE_MAX_SIDE && info.height <= IMAGE_MAX_SIDE;
  } catch { return false; }
}
