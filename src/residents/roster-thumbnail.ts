// Makes the small inline picture the Rumble roster carries for a made resident: the saved image drawn onto a canvas
// no larger than THUMB_MAX_SIDE. The browser pieces (image decode, canvas) are injected, so the logic runs under test.
import { imageSource } from '../builder/image-source.ts';
import type { GeneratedImage } from '../builder/records.ts';
import type { RosterArt } from '../loadout/roster-model.ts';
import { THUMB_MAX_SIDE } from './roster-publish.ts';
import { THUMB_MIME, THUMB_QUALITY } from './roster-thumbnail-constants.ts';
import { fitWithin } from './thumbnail-model.ts';

/** What the publisher passes as a saved record's image: the id says which character, the image is its saved picture. */
export type ThumbnailSource = { id: string; image: GeneratedImage };
export type LoadedImage = { source: unknown; width: number; height: number };
export type ThumbnailCanvas = {
  getContext(kind: '2d'): { drawImage(source: any, x: number, y: number, width: number, height: number): void } | null;
  toDataURL(type: string, quality: number): string;
};
export type ThumbnailEnv = { load(src: string): Promise<LoadedImage>; canvas(width: number, height: number): ThumbnailCanvas };

const isThumbnailSource = (value: unknown): value is ThumbnailSource => {
  const record = value as { id?: unknown; image?: { mime?: unknown } } | null;
  return typeof record?.id === 'string' && typeof record.image?.mime === 'string';
};

/** What tells one saved image from another: a saved image never changes under its id, so its encoded size is enough to notice a replaced one. */
const fingerprint = ({ id, image }: ThumbnailSource): string =>
  [id, image.mime, image.width, image.height, 'url' in image ? image.url : image.base64.length].join('|');

const draw = async (env: ThumbnailEnv, source: ThumbnailSource, maxSide: number): Promise<RosterArt> => {
  const loaded = await env.load(imageSource(source.image));
  const size = fitWithin(loaded.width, loaded.height, maxSide);
  if (!size) throw new Error('The saved image has no usable size');
  const canvas = env.canvas(size.width, size.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No 2d canvas context');
  context.drawImage(loaded.source, 0, 0, size.width, size.height);
  return { src: canvas.toDataURL(THUMB_MIME, THUMB_QUALITY), ...size };
};

/**
 * A thumbnailer for the roster publisher. The Residents render publishes on every change, so a finished thumbnail is
 * remembered per saved image (the publisher's change check still decides whether anything is written); a failure is not.
 */
export const createThumbnailer = (env: ThumbnailEnv, maxSide: number) => {
  const done = new Map<string, Promise<RosterArt>>();
  return (value: unknown): Promise<RosterArt> => {
    if (!isThumbnailSource(value)) return Promise.reject(new Error('Not a saved image'));
    const key = fingerprint(value);
    const known = done.get(key);
    if (known) return known;
    const made = draw(env, value, maxSide);
    done.set(key, made);
    made.catch(() => { if (done.get(key) === made) done.delete(key); });
    return made;
  };
};

/** The real environment: an `Image` decoded off screen and a canvas element. A remote image the page may not read back (no CORS) fails, and its resident publishes without art. */
export const browserThumbnailEnv: ThumbnailEnv = {
  load: async (src) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = src;
    await image.decode();
    return { source: image, width: image.naturalWidth, height: image.naturalHeight };
  },
  canvas: (width, height) => {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    return canvas;
  },
};

export const browserThumbnailer = () => createThumbnailer(browserThumbnailEnv, THUMB_MAX_SIDE);
