// The first-ask lifecycle of the focus picker (docs/architecture/STATE-MACHINES-FOCUS-GLADE.md). Pure: no timer, no DOM.
// The view owns the one timer; it holds a handle exactly while the state is `waiting`.
export type AskState = Readonly<{ kind: 'idle' | 'waiting' | 'asking' | 'done' }>;
export type AskEvent =
  | { type: 'askOnce'; answered: boolean } // the title is passed
  | { type: 'tick'; answered: boolean; busy: boolean } // the timer fired
  | { type: 'answered' } // the picker closed (Done, Skip, close button or Escape)
  | { type: 'dispose' };

export const IDLE: AskState = Object.freeze({ kind: 'idle' });
export const WAITING: AskState = Object.freeze({ kind: 'waiting' });
export const ASKING: AskState = Object.freeze({ kind: 'asking' });
export const DONE: AskState = Object.freeze({ kind: 'done' });

/** Returns the same object for a refused event. A busy tick returns `waiting`: the view schedules the next poll. */
export function next(state: AskState, event: AskEvent): AskState {
  switch (event.type) {
    case 'askOnce':
      return state.kind === 'idle' ? (event.answered ? DONE : WAITING) : state;
    case 'tick':
      if (state.kind !== 'waiting') return state;
      return event.answered ? DONE : event.busy ? WAITING : ASKING;
    case 'answered':
    case 'dispose':
      return state.kind === 'done' ? state : DONE;
    default:
      return state;
  }
}
