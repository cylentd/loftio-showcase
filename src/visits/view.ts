import type { ResidentPortrait } from '../residents/view-parts';
import { visitChrome } from './view-parts';
import { COPY } from './copy';
import { ownedArt, importFile, sourceOf, canonicalGuest } from './image';
import { displayName } from './invite-contract';
import type { Guest, Invitation } from './invite-contract';
import { next, type VisitState } from './visit-model';
import { invitationFile, shareFile, downloadFile } from './share';
import { linkShareActions, type LinkPorts } from './link-actions';
import { loadLinkGuest } from './link-open';
import { LinkError } from './link-client';
import { removalActions as removeGuestActions, type Session } from './view-removal';

type Actions = { welcome(guest: Guest): Promise<boolean>; remove(id: string): Promise<void>; changed(removed?: boolean): Promise<void> };
function shareActions(ui: ReturnType<typeof visitChrome>, item: Invitation, current: () => boolean, download: (file: File) => void, links?: LinkPorts) {
  let name: string;
  try { name = displayName(item.name); } catch { ui.status.textContent = COPY.inviteName; return; }
  if (links) linkShareActions(ui, { ...item, name }, links, current);
  const file = invitationFile({ ...item, name });
  // With links on, the file route is the quieter second choice under the link buttons.
  const add = (label: string, action: () => void, primary = false) => links ? ui.fileButton(label, action) : ui.button(label, action, primary);
  add(links ? COPY.shareFile : COPY.share, () => {
    ui.busy(true);
    void shareFile(file, navigator, download).then(result => {
      if (current()) ui.status.textContent = result === 'failed' ? COPY.shareFailed : COPY[result];
    }).finally(() => { if (current()) ui.busy(false); });
  }, true);
  add(links ? COPY.downloadFile : COPY.download, () => { download(file); ui.status.textContent = COPY.downloaded; });
}
// A link that failed for a passing reason (offline, busy server) can be tried again; an ended one cannot.
const RETRYABLE: readonly string[] = ['offline', 'unavailable', 'rate-limited'];
const retryable = (error: unknown) => error instanceof LinkError && RETRYABLE.includes(error.kind);
export function visitViewer(actions: Actions, links?: LinkPorts) {
  const ui = visitChrome();
  const downloads = new Set<() => void>(); const download = (file: File) => { downloads.add(downloadFile(file)); }; let state: VisitState = 'closed', generation = 0;
  const close = () => { if (state !== 'welcoming') ui.dialog.close(); };
  ui.dialog.addEventListener('close', () => { generation++; state = next(state, 'close'); ui.image.removeAttribute('src'); });
  async function show(load: () => Promise<Invitation | Guest>, mode: 'owned' | 'import' | 'guest', trigger: HTMLElement, stored?: Guest, retry?: () => void) {
    if (state === 'welcoming') return;
    const current = ++generation; state = next(state, 'open');
    ui.reset(); ui.image.removeAttribute('src'); ui.stage.hidden = true; ui.name.textContent = '';
    ui.message.textContent = mode === 'import' ? COPY.opening : COPY.loading; ui.status.textContent = ''; ui.open(trigger); ui.busy(false);
    try {
      const item = await load(); if (current !== generation) return;
      ui.image.src = sourceOf(item); await ui.image.decode(); if (current !== generation) return;
      state = next(state, 'loaded'); ui.stage.hidden = false; ui.name.textContent = item.name;
      ui.message.textContent = mode === 'owned' ? COPY.owned : mode === 'guest' ? COPY.guest : COPY.preview;
      if (mode === 'owned') shareActions(ui, item, () => current === generation, download, links);
      else if (mode === 'import') welcomeActions(item as Guest);
      else if (stored) removalActions(stored);
    } catch (error) {
      if (current !== generation) return; state = next(state, 'fail');
      ui.message.textContent = error instanceof Error ? error.message : COPY.failed;
      if (stored) { state = 'preview'; ui.name.textContent = stored.name; removalActions(stored); }
      else if (retry && retryable(error)) { ui.button(COPY.retry, retry, true); ui.button(COPY.notNow, close); }
      else ui.button(COPY.done, close, true);
    }
  }
  function welcomeActions(guest: Guest) {
    ui.button(COPY.welcome, () => {
      if (state !== 'preview') return;
      state = next(state, 'welcome'); ui.busy(true); ui.status.textContent = COPY.saving;
      void actions.welcome(guest).then(async added => {
        state = next(state, 'saved'); ui.actions.replaceChildren(); ui.button(COPY.done, close, true); ui.busy(false);
        ui.message.textContent = COPY.guest; ui.status.textContent = added ? COPY.welcomed : COPY.duplicate; await actions.changed();
      }).catch(error => { state = next(state, 'fail'); ui.status.textContent = error instanceof Error ? error.message : COPY.storage; })
        .finally(() => ui.busy(false));
    }, true);
    ui.button(COPY.notNow, close);
  }
  const session: Session = { send: event => { state = next(state, event); }, closed: () => { state = 'closed'; } };
  const removalActions = (guest: Guest) => removeGuestActions(ui, actions, session, guest);
  const link = (code: string, trigger: HTMLElement): Promise<void> =>
    show(() => loadLinkGuest(code, links!.fetch, canonicalGuest), 'import', trigger, undefined, () => {
      // Try again removes its own button, so focus waits on the close button and then lands on the first new action.
      ui.dialog.querySelector<HTMLButtonElement>('.world-close')?.focus();
      void link(code, trigger).then(() => ui.actions.querySelector('button')?.focus());
    });
  return {
    owned: (portrait: ResidentPortrait, trigger: HTMLElement) => show(async () => {
      if (!portrait.supported) throw Error(COPY.unsupported);
      return ownedArt(portrait.name, portrait.source);
    }, 'owned', trigger),
    import: (file: File, trigger: HTMLElement) => show(() => importFile(file), 'import', trigger),
    link,
    guest: (guest: Guest, trigger: HTMLElement) => show(async () => { const { id: _id, ...invite } = guest; return canonicalGuest(invite); }, 'guest', trigger, guest),
    dispose() { generation++; ui.dialog.close(); ui.dialog.remove(); downloads.forEach(release => release()); },
  };
}
