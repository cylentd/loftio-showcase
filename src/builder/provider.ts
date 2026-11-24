export type FailureKind = 'invalid' | 'network' | 'safety' | 'corrupt' | 'aborted' | 'cap' | 'busy' | 'storage' | 'preparation' | 'tickets';
export type BuilderFailure = { kind: FailureKind | 'loft-full' | 'loft-pending'; message: string; dispatch?: 'not-sent' | 'unresolved' };

export class ProviderError extends Error {
  readonly kind: FailureKind;
  constructor(kind: FailureKind, message: string) {
    super(message);
    this.name = 'ProviderError';
    this.kind = kind;
  }
}

// The text seam: one request for the themed-name pack (#442 P2). The reply is untrusted JSON; the caller parses it.
export type NamePackRequest = { prompt: string; signal?: AbortSignal };
export type NamePackProvider = {
  id: string;
  model: string;
  generate(request: NamePackRequest): Promise<unknown>;
};

// A build names catalog `referenceIds`. A follow-up names none and sends the earlier images instead: their bytes (online, the idle
// the browser sent back) or absolute file paths (the local worker, the idle's original.png).
export type ImageRequest = {
  prompt: string;
  referenceIds: readonly string[];
  referenceImages?: Uint8Array[];
  referencePaths?: string[];
  /** True for a follow-up drawn as an opaque painting (its FollowUpDef has alphaRequired: false), such as the alt art. */
  opaque?: boolean;
  signal?: AbortSignal;
};
export type ImageProvider = {
  id: string;
  model: string;
  generate(request: ImageRequest): Promise<{ bytes: Uint8Array; mime: string }>;
};
