import { INITIAL_LOADING, nextLoading } from './loading-model.mjs';
import { LOADING } from './loading-copy.mjs';

const cover = document.querySelector('[data-world-loading]');
const status = cover.querySelector('[role="status"]');
const retry = cover.querySelector('[data-loading-retry]');
const back = cover.querySelector('[data-loading-back]');
cover.querySelector('h1').textContent = LOADING.title;
status.textContent = LOADING.preparing;
retry.textContent = LOADING.retry;
back.textContent = LOADING.back;
back.href = new URL('../../?from=valley', location.href).href;
back.hidden = !document.documentElement.hasAttribute('data-published-world');
retry.addEventListener('click', () => location.reload());
let state = INITIAL_LOADING;
const block = event => {
  if (!cover.contains(event.target)) { event.stopImmediatePropagation(); event.preventDefault(); }
};
for (const type of ['pointerdown', 'keydown', 'wheel']) addEventListener(type, block, { capture: true, passive: false });
const timer = setTimeout(() => send('error'), LOADING.timeoutMs);
function send(event) {
  state = nextLoading(state, event);
  if (state.phase === 'error') {
    status.textContent = LOADING.error;
    retry.hidden = false;
    cover.dataset.failed = '';
    clearTimeout(timer);
  }
  if (state.phase === 'ready') {
    cover.remove();
    clearTimeout(timer);
    removeEventListener('error', fail);
    removeEventListener('world-first-frame', rendered);
    for (const type of ['pointerdown', 'keydown', 'wheel']) removeEventListener(type, block, true);
  }
}
const fail = () => send('error');
const rendered = () => { if (state.assets) send('frame'); };
addEventListener('error', fail);
addEventListener('world-first-frame', rendered);
try {
  const { DefaultLoadingManager } = await import('three');
  let started = false;
  DefaultLoadingManager.onStart = () => { started = true; status.textContent = LOADING.textures; };
  DefaultLoadingManager.onLoad = () => { status.textContent = LOADING.drawing; send('assets'); };
  DefaultLoadingManager.onError = fail;
  await import('./main.js');
  if (!started) send('assets');
} catch (error) { console.error(error); fail(); }
