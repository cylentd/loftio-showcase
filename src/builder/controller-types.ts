import type { FailureKind, BuilderFailure } from './provider.ts';
import type { BuilderRequest, GenerationStage } from './controller-model.ts';
import type { UserSelections } from './selections.ts';
import type { AltKind } from './alt-kind.ts';
import type { Element, Trait } from '../loadout/loadout-model.ts';
import type { AltReference, GeneratedImage, GenerationRecord, SavedCharacter } from './records.ts';
import type { ImageCheck } from './displayable-idle.ts';
import type { CharacterStore } from './store.ts';
import type { BuildTickets } from './tickets.ts';
import type { AltOperation, ExclusiveWrite } from './online-write.ts';

export type Dependencies = {
  api: BuilderApi;
  store: CharacterStore;
  newId: () => string;
  now: () => Date;
  inspect: (image: GeneratedImage) => Promise<ImageCheck>;
  journal?: { read(): BuilderRequest[]; add(request: BuilderRequest): void; remove(requestId: string): void };
  tickets?: Pick<BuildTickets, 'count' | 'spend' | 'refund' | 'settle'>;
  guardPaidRequests?: boolean;
  exclusive?: ExclusiveWrite;
  altOperation?: AltOperation;
  refillTickets?: () => void;
  joinSaved?: (savedId: string) => boolean;
  isJoined?: (savedId: string) => boolean;
  canJoin?: (savedId?: string) => boolean;
  rng?: () => number; // draws a reroll; Math.random unless a test injects one
};

export type { BuilderRequest, GenerationStage } from './controller-model.ts';
export type GenerateOutcome =
  // `names` is the server's themed-name pack, unchecked: the controller parses it again before it is stored.
  // `followUp` is the online worker's one-time token for the images drawn after the idle; other apis leave it out.
  | { ok: true; generation: GenerationRecord; image: GeneratedImage; usage?: { used: number; cap: number }; names?: unknown; followUp?: { token: string; ids: string[] } }
  | { ok: false; error: BuilderFailure };
export type StageListener = (stage: GenerationStage) => void;
/** One image drawn after the idle: which one, for which build, from which idle, and the online token when there is one. */
// `expression` is the expression image, sent only when its slot is ready; `kind`, `trait` and `element` are set for the alt alone.
export type FollowUpRequest = {
  id: string; requestId: string; image: GeneratedImage; token?: string;
  expression?: GeneratedImage; kind?: AltKind; trait?: Trait; element?: Element;
};
export type FollowUpOutcome =
  // `references`: the images the api really sent, when it knows (online drops the expression over the body max).
  | { ok: true; image: GeneratedImage; promptVersion: string; createdAt: string; references?: AltReference[] }
  | { ok: false; kind: FailureKind };
export type BuilderApi = {
  // Absent in the standalone harness: the resident then has no expression. Never spends or refunds a ticket.
  followUp?: (request: FollowUpRequest, signal?: AbortSignal) => Promise<FollowUpOutcome>;
  recoverAlt?: (request: FollowUpRequest, selections: UserSelections, verify: () => Promise<string>, signal?: AbortSignal) => Promise<FollowUpOutcome>;
  // Only an api whose worker keeps the slot (local) has this: a reloaded page polls it again. Online and mock lose their token.
  resumeFollowUp?: (request: FollowUpRequest, signal?: AbortSignal) => Promise<FollowUpOutcome>;
  generate(body: BuilderRequest, signal?: AbortSignal, onStage?: StageListener): Promise<GenerateOutcome>;
  observe?: (requestId: string, signal?: AbortSignal, onStage?: StageListener) => Promise<GenerateOutcome>;
  // Resolves false when the job had already finished or was preparing, so its result still arrives.
  cancel?: (requestId: string) => Promise<boolean>;
  prepare?: (requestId: string) => Promise<GenerateOutcome>;
};
export type { ImageCheck } from './displayable-idle.ts';
export type BuilderState = {
  status: 'idle' | 'generating' | 'ready' | 'failed';
  stage: GenerationStage;
  selections: UserSelections;
  preview: { generation: GenerationRecord; image: GeneratedImage; check: ImageCheck } | null;
  previewKept: boolean;
  saving: boolean;
  kept: SavedCharacter[];
  error: BuilderFailure | null;
  refineSupported: false;
  usage: { used: number; cap: number } | null;
  tickets: number | null; // null when this builder has no ticket store (the standalone harness)
  resumable: boolean; // the API has observe, so a failed request can be reattached instead of paid for again
  pendingJoinIds?: string[];
};
