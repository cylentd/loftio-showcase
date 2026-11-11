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
import { turnstileTokens } from '../builder/turnstile-client';
import { VISITOR_DAILY_CAP } from '../builder/server/online-config';
import type { Scene } from '../scene';
import type { Runtime } from '../runtime';
import type { Overlay } from '../overlay';
import type { installResidentControls } from '../resident-controls';
import { residentRegistry, type ResidentEntry } from './registry';
import { RESIDENT_COPY as COPY } from './copy';
import { residentForm } from './create-form';
import { createAction } from './create-action';
import { sceneResidents } from './scene-adapter';
import { residentChrome, renderResidents } from './view-parts';
import { arrivalReveal } from './arrival-reveal';
import { roomDeliveries } from './delivery';
import { creationIndicator } from './creation-progress';
import type { RevealAudioPreference } from './unboxing-sound';
import { CAST } from '../cast';
import { originalLineup } from './original-lineup';
import { originalResidents } from './original-scene';
import { arrivalPreview } from './arrival-preview-mode';
import { previewBackend } from './arrival-preview';

const NAMES = {
  local: { registry: 'loftio-residents-v1', tickets: 'loftio-build-tickets-v1', journal: 'loftio-builder-local-pending-v1' },
  online: { registry: ONLINE_REGISTRY_KEY, tickets: ONLINE_TICKET_KEY, journal: ONLINE_JOURNAL_KEY },
  mock: { registry: 'loftio-residents-mock-v1', tickets: 'loftio-build-tickets-mock-v1', journal: 'loftio-builder-mock-pending-v1' },
};

// A visible Turnstile challenge shows here, in the Create panel: the drawer is a modal dialog, so the page behind it is inert.
const challenge = document.createElement('div'); challenge.className = 'turnstile-challenge';

function builderApi(mode: BuilderMode) {
  if (mode === 'local') return localApi({ durable: true });
  if (mode === 'online') return onlineApi({ getToken: turnstileTokens({ siteKey: import.meta.env.VITE_TURNSTILE_SITE_KEY, host: () => challenge }) });
  return mockApi();
}

function session(mode: BuilderMode, preview: ReturnType<typeof previewBackend> | null) {
  const storage = preview?.storage ?? { getItem: (key: string) => localStorage.getItem(key), setItem: (key: string, value: string) => localStorage.setItem(key, value) };
  const names = NAMES[mode];
  const registry = residentRegistry(storage, () => crypto.randomUUID(), names.registry);
  const originals = originalLineup(storage, CAST.map(member => member.id), names.registry + '-originals');
  const ticketKey = names.tickets;
  const tickets = buildTickets(storage, ticketKey);
  // Online visitors get a daily allowance, topped up once per UTC day.
  if (mode === 'online') tickets.refillDaily(VISITOR_DAILY_CAP, utcDay(new Date()));
  const builder = createBuilder({ api: builderApi(mode),
    store: preview?.store ?? (mode === 'mock' ? indexedStore() : indexedStore(indexedDB, mode === 'local' ? LOCAL_DATABASE_NAME : ONLINE_DATABASE_NAME)), inspect: inspectImage,
    journal: requestJournal(storage, names.journal),
    tickets, newId: () => crypto.randomUUID(), now: () => new Date(),
  }, { creature: 'bunny', personality: 'sleepy', signatureDetail: 'none', palette: null });
  return { registry, originals, builder, tickets, ticketKey };
}

