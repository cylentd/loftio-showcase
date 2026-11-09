import { ProviderError, type ImageProvider } from './provider.ts';
import { MOCK_SIDE } from './constants.ts';
import { MOCK_ART } from './mock-data.ts';
import { encodeRgbaPng } from './png.ts';
import { COPY } from './copy.ts';

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
