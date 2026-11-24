import { worldButton } from '../world-ui';
import { FIRST_RESIDENT_COPY as COPY } from './first-resident-copy';

export type FirstResidentLaunches = {
  playRumble(savedId: string, signal: AbortSignal): Promise<void>;
  exploreValley(savedId: string, signal: AbortSignal): Promise<void>;
};

type Destination = keyof FirstResidentLaunches;
type LaunchState = { kind: 'idle' | 'closed' } | { kind: 'pending' | 'failed'; destination: Destination };
type LaunchEvent = { type: 'press'; destination: Destination } | { type: 'fail' | 'close' };

export function nextLaunch(state: LaunchState, event: LaunchEvent): LaunchState {
  if (state.kind === 'closed') return state;
  if (event.type === 'close') return { kind: 'closed' };
  if (event.type === 'fail') return state.kind === 'pending' ? { ...state, kind: 'failed' } : state;
  if (state.kind === 'pending' || event.type !== 'press') return state;
  return { kind: 'pending', destination: event.destination };
}

export function launchControls(launches: FirstResidentLaunches, savedId: string, persist: () => boolean | Promise<boolean>, finish: () => void, lock: (busy: boolean) => void) {
  let state: LaunchState = { kind: 'idle' };
  const intent = new AbortController();
  const root = document.createElement('div'); root.className = 'first-resident-launches';
  const error = document.createElement('p'); error.setAttribute('role', 'alert');
  const status = document.createElement('p'); status.className = 'visually-hidden'; status.setAttribute('role', 'status');
  const button = (destination: Destination) => worldButton(COPY.destinations[destination].start, () => void start(destination));
  const buttons = { playRumble: button('playRumble'), exploreValley: button('exploreValley') };
  buttons.playRumble.classList.add('world-primary');
  root.append(buttons.playRumble, buttons.exploreValley, error, status);

  function render() {
    const busy = state.kind === 'pending';
    for (const destination of Object.keys(buttons) as Destination[]) {
      const copy = COPY.destinations[destination];
      buttons[destination].disabled = busy;
      buttons[destination].textContent = 'destination' in state && state.destination === destination
        ? busy ? COPY.opening : copy.retry : copy.start;
    }
    error.textContent = state.kind === 'failed' ? COPY.destinations[state.destination].error : '';
    status.textContent = busy ? COPY.opening : '';
    lock(busy);
  }

  async function start(destination: Destination) {
    const pending = nextLaunch(state, { type: 'press', destination });
    if (pending === state) return;
    const previous = state;
    const persisted = persist();
    if (persisted === false) return;
    state = pending; render();
    if (persisted !== true && !await persisted) {
      if (state === pending) { state = previous; render(); }
      return;
    }
    if (state !== pending) return;
    try { await launches[destination](savedId, intent.signal); }
    catch {
      if (state !== pending) return;
      state = nextLaunch(state, { type: 'fail' }); render(); buttons[destination].focus(); return;
    }
    if (state === pending) { state = nextLaunch(state, { type: 'close' }); render(); finish(); }
  }
  return { root, dispose() { state = nextLaunch(state, { type: 'close' }); intent.abort(); } };
}
