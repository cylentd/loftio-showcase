import { readSavedCharacters } from './storage-contract.ts';
import { matchesStaticWebp } from './playable-webp.ts';
import type { GeneratedImage } from './records.ts';

export type PlayableResident = { id: string; idle: Blob };
type ReaderPorts = {
  find(id: string): Promise<unknown>;
  decode(blob: Blob): Promise<Pick<ImageBitmap, 'width' | 'height' | 'close'>>;
  fetch: typeof fetch;
};

type Artifact = Extract<GeneratedImage, { mime: 'image/webp' }>;

async function readArtifact(image: Artifact, fetchArtifact: typeof fetch): Promise<Blob | null> {
  if (!image.url.endsWith('/preview.webp')) return null;
  const response = await fetchArtifact(image.url, { mode: 'same-origin', redirect: 'error', cache: 'force-cache' });
  if (!response.body) return null;
  if (!response.ok || response.headers.get('content-type') !== image.mime) {
    await response.body.cancel();
    return null;
  }
  const bytes = new Uint8Array(image.bytes);
  const reader = response.body.getReader();
  let offset = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (offset + value.length > bytes.length) { await reader.cancel(); return null; }
      bytes.set(value, offset);
      offset += value.length;
    }
  } finally { reader.releaseLock(); }
  return offset === bytes.length && matchesStaticWebp(bytes, image.width, image.height)
    ? new Blob([bytes], { type: image.mime }) : null;
}

export function createPlayableResidentReader(ports: ReaderPorts) {
  return async (id: string): Promise<PlayableResident | null> => {
    if (typeof id !== 'string' || !id) return null;
    try {
      const [record] = readSavedCharacters([await ports.find(id)]);
      if (!record || record.id !== id) return null;
      const image = record.image;
      const idle = image.mime === 'image/png'
        ? new Blob([Uint8Array.from(atob(image.base64), char => char.charCodeAt(0))], { type: image.mime })
        : await readArtifact(image, ports.fetch);
      if (!idle) return null;
      const bitmap = await ports.decode(idle);
      try {
        return bitmap.width === image.width && bitmap.height === image.height ? { id, idle } : null;
      } finally { bitmap.close(); }
    } catch { return null; }
  };
}
