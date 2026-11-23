import type { BuilderApi, GenerateOutcome } from './controller.ts';
import { createGenerateHandler } from './server/generate-handler.ts';
import { mockAlt, mockExpression, mockProvider } from './mock-provider.ts';
import { EXPRESSION_PROMPT_VERSION } from './expression-prompt.ts';
import { ALT_PROMPT_VERSION } from './alt-prompt.ts';
import { ALT_ID, DEFAULT_LIMITS } from './constants.ts';

export function mockApi(dependencies: {
  rng: () => number; now: () => Date; newId: () => string;
} = { rng: Math.random, now: () => new Date(), newId: () => crypto.randomUUID() }): BuilderApi {
  const handle = createGenerateHandler({
    provider: mockProvider(), ...dependencies, limits: DEFAULT_LIMITS,
  });
  let drawn = 0;
  return {
    // The mock expression and alt are drawn locally, past the latest idle's palette step (the alt is opaque); no worker is involved.
    async followUp(request) {
      const alt = request.id === ALT_ID;
      const { bytes } = await (alt ? mockAlt : mockExpression)(Math.max(drawn - 1, 0));
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      const { width, height } = request.image;
      return { ok: true, image: { base64: btoa(binary), mime: 'image/png', width, height, hasAlphaChannel: !alt },
        promptVersion: alt ? ALT_PROMPT_VERSION : EXPRESSION_PROMPT_VERSION, createdAt: dependencies.now().toISOString() };
    },
    async generate(body, signal): Promise<GenerateOutcome> {
      drawn++;
      const response = await handle(new Request('http://local/api/builder/generate', {
        method: 'POST', body: JSON.stringify(body), signal,
      }));
      return response.json();
    },
  };
}
