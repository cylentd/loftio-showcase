// Connects the Residents render to the Rumble roster publisher (docs/architecture/ROSTER.md). The render hands over what
// it already holds; this module shapes it, and the publisher decides whether anything is written. Fire and forget: a
// publish never slows or breaks the render.
import { NAMES } from '../copy.ts';
import type { BuilderMode } from '../builder/local-mode.ts';
import type { SavedCharacter } from '../builder/records.ts';
import type { RoomEntry, RosterMode } from '../loadout/roster-model.ts';
import type { OriginalEntry } from './original-lineup.ts';
import { createRosterPublisher } from './roster-publish.ts';
import type { PublishInput, PublishSaved, PublisherDeps, RosterReceipt } from './roster-publish.ts';
import { browserThumbnailer } from './roster-thumbnail.ts';
import type { ThumbnailSource } from './roster-thumbnail.ts';

export type RosterDeps = PublisherDeps & { mode: RosterMode };
/** What the render holds: the lineup originals, the registry's entries and the builder's kept records. Guests are in none of them. */
export type RosterSources = {
  originals: readonly OriginalEntry[]; entries: readonly RoomEntry[]; // a registry `ResidentEntry` fits `RoomEntry`
  kept: readonly KeptRecord[];
};
/** The part of a builder `SavedCharacter` the roster reads; a full record fits. */
export type KeptRecord = Pick<SavedCharacter, 'id' | 'image' | 'rumble'> & { resolvedSelections: { creature: { label: string } } };

const toSaved = (record: KeptRecord): PublishSaved => {
  const source: ThumbnailSource = { id: record.id, image: record.image };
  // The name a card falls back to is the creature label, so Rumble shows the same name the Residents panel does.
  return { id: record.id, name: record.resolvedSelections?.creature?.label, image: source, rumble: record.rumble };
};

const toInput = (sources: RosterSources, mode: RosterMode): PublishInput => ({
  originals: sources.originals.map(({ id, inRoom }) => ({ id, name: NAMES[id] ?? id, inRoom })),
  residents: sources.entries.map(entry => ({ ...entry })), saved: sources.kept.map(toSaved), mode,
});

/** `makePublisher` is injected so a test can stand in a publisher whose promise rejects; the real one is the default. */
type Publisher = ReturnType<typeof createRosterPublisher>;
type PublisherFactory = (deps: PublisherDeps) => Pick<Publisher, 'publish'> & Partial<Pick<Publisher, 'launch'>>;

export function rosterWiring({ mode, ...deps }: RosterDeps, makePublisher: PublisherFactory = createRosterPublisher) {
  const publisher = makePublisher(deps);
  let latest: PublishInput | null = null;
  let enabled = false;
  let handingOff = false;
  let suspended = false;
  const send = () => { if (enabled && !handingOff && !suspended && latest) publisher.publish(latest).catch(() => undefined); };
  const eligible = (savedId: string) => {
    if (!enabled || mode !== 'online' || deps.previewMode || !savedId || !latest) throw new Error('Online resident unavailable');
    const entries = latest.residents.filter(entry => entry.savedId === savedId);
    if (entries.length !== 1 || entries[0]?.arrival !== 'welcomed' || latest.saved.filter(record => record.id === savedId).length !== 1) {
      throw new Error('The selected resident has not been welcomed');
    }
    return { input: latest, entryId: entries[0].id };
  };
  return {
    /** Records the latest sources and, once enabled, publishes them. Returns at once; an error never reaches the caller. */
    publish(sources: RosterSources): void {
      try { latest = toInput(sources, mode); } catch { return; }
      send();
    },
    /** From now on publishes go through, and the latest sources are published now: called once the saved room is back. */
    enable(): void { enabled = true; send(); },
    requireWelcomed(savedId: string): void { eligible(savedId); },
    resumeBackground(): void { suspended = false; send(); },
    async publishForLaunch(savedId: string, commit: (receipt: RosterReceipt) => void): Promise<void> {
      if (handingOff || !publisher.launch) throw new Error('Rumble handoff unavailable');
      const { input, entryId } = eligible(savedId);
      handingOff = true;
      try {
        await publisher.launch(input, { entryId, savedId, current: () => latest === input, commit });
        suspended = true;
      } finally {
        handingOff = false;
        send();
      }
    },
  };
}

/** The real pieces: `localStorage` (its errors reach the publisher, which swallows them), `Date.now`, a canvas thumbnailer. */
export const browserRosterWiring = (mode: BuilderMode, previewMode: boolean) => rosterWiring({
  storage: { getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) },
  now: () => Date.now(), thumbnail: browserThumbnailer(), mode, previewMode,
  launchThumbnail: image => browserThumbnailer()(image),
});
