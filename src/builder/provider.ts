export type FailureKind = 'invalid' | 'network' | 'safety' | 'corrupt' | 'aborted' | 'cap' | 'busy' | 'storage' | 'preparation' | 'tickets';
export type BuilderFailure = { kind: FailureKind; message: string };

export class ProviderError extends Error {
  readonly kind: FailureKind;
  constructor(kind: FailureKind, message: string) {
    super(message);
    this.name = 'ProviderError';
    this.kind = kind;
  }
}

export type ImageRequest = { prompt: string; referenceIds: readonly string[]; signal?: AbortSignal };
export type ImageProvider = {
  id: string;
  model: string;
  generate(request: ImageRequest): Promise<{ bytes: Uint8Array; mime: string }>;
};
