// Writes the derived Rumble roster snapshot. A targeted launch also reads it back before handing off.
// Everything that touches the outside world is injected: storage, clock and thumbnailer.
import { ROSTER_KEY, isRosterArt, parseRoster } from '../loadout/roster-contract.ts';
import { buildRoster } from '../loadout/roster-model.ts';
import { isRerollable, parseLoadout } from '../loadout/loadout-model.ts';
import type { Loadout } from '../loadout/loadout-model.ts';
import type { OriginalInput, RoomEntry, RosterArt, RosterMode, RosterSnapshot, SavedInput } from '../loadout/roster-model.ts';

/**
 * The longest side, in pixels, of a published thumbnail. Source: the largest size Loft Rumble draws a hero at, and small
 * enough to keep a full roster cheap in localStorage. Enforced by the injected thumbnailer, never clamped here.
 */
export const THUMB_MAX_SIDE = 256;

export type RosterStorage = { setItem(key: string, value: string): void; getItem?(key: string): string | null };
/** A saved character before thumbnailing: `image` is whatever the saved record holds; only `thumbnail` reads it. */
export type PublishSaved = { id: string; name?: string; image?: unknown; rumble?: Loadout };
export type PublishInput = {
  residents: readonly RoomEntry[]; saved: readonly PublishSaved[]; originals: readonly OriginalInput[]; mode: RosterMode;
};
export type PublishResult = { kind: 'written' | 'unchanged' | 'preview' } | { kind: 'failed'; reason: 'storage' };
export type PublisherDeps = {
  storage: RosterStorage; now: () => number; thumbnail: (image: unknown) => Promise<RosterArt>; previewMode: boolean;
  launchThumbnail?: PublisherDeps['thumbnail'];
};

export type RosterReceipt = { id: string; writtenAt: number };
type LaunchTarget = { entryId: string; savedId: string; current: () => boolean; commit: (receipt: RosterReceipt) => void };
const isRevision = (value: number): boolean => Number.isSafeInteger(value) && value >= 0;
const previousRevision = (value: string | null | undefined): number => {
  if (!value) return -1;
  try {
    const stored = parseRoster(JSON.parse(value));
    return stored && isRevision(stored.writtenAt) ? stored.writtenAt : -1;
  } catch { return -1; }
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
const withThumbnails = async (deps: PublisherDeps, input: PublishInput, target?: LaunchTarget): Promise<SavedInput[]> => {
  const bare = input.saved.map((record): SavedInput => ({ ...record, image: null }));
  const probe = buildRoster({ ...input, saved: bare, now: deps.now });
  const published = new Set(probe.residents.map((resident) => resident.id));
  const wanted = new Set(input.residents.filter((entry) => published.has(entry.id)).map((entry) => entry.savedId));
  return Promise.all(input.saved.map(async (record): Promise<SavedInput> => {
    const hasImage = record.image !== undefined && record.image !== null;
    const thumbnail = target?.savedId === record.id ? deps.launchThumbnail ?? deps.thumbnail : deps.thumbnail;
    const image = hasImage && wanted.has(record.id) ? await safeThumbnail({ ...deps, thumbnail }, record.image) : null;
    return { ...record, image };
  }));
};

export const createRosterPublisher = (deps: PublisherDeps) => {
  let lastContent: string | null = null;
  let lastRevision = -1;
  let queue: Promise<unknown> = Promise.resolve();

  const write = (snapshot: RosterSnapshot): string => {
    const now = deps.now();
    const stored = previousRevision(deps.storage.getItem?.(ROSTER_KEY));
    const writtenAt = Math.max(now, Math.max(lastRevision, stored) + 1);
    if (!isRevision(now) || !isRevision(writtenAt)) throw new Error('Invalid Rumble roster revision');
    const value = JSON.stringify({ ...snapshot, writtenAt });
    deps.storage.setItem(ROSTER_KEY, value);
    lastRevision = writtenAt;
    return value;
  };

  const run = async (input: PublishInput): Promise<PublishResult> => {
    if (deps.previewMode) return { kind: 'preview' }; // the arrival preview shows a demo: it must not write
    const snapshot = buildRoster({ ...input, saved: await withThumbnails(deps, input), now: deps.now });
    const content = contentKey(snapshot);
    if (content === lastContent) return { kind: 'unchanged' };
    try {
      write(snapshot);
    } catch {
      return { kind: 'failed', reason: 'storage' }; // quota or disabled: the previous snapshot stays in place
    }
    lastContent = content;
    return { kind: 'written' };
  };

  // Publishes run one after another in call order, so a slow earlier input can never overwrite a later one.
  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const result = queue.then(task);
    queue = result.catch(() => undefined); // one failed run must not stop the queue
    return result;
  };
  const launch = (input: PublishInput, target: LaunchTarget): Promise<void> => enqueue(async () => {
    if (deps.previewMode || input.mode !== 'online' || !deps.storage.getItem || !target.current()) throw new Error('Rumble launch unavailable');
    const saved = input.saved.filter(record => record.id === target.savedId);
    const entries = input.residents.filter(entry => entry.id === target.entryId);
    const loadout = parseLoadout(saved[0]?.rumble);
    if (saved.length !== 1 || entries.length !== 1 || entries[0]?.savedId !== target.savedId
      || entries[0]?.arrival !== 'welcomed' || !loadout || !isRerollable(loadout)) throw new Error('Resident is not eligible for Rumble');
    const snapshot = buildRoster({ ...input, saved: await withThumbnails(deps, input, target), now: deps.now });
    const rows = snapshot.residents.filter(row => row.id === target.entryId);
    if (rows.length !== 1 || rows[0]?.kind !== 'made' || !rows[0].art || !target.current()) throw new Error('Rumble artwork or resident changed');
    const value = write(snapshot);
    if (deps.storage.getItem(ROSTER_KEY) !== value || !target.current()) throw new Error('Rumble roster did not acknowledge the launch');
    lastContent = contentKey(snapshot);
    target.commit({ id: target.entryId, writtenAt: lastRevision });
  });
  return { publish: (input: PublishInput) => enqueue(() => run(input)), launch };
};
