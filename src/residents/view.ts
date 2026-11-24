import './styles.css';
import { createBuilder } from '../builder/controller';
import { localApi } from '../builder/local-api';
import { mockApi } from '../builder/mock-api';
import { indexedStore } from '../builder/indexed-store';
import { requestJournal } from '../builder/journal';
import { buildTickets } from '../builder/tickets';
import { inspectImage } from '../builder/image-inspection';
import { LOCAL_DATABASE_NAME, ONLINE_DATABASE_NAME, ONLINE_JOURNAL_KEY, ONLINE_REGISTRY_KEY, ONLINE_TICKET_KEY } from '../builder/constants';
import { builderMode, type BuilderMode } from '../builder/local-mode';
import { utcDay } from '../builder/utc-day';
import { onlineApi } from '../builder/online-api';
import { onlineAltOperation, onlineWrite } from '../builder/online-write';
import { turnstileTokens } from '../builder/turnstile-client';
import { VISITOR_DAILY_CAP } from '../builder/server/online-config';
import type { Scene } from '../scene';
import type { Runtime } from '../runtime';
import type { Overlay } from '../overlay';
import type { installResidentControls } from '../resident-controls';
import { hasParcel, residentRegistry, type ResidentEntry } from './registry';
import { RESIDENT_COPY as COPY } from './copy';
import { residentForm } from './create-form';
import { createAction } from './create-action';
import { sceneResidents } from './scene-adapter';
import { builderDetails, residentChrome, renderResidents, type CardDetail, type PortraitAction } from './view-parts';
import { arrivalReveal } from './arrival-reveal';
import { roomDeliveries } from './delivery';
import { creationIndicator } from './creation-progress';
import type { RevealAudioPreference } from './unboxing-sound';
import { CAST } from '../cast';
import { originalLineup } from './original-lineup';
import { originalResidents } from './original-scene';
import { arrivalPreview } from './arrival-preview-mode';
import { previewBackend } from './arrival-preview';
import { bindSessionEvents } from './session-events';
import { startNotingFresh } from './fresh-start-model';
import { teardownAll } from '../teardown';
import { browserRosterWiring } from './roster-wiring';
import type { KeptResident } from './kept-residents';
import { keptResidents } from './kept-residents';
import { openArrivalCard } from './arrival-card';
import type { FirstResidentLaunches } from './first-resident-launch';
import { awaitSelectedWelcome, type createResidentLaunches } from './resident-launch';
import { FIRST_RESIDENT_COPY } from './first-resident-copy';

const NAMES = {
  local: { registry: 'loftio-residents-v1', tickets: 'loftio-build-tickets-v1', journal: 'loftio-builder-local-pending-v1' },
  online: { registry: ONLINE_REGISTRY_KEY, tickets: ONLINE_TICKET_KEY, journal: ONLINE_JOURNAL_KEY },
  mock: { registry: 'loftio-residents-mock-v1', tickets: 'loftio-build-tickets-mock-v1', journal: 'loftio-builder-mock-pending-v1' },
};

/** The localStorage keys each builder mode saves: registry, ticket ledger and request journal. The lineup saves beside the registry as `<registry>-originals`. */
export const RESIDENT_STORAGE_NAMES = NAMES;

/** What an entry may set through a room feature: the balance a missing ticket ledger starts with, the final Create label,
 * a button on each card (`portrait`) and a block under each card's name (`cardDetail`). */
export type ResidentOptions = { initialTickets?: number; confirmLabel?: string; portrait?: PortraitAction; cardDetail?: CardDetail;
  firstResident?: boolean; launches?: typeof createResidentLaunches;
  selectGame?: (departures: { rumble(signal: AbortSignal): Promise<void>; valley(signal: AbortSignal): Promise<void> }, failure: string) => void };
/** What a room feature may read. `fresh`: no saved residents, tickets or lineup before this load; `restored` settles once
 * the saved room is back (true) or failed to load (false). */
export type ResidentHooks = {
  fresh: boolean; storageKey: string; preview: boolean; trigger: HTMLElement; openCreate: () => void; restored: Promise<boolean>;
  extension?: HTMLElement;
  kept?: () => KeptResident[];
  recoverAlt?: (id: string, host: HTMLElement) => ReturnType<ReturnType<typeof createBuilder>['recoverAlt']>;
};

