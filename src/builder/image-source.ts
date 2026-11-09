import type { GeneratedImage } from './records.ts';

export const imageSource = (image: GeneratedImage) => image.mime === 'image/webp'
  ? image.url : 'data:' + image.mime + ';base64,' + image.base64;
