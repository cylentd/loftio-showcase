import type { visitChrome } from './view-parts';
import { LINK_COPY } from './copy';
import type { Invitation } from './invite-contract';
import type { LinkFetch } from './link-client';
import { prepareUpload, publishLink, copyLink, shareLinkNative, type ClipboardPort, type LinkSharePort } from './link-share';

type Chrome = ReturnType<typeof visitChrome>;
/** Everything the link flow needs from the browser, injected so the flow has no globals. */
export type LinkPorts = { fetch: LinkFetch; origin: string; clipboard?: ClipboardPort; share: LinkSharePort };

export function linkPorts(): LinkPorts {
  return { fetch: (url, init) => fetch(url, init), origin: location.origin, clipboard: navigator.clipboard, share: navigator };
}

const fill = (text: string, values: Record<string, string>) => text.replace(/\{(\w+)\}/g, (_all, key: string) => values[key] ?? '');
const failure = (error: unknown) => error instanceof Error ? error.message : LINK_COPY.unavailable;

/** After a link exists: Copy link, and the native share sheet where the browser has one. Each needs its own click. */
function resultActions(ui: Chrome, link: string, name: string, ports: LinkPorts, current: () => boolean) {
  ui.button(LINK_COPY.copy, () => {
    void copyLink(link, ports.clipboard).then(result => {
      if (!current()) return;
      ui.status.textContent = result === 'copied' ? LINK_COPY.copied : result === 'unavailable' ? LINK_COPY.copyUnavailable : LINK_COPY.copyFailed;
      // Without a clipboard the link is selected in its field, so a long-press or Ctrl+C copies it.
      if (result !== 'copied') { ui.link.field.focus(); ui.link.field.select(); }
    });
  }, true);
  if (!ports.share.share) return;
  ui.button(LINK_COPY.share, () => {
    ui.busy(true);
    void shareLinkNative(link, name, ports.share).then(result => {
      if (current() && result !== 'unsupported') ui.status.textContent = result === 'shared' ? LINK_COPY.shared : result === 'cancelled' ? LINK_COPY.cancelled : LINK_COPY.shareFailed;
    }).finally(() => { if (current()) ui.busy(false); });
  });
}

/** Adds Create link. The portrait is downsized before the click; the upload happens on it. The file buttons stay. */
export function linkShareActions(ui: Chrome, item: Invitation, ports: LinkPorts, current: () => boolean) {
  const prepared = prepareUpload(item);
  const create = ui.button(LINK_COPY.create, () => {
    ui.busy(true); ui.status.textContent = LINK_COPY.creating;
    void publishLink(prepared, ports.fetch, ports.origin).then(made => {
      if (!current()) return;
      create.remove();
      const date = made.expiresAt.toLocaleDateString(undefined, { dateStyle: 'medium' });
      ui.showLink(made.link, fill(LINK_COPY.privacy, { name: item.name, date }));
      ui.status.textContent = LINK_COPY.ready;
      resultActions(ui, made.link, item.name, ports, current);

    }).catch(error => { if (current()) ui.status.textContent = failure(error); })
      .finally(() => {
        if (!current()) return;
        ui.busy(false);
        if (!create.isConnected) ui.actions.querySelector('button')?.focus(); // Copy link takes Create link's place
      });
  }, true);
}
