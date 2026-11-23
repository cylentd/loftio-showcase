import { ProviderError, type ImageProvider } from './provider.ts';
import { MOCK_SIDE } from './constants.ts';
import { MOCK_ART } from './mock-data.ts';
import { encodeRgbPng, encodeRgbaPng } from './png.ts';
import { COPY } from './copy.ts';

// Samples per pixel of the placeholder (RGBA) and of the opaque alt (RGB), and the alpha sample's index: PNG spec, 11.2.2 colour types.
const RGB_CHANNELS = 3;
const RGBA_CHANNELS = 4;
const ALPHA_CHANNEL = 3;

function placeholder(variation: number) {
  const pixels = new Uint8Array(MOCK_SIDE * MOCK_SIDE * 4);
  const color = MOCK_ART.colors[variation % MOCK_ART.colors.length] ?? MOCK_ART.colors[0];
  function ellipse(centerX: number, centerY: number, radiusX: number, radiusY: number, rgba: readonly number[]) {
    for (let row = 0; row < MOCK_SIDE; row++) {
      for (let column = 0; column < MOCK_SIDE; column++) {
        const distance = ((column / MOCK_SIDE - centerX) / radiusX) ** 2 + ((row / MOCK_SIDE - centerY) / radiusY) ** 2;
        if (distance <= 1) pixels.set(rgba, (row * MOCK_SIDE + column) * 4);
      }
    }
  }
  const { bodyCenter, bodyRadius, eyeY, eyeRadius, pupilRadius, mouthY, mouthRadius } = MOCK_ART;
  ellipse(bodyCenter.x, bodyCenter.y, bodyRadius.x, bodyRadius.y, [...color, 255]);
  for (const eyeX of MOCK_ART.eyeCenters) {
    ellipse(eyeX, eyeY, eyeRadius, eyeRadius, MOCK_ART.eyeWhite);
    ellipse(eyeX, eyeY, pupilRadius, pupilRadius, MOCK_ART.ink);
  }
  ellipse(bodyCenter.x, mouthY, mouthRadius.x, mouthRadius.y, MOCK_ART.ink);
  return pixels;
}

/** The mock expression: the same placeholder in the next palette colour, so it differs from the idle and keeps transparency. */
export async function mockExpression(idleVariation: number) {
  return { bytes: await encodeRgbaPng(MOCK_SIDE, MOCK_SIDE, placeholder(idleVariation + 1)), mime: 'image/png' as const };
}

/** The mock alt: the placeholder two palette steps on, laid over an opaque cream background, so it has no alpha channel. */
export async function mockAlt(idleVariation: number) {
  const rgba = placeholder(idleVariation + 2);
  const rgb = new Uint8Array(MOCK_SIDE * MOCK_SIDE * RGB_CHANNELS);
  const background = MOCK_ART.eyeWhite;
  for (let pixel = 0; pixel < MOCK_SIDE * MOCK_SIDE; pixel++) {
    const covered = (rgba[pixel * RGBA_CHANNELS + ALPHA_CHANNEL] ?? 0) > 0;
    for (let channel = 0; channel < RGB_CHANNELS; channel++) {
      rgb[pixel * RGB_CHANNELS + channel] = covered ? rgba[pixel * RGBA_CHANNELS + channel] ?? 0 : background[channel] ?? 0;
    }
  }
  return { bytes: await encodeRgbPng(MOCK_SIDE, MOCK_SIDE, rgb), mime: 'image/png' as const };
}

export function mockProvider(): ImageProvider {
  let variation = 0;
  return {
    id: 'mock', model: 'geometric-placeholder-v1',
    async generate(request) {
      if (request.signal?.aborted) throw new ProviderError('aborted', COPY.aborted);
      const bytes = await encodeRgbaPng(MOCK_SIDE, MOCK_SIDE, placeholder(variation++));
      if (request.signal?.aborted) throw new ProviderError('aborted', COPY.aborted);
      return { bytes, mime: 'image/png' };
    },
  };
}