function restore(current: ReturnType<typeof session>, adapter: ReturnType<typeof sceneResidents>, failure: (error: unknown) => void, loaded?: () => void) {
  const { builder, registry } = current;
  addEventListener('online', () => { void builder.reconnect(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void builder.reconnect(); });
  // Restore the room from saved records first; a pending job reattaches alongside, never ahead of it.
  void builder.load().then(async () => {
    void builder.resume().catch(failure);
    for (const entry of registry.list().filter(item => item.inRoom)) {
      const saved = builder.state().kept.find(item => item.id === entry.savedId);
      if (saved) { try { await adapter.add(entry, saved); } catch (error) { failure(error); } }
    }
    loaded?.();
  }).catch(failure);
}

export function installResidents(scene: Scene, runtime: Runtime, overlay: Overlay, controls: ReturnType<typeof installResidentControls>, audio: RevealAudioPreference) {
  const mode = builderMode(location.search, location.hostname, { workerHost: import.meta.env.VITE_LOCAL_WORKER_HOST, mode: import.meta.env.VITE_BUILDER_MODE });
  const chrome = residentChrome();
  let current: ReturnType<typeof session>;
  const preview = arrivalPreview(location.search, mode) ? previewBackend() : null;
  try { current = session(mode, preview); } catch { chrome.error.textContent = COPY.loadFailure; return () => {}; }
  const { registry, builder, tickets, ticketKey } = current;
  const originals = originalResidents(scene, runtime, overlay, controls, current.originals);
  // Test tickets only where images are free placeholders; real builds (local, online) never get them.
  const form = residentForm(builder, mode, mode === 'mock' ? () => tickets.grant(1) : undefined, () => chrome.drawer.dialog.close()); chrome.panels[2]!.append(form.form, challenge);
  const indicator = creationIndicator(chrome.openCreate);
  chrome.drawer.dialog.addEventListener('close', form.dismissProgress);
  // Online the image arrives through this page and the ticket is already spent, so leaving mid-build asks first.
  if (mode === 'online') addEventListener('beforeunload', event => { if (builder.state().status === 'generating') event.preventDefault(); });
  // Another tab spent or added a ticket: show the new count here too.
  addEventListener('storage', event => { if (event.key === ticketKey) render(); });
  const failure = (error: unknown) => { chrome.error.textContent = error instanceof Error ? error.message : COPY.actionFailure; overlay.announce(chrome.error.textContent); };
  const adapter = sceneResidents(scene, runtime, overlay, controls, registry, () => render());
  const showArrival = arrivalReveal(chrome, {
    welcome: async (entry, saved, skip) => { await adapter.add(entry, saved, true, skip); render(); },
    rename: (id, name) => registry.rename(id, name),
    later: id => { registry.defer(id); render(); }, failure,
  }, audio);
  const reveal = (entry: ResidentEntry, trigger?: HTMLButtonElement) => {
    const saved = builder.state().kept.find(item => item.id === entry.savedId);
    if (saved) showArrival(entry, saved, runtime.look.frozen, trigger);
  };
  const deliveries = roomDeliveries(scene, runtime, reveal, audio,
    (id, room, point) => registry.deliveryPosition(id, room, point), failure);
  function render() {
    const state = builder.state(); form.update();
    indicator.update(state.status, state.stage);
    chrome.error.textContent = createAction(state).drawerAlert;
    try { if (state.status !== 'generating') for (const saved of state.kept) registry.discover(saved.id, saved.state === 'kept' ? 'saved' : 'waiting'); } catch (error) { failure(error); return; }
    const entries = registry.list(); const ready = entries.some(entry => entry.arrival === 'waiting'); deliveries.sync(entries);
    chrome.trigger.setAttribute('aria-label', ready ? COPY.title + ' · ' + COPY.ready : COPY.title);
    chrome.trigger.title = ready ? COPY.ready : COPY.title;
    renderResidents(chrome.panels, state, entries, id => { try { adapter.remove(id); } catch (error) { failure(error); } }, reveal,
      current.originals.list(), (id, inRoom) => { try { originals.setInRoom(id, inRoom); render(); } catch (error) { failure(error); } });
  }
  const openPreview = preview ? () => { const waiting = registry.list().find(entry => entry.arrival === 'waiting'); if (waiting) reveal(waiting); } : undefined;
  builder.subscribe(render); render(); restore(current, adapter, failure, openPreview);
  return (elapsed: number) => deliveries.update(elapsed);
}
