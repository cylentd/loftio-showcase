import type { BuilderApi, GenerateOutcome } from './controller.ts';
import { createGenerateHandler } from './server/generate-handler.ts';
import { mockProvider } from './mock-provider.ts';
import { DEFAULT_LIMITS } from './constants.ts';

export function mockApi(dependencies: {
  rng: () => number; now: () => Date; newId: () => string;
} = { rng: Math.random, now: () => new Date(), newId: () => crypto.randomUUID() }): BuilderApi {
  const handle = createGenerateHandler({
    provider: mockProvider(), ...dependencies, limits: DEFAULT_LIMITS,
  });
  return {
    async generate(body, signal): Promise<GenerateOutcome> {
      const response = await handle(new Request('http://local/api/builder/generate', {
        method: 'POST', body: JSON.stringify(body), signal,
      }));
      return response.json();
    },
  };
}
