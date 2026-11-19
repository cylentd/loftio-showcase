// The pause lifecycle: two states, one pure transition. The view and the frame gate read `open`; nothing else decides it.
export const CLOSED = Object.freeze({ open: false });
export const OPEN = Object.freeze({ open: true });

/** Events: escape, button (the HUD pause button), lockLost (the browser freed the mouse), hidden (tab hidden),
 *  resume, backdrop (a click outside the window).
 *  ctx.running: Explore is being played (not loading, begin prompt, flyover or a capture run).
 *  ctx.aiming: a fling aim is in progress; Escape and a freed mouse then cancel the aim instead of pausing. */
export function nextPause(state, event, { running = false, aiming = false } = {}) {
  if (!running) return CLOSED;
  if (state.open) return ['escape', 'resume', 'backdrop'].includes(event) ? CLOSED : state;
  if (event === 'button' || event === 'hidden') return OPEN;
  if ((event === 'escape' || event === 'lockLost') && !aiming) return OPEN;
  return state;
}
