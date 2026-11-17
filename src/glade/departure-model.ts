// The glade departure lifecycle (docs/architecture/STATE-MACHINES-FOCUS-GLADE.md). Pure: no DOM, no animation, no navigation.
// `epoch` counts departures. The view tags each animation's completion with the epoch it started in, so a completion
// that arrives after a pageshow reset, or after a newer departure began, is refused.
export type Departure = Readonly<{ kind: 'resting' | 'leaving' | 'navigated'; epoch: number }>;
export type DepartureEvent =
  | { type: 'click' } // a plain click on Play, motion allowed
  | { type: 'finished'; epoch: number } // that departure's animation settled
  | { type: 'pageshow' }; // the page is shown again (a back or forward restore)

export const RESTING: Departure = Object.freeze({ kind: 'resting', epoch: 0 });

/** Returns the same object for a refused event. */
export function next(state: Departure, event: DepartureEvent): Departure {
  switch (event.type) {
    case 'click':
      return state.kind === 'resting' ? { kind: 'leaving', epoch: state.epoch + 1 } : state;
    case 'finished':
      return state.kind === 'leaving' && state.epoch === event.epoch ? { kind: 'navigated', epoch: state.epoch } : state;
    case 'pageshow':
      return state.kind === 'resting' ? state : { kind: 'resting', epoch: state.epoch };
    default:
      return state;
  }
}
