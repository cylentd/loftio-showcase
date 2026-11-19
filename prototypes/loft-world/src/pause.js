// Pause: Escape, the HUD pause button, a freed mouse or a hidden tab opens the window; the frame's dt is gated here.
// Decisions are pause-model.mjs; the markup is pause-view.js. Never active under ?bench, ?shot= or ?capture, nor before play starts.
import { CLOSED, nextPause } from './pause-model.mjs';
import { createPauseView } from './pause-view.js';
import { MODE_NAMES } from './mode-data.mjs';

const FOCUSABLE = 'button:not([hidden])';

export function wirePause({ play, params, soundButton, pauseButton }) {
  if (params.has('bench') || params.has('shot') || params.has('capture')) { pauseButton.hidden = true; return { get paused() { return false; }, gate: (dt) => dt }; }
  let state = CLOSED, returnTo = null, downOnBackdrop = false;
  const running = () => play.active && !document.body.classList.contains('intro') && !document.querySelector('[data-world-loading]');
  const soundOn = () => soundButton.getAttribute('aria-pressed') === 'true';
  const published = () => document.documentElement.hasAttribute('data-published-world');
  const view = createPauseView({
    modes: MODE_NAMES,
    onResume: () => send('resume'),
    onSound: () => { soundButton.click(); view.setSound(soundOn()); },
    onMode: (name) => {
      if (name === window.__valleyMode?.mode) return;
      const url = new URL(location.href); url.searchParams.delete('low'); url.searchParams.set('mode', name); location.assign(url.href);
    },
    onLoft: () => location.assign(new URL('../../?from=valley', location.href).href),
  });

  function send(event) {
    const next = nextPause(state, event, { running: running(), aiming: !!play.state.aim });
    if (next.open === state.open) return false;
    state = next;
    if (state.open) {
      returnTo = document.activeElement;
      if (document.pointerLockElement) document.exitPointerLock();
      window.dispatchEvent(new Event('blur')); // lets go of held keys and cancels any touch aim, as a lost window does
      view.show({ soundOn: soundOn(), mode: window.__valleyMode?.mode, loftAvailable: published() });
    } else {
      view.hide();
      if (returnTo?.isConnected) returnTo.focus();
    }
    return true;
  }

  addEventListener('keydown', (e) => {
    if (state.open) {
      if (e.code === 'Escape') { if (!e.repeat) send('escape'); } else if (e.code === 'Tab') trapFocus(e);
      e.stopImmediatePropagation(); // the game ignores every key while paused; buttons still act on their default
      if (e.code === 'Escape') e.preventDefault();
    } else if (e.code === 'Escape' && !e.repeat && send('escape')) e.stopImmediatePropagation();
  }, true);
  function trapFocus(e) {
    const items = [...view.card.querySelectorAll(FOCUSABLE)], at = items.indexOf(document.activeElement);
    const to = items[(at + (e.shiftKey ? -1 : 1) + items.length) % items.length];
    e.preventDefault(); to.focus();
  }
  view.root.addEventListener('pointerdown', (e) => { downOnBackdrop = e.target === view.root; });
  view.root.addEventListener('click', (e) => { if (e.target === view.root && downOnBackdrop) send('backdrop'); downOnBackdrop = false; });
  pauseButton.addEventListener('click', (e) => { e.stopPropagation(); send('button'); });
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement) send('lockLost'); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) send('hidden'); });
  return { get paused() { return state.open; }, gate: (dt) => (state.open ? 0 : dt) };
}