// A visible Turnstile challenge shows here, in the Create panel: the drawer is a modal dialog, so the page behind it is inert.
const challenge = document.createElement('div'); challenge.className = 'turnstile-challenge';

function builderApi(mode: BuilderMode) {
  if (mode === 'local') return localApi({ durable: true });
  if (mode === 'online') return onlineApi({ getToken: turnstileTokens({ siteKey: import.meta.env.VITE_TURNSTILE_SITE_KEY, host: () => challenge }) });
  return mockApi();
}

function session(mode: BuilderMode, preview: ReturnType<typeof previewBackend> | null, guardPaidRequests: boolean, initialTickets?: number) {
  const storage = preview?.storage ?? { getItem: (key: string) => localStorage.getItem(key), setItem: (key: string, value: string) => localStorage.setItem(key, value) };
  const names = NAMES[mode];
  const registry = residentRegistry(storage, () => crypto.randomUUID(), names.registry);
  const originals = originalLineup(storage, CAST.map(member => member.id), names.registry + '-originals');
  const ticketKey = names.tickets;
  const exclusive = mode === 'online' && !preview ? onlineWrite(navigator.locks) : undefined;
  const tickets = buildTickets(storage, ticketKey, initialTickets, !exclusive);
  const refill = () => tickets.refillDaily(VISITOR_DAILY_CAP, utcDay(new Date()));
  const journal = requestJournal(storage, names.journal);
  const builder = createBuilder({ api: builderApi(mode),
    store: preview?.store ?? (mode === 'mock' ? indexedStore() : indexedStore(indexedDB, mode === 'local' ? LOCAL_DATABASE_NAME : ONLINE_DATABASE_NAME)), inspect: inspectImage,
    journal, guardPaidRequests: mode === 'online', exclusive, altOperation: exclusive ? onlineAltOperation(navigator.locks) : undefined, refillTickets: mode === 'online' ? refill : undefined,
    ...(guardPaidRequests ? { joinSaved: registry.joinWithParcel, canJoin: registry.hasSpace,
      isJoined: (id: string) => registry.list().some(entry => entry.savedId === id && entry.arrival === 'welcomed') } : {}),
    tickets, newId: () => crypto.randomUUID(), now: () => new Date(),
  }, { creature: 'bunny', personality: 'sleepy', signatureDetail: 'none', palette: null });
  const edit = <T>(work: () => T) => exclusive ? exclusive(work) : work();
  const initialize = () => mode === 'online' ? edit(refill) : undefined;
  return { registry, originals, builder, tickets, ticketKey, initialize, edit, journal, exclusive };
}

function restore(current: ReturnType<typeof session>, adapter: ReturnType<typeof sceneResidents>, failure: (error: unknown) => void, loaded?: () => void) {
  const { builder, registry } = current;
  // Restore the room from saved records first; a pending job reattaches alongside, never ahead of it.
  return Promise.resolve().then(current.initialize).catch(failure).then(() => builder.load()).then(async () => {
    void builder.resume().catch(failure);
    for (const entry of registry.list().filter(item => item.inRoom)) {
      const saved = builder.state().kept.find(item => item.id === entry.savedId);
      if (saved) { try { await adapter.add(entry, saved); } catch (error) { failure(error); } }
    }
    loaded?.();
    return true;
  }).catch(error => { failure(error); return false; });
}

