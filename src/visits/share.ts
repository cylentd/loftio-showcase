import { FILE_NAME } from './constants';
import type { Invitation } from './invite-contract';
export type SharePort = { canShare?: (data: ShareData) => boolean; share?: (data: ShareData) => Promise<void> };
export function invitationFile(invitation: Invitation): File {
  return new File([JSON.stringify(invitation)], FILE_NAME, { type: 'application/json' });
}
export async function shareFile(file: File, port: SharePort, download: (file: File) => void): Promise<'shared' | 'downloaded' | 'cancelled' | 'failed'> {
  try {
    if (!port.share || !port.canShare?.({ files: [file] })) { download(file); return 'downloaded'; }
    await port.share({ files: [file] }); return 'shared';
  } catch (error) { return error instanceof Error && error.name === 'AbortError' ? 'cancelled' : 'failed'; }
}
export function downloadFile(file: File) {
  const url = URL.createObjectURL(file), anchor = document.createElement('a');
  anchor.href = url; anchor.download = FILE_NAME; document.body.append(anchor); anchor.click(); anchor.remove();
  // Revoked on the next user interaction, after the browser consumes the download URL.
  const release = () => { URL.revokeObjectURL(url); window.removeEventListener('pointerdown', release); };
  window.addEventListener('pointerdown', release, { once: true });
  return release;
}
