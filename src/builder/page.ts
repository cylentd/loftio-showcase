import './styles.css';
import { createBuilder } from './controller.ts';
import { mockApi } from './mock-api.ts';
import { indexedStore } from './indexed-store.ts';
import { inspectImage } from './image-inspection.ts';
import { element, fields, prepareForm, render } from './render.ts';
import { SURPRISE } from './catalog-data.ts';
import { localApi } from './local-api.ts';
import { COPY, LOCAL_COPY } from './copy.ts';
import { LOCAL_DATABASE_NAME } from './constants.ts';
import { requestJournal } from './journal.ts';
import { usesLocalWorker } from './local-mode.ts';

const local = usesLocalWorker(location.search, location.hostname, import.meta.env.VITE_LOCAL_WORKER_HOST);
const copy = local ? LOCAL_COPY : COPY;

const builder = createBuilder({
  api: local ? localApi({ durable: true }) : mockApi(),
  ...(local ? { journal: requestJournal({ getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) }) } : {}),
  store: local ? indexedStore(indexedDB, LOCAL_DATABASE_NAME) : indexedStore(), inspect: inspectImage,
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
