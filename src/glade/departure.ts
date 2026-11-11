export function installGladeDeparture(play: HTMLAnchorElement): void {
  const departureCover = document.createElement('div');
  departureCover.className = 'glade-departure';
  departureCover.popover = 'manual';
  departureCover.setAttribute('aria-hidden', 'true');
  document.body.append(departureCover);
  let leaving = false;
  let departure: Animation | undefined;
  play.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
      || matchMedia('(prefers-reduced-motion: reduce)').matches || typeof departureCover.showPopover !== 'function') return;
    const tokens = getComputedStyle(document.documentElement);
    const duration = Number.parseFloat(tokens.getPropertyValue('--glade-departure-ms'));
    if (!Number.isFinite(duration)) return;
    event.preventDefault();
    if (leaving) return;
    leaving = true;
    document.documentElement.dataset.rumbleLeaving = '';
    departureCover.showPopover();
    departure = departureCover.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration, easing: tokens.getPropertyValue('--glade-departure-ease').trim(), fill: 'forwards',
    });
    const navigate = () => { if (leaving) location.assign(play.href); };
    void departure.finished.then(navigate, navigate);
  });
  addEventListener('pageshow', () => {
    leaving = false;
    delete document.documentElement.dataset.rumbleLeaving;
    departure?.cancel();
    departureCover.hidePopover?.();
  });
}
