// Writes the Rumble roster snapshot to localStorage; roster-wiring.ts calls it from the Residents render. The snapshot is derived: the room never
// reads it back, and Loft Rumble (a separate bundle) is its only reader (docs/architecture/ICD.md, loftio-rumble-roster-v1).
// Everything that touches the outside world is injected: storage, clock and thumbnailer.
import { ROSTER_KEY, isRosterArt } from '../loadout/roster-contract.ts';
import { buildRoster } from '../loadout/roster-model.ts';
import type { Loadout } from '../loadout/loadout-model.ts';
import type { OriginalInput, RoomEntry, RosterArt, RosterMode, RosterSnapshot, SavedInput } from '../loadout/roster-model.ts';

/**
 * The longest side, in pixels, of a published thumbnail. Source: the largest size Loft Rumble draws a hero at, and small
 * enough to keep a full roster cheap in localStorage. Enforced by the injected thumbnailer, never clamped here.
 */
export const THUMB_MAX_SIDE = 256;

/** The one storage call the publisher makes; a real `localStorage` satisfies it. */
export type RosterStorage = { setItem(key: string, value: string): void };
/** A saved character before thumbnailing: `image` is whatever the saved record holds; only `thumbnail` reads it. */
export type PublishSaved = { id: string; name?: string; image?: unknown; rumble?: Loadout };
export type PublishInput = {
  residents: readonly RoomEntry[]; saved: readonly PublishSaved[]; originals: readonly OriginalInput[]; mode: RosterMode;
};
export type PublishResult = { kind: 'written' | 'unchanged' | 'preview' } | { kind: 'failed'; reason: 'storage' };
export type PublisherDeps = {
  storage: RosterStorage; now: () => number; thumbnail: (image: unknown) => Promise<RosterArt>; previewMode: boolean;
};

/** What makes two snapshots the same: everything except when they were written. */
const contentKey = (snapshot: RosterSnapshot): string => JSON.stringify({ mode: snapshot.mode, residents: snapshot.residents });

/** The thumbnail for one image, or null when the thumbnailer fails or returns art the reader would drop. */
const safeThumbnail = async (deps: PublisherDeps, image: unknown): Promise<RosterArt | null> => {
  try {
    const art = await deps.thumbnail(image);
    return isRosterArt(art) ? art : null;
  } catch {
    return null; // no thumbnail is a resident without art, not a failed publish
  }
};

/** Saved records with thumbnails, made only for the residents the roster will actually publish. */
const withThumbnails = async (deps: PublisherDeps, input: PublishInput): Promise<SavedInput[]> => {
  const bare = input.saved.map((record): SavedInput => ({ ...record, image: null }));
  const probe = buildRoster({ ...input, saved: bare, now: deps.now });
  const published = new Set(probe.residents.map((resident) => resident.id));
  const wanted = new Set(input.residents.filter((entry) => published.has(entry.id)).map((entry) => entry.savedId));
  return Promise.all(input.saved.map(async (record): Promise<SavedInput> => {
    const hasImage = record.image !== undefined && record.image !== null;
    const image = hasImage && wanted.has(record.id) ? await safeThumbnail(deps, record.image) : null;
    return { ...record, image };
  }));
};

export const createRosterPublisher = (deps: PublisherDeps) => {
  let lastContent: string | null = null;
  let queue: Promise<unknown> = Promise.resolve();

  const run = async (input: PublishInput): Promise<PublishResult> => {
    if (deps.previewMode) return { kind: 'preview' }; // the arrival preview shows a demo: it must not write
    const snapshot = buildRoster({ ...input, saved: await withThumbnails(deps, input), now: deps.now });
    const content = contentKey(snapshot);
    if (content === lastContent) return { kind: 'unchanged' };
    try {
      deps.storage.setItem(ROSTER_KEY, JSON.stringify(snapshot));
    } catch {
      return { kind: 'failed', reason: 'storage' }; // quota or disabled: the previous snapshot stays in place
    }
    lastContent = content;
    return { kind: 'written' };
  };

  // Publishes run one after another in call order, so a slow earlier input can never overwrite a later one.
  const publish = (input: PublishInput): Promise<PublishResult> => {
    const result = queue.then(() => run(input));
    queue = result.catch(() => undefined); // one failed run must not stop the queue
    return result;
  };
  return { publish };
};
