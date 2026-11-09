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
import { worldButton } from '../world-ui';
import type { Scene } from '../scene';
import type { Runtime } from '../runtime';
import type { Overlay } from '../overlay';
import type { installResidentControls } from '../resident-controls';
import { residentRegistry, type ResidentEntry } from './registry';
import { RESIDENT_COPY as COPY } from './copy';
import { residentForm } from './create-form';
import { createAction } from './create-action';
import { arrivalSpot, openSpot, sceneResidents } from './scene-adapter';
import { residentChrome, arrivalReveal, renderResidents } from './view-parts';

const BASKET_MARGIN = 16; // px from the screen edge and the Residents button; matches --space-4

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

function session(mode: BuilderMode) {
  const storage = { getItem: (key: string) => localStorage.getItem(key), setItem: (key: string, value: string) => localStorage.setItem(key, value) };
  const names = NAMES[mode];
  const registry = residentRegistry(storage, () => crypto.randomUUID(), names.registry);
  const ticketKey = names.tickets;
  const tickets = buildTickets(storage, ticketKey);
  // Online visitors get a daily allowance, topped up once per UTC day.
  if (mode === 'online') tickets.refillDaily(VISITOR_DAILY_CAP, utcDay(new Date()));
  const builder = createBuilder({ api: builderApi(mode),
    store: mode === 'mock' ? indexedStore() : indexedStore(indexedDB, mode === 'local' ? LOCAL_DATABASE_NAME : ONLINE_DATABASE_NAME), inspect: inspectImage,
    journal: requestJournal(storage, names.journal),
    tickets, newId: () => crypto.randomUUID(), now: () => new Date(),
  }, { creature: 'bunny', personality: 'sleepy', signatureDetail: 'none', palette: null });
  return { registry, builder, tickets, ticketKey };
}

function restore(current: ReturnType<typeof session>, adapter: ReturnType<typeof sceneResidents>, failure: (error: unknown) => void) {
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
  }).catch(failure);
}

export function installResidents(scene: Scene, runtime: Runtime, overlay: Overlay, controls: ReturnType<typeof installResidentControls>) {
  const mode = builderMode(location.search, location.hostname, { workerHost: import.meta.env.VITE_LOCAL_WORKER_HOST, mode: import.meta.env.VITE_BUILDER_MODE });
  const chrome = residentChrome();
  let current: ReturnType<typeof session>;
  try { current = session(mode); } catch { chrome.error.textContent = COPY.loadFailure; return () => {}; }
  const { registry, builder, tickets, ticketKey } = current;
  // Test tickets only where images are free placeholders; real builds (local, online) never get them.
  const form = residentForm(builder, mode, mode === 'mock' ? () => tickets.grant(1) : undefined); chrome.panels[2]!.append(form.form, challenge);
  // Another tab spent or added a ticket: show the new count here too.
  addEventListener('storage', event => { if (event.key === ticketKey) render(); });
  const failure = (error: unknown) => { chrome.error.textContent = error instanceof Error ? error.message : COPY.actionFailure; overlay.announce(chrome.error.textContent); };
  const adapter = sceneResidents(scene, runtime, overlay, controls, registry, () => render());
  const showArrival = arrivalReveal(chrome, {
    welcome: async (entry, saved, skip) => { await adapter.add(entry, saved, true, skip); render(); },
    later: id => { registry.defer(id); render(); }, failure,
  });
  const reveal = (entry: ResidentEntry) => {
    const saved = builder.state().kept.find(item => item.id === entry.savedId);
    if (saved) showArrival(entry, saved, runtime.look.frozen);
  };
  const basket = worldButton(COPY.ready, () => { const next = registry.list().find(entry => entry.arrival === 'waiting'); if (next) reveal(next); });
  basket.className = 'arrival-basket'; basket.setAttribute('aria-label', COPY.reveal); basket.hidden = true;
  const tag = document.createElement('span'); tag.textContent = COPY.ready; basket.replaceChildren(tag);
  document.querySelector('#world')!.append(basket);
  let basketSpot: { x: number; y: number } | null = null;
  function render() {
    const state = builder.state(); form.update();
    chrome.status.textContent = state.status === 'generating' ? state.stage === 'preparing' ? COPY.preparing : COPY.creating : '';
    chrome.error.textContent = createAction(state).drawerAlert;
    try { for (const saved of state.kept) registry.discover(saved.id, saved.state === 'kept' ? 'saved' : 'waiting'); } catch (error) { failure(error); return; }
    const entries = registry.list(); const ready = entries.some(entry => entry.arrival === 'waiting'); basket.hidden = !ready;
    // Chosen once when the basket appears, so it doesn't follow residents as they wander.
    basketSpot = ready ? basketSpot ?? openSpot(scene) : null;
    chrome.trigger.textContent = ready ? COPY.title + ' · ' + COPY.ready : COPY.title;
    renderResidents(chrome.panels, state, entries, id => { try { adapter.remove(id); } catch (error) { failure(error); } }, reveal);
  }
  builder.subscribe(render); render(); restore(current, adapter, failure);
  return () => {
    const spot = basketSpot ?? arrivalSpot(); const { scale, x, y, offsetY, left: scrolled } = runtime.look;
    // The door can sit past a phone's edge or behind the Residents button: keep the basket in view above it.
    // left is in world-scroller coordinates, so clamp the on-screen position and add the scroll back.
    const bottomControls = [chrome.trigger, document.querySelector('.scene-actions')].filter(item => item instanceof HTMLElement);
    const half = basket.offsetWidth / 2; const ceiling = Math.min(...bottomControls.map(item => item.getBoundingClientRect().top)) - BASKET_MARGIN;
    const left = (spot.x + scene.cast.x - x) * scale - scrolled; const top = (spot.y + scene.cast.y - y) * scale + offsetY;
    basket.style.left = Math.max(half + BASKET_MARGIN, Math.min(innerWidth - half - BASKET_MARGIN, left)) + scrolled + 'px';
    basket.style.top = Math.min(ceiling, top) + 'px';
  };
}
