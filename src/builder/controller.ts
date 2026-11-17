import { ProviderError, type BuilderFailure } from './provider.ts';
import type { GeneratedImage, GenerationRecord, SavedCharacter } from './records.ts';
import { validateSelections, type UserSelections, type SelectionField } from './selections.ts';
import type { CharacterStore } from './store.ts';
import { COPY } from './copy.ts';
import type { BuildTickets } from './tickets.ts';
import { canCreate, initial, next, retryMode } from './controller-model.ts';
import type { BuilderRequest, GenerationStage, Life, LifeEvent, RunMode } from './controller-model.ts';

export type { BuilderRequest, GenerationStage } from './controller-model.ts';
export type GenerateOutcome =
  | { ok: true; generation: GenerationRecord; image: GeneratedImage; usage?: { used: number; cap: number } }
  | { ok: false; error: BuilderFailure };
export type StageListener = (stage: GenerationStage) => void;
export type BuilderApi = {
  generate(body: BuilderRequest, signal?: AbortSignal, onStage?: StageListener): Promise<GenerateOutcome>;
  observe?: (requestId: string, signal?: AbortSignal, onStage?: StageListener) => Promise<GenerateOutcome>;
  // Resolves false when the job had already finished or was preparing, so its result still arrives.
  cancel?: (requestId: string) => Promise<boolean>;
  prepare?: (requestId: string) => Promise<GenerateOutcome>;
};
export type ImageCheck = { verdict: string; marginOk?: boolean };
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
};

type Dependencies = {
  api: BuilderApi;
  store: CharacterStore;
  newId: () => string;
  now: () => Date;
  inspect: (image: GeneratedImage) => Promise<ImageCheck>;
  journal?: { read(): BuilderRequest[]; add(request: BuilderRequest): void; remove(requestId: string): void };
  tickets?: Pick<BuildTickets, 'count' | 'spend' | 'refund' | 'settle'>;
};

// What the visitor sees besides the lifecycle: the lifecycle itself (status, stage, error, saving, whether the
// preview was kept) lives in `Life`, and `state()` joins the two.
type Shown = Pick<BuilderState, 'selections' | 'preview' | 'kept' | 'usage'>;
type Preview = NonNullable<BuilderState['preview']>;

// The worker answers these before any image is attempted, so the request's ticket comes back.
const REFUNDED = new Set(['invalid', 'cap', 'busy']);
const sameSelections = (a: UserSelections, b: UserSelections) => JSON.stringify(a) === JSON.stringify(b);

function savedRecord(preview: Preview, keptAt: string): SavedCharacter {
  const generation = preview.generation;
  return structuredClone({
    schemaVersion: 2, id: generation.id, state: 'kept', generationId: generation.id,
    userSelections: generation.userSelections, resolvedSelections: generation.resolvedSelections,
    promptVersion: generation.promptVersion, providerModelId: generation.providerId + '/' + generation.modelId,
    referenceIds: generation.referenceIds, image: preview.image, generation,
    keptAt, parentId: null, identityNotes: null,
  });
}

// Side effects only. Every change of lifecycle is an event sent to `next` (controller-model.ts), which says whether it
// is allowed; an answer from a run that is no longer the live one is refused there.
class BuilderController {
  private life: Life;
  private shown: Shown;
  private dependencies: Dependencies;
  private abort: { run: number; controller: AbortController } | null = null; // the live run's way to stop its request
  private pendingSave: Promise<void> | null = null; // so a second Keep waits on the first
  private background: Promise<void> = Promise.resolve();
  private listeners = new Set<() => void>();

  constructor(dependencies: Dependencies, selections: UserSelections) {
    this.dependencies = dependencies;
    this.life = initial({ observable: !!dependencies.api.observe, preparable: !!dependencies.api.prepare });
    this.shown = { selections: structuredClone(selections), preview: null, kept: [], usage: null };
  }

  // The count is read live, so a spend in another tab shows here too. Unreadable storage counts as none.
  state(): BuilderState {
    const { life } = this;
    return {
      ...structuredClone({
        ...this.shown, status: life.status, stage: life.stage, error: life.error, saving: life.saving,
        previewKept: life.preview === 'kept',
      }),
      refineSupported: false, tickets: this.ticketCount(), resumable: life.observable,
    };
  }

