import { followUpRequest, recoverSavedAlt, SharedAltRecovery, type FollowUpBase } from './recover-saved-alt.ts';
import { backfillLoadout, newLoadout, parseLoadout, type Loadout } from '../loadout/loadout-model.ts';
import { parseNamePack, type NamePack } from '../loadout/loadout-name-model.ts';
import { ProviderError, type BuilderFailure, type FailureKind } from './provider.ts';
import { FOLLOW_UPS, type FollowUpDef } from './follow-ups.ts';
import { altKindFor } from './alt-kind.ts';
import { ALT_ID } from './constants.ts';
import { failPending, freshSlots, settleSlot, slotFields, slotOf, slotsOf, type SlotSet } from './follow-up-slots.ts';
import type { GeneratedImage, SavedCharacter } from './records.ts';
import { backfillRecord, durableSlots, keepRecord, putGeneratedRecord, rerollRecord, savedRecord, showPendingSlots, writeSharedSlots } from './saved-record-write.ts';
import { validateSelections, type UserSelections, type SelectionField } from './selections.ts';
import { COPY } from './copy.ts';
import { paidJournalFailure, paidOutcomeFailure, settleBuild } from './journal.ts';
import { admitBuild } from './admit-build.ts';
import { canCreate, initial, next, retryMode } from './controller-model.ts';
import { commitLoftJoin, pendingLoftJoins } from './loft-join.ts';
import { displayableIdle, type ImageCheck } from './displayable-idle.ts';
import type { BuilderRequest, GenerationStage, Life, LifeEvent, RunMode } from './controller-model.ts';

import type { BuilderState, Dependencies, FollowUpOutcome, FollowUpRequest, GenerateOutcome, StageListener } from './controller-types.ts';
export type { BuilderApi, BuilderRequest, BuilderState, FollowUpOutcome, FollowUpRequest, GenerateOutcome, GenerationStage, ImageCheck, StageListener } from './controller-types.ts';
// What the visitor sees besides the lifecycle: the lifecycle itself (status, stage, error, saving, whether the
// preview was kept) lives in `Life`, and `state()` joins the two.
type Shown = Pick<BuilderState, 'selections' | 'preview' | 'kept' | 'usage' | 'pendingJoinIds'>;

// The worker answers these before any image is attempted, so the request's ticket comes back.
const REFUNDED = new Set(['invalid', 'cap', 'busy']);
const sameSelections = (a: UserSelections, b: UserSelections) => JSON.stringify(a) === JSON.stringify(b);

// A follow-up that must be transparent (its entry's `alphaRequired`) is checked on its pixels when a PNG; a webp artifact was
// checked by the worker.
const OPAQUE: FollowUpOutcome = { ok: false, kind: 'corrupt' };

// What every follow-up request of one build shares; each entry adds its own id and references.
type FollowUpCall = (request: FollowUpRequest, signal: AbortSignal) => Promise<FollowUpOutcome>;

// The loadout with the build's name pack on it; no pack leaves the loadout as it is, with no `names` key.
const withNames = (loadout: Loadout, names: NamePack | null): Loadout => (names ? { ...loadout, names } : loadout);

