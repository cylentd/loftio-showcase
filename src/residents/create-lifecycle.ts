import { INITIAL, next, timerOf, type FormEvent, type FormState, type HoldKind, type TimerKind } from './create-form-model.ts';

export type LifecycleTiming = {
  /** The pick's hop in ms; 0 under reduced motion. Read when a hold starts. */
  holdMs(): number;
  /** Use 1 ticket ignores taps this long after the question opens. */
  armMs: number;
  /** The arm window closed: the panel redraws. */
  onArmed(): void;
};

type Held = { run(): void; release(): void };
type Running = { timer: TimerKind; handle: ReturnType<typeof setTimeout>; held: Held | null };

/**
 * The Create panel's side effects: it owns the state, and the one timer the state needs.
 * Every transition out of a timed state cancels that timer, and a cancelled hold is released
 * (the card's hop class comes off), so no timer can fire into a state that did not start it.
 */
export function createLifecycle(timing: LifecycleTiming) {
  let state: FormState = INITIAL;
  let running: Running | null = null;
  let queued: Held | null = null; // the hold being started by `hold`, read by `sync`

  function stop() {
    if (!running) return;
    clearTimeout(running.handle);
    running.held?.release();
    running = null;
  }
  function start(timer: TimerKind) {
    const held = timer === 'hold' ? queued : null;
    const ms = timer === 'hold' ? timing.holdMs() : timing.armMs;
    const handle = setTimeout(() => {
      running = null; // fired: nothing left to cancel
      if (timer === 'arm') { if (send({ type: 'armed' })) timing.onArmed(); return; }
      if (send({ type: 'holdDone' })) { held?.release(); held?.run(); }
    }, ms);
    running = { timer, handle, held };
  }
  function sync() {
    const want = timerOf(state);
    if (want === (running?.timer ?? null)) return;
    stop();
    if (want) start(want);
  }
  function send(event: FormEvent): boolean {
    const before = state;
    state = next(before, event);
    if (state === before) return false;
    sync();
    return true;
  }
  return {
    get state() { return state; },
    send,
    /** Starts a hold; false when the panel is not free to take one. `run` happens when the hop ends, `release` on either end. */
    hold(kind: HoldKind, run: () => void, release: () => void) {
      queued = { run, release };
      const accepted = send({ type: 'hold', hold: kind });
      queued = null;
      return accepted;
    },
    dispose() { send({ type: 'dispose' }); },
  };
}
