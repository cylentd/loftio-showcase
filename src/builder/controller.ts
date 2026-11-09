import { ProviderError, type BuilderFailure } from './provider.ts';
import type { GeneratedImage, GenerationRecord, SavedCharacter } from './records.ts';
import { validateSelections, type UserSelections, type SelectionField } from './selections.ts';
import type { CharacterStore } from './store.ts';
import { COPY } from './copy.ts';
import type { BuildTickets } from './tickets.ts';

export type GenerateOutcome =
  | { ok: true; generation: GenerationRecord; image: GeneratedImage; usage?: { used: number; cap: number } }
  | { ok: false; error: BuilderFailure };
export type BuilderRequest = { requestId: string; selections: UserSelections };
export type GenerationStage = 'creating' | 'preparing';
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

type RunMode = 'generate' | 'observe' | 'prepare';
// The worker answers these before any image is attempted, so the request's ticket comes back.
const REFUNDED = new Set(['invalid', 'cap', 'busy']);
const sameSelections = (a: UserSelections, b: UserSelections) => JSON.stringify(a) === JSON.stringify(b);

function savedRecord(preview: NonNullable<BuilderState['preview']>, keptAt: string): SavedCharacter {
  const generation = preview.generation;
  return structuredClone({
    schemaVersion: 2, id: generation.id, state: 'kept', generationId: generation.id,
    userSelections: generation.userSelections, resolvedSelections: generation.resolvedSelections,
    promptVersion: generation.promptVersion, providerModelId: generation.providerId + '/' + generation.modelId,
    referenceIds: generation.referenceIds, image: preview.image, generation,
    keptAt, parentId: null, identityNotes: null,
  });
}

class BuilderController {
  private current: BuilderState;
  private dependencies: Dependencies;
  private active: AbortController | null = null;
  private request: BuilderRequest | null = null;
  private saving: Promise<void> | null = null;
  private background: Promise<void> = Promise.resolve();
  private listeners = new Set<() => void>();

  constructor(dependencies: Dependencies, selections: UserSelections) {
    this.dependencies = dependencies;
    this.current = {
      status: 'idle', stage: 'creating', selections: structuredClone(selections), preview: null, previewKept: false,
      saving: false, kept: [], error: null, refineSupported: false, usage: null, tickets: null,
    };
  }

  // The count is read live, so a spend in another tab shows here too. Unreadable storage counts as none.
  state() { return { ...structuredClone(this.current), tickets: this.ticketCount() }; }

