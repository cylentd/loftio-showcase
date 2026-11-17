// The Create panel's lifecycle: one state type and one pure `next`. No DOM, no timers.
// The wizard owns which question (or the summary) shows; this owns what the panel may do next.
// Table test: game/tests/unit/create-form-model.test.ts. Doc: docs/architecture/STATE-MACHINES.md, G2.

/** What a hold waits for: a card pick, the dice, or Pick for me. */
export type HoldKind = 'pick' | 'roll' | 'forMe';

/**
 * choosing: a question or the summary is open for input.
 * holding: a pick's hop is playing; input is ignored until it ends.
 * unarmed / armed: the spend-a-ticket question is open; only armed accepts Use 1 ticket.
 * creating: the builder is generating or saving. arrived: the arrival notice is up.
 * disposed: the form is gone; nothing is accepted.
 */
export type FormState =
  | { kind: 'choosing' }
  | { kind: 'holding'; hold: HoldKind }
  | { kind: 'unarmed' }
  | { kind: 'armed' }
  | { kind: 'creating' }
  | { kind: 'arrived' }
  | { kind: 'disposed' };

export type FormEvent =
  | { type: 'hold'; hold: HoldKind }
  | { type: 'holdDone' }
  | { type: 'show' }
  | { type: 'submit' }
  | { type: 'armed' }
  | { type: 'no' }
  | { type: 'yes' }
  | { type: 'busy'; generating: boolean }
  | { type: 'idle' }
  | { type: 'finish'; notice: boolean }
  | { type: 'dismiss' }
  | { type: 'dispose' };

/** The one timer a state needs running; the driver starts it on entry and cancels it on every exit. */
export type TimerKind = 'hold' | 'arm';

const CHOOSING: FormState = { kind: 'choosing' };
const UNARMED: FormState = { kind: 'unarmed' };
const ARMED: FormState = { kind: 'armed' };
const CREATING: FormState = { kind: 'creating' };
const ARRIVED: FormState = { kind: 'arrived' };
const DISPOSED: FormState = { kind: 'disposed' };

export const INITIAL: FormState = CHOOSING;

export function timerOf(state: FormState): TimerKind | null {
  if (state.kind === 'holding') return 'hold';
  return state.kind === 'unarmed' ? 'arm' : null;
}

const live = (state: FormState) => state.kind !== 'disposed';
const asking = (state: FormState) => state.kind === 'unarmed' || state.kind === 'armed';

/** Returns the next state, or the same object when the event is refused. */
export function next(state: FormState, event: FormEvent): FormState {
  switch (event.type) {
    case 'hold': return state.kind === 'choosing' ? { kind: 'holding', hold: event.hold } : state;
    case 'holdDone': return state.kind === 'holding' ? CHOOSING : state;
    // The wizard moved: a hold is moot and an open question may be stale.
    case 'show': return state.kind === 'choosing' || state.kind === 'holding' || asking(state) ? CHOOSING : state;
    case 'submit': return state.kind === 'choosing' ? UNARMED : state;
    case 'armed': return state.kind === 'unarmed' ? ARMED : state;
    case 'no': return asking(state) ? CHOOSING : state;
    case 'yes': return state.kind === 'armed' ? CHOOSING : state;
    // A saving build does not erase an arrival notice; a new generation does.
    case 'busy': return state.kind === 'creating' || !live(state) || (state.kind === 'arrived' && !event.generating) ? state : CREATING;
    case 'idle': return state.kind === 'creating' ? CHOOSING : state;
    case 'finish': return live(state) ? (event.notice ? ARRIVED : CHOOSING) : state;
    case 'dismiss': return state.kind === 'arrived' ? CHOOSING : state;
    case 'dispose': return live(state) ? DISPOSED : state;
    default: return state;
  }
}