// A record that has no valid loadout (saved before loadouts existed, or damaged) gets the one rolled from its id.
const needsLoadout = (item: SavedCharacter) => parseLoadout(item.rumble) === null;

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
  private rerolls = new Map<string, Promise<Loadout | null>>(); // per record id: a second reroll shares the one saving
  private packs = new Map<string, NamePack>(); // per generation id: the checked name pack, for a Keep that has no draft
  private slots = new Map<string, SlotSet>(); // per generation id: the follow-up slots, the one home for a Keep or reroll that races them
  private followUps = new Set<Promise<void>>();
  private disposed = false;
  private followUpAbort = new AbortController();
  private sharedAlt = new SharedAltRecovery();

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
    if (this.dependencies.joinSaved) {
      const [pending] = pendingLoftJoins(this.shown.kept, this.dependencies.journal);
      if (pending) return this.collectJoin(pending.request, pending.saved);
      if (this.shown.pendingJoinIds?.length) {
        this.send({ type: 'reject', error: { kind: 'storage', message: COPY.reloadJoin, dispatch: 'not-sent' } }); return;
      }
    }
    const retry = retryMode(this.life);
    const held = this.life.request;
    if (retry && held && sameSelections(held.selections, this.shown.selections)) return this.run(held, retry);
    const admit = () => canCreate(this.life) ? admitBuild(this.dependencies, this.shown.selections) : null;
    try {
      const admission = this.dependencies.exclusive ? await this.dependencies.exclusive(admit) : admit();
      if (!admission) return;
      if (admission.error) { this.send({ type: 'reject', error: admission.error }); return; }
      return this.run(admission.request, 'generate');
    } catch (error) {
      const failure = error instanceof ProviderError ? { kind: error.kind, message: error.message } : this.storageFailure();
      this.send({ type: 'reject', error: { ...failure, dispatch: 'not-sent' } });
    }
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
      let kind = error instanceof ProviderError ? error.kind : 'network';
      try { if (kind === 'corrupt') await this.forget(request); }
      catch { kind = 'storage'; }
      const failure = { kind, message: COPY[kind] };
      this.end({ type: 'fail', run, error: this.dependencies.guardPaidRequests ? paidOutcomeFailure(failure) : failure });
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
      const error = this.dependencies.guardPaidRequests ? paidOutcomeFailure(result.error) : result.error;
      if (error.kind !== 'preparation' && !(this.dependencies.guardPaidRequests && error.dispatch === 'unresolved')) {
        await this.forget(request, mode === 'generate' && REFUNDED.has(error.kind));
      }
      this.end({ type: 'fail', run, error });
      return;
    }
    await this.finish(run, request, result);
  }

  private async finish(run: number, request: BuilderRequest, result: Extract<GenerateOutcome, { ok: true }>) {
    let check: ImageCheck;
    try { check = await this.dependencies.inspect(result.image); }
    catch (error) { throw error instanceof ProviderError ? error : new ProviderError('corrupt', COPY.corrupt); }
    if (!this.isLive(run)) return;
    if (this.dependencies.joinSaved && !displayableIdle(check)) throw new ProviderError('corrupt', COPY.corrupt);
    const preview = { generation: result.generation, image: result.image, check };
    const existing = this.shown.kept.find(item => item.generationId === result.generation.id);
    let candidate = existing && { ...existing, generation: preview.generation, image: preview.image };
    const names = parseNamePack(result.names);
    const id = result.generation.id;
    if (names) this.packs.set(id, names);
    // The follow-up slots start pending with the draft (the loadout is rolled with it, before any follow-up asks for its trait
    // and element); a record that already has one (a resumed build) keeps it.
    const draws = !!this.dependencies.api.followUp && !this.slots.has(id) && !existing?.expression;
    if (draws) this.slots.set(id, freshSlots(altKindFor(id)));
    if ((this.dependencies.journal || this.dependencies.joinSaved) && !existing) {
      const draft = savedRecord(preview, this.dependencies.now().toISOString(), withNames(newLoadout(id), names), this.slots.get(id));
      if (!this.dependencies.joinSaved) draft.state = 'draft';
      try { await putGeneratedRecord(this.dependencies, { ...draft, ...durableSlots(this.dependencies, this.slots.get(id)) }); }
      catch { throw new ProviderError('storage', COPY.storage); }
      candidate = draft;
      if (this.dependencies.joinSaved) {
        if (!this.isLive(run)) return;
        this.update({ kept: [...this.shown.kept, draft], pendingJoinIds: [draft.id] });
      } else this.update({ kept: [...this.shown.kept, draft] });
    } else if (draws) await this.writeSlots(id, FOLLOW_UPS.map(entry => entry.id));
    if (draws) {
      const asked = { requestId: request.requestId, image: result.image, token: result.followUp?.token };
      this.launchFollowUps(id, asked, (call, signal) => this.dependencies.api.followUp!(call, signal));
    }
    if (!this.dependencies.joinSaved) await this.forget(request);
    else if (!candidate || !await this.completeJoin(run, request, candidate)) return;
    if (!this.isLive(run)) return;
    this.end({ type: 'ready', run, kept: !!this.dependencies.joinSaved || existing?.state === 'kept' }, { preview, usage: result.usage ?? null,
      ...(this.dependencies.joinSaved ? { pendingJoinIds: this.shown.pendingJoinIds?.filter(item => item !== id) } : {}) });
  }

  private async completeJoin(run: number, request: BuilderRequest, inspected: SavedCharacter) {
    const joined = await commitLoftJoin(this.dependencies, request, inspected, () => this.isLive(run), () => this.settle(request));
    if (!this.isLive(run)) return;
    if (joined) this.showSharedRecord(joined);
    else this.end({ type: 'fail', run, error: { kind: 'loft-pending', message: COPY['loft-pending'] } }, joined === null
      ? { kept: this.shown.kept.filter(item => item.id !== inspected.id) } : undefined);
    return joined;
  }

  private async collectJoin(request: BuilderRequest, saved: SavedCharacter) {
    const started = this.begin('generate', request);
    if (!started) return;
    const { run } = started;
    try {
      const check = await this.dependencies.inspect(saved.image);
      if (!displayableIdle(check)) throw new ProviderError('corrupt', COPY.corrupt);
      const joined = await this.completeJoin(run, request, saved);
      if (!joined) return;
      this.end({ type: 'ready', run, kept: true }, { preview: { generation: joined.generation, image: joined.image, check },
        usage: null, pendingJoinIds: this.shown.pendingJoinIds?.filter(item => item !== saved.id) });
      await this.resumeFollowUps(joined);
    } catch (error) {
      this.end({ type: 'fail', run, error: { kind: 'loft-pending', message: error instanceof ProviderError ? error.message : COPY.reloadJoin } });
    }
  }

  private isLive(run: number) { return this.life.run === run; }

  // The idle is already saved and shown; the follow-ups (expression, then alt) follow on their own and never move the lifecycle,
  // a ticket or the error line. Whatever goes wrong ends as a failed slot, so the resident stays ready.
  private launchFollowUps(id: string, asked: FollowUpBase, call: FollowUpCall) {
    const task: Promise<void> = this.drawFollowUps(id, asked, call).finally(() => { this.followUps.delete(task); });
    this.followUps.add(task);
  }

  // A record loaded with a pending follow-up had its draw cut off by a reload. Local mode polls the worker's slots again;
  // otherwise the token is gone and each pending slot says failed, so none is stuck pending.
  private async resumeFollowUps(item: SavedCharacter) {
    const api = this.dependencies.api;
    const set = slotsOf(item);
    if (!set || !FOLLOW_UPS.some(entry => slotOf(set, entry.id)?.status === 'pending') || this.slots.has(item.id) || !api.followUp) return;
    if (api.resumeFollowUp) {
      this.slots.set(item.id, set);
      this.launchFollowUps(item.id, { requestId: item.generation.requestId, image: item.image }, (call, signal) => api.resumeFollowUp!(call, signal));
    } else {
      this.slots.set(item.id, failPending(set, 'network'));
      await this.writeSlots(item.id, FOLLOW_UPS.filter(entry => slotOf(set, entry.id)?.status === 'pending').map(entry => entry.id));
    }
  }

  // Each entry still pending is asked for in list order; a later one reads the earlier ones' outcomes (the alt takes the expression).
  private async drawFollowUps(id: string, asked: FollowUpBase, call: FollowUpCall) {
    for (const entry of FOLLOW_UPS) {
      if (slotOf(this.slots.get(id), entry.id)?.status !== 'pending') continue;
      await this.drawOne(id, entry, asked, call);
      if (this.disposed) return;
    }
  }

  private async drawOne(id: string, entry: FollowUpDef, asked: FollowUpBase, call: FollowUpCall) {
    const request = followUpRequest(id, entry, asked, this.slots.get(id), this.shown.kept.find(item => item.id === id)?.rumble);
    let outcome: FollowUpOutcome;
    try {
      outcome = await call(request, this.followUpAbort.signal);
      if (outcome.ok && entry.alphaRequired) outcome = await this.requireTransparent(outcome);
    } catch (error) { outcome = { ok: false, kind: error instanceof ProviderError ? error.kind : 'network' }; }
    if (this.disposed) return;
    this.slots.set(id, settleSlot(this.slots.get(id) ?? {}, entry.id, outcome, !!request.expression));
    await this.writeSlots(id, [entry.id]);
  }

  private async requireTransparent(outcome: Extract<FollowUpOutcome, { ok: true }>): Promise<FollowUpOutcome> {
    if (outcome.image.mime !== 'image/png') return outcome;
    if (!outcome.image.hasAlphaChannel) return OPAQUE;
    try { return (await this.dependencies.inspect(outcome.image)).verdict === 'transparent' ? outcome : OPAQUE; }
    catch { return OPAQUE; }
  }

  // Writes the slots onto the saved record (draft or kept) and shows them. It waits for a Keep or reroll in flight, so
  // the record it reads is the one they wrote. A failed save keeps the slots in memory, where Keep carries them.
  recoverAlt(id: string, verify: () => Promise<string>): Promise<'ready' | FailureKind> {
    const recovery = { id, verify, saved: this.shown.kept.find(item => item.id === id), slots: this.slots, signal: this.followUpAbort.signal };
    return this.dependencies.guardPaidRequests
      ? this.sharedAlt.run({ ...recovery, dependencies: this.dependencies, show: record => this.showSharedRecord(record) })
      : recoverSavedAlt({ ...recovery, api: this.dependencies.api, write: () => this.writeSlots(id, [ALT_ID]) });
  }

  private showSharedRecord(record: SavedCharacter) {
    const shown = showPendingSlots(record, this.slots.get(record.id));
    this.update({ kept: this.shown.kept.map(item => item.id === record.id ? shown : item) });
  }

  private async writeSlots(id: string, changed: readonly string[]) {
    await this.pendingSave;
    await this.rerolls.get(id);
    const set = this.slots.get(id);
    const current = this.shown.kept.find(item => item.id === id);
    if (!set || !current) return false;
    if (this.dependencies.guardPaidRequests) {
      try {
        const saved = await writeSharedSlots(this.dependencies, current, durableSlots(this.dependencies, set), changed);
        if (!saved) return false;
        this.showSharedRecord(saved);
        return true;
      } catch { return false; }
    }
    try { await this.dependencies.store.put({ ...current, ...durableSlots(this.dependencies, set) }); } catch { return false; }
    this.update({ kept: this.shown.kept.map(item => (item.id === id ? { ...item, ...slotFields(set) } : item)) });
    return true;
  }

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
    this.disposed = true;
    this.followUpAbort.abort();
    this.life = to;
    this.listeners.clear();
  }

  private stopRun() {
    this.abort?.controller.abort();
    this.abort = null;
  }

  // The background work (a cancelled request's collection) and every expression still being drawn.
  async settled() {
    await this.background;
    await Promise.all([...this.followUps]);
  }

  private forget(request: BuilderRequest, refund = false) {
    return this.dependencies.exclusive ? this.dependencies.exclusive(() => this.settle(request, refund)) : this.settle(request, refund);
  }

  private settle(request: BuilderRequest, refund = false) {
    settleBuild(this.dependencies, request, refund);
    this.life = next(this.life, { type: 'forget', requestId: request.requestId });
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
      const id = preview.generation.id;
      const carried = parseLoadout(this.shown.kept.find(item => item.id === id)?.rumble); // a draft's loadout, rerolled or not
      const draft = this.shown.kept.find(item => item.id === id);
      const resident = savedRecord(preview, this.dependencies.now().toISOString(), carried ?? withNames(newLoadout(id), this.packs.get(id) ?? null), this.slots.get(id) ?? slotsOf(draft));
      const saved = await keepRecord(this.dependencies, resident);
      const kept = [...this.shown.kept.filter(item => item.id !== saved.id), showPendingSlots(saved, this.slots.get(id))];
      this.send({ type: 'saved' }, { kept });
    } catch {
      this.send({ type: 'saveFailed', error: this.storageFailure() });
    }
  }

  // Restore saved records without waiting for pending jobs. Loadout backfill is deterministic per resident ID.
  async load() {
    try {
      const stored = await this.dependencies.store.list();
      const pending = this.dependencies.joinSaved ? pendingLoftJoins(stored, this.dependencies.journal) : [];
      const pendingIds = new Set(pending.map(item => item.saved.id));
      const fixed = stored.filter(item => !pendingIds.has(item.id) && needsLoadout(item)).map(item => ({ ...item, rumble: backfillLoadout(item.id) }));
      const records = stored.map(item => fixed.find(candidate => candidate.id === item.id) ?? item);
      const unique = new Map([...records, ...this.shown.kept].map(item => [item.id, item]));
      this.update({ kept: [...unique.values()], ...(this.dependencies.joinSaved ? { pendingJoinIds: [...pendingIds] } : {}) });
      for (const { request, saved } of pending) await this.collectJoin(request, saved);
      await Promise.all(fixed.map(item => this.saveBackfilled(item)));
      await Promise.all(records.filter(item => !pendingIds.has(item.id)).map(item => this.resumeFollowUps(item)));
    } catch { this.send({ type: 'note', error: this.storageFailure() }); }
  }

  private async saveBackfilled(item: SavedCharacter) {
    try {
      const saved = await backfillRecord(this.dependencies, item);
      if (saved) this.showSharedRecord(saved);
    } catch { /* shown anyway; the next load backfills and saves again */ }
  }

  // A record edit, not a lifecycle event: it never moves `Life` (a failed save sets its error via `note`). A second reroll of the same id while one is saving
  // returns that one's result; another id is independent.
  reroll(id: string): Promise<Loadout | null> {
    const inFlight = this.rerolls.get(id);
    if (inFlight) return inFlight;
    const attempt = this.rerollSaved(id).finally(() => { this.rerolls.delete(id); });
    this.rerolls.set(id, attempt);
    return attempt;
  }

  // Null, changing nothing, for an unknown id, a record with a synergy or special id this build does not know (a newer
  // build's, never rerolled), and a save that fails (which also shows the storage error).
  private async rerollSaved(id: string): Promise<Loadout | null> {
    const current = this.shown.kept.find(item => item.id === id);
    if (!current) return null;
    try {
      const { saved, rolled } = await rerollRecord(this.dependencies, current, this.slots.get(id));
      if (saved) this.showSharedRecord(saved);
      return rolled;
    }
    catch { this.send({ type: 'note', error: this.storageFailure() }); return null; }
  }

  // Reattaches to each pending request in turn, oldest first. Never dispatches a new generation.
  resume() {
    const work = (async () => {
      if (this.shown.pendingJoinIds?.length) return;
      if (this.dependencies.guardPaidRequests && !this.life.observable) {
        const read = () => paidJournalFailure(this.dependencies.journal);
        let blocked;
        try { blocked = this.dependencies.exclusive ? await this.dependencies.exclusive(read) : read(); }
        catch (error) { blocked = { ...this.storageFailure(), ...(error instanceof ProviderError ? { message: error.message } : {}), dispatch: 'not-sent' as const }; }
        if (blocked) this.send({ type: 'reject', error: blocked });
        return;
      }
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
