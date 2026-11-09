import './styles.css';
import { createBuilder } from './controller.ts';
import { mockApi } from './mock-api.ts';
import { indexedStore } from './indexed-store.ts';
import { inspectImage } from './image-inspection.ts';
import { element, fields, prepareForm, render } from './render.ts';
import { SURPRISE } from './catalog-data.ts';
import { localApi } from './local-api.ts';
import { COPY, LOCAL_COPY, ONLINE_COPY } from './copy.ts';
import { LOCAL_DATABASE_NAME, ONLINE_DATABASE_NAME, ONLINE_JOURNAL_KEY } from './constants.ts';
import { requestJournal } from './journal.ts';
import { builderMode } from './local-mode.ts';
import { onlineApi } from './online-api.ts';
import { turnstileTokens } from './turnstile-client.ts';

const mode = builderMode(location.search, location.hostname, { workerHost: import.meta.env.VITE_LOCAL_WORKER_HOST, mode: import.meta.env.VITE_BUILDER_MODE });
const local = mode === 'local';
const copy = local ? LOCAL_COPY : mode === 'online' ? ONLINE_COPY : COPY;
const storage = { getItem: (key: string) => localStorage.getItem(key), setItem: (key: string, value: string) => localStorage.setItem(key, value) };
const api = local ? localApi({ durable: true })
  : mode === 'online' ? onlineApi({ getToken: turnstileTokens({ siteKey: import.meta.env.VITE_TURNSTILE_SITE_KEY }) }) : mockApi();

const builder = createBuilder({
  api,
  ...(local ? { journal: requestJournal(storage) } : mode === 'online' ? { journal: requestJournal(storage, ONLINE_JOURNAL_KEY) } : {}),
  store: local ? indexedStore(indexedDB, LOCAL_DATABASE_NAME) : mode === 'online' ? indexedStore(indexedDB, ONLINE_DATABASE_NAME) : indexedStore(), inspect: inspectImage,
  newId: () => crypto.randomUUID(), now: () => new Date(),
}, { creature: SURPRISE, personality: SURPRISE, signatureDetail: SURPRISE, palette: null });

prepareForm(copy);
builder.subscribe(() => render(builder.state(), copy));
for (const field of fields) {
  const select = element<HTMLSelectElement>(field);
  select.addEventListener('change', () => builder.select(field, select.value || null));
}
element('builder-form').addEventListener('submit', event => { event.preventDefault(); void builder.create(); });
element('cancel').addEventListener('click', () => builder.cancel());
element('keep').addEventListener('click', () => { void builder.keep(); });
element('another').addEventListener('click', () => { void builder.tryAnother(); });
render(builder.state(), copy);
void builder.load().then(() => builder.resume());
addEventListener('online', () => { void builder.reconnect(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) void builder.reconnect(); });