function arrivalPresenter(current: ReturnType<typeof session>, chrome: ReturnType<typeof residentChrome>, audio: RevealAudioPreference,
  adapter: ReturnType<typeof sceneResidents>, render: () => void, failure: (error: unknown) => void, first: boolean,
  launches: () => FirstResidentLaunches | undefined, frozen: () => boolean, selectGame?: ResidentOptions['selectGame']) {
  const { builder, registry, edit } = current;
  const changed = async (write: () => void) => { await edit(write); render(); };
  const show = arrivalReveal(chrome, {
    welcome: async (entry, saved, skip) => { await adapter.add(entry, saved, true, skip); render(); },
    rename: (id, name) => edit(() => registry.rename(id, name)),
    later: id => changed(() => { registry.defer(id); }), failure, openCard: openArrivalCard,
  }, audio);
  const reveal = (entry: ResidentEntry, trigger?: HTMLButtonElement) => {
    const saved = builder.state().kept.find(item => item.id === entry.savedId);
    if (!saved) return;
    const launch = launches();
    if (first && entry.arrival === 'welcomed' && saved.state === 'kept') {
      show(entry, saved, frozen(), trigger, undefined, {
        opened: () => changed(() => registry.openParcel(entry.id)),
        async rename(name) { await edit(() => registry.rename(entry.id, name)); adapter.rename(entry.id, name); render(); },
        observe(update) {
          const sync = () => { const record = builder.state().kept.find(item => item.id === saved.id); if (record) update(record); };
          sync(); return builder.subscribe(sync);
        },
        play: launch && selectGame ? () => selectGame({
          rumble: signal => launch.playRumble(saved.id, signal),
          valley: signal => launch.exploreValley(saved.id, signal),
        }, FIRST_RESIDENT_COPY.playError) : undefined,
      });
      return;
    }
    const spotlight = first && entry.arrival === 'waiting' && (launch || registry.list()[0]?.savedId === entry.savedId);
    show(entry, saved, frozen(), trigger, spotlight ? {
      launches: launch,
      persist: name => changed(() => { registry.rename(entry.id, name); registry.defer(entry.id); }),
      collection: () => { show.close(); chrome.openCollection(); },
    } : undefined);
  };
  const meet = () => {
    const savedId = builder.state().preview?.generation.id;
    const completed = registry.list().find(entry => entry.savedId === savedId);
    if (completed) reveal(completed);
  };
  return { reveal, meet, dispose: show.dispose };
}

function residentLaunchPorts(current: ReturnType<typeof session>, adapter: ReturnType<typeof sceneResidents>, render: () => void, restored: Promise<boolean>) {
  const { registry, builder } = current;
  return {
    awaitWelcome: awaitSelectedWelcome({ restored, entries: registry.list, kept: () => builder.state().kept,
      keep: async savedId => { if (builder.state().preview?.generation.id === savedId) await builder.keep(); },
      welcome: (entry, record) => adapter.add(entry, record, true, true), render }),
    navigate: (url: string) => location.assign(url),
  };
}

function mountJoined(state: ReturnType<ReturnType<typeof createBuilder>['state']>, entries: ResidentEntry[],
  adapter: ReturnType<typeof sceneResidents>, failure: (error: unknown) => void) {
  if (state.status !== 'ready') return;
  const joined = entries.find(entry => entry.inRoom && entry.parcelPending && entry.savedId === state.preview?.generation.id);
  const record = joined && state.kept.find(item => item.id === joined.savedId && item.state === 'kept');
  if (joined && record) void adapter.add(joined, record).catch(failure);
}

function savedDiscovery(current: ReturnType<typeof session>, publicFlow: boolean, render: () => void, failure: (error: unknown) => void) {
  const { builder, registry } = current;
  let discovering = false;
  return async () => {
    if (discovering) return;
    discovering = true;
    try {
      const changed = await current.edit(() => {
        const state = builder.state();
        if (state.status === 'generating') return false;
        const pending = publicFlow ? new Set(current.journal.read().map(item => item.requestId)) : null;
        const known = new Set(registry.list().map(entry => entry.savedId));
        const missing = state.kept.filter(item => !known.has(item.id) && !pending?.has(item.generation.requestId));
        for (const saved of missing) registry.discover(saved.id, saved.state === 'kept' ? 'saved' : 'waiting');
        return missing.length !== 0;
      });
      discovering = false;
      if (changed) render();
    } catch (error) { discovering = false; failure(error); }
  };
}

