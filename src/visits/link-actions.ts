import type { visitChrome } from './view-parts';
import { turnstileTokens } from '../builder/turnstile-client';
import { LINK_COPY, LINK_LIFETIME } from './copy';
import type { Invitation } from './invite-contract';
import { LinkError, type LinkFetch } from './link-client';
import { prepareUpload, publishLink, copyLink, shareLinkNative, type ClipboardPort, type LinkSharePort } from './link-share';

type Chrome = ReturnType<typeof visitChrome>;
/** Everything the link flow needs from the browser, injected so the flow has no globals.
 *  getToken: a fresh single-use Turnstile token per call; absent when the build has no site key, and then Create link is not offered.
 *  challenge: where a visible Turnstile challenge shows; the viewer puts it inside its dialog, since the rest of the page is inert. */
export type LinkPorts = { fetch: LinkFetch; origin: string; clipboard?: ClipboardPort; share: LinkSharePort;
  getToken?: () => Promise<string>; challenge?: HTMLElement };

export function linkPorts(siteKey: string | undefined): LinkPorts {
  const challenge = document.createElement('div'); challenge.className = 'visit-challenge';
  return { fetch: (url, init) => fetch(url, init), origin: location.origin, clipboard: navigator.clipboard, share: navigator, challenge,
    getToken: siteKey ? turnstileTokens({ siteKey, host: () => challenge }) : undefined };
}

/** The ports to make links with, or nothing when there is no human check: friends can still open a link, owners get the file flow only. */
export const hostedLinks = (ports?: LinkPorts) => ports?.getToken ? ports : undefined;

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

/** Adds Create link. The portrait is downsized before the click; the check and the upload happen on it, each attempt with its own
 *  fresh token (a used token is spent even when a cap then refuses). The file buttons stay. Does nothing without a human check. */
export function linkShareActions(ui: Chrome, item: Invitation, ports: LinkPorts, current: () => boolean) {
  const getToken = ports.getToken;
  if (!getToken) return;
  const prepared = prepareUpload(item);
  async function attempt() {
    let token: string;
    try { token = await getToken!(); } catch { throw new LinkError('human-check'); }
    if (!current()) throw new Error('closed'); // the dialog went away during the check: send nothing
    ui.busy(true); ui.status.textContent = LINK_COPY.creating;
    return publishLink(prepared, ports.fetch, ports.origin, token);
  }
  const create = ui.button(LINK_COPY.create, () => {
    create.disabled = true; ui.status.textContent = LINK_COPY.checking;
    void attempt().then(made => {
      if (!current()) return;
      create.remove();
      // The stop time is the server's expiresAt, never the device clock plus a guess.
      const time = made.expiresAt.toLocaleTimeString(undefined, { timeStyle: 'short' });
      ui.showLink(made.link, fill(LINK_COPY.privacy, { name: item.name, lifetime: LINK_LIFETIME, time }));
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
