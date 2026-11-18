import { createLink, LinkError, type LinkFetch } from './link-client';
import { fitForUpload, renderAtSide } from './link-fit';
import { base64FromBytes, type Invitation } from './invite-contract';

export type ClipboardPort = { writeText?: (text: string) => Promise<void> };
export type LinkSharePort = { share?: (data: ShareData) => Promise<void> };

/** Prepared before the click: the portrait downsized to fit the upload cap, or null when no size fits. */
export function prepareUpload(item: Invitation): Promise<Invitation | null> {
  return fitForUpload(side => renderAtSide(item.png, side))
    .then(png => png ? { ...item, png: base64FromBytes(png) } : null, () => null);
}

/** The click-time step: upload the prepared invitation and return the link. No fit is a failure that points to the file. */
export async function publishLink(prepared: Promise<Invitation | null>, fetchFn: LinkFetch, origin: string) {
  const upload = await prepared.catch(() => null);
  if (!upload) throw new LinkError('no-fit');
  return createLink(upload, fetchFn, origin);
}

export async function copyLink(link: string, clipboard: ClipboardPort | undefined): Promise<'copied' | 'unavailable' | 'failed'> {
  if (!clipboard?.writeText) return 'unavailable';
  try { await clipboard.writeText(link); return 'copied'; } catch { return 'failed'; }
}

export async function shareLinkNative(link: string, name: string, port: LinkSharePort): Promise<'shared' | 'unsupported' | 'cancelled' | 'failed'> {
  if (!port.share) return 'unsupported';
  try { await port.share({ url: link, title: name }); return 'shared'; }
  catch (error) { return error instanceof Error && error.name === 'AbortError' ? 'cancelled' : 'failed'; }
}
