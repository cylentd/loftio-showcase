import type { rosterWiring } from './roster-wiring.ts';

type LaunchRoster = Pick<ReturnType<typeof rosterWiring>, 'publishForLaunch' | 'requireWelcomed'>;
type LaunchPorts = { awaitWelcome(savedId: string, signal?: AbortSignal): Promise<void>; navigate(url: string): void };

export function awaitSelectedWelcome<Entry extends { savedId: string; arrival: string }, Record extends { id: string; state: string }>(ports: {
  restored: Promise<boolean>; entries(): readonly Entry[]; kept(): readonly Record[];
  keep(savedId: string): Promise<void>; welcome(entry: Entry, record: Record): Promise<void>; render(): void;
}) {
  const exact = <Item>(items: readonly Item[], matches: (item: Item) => boolean) => {
    const [item, ...duplicates] = items.filter(matches);
    if (!item || duplicates.length) throw new Error('Selected resident unavailable');
    return item;
  };
  return async (savedId: string, signal?: AbortSignal): Promise<void> => {
    if (!(await ports.restored)) throw new Error('Residents could not be restored');
    signal?.throwIfAborted();
    const readEntry = () => exact(ports.entries(), candidate => candidate.savedId === savedId);
    const readRecord = () => exact(ports.kept(), candidate => candidate.id === savedId);
    readEntry();
    if (readRecord().state === 'draft') await ports.keep(savedId);
    signal?.throwIfAborted();
    const entry = readEntry(), record = readRecord();
    if (record.state !== 'kept') throw new Error('Selected resident was not saved');
    if (entry.arrival !== 'welcomed') await ports.welcome(entry, record);
    ports.render();
  };
}

export function createResidentLaunches(roster: LaunchRoster, { awaitWelcome, navigate }: LaunchPorts) {
  let busy = false;
  const launch = async (savedId: string, signal: AbortSignal | undefined, handoff: () => void | Promise<void>) => {
    signal?.throwIfAborted();
    if (busy || !savedId) throw new Error('Resident launch unavailable');
    busy = true;
    try {
      await awaitWelcome(savedId, signal);
      signal?.throwIfAborted();
      await handoff();
    } finally { busy = false; }
  };
  return {
    playRumble: (savedId: string, signal?: AbortSignal): Promise<void> => launch(savedId, signal, () => roster.publishForLaunch(savedId, ({ id, writtenAt }) => {
      signal?.throwIfAborted();
      navigate(`/play/rumble/?resident=${encodeURIComponent(id)}&mode=online&revision=${writtenAt}`);
    })),
    exploreValley: (savedId: string, signal?: AbortSignal): Promise<void> => launch(savedId, signal, () => {
      roster.requireWelcomed(savedId);
      signal?.throwIfAborted();
      navigate(`/play/valley/?view=play&resident=${encodeURIComponent(savedId)}`);
    }),
  };
}
