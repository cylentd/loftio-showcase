type Departure = (signal: AbortSignal) => Promise<void>;
type Departures = { rumble: Departure; valley: Departure };

export function gladeSelection(panel: HTMLDialogElement, rumble: HTMLAnchorElement, valley: HTMLAnchorElement, error: HTMLElement) {
  let selected: { departures: Departures; intent: AbortController; busy: boolean; failure: string } | undefined;
  let restoreLinks: (() => void)[] = [];
  function reset() {
    selected?.intent.abort(); selected = undefined;
    for (const restore of restoreLinks) restore();
    restoreLinks = [];
    error.textContent = '';
  }
  panel.addEventListener('close', () => { if (!panel.open) reset(); });
  panel.addEventListener('cancel', reset);
  function mountAction(link: HTMLAnchorElement, destination: keyof Departures) {
    const action = document.createElement('button');
    action.type = 'button'; action.className = link.className; action.textContent = link.textContent;
    action.addEventListener('click', () => {
      const current = selected;
      if (!current || !panel.open) return;
      if (current.busy) return;
      current.busy = true; error.textContent = '';
      void current.departures[destination](current.intent.signal).catch(() => {
        if (selected !== current || !panel.open) return;
        current.busy = false;
        error.textContent = current.failure;
        action.focus({ preventScroll: true });
        action.scrollIntoView({ block: 'nearest' });
      });
    });
    link.replaceWith(action);
    restoreLinks.push(() => action.replaceWith(link));
  }
  const select = (departures: Departures, failure: string) => {
    reset();
    selected = { departures, intent: new AbortController(), busy: false, failure };
    mountAction(rumble, 'rumble'); mountAction(valley, 'valley');
    panel.showModal();
  };
  return { select, reset };
}
