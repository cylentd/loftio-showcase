/** The builder's lifecycle as one state and one pure transition function (docs/architecture/STATE-MACHINES.md, G5).
 *  No DOM, no storage, no network: `BuilderController` keeps the side effects, sends this model an event for every
 *  change and acts on what comes back. A refused event returns the very same object.
 *
 *  A run is one attempt to reach an image (generate, observe or prepare). Each gets a fresh id, and every event a run
 *  sends back carries it, so an answer from a run that was cancelled, replaced or disposed is refused here instead of
 *  being checked by identity at each await in the controller. */
import type { BuilderFailure } from './provider.ts';
import type { UserSelections } from './selections.ts';

export type BuilderRequest = { requestId: string; selections: UserSelections };
export type GenerationStage = 'creating' | 'preparing';
export type RunMode = 'generate' | 'observe' | 'prepare';
export type PreviewKind = 'none' | 'fresh' | 'kept';

export type Life = {
  readonly status: 'idle' | 'generating' | 'ready' | 'failed';
  readonly stage: GenerationStage;
  readonly error: BuilderFailure | null;
  /** A Keep is writing the preview to the store. */
  readonly saving: boolean;
  /** Whether a preview is shown, and whether it has been kept. */
  readonly preview: PreviewKind;
  /** The live run's id; null exactly while no run is live. */
  readonly run: number | null;
  /** The id of the last run started. Ids only grow, so a dead run's id never matches a live one. */
  readonly runs: number;
  /** The request held for a retry: journaled until its image is stored, or it fails for good. */
  readonly request: BuilderRequest | null;
  /** The API has `observe`, so a failed request can be reattached. */
  readonly observable: boolean;
  /** The API has `prepare`. */
  readonly preparable: boolean;
  /** The builder was torn down; nothing changes after. */
  readonly disposed: boolean;
};

export type LifeEvent =
  /** The visitor changed a pick. */
  | { type: 'select' }
  /** A create failed before any run started (invalid picks, no ticket, unwritable storage). */
  | { type: 'reject'; error: BuilderFailure }
  | { type: 'start'; mode: RunMode; request: BuilderRequest }
  | { type: 'stage'; run: number; stage: GenerationStage }
  | { type: 'fail'; run: number; error: BuilderFailure }
  /** `kept`: the finished image was already saved as a resident. */
  | { type: 'ready'; run: number; kept: boolean }
  | { type: 'cancel' }
  /** The request's work is over: it leaves the journal, so no retry holds it. */
  | { type: 'forget'; requestId: string }
  /** A problem to show that does not move the status (a failed cancel, a failed load). */
  | { type: 'note'; error: BuilderFailure }
  | { type: 'save' }
  | { type: 'saved' }
  | { type: 'saveFailed'; error: BuilderFailure }
  | { type: 'dispose' };

export function initial(api: { observable: boolean; preparable: boolean }): Life {
  return {
    status: 'idle', stage: 'creating', error: null, saving: false, preview: 'none', run: null, runs: 0, request: null,
    observable: api.observable, preparable: api.preparable, disposed: false,
  };
}

/** A new request, a change of picks or a reject may begin: no run live, no save running, not disposed. */
export const canCreate = (life: Life) => !life.disposed && life.status !== 'generating' && !life.saving;

/** How a failed request may be resumed without paying again, or null when it starts afresh. Only a lost connection,
 *  a failed draft save or a failed preparation can be resumed: the paid image may still arrive. */
export function retryMode(life: Life): RunMode | null {
  if (!life.request || life.status !== 'failed' || !life.observable) return null;
  const kind = life.error?.kind;
  if (kind === 'preparation' && life.preparable) return 'prepare';
  return kind === 'network' || kind === 'storage' ? 'observe' : null;
}

const settledStatus = (life: Life): Life['status'] => (life.preview === 'none' ? 'idle' : 'ready');
const isLive = (life: Life, run: number) => life.run === run;

/** The next life, or `life` itself when the event is refused from this state. */
export function next(life: Life, event: LifeEvent): Life {
  if (life.disposed) return life;
  switch (event.type) {
    case 'select': return canCreate(life) ? { ...life, error: null } : life;
    case 'reject': return canCreate(life) ? { ...life, status: 'failed', error: event.error } : life;
    case 'start': return start(life, event.mode, event.request);
    case 'stage': return isLive(life, event.run) ? { ...life, stage: event.stage } : life;
    case 'fail': return isLive(life, event.run) ? { ...life, status: 'failed', error: event.error, run: null } : life;
    case 'ready':
      return isLive(life, event.run) ? { ...life, status: 'ready', run: null, preview: event.kept ? 'kept' : 'fresh' } : life;
    case 'cancel': return life.run === null ? life : { ...life, status: settledStatus(life), run: null, error: null };
    case 'forget': return life.request?.requestId === event.requestId ? { ...life, request: null } : life;
    case 'note': return { ...life, error: event.error };
    case 'save': return life.preview === 'fresh' && canCreate(life) ? { ...life, saving: true, error: null } : life;
    case 'saved': return life.saving ? { ...life, saving: false, preview: 'kept' } : life;
    case 'saveFailed': return life.saving ? { ...life, saving: false, error: event.error } : life;
    case 'dispose':
      return { ...life, disposed: true, run: null, status: life.run === null ? life.status : settledStatus(life) };
  }
}

// A new request waits for a save to finish, so a keep and a create never overlap. Reattaching to a request already
// paid for does not: a boot-time resume or a collect after a cancel may start while a save is still writing.
function start(life: Life, mode: RunMode, request: BuilderRequest): Life {
  if (life.run !== null || (mode === 'generate' && life.saving)) return life;
  const run = life.runs + 1;
  return { ...life, status: 'generating', stage: mode === 'prepare' ? 'preparing' : 'creating', error: null, run, runs: run, request };
}
