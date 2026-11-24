import { INITIAL_LOADING, nextLoading } from './loading-model.mjs';
import { LOADING } from './loading-copy.mjs';
import { openGate } from './intro-gate.js';
import { enterWorld, loadWorld } from './resident-entry.mjs';
import { decodeResidentArt } from './resident-art.js';

const cover = document.querySelector('[data-world-loading]');
const status = cover.querySelector('[role="status"]');
const retry = cover.querySelector('[data-loading-retry]');
const back = cover.querySelector('[data-loading-back]');
const begin = cover.querySelector('[data-loading-begin]');
cover.querySelector('h1').textContent = LOADING.title;
status.textContent = LOADING.preparing;
retry.textContent = LOADING.retry;
back.textContent = LOADING.back;
back.href = new URL('../../?from=valley', location.href).href;
back.hidden = !document.documentElement.hasAttribute('data-published-world');
retry.addEventListener('click', () => location.reload());
let state = INITIAL_LOADING;
let resolvingResident = false;
const block = event => {
  if (!cover.contains(event.target)) { event.stopImmediatePropagation(); event.preventDefault(); }
};
for (const type of ['pointerdown', 'keydown', 'wheel']) addEventListener(type, block, { capture: true, passive: false });
const timer = setTimeout(() => resolvingResident ? residentUnavailable() : fail(), LOADING.timeoutMs);
function send(event) {
  state = nextLoading(state, event);
  if (state.phase === 'error') {
    status.textContent = LOADING.error;
    retry.hidden = false;
    cover.dataset.failed = '';
    clearTimeout(timer);
  }
  if (state.phase === 'ready') lift();
}
async function lift() {
  clearTimeout(timer);
  removeEventListener('error', fail);
  removeEventListener('world-first-frame', rendered);
  const gate = window.loftWorld.gate;
  try { await openGate({ status, begin, gate }); } catch (error) { console.error(error); }
  cover.remove();
  for (const type of ['pointerdown', 'keydown', 'wheel']) removeEventListener(type, block, true);
  gate.begin();
}
const fail = () => send('error');
const rendered = () => { if (state.assets) send('frame'); };
function residentUnavailable() {
  resolvingResident = false;
  fail();
  status.textContent = LOADING.residentUnavailable;
  retry.hidden = true;
  back.hidden = false;
  removeEventListener('error', fail);
  removeEventListener('world-first-frame', rendered);
}
addEventListener('error', fail);
addEventListener('world-first-frame', rendered);
try {
  const { DefaultLoadingManager } = await import('three');
  let started = false;
  DefaultLoadingManager.onStart = () => { started = true; status.textContent = LOADING.textures; };
  DefaultLoadingManager.onLoad = () => { status.textContent = LOADING.drawing; send('assets'); };
  DefaultLoadingManager.onError = fail;
  resolvingResident = true;
  await enterWorld(location.search, {
    decode: decodeResidentArt,
    async start(art) {
      resolvingResident = false;
      if (art && state.phase === 'error') return;
      await loadWorld(art);
      if (!started) send('assets');
    },
    unavailable: residentUnavailable,
  });
} catch (error) { console.error(error); fail(); }