  private ticketCount() {
    const tickets = this.dependencies.tickets;
    if (!tickets) return null;
    try { return tickets.count(); } catch { return 0; }
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private notify() {
    for (const listener of this.listeners) listener();
  }

  // Shown data that no lifecycle rule reads (the saved list, the picks on resume).
  private update(changes: Partial<Shown>) {
    this.shown = { ...this.shown, ...changes };
    this.notify();
  }

  // The one way a lifecycle changes. A refused event changes nothing, tells nobody and returns false.
  private send(event: LifeEvent, changes: Partial<Shown> = {}) {
    const to = next(this.life, event);
    if (to === this.life) return false;
    this.life = to;
    this.shown = { ...this.shown, ...changes };
    this.notify();
    return true;
  }

  // The end of a run, by `fail` or `ready`. A stale run's end is refused and leaves the live run's handle alone.
  private end(event: Extract<LifeEvent, { run: number }>, changes: Partial<Shown> = {}) {
    if (!this.send(event, changes)) return;
    if (this.abort?.run === event.run) this.abort = null;
  }

  private storageFailure(): BuilderFailure { return { kind: 'storage', message: COPY.storage }; }

  select(field: SelectionField, value: string | null) {
    if (!canCreate(this.life)) return;
    const result = validateSelections({ ...this.shown.selections, [field]: value });
    if (result.ok) this.send({ type: 'select' }, { selections: result.value });
  }

  async create() {
    if (!canCreate(this.life)) return;
    const retry = retryMode(this.life);
    const held = this.life.request;
    if (retry && held && sameSelections(held.selections, this.shown.selections)) return this.run(held, retry);
    const validated = validateSelections(this.shown.selections);
    if (!validated.ok) { this.send({ type: 'reject', error: { kind: 'invalid', message: COPY.invalid } }); return; }
    const request = { requestId: this.dependencies.newId(), selections: validated.value };
    // Every new image costs a ticket, spent before dispatch; reattaching to a request never spends again.
    try {
      if (this.dependencies.tickets && !this.dependencies.tickets.spend(request.requestId)) {
        this.send({ type: 'reject', error: { kind: 'tickets', message: COPY.tickets } }); return;
      }
    } catch { this.send({ type: 'reject', error: this.storageFailure() }); return; }
    try { this.dependencies.journal?.add(request); }
    catch { this.giveBack(request); this.send({ type: 'reject', error: this.storageFailure() }); return; }
    return this.run(request, 'generate');
  }

  // Starts a run, or returns null when the model refuses (a run is live, or the builder is disposed). The run's
  // abort handle is in place before anyone is told, so a listener that cancels reaches it.
  private begin(mode: RunMode, request: BuilderRequest) {
    const to = next(this.life, { type: 'start', mode, request });
    if (to === this.life) return null;
    const controller = new AbortController();
    this.abort = { run: to.run!, controller };
    this.life = to;
    this.notify();
    return { run: to.run!, signal: controller.signal };
  }

  private async run(request: BuilderRequest, mode: RunMode) {
    const started = this.begin(mode, request);
    if (!started) return;
    const { run } = started;
    try {
      await this.attempt(run, started.signal, request, mode);
    } catch (error) {
      const kind = error instanceof ProviderError ? error.kind : 'network';
      if (kind === 'corrupt') this.forget(request); // Undecodable for good; retrying cannot help.
      this.end({ type: 'fail', run, error: { kind, message: COPY[kind] } });
    }
  }

  private async attempt(run: number, signal: AbortSignal, request: BuilderRequest, mode: RunMode) {
    const api = this.dependencies.api;
    const onStage: StageListener = stage => { this.send({ type: 'stage', run, stage }); };
    let result = await (mode === 'prepare' ? api.prepare!(request.requestId)
      : mode === 'observe' ? api.observe!(request.requestId, signal, onStage) : api.generate(request, signal, onStage));
    if (!this.isLive(run)) return;
    // A busy worker refused only the retry; the image is still waiting for preparation.
    if (mode === 'prepare' && !result.ok && result.error.kind === 'busy') {
      result = { ok: false, error: { kind: 'preparation', message: result.error.message } };
    }
    if (!result.ok) {
      if (mode === 'generate' && REFUNDED.has(result.error.kind)) this.giveBack(request);
      if (result.error.kind !== 'preparation') this.forget(request);
      this.end({ type: 'fail', run, error: result.error });
      return;
    }
    await this.finish(run, request, result);
  }

  // The image arrived: check it, save it as a draft when the journal makes it durable, then show it.
  private async finish(run: number, request: BuilderRequest, result: Extract<GenerateOutcome, { ok: true }>) {
    let check: ImageCheck;
    try { check = await this.dependencies.inspect(result.image); }
    catch (error) { throw error instanceof ProviderError ? error : new ProviderError('corrupt', COPY.corrupt); }
    if (!this.isLive(run)) return;
    const preview = { generation: result.generation, image: result.image, check };
    const existing = this.shown.kept.find(item => item.generationId === result.generation.id);
    if (this.dependencies.journal && !existing) {
      const draft = savedRecord(preview, this.dependencies.now().toISOString());
      draft.state = 'draft';
      try { await this.dependencies.store.put(draft); }
      catch { throw new ProviderError('storage', COPY.storage); }
      this.update({ kept: [...this.shown.kept, draft] });
    }
    this.forget(request);
    if (!this.isLive(run)) return;
    this.end({ type: 'ready', run, kept: existing?.state === 'kept' }, { preview, usage: result.usage ?? null });
  }

  private isLive(run: number) { return this.life.run === run; }

  tryAnother() { return this.create(); }

  reconnect() {
    const retry = retryMode(this.life);
    return retry ? this.run(this.life.request!, retry) : Promise.resolve();
  }

  cancel() {
    const to = next(this.life, { type: 'cancel' });
    if (to === this.life) return;
    const request = this.life.request;
    this.stopRun();
    if (request && this.dependencies.api.cancel) {
      this.background = this.dependencies.api.cancel(request.requestId).then(cancelled => {
        if (cancelled || !this.life.observable) return this.forget(request);
        // Already finished or preparing: collect the result as a draft. If another run has started, the model
        // refuses this one: the request stays journaled and the next resume() collects it.
        return this.run(request, 'observe');
      }, () => { this.send({ type: 'note', error: { kind: 'network', message: COPY.network } }); });
    }
    this.life = to;
    this.notify();
  }

  // Teardown (the page is going away). The live run stops; its request stays journaled so the next boot's resume()
  // collects it, and the worker is not told to cancel. Nothing changes or notifies afterwards.
  dispose() {
    const to = next(this.life, { type: 'dispose' });
    if (to === this.life) return;
    this.stopRun();
    this.life = to;
    this.listeners.clear();
  }

  private stopRun() {
    this.abort?.controller.abort();
    this.abort = null;
  }

  settled() { return this.background; }

  private forget(request: BuilderRequest) {
    this.dependencies.journal?.remove(request.requestId);
    this.life = next(this.life, { type: 'forget', requestId: request.requestId });
    // Finished, made or not: the ticket stays spent. Unwritable storage leaves it open, never refunded twice.
    try { this.dependencies.tickets?.settle(request.requestId); } catch { /* see above */ }
  }

  // Nothing was made. If storage can't record the refund the ticket stays spent; it never mints an extra one.
  private giveBack(request: BuilderRequest) {
    try { this.dependencies.tickets?.refund(request.requestId); } catch { /* see above */ }
  }

  keep() {
    if (this.pendingSave) return this.pendingSave;
    this.pendingSave = this.savePreview().finally(() => { this.pendingSave = null; });
    return this.pendingSave;
  }

  private async savePreview() {
    const preview = this.shown.preview;
    if (!preview || !this.send({ type: 'save' })) return;
    try {
      const resident = savedRecord(preview, this.dependencies.now().toISOString());
      await this.dependencies.store.put(resident);
      const kept = [...this.shown.kept.filter(item => item.id !== resident.id), resident];
      this.send({ type: 'saved' }, { kept });
    } catch {
      this.send({ type: 'saveFailed', error: this.storageFailure() });
    }
  }

  // Saved residents only; never waits on a pending job, so the room can restore at once.
  async load() {
    try {
      const records = await this.dependencies.store.list();
      const unique = new Map([...records, ...this.shown.kept].map(item => [item.id, item]));
      this.update({ kept: [...unique.values()] });
    } catch { this.send({ type: 'note', error: this.storageFailure() }); }
  }

  // Reattaches to each pending request in turn, oldest first. Never dispatches a new generation.
  resume() {
    const work = (async () => {
      let pending: BuilderRequest[];
      try { pending = this.dependencies.journal?.read() ?? []; }
      catch { this.send({ type: 'note', error: this.storageFailure() }); return; }
      for (const request of pending) {
        if (!this.life.observable || next(this.life, { type: 'start', mode: 'observe', request }) === this.life) return;
        this.update({ selections: request.selections });
        await this.run(request, 'observe');
      }
    })();
    this.background = work;
    return work;
  }
}

export function createBuilder(dependencies: Dependencies, selections: UserSelections) {
  return new BuilderController(dependencies, selections);
}