export function installResidents(scene: Scene, runtime: Runtime, overlay: Overlay, controls: ReturnType<typeof installResidentControls>, audio: RevealAudioPreference, options: ResidentOptions = {}) {
  const mode = builderMode(location.search, location.hostname, { workerHost: import.meta.env.VITE_LOCAL_WORKER_HOST, mode: import.meta.env.VITE_BUILDER_MODE });
  const chrome = residentChrome();
  let current: ReturnType<typeof session>;
  const preview = arrivalPreview(location.search, mode) ? previewBackend() : null;
  const names = NAMES[mode];
  let fresh = false;
  const saved = [names.registry, names.tickets, names.registry + '-originals'];
  const page = preview ? null : { getItem: (key: string) => localStorage.getItem(key) };
  const publicFlow = options.firstResident === true && mode === 'online';
  try { ({ fresh, started: current } = startNotingFresh(page, saved, () => session(mode, preview, publicFlow, options.initialTickets))); } catch {
    chrome.error.textContent = COPY.loadFailure; return { update: () => {}, hooks: undefined, dispose: () => {} };
  }
  const { registry, builder, tickets, ticketKey } = current;
  const originals = originalResidents(scene, runtime, overlay, controls, current.originals, current.edit);
  // Test tickets only where images are free placeholders; real builds (local, online) never get them.
  chrome.drawer.dialog.classList.toggle('showcase-residents', publicFlow);
  const failure = (error: unknown) => { chrome.error.textContent = error instanceof Error ? error.message : COPY.actionFailure; overlay.announce(chrome.error.textContent); };
  const adapter = sceneResidents(scene, runtime, overlay, controls, registry, () => render(), current.edit);
  let launches: FirstResidentLaunches | undefined;
  const { reveal, meet, dispose: disposeReveal } = arrivalPresenter(current, chrome, audio, adapter, render, failure, publicFlow, () => launches, () => runtime.look.frozen, options.selectGame);
  const form = residentForm(builder, mode, mode === 'mock' ? () => tickets.grant(1) : undefined,
    () => chrome.drawer.dialog.close(), options.confirmLabel, publicFlow, publicFlow ? meet : undefined);
  chrome.panels[2]!.append(form.form, challenge);
  const roster = browserRosterWiring(mode, preview !== null);
  const indicator = creationIndicator(chrome.openCreate);
  chrome.drawer.dialog.addEventListener('close', form.dismissProgress);
  const events = bindSessionEvents({ builder, mode, ticketKey, onTicketChange: () => render(), disposeReveal,
    onPageShow: roster.resumeBackground });
  const deliveries = roomDeliveries(scene, runtime, reveal, audio,
    (id, room, point) => current.edit(() => registry.deliveryPosition(id, room, point)), failure);
  const discover = savedDiscovery(current, publicFlow, render, failure);
  function render() {
    const state = builder.state(); form.update();
    indicator.update(state.status, state.stage);
    chrome.error.textContent = createAction(state).drawerAlert;
    const entries = registry.list(); const ready = entries.some(hasParcel); deliveries.sync(entries);
    if (state.status !== 'generating' && state.kept.some(item => !state.pendingJoinIds?.includes(item.id) && !entries.some(entry => entry.savedId === item.id))) void discover();
    if (publicFlow) mountJoined(state, entries, adapter, failure);
    chrome.trigger.setAttribute('aria-label', ready ? COPY.title + ' · ' + COPY.ready : COPY.title);
    chrome.trigger.title = ready ? COPY.ready : COPY.title;
    renderResidents(chrome.panels, state, entries, id => { void adapter.remove(id).catch(failure); }, reveal,
      current.originals.list(), (id, inRoom) => { void originals.setInRoom(id, inRoom).then(render, failure); }, options.portrait,
      options.cardDetail && builderDetails(options.cardDetail, builder));
    roster.publish({ originals: current.originals.list(), entries, kept: state.kept }); // fire and forget; the publisher dedupes
  }
  const openPreview = preview ? () => { const waiting = registry.list().find(entry => entry.arrival === 'waiting'); if (waiting) reveal(waiting); } : undefined;
  builder.subscribe(render); render();
  const restored = restore(current, adapter, failure, openPreview);
  const rosterReady = restored.then(loaded => { if (loaded) roster.enable(); }).then(() => restored);
  if (publicFlow) launches = options.launches?.(roster, residentLaunchPorts(current, adapter, render, rosterReady));
  const hooks: ResidentHooks = { fresh, storageKey: names.registry, preview: preview !== null, trigger: chrome.trigger, openCreate: chrome.openCreate,
    restored, extension: chrome.drawer.content, kept: () => keptResidents(builder.state().kept, registry.list()),
    ...(mode === 'online' && !preview ? { recoverAlt: (id: string, host: HTMLElement) => builder.recoverAlt(id,
      turnstileTokens({ siteKey: import.meta.env.VITE_TURNSTILE_SITE_KEY, host: () => host })) } : {}) };
  // Teardown, newest first: stop listening, end the form's timers, then stop the builder's live run. Its request
  // stays journaled, so the next visit's resume() collects it.
  const dispose = teardownAll([events, () => form.dispose(), () => builder.dispose()]);
  return { update: (elapsed: number) => deliveries.update(elapsed), hooks, dispose };
}