  private ticketCount() {
    const tickets = this.dependencies.tickets;
    if (!tickets) return null;
    try { return tickets.count(); } catch { return 0; }
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private update(changes: Partial<BuilderState>) {
    this.current = { ...this.current, ...changes };
    for (const listener of this.listeners) listener();
  }

  select(field: SelectionField, value: string | null) {
    if (this.current.status === 'generating' || this.current.saving) return;
    const result = validateSelections({ ...this.current.selections, [field]: value });
    if (result.ok) this.update({ selections: result.value, error: null });
  }

  async create() {
    if (this.current.status === 'generating' || this.current.saving) return;
    const retry = this.retryMode();
    if (retry && sameSelections(this.request!.selections, this.current.selections)) return this.run(this.request!, retry);
    const validated = validateSelections(this.current.selections);
    if (!validated.ok) {
      this.update({ status: 'failed', error: { kind: 'invalid', message: COPY.invalid } });
      return;
    }
    const request = { requestId: this.dependencies.newId(), selections: validated.value };
    // Every new image costs a ticket, spent before dispatch; reattaching to a request never spends again.
    try {
      if (this.dependencies.tickets && !this.dependencies.tickets.spend(request.requestId)) {
        this.update({ status: 'failed', error: { kind: 'tickets', message: COPY.tickets } }); return;
      }
    } catch { this.update({ status: 'failed', error: { kind: 'storage', message: COPY.storage } }); return; }
    try { this.dependencies.journal?.add(request); }
    catch { this.giveBack(request); this.update({ status: 'failed', error: { kind: 'storage', message: COPY.storage } }); return; }
    return this.run(request, 'generate');
  }

  // Only a lost connection, a failed draft save or a failed preparation can be resumed:
  // in those cases the paid image may still arrive. Every other failure starts afresh.
  private retryMode(): RunMode | null {
    if (!this.request || this.current.status !== 'failed' || !this.dependencies.api.observe) return null;
    const kind = this.current.error?.kind;
    return kind === 'preparation' && this.dependencies.api.prepare ? 'prepare' : kind === 'network' || kind === 'storage' ? 'observe' : null;
  }

  private async run(request: BuilderRequest, mode: RunMode) {
    this.request = request;
    const controller = new AbortController();
    this.active = controller;
    this.update({ status: 'generating', stage: mode === 'prepare' ? 'preparing' : 'creating', error: null });
    try {
      const api = this.dependencies.api;
      const onStage: StageListener = stage => { if (this.active === controller) this.update({ stage }); };
      let result = await (mode === 'prepare' ? api.prepare!(request.requestId)
        : mode === 'observe' ? api.observe!(request.requestId, controller.signal, onStage) : api.generate(request, controller.signal, onStage));
      if (this.active !== controller) return;
      // A busy worker refused only the retry; the image is still waiting for preparation.
      if (mode === 'prepare' && !result.ok && result.error.kind === 'busy') {
        result = { ok: false, error: { kind: 'preparation', message: result.error.message } };
      }
      if (!result.ok) {
        if (mode === 'generate' && REFUNDED.has(result.error.kind)) this.giveBack(request);
        if (result.error.kind !== 'preparation') this.forget(request);
        this.update({ status: 'failed', error: result.error }); return;
      }
      let check: ImageCheck;
      try { check = await this.dependencies.inspect(result.image); }
      catch (error) { throw error instanceof ProviderError ? error : new ProviderError('corrupt', COPY.corrupt); }
      if (this.active !== controller) return;
      const preview = { generation: result.generation, image: result.image, check };
      const existing = this.current.kept.find(item => item.generationId === result.generation.id);
      if (this.dependencies.journal && !existing) {
        const draft = savedRecord(preview, this.dependencies.now().toISOString());
        draft.state = 'draft';
        try { await this.dependencies.store.put(draft); }
        catch { throw new ProviderError('storage', COPY.storage); }
        this.update({ kept: [...this.current.kept, draft] });
      }
      this.forget(request);
      if (this.active !== controller) return;
      this.update({ status: 'ready', preview, previewKept: existing?.state === 'kept', usage: result.usage ?? null });
    } catch (error) {
      const kind = error instanceof ProviderError ? error.kind : 'network';
      if (kind === 'corrupt') this.forget(request); // Undecodable for good; retrying cannot help.
      if (this.active === controller) this.update({ status: 'failed', error: { kind, message: COPY[kind] } });
    } finally {
      if (this.active === controller) this.active = null;
    }
  }

  tryAnother() { return this.create(); }

  reconnect() {
    const retry = this.retryMode();
    return retry && !this.active ? this.run(this.request!, retry) : Promise.resolve();
  }

  cancel() {
    const previous = this.active;
    this.active = null;
    previous?.abort();
    const request = this.request;
    if (previous && request && this.dependencies.api.cancel) {
      this.background = this.dependencies.api.cancel(request.requestId).then(cancelled => {
        if (cancelled || !this.dependencies.api.observe) return this.forget(request);
        // Already finished or preparing: collect the result as a draft. If another run has
        // started, the request stays journaled and the next resume() collects it.
        if (!this.active) return this.run(request, 'observe');
      }, () => this.update({ error: { kind: 'network', message: COPY.network } }));
    }
    if (previous) this.update({ status: this.current.preview ? 'ready' : 'idle', error: null });
  }

  settled() { return this.background; }

  private forget(request: BuilderRequest) {
    this.dependencies.journal?.remove(request.requestId);
    if (this.request === request) this.request = null;
    // Finished, made or not: the ticket stays spent. Unwritable storage leaves it open, never refunded twice.
    try { this.dependencies.tickets?.settle(request.requestId); } catch { /* see above */ }
  }

  // Nothing was made. If storage can't record the refund the ticket stays spent; it never mints an extra one.
  private giveBack(request: BuilderRequest) {
    try { this.dependencies.tickets?.refund(request.requestId); } catch { /* see above */ }
  }

  keep() {
    if (this.saving) return this.saving;
    this.saving = this.savePreview().finally(() => { this.saving = null; });
    return this.saving;
  }

  private async savePreview() {
    const preview = this.current.preview;
    if (!preview || this.current.previewKept || this.current.saving || this.current.status === 'generating') return;
    this.update({ saving: true, error: null });
    try {
      const resident = savedRecord(preview, this.dependencies.now().toISOString());
      await this.dependencies.store.put(resident);
      const kept = [...this.current.kept.filter(item => item.id !== resident.id), resident];
      this.update({ kept, previewKept: true });
    } catch {
      this.update({ error: { kind: 'storage', message: COPY.storage } });
    } finally {
      this.update({ saving: false });
    }
  }

  // Saved residents only; never waits on a pending job, so the room can restore at once.
  async load() {
    try {
      const records = await this.dependencies.store.list();
      const unique = new Map([...records, ...this.current.kept].map(item => [item.id, item]));
      this.update({ kept: [...unique.values()] });
    } catch { this.update({ error: { kind: 'storage', message: COPY.storage } }); }
  }

  // Reattaches to each pending request in turn, oldest first. Never dispatches a new generation.
  resume() {
    const work = (async () => {
      let pending: BuilderRequest[];
      try { pending = this.dependencies.journal?.read() ?? []; }
      catch { this.update({ error: { kind: 'storage', message: COPY.storage } }); return; }
      for (const request of pending) {
        if (this.active || !this.dependencies.api.observe) return;
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
