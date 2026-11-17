import { RESTING, next, type DepartureEvent } from './departure-model';

export function installGladeDeparture(play: HTMLAnchorElement): void {
  const departureCover = document.createElement('div');
  departureCover.className = 'glade-departure';
  departureCover.popover = 'manual';
  departureCover.setAttribute('aria-hidden', 'true');
  document.body.append(departureCover);
  // departure-model.ts owns the lifecycle; this file keeps the cover, the animation and the navigation.
  let state = RESTING;
  let departure: Animation | undefined;
  const send = (event: DepartureEvent) => {
    const before = state;
    state = next(state, event);
    return state !== before;
  };
  play.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
      || matchMedia('(prefers-reduced-motion: reduce)').matches || typeof departureCover.showPopover !== 'function') return;
    const tokens = getComputedStyle(document.documentElement);
    const duration = Number.parseFloat(tokens.getPropertyValue('--glade-departure-ms'));
    if (!Number.isFinite(duration)) return;
    event.preventDefault();
    if (!send({ type: 'click' })) return;
    const epoch = state.epoch;
    document.documentElement.dataset.rumbleLeaving = '';
    departureCover.showPopover();
    departure = departureCover.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration, easing: tokens.getPropertyValue('--glade-departure-ease').trim(), fill: 'forwards',
    });
    // Tagged with its epoch: a completion that outlives a pageshow reset, or a newer departure, is refused.
    const navigate = () => { if (send({ type: 'finished', epoch })) location.assign(play.href); };
    void departure.finished.then(navigate, navigate);
  });
  addEventListener('pageshow', () => {
    send({ type: 'pageshow' });
    delete document.documentElement.dataset.rumbleLeaving;
    departure?.cancel();
    departureCover.hidePopover?.();
  });
}
