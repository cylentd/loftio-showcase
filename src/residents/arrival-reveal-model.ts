// The arrival reveal's lifecycle: one state type and one pure `next`. No DOM, no timers, no media.
// The view (arrival-reveal.ts) sends events and performs the effects this module names.
// Table test: game/tests/unit/arrival-reveal-model.test.ts. Doc: docs/architecture/STATE-MACHINES-ARRIVAL.md.

/** The dialog's `data-handoff`: off ('false'), waiting for the box flight to land ('pending'), the clip has taken over ('true'). */
export type Handoff = 'off' | 'pending' | 'on';

/**
 * idle: the dialog is closed.
 * cinema: the box video stage is showing. flight: the flight layer exists. framed: the flight landed.
 *   audioHeld: room audio is suspended and owes one resume.
 * naming: the box opened; the name form shows. framed is kept for the dialog attribute.
 * disposed: the reveal is torn down; nothing is accepted.
 */
export type RevealState =
  | { kind: 'idle' }
  | { kind: 'cinema'; flight: boolean; handoff: Handoff; framed: boolean; audioHeld: boolean }
  | { kind: 'naming'; framed: boolean }
  | { kind: 'disposed' };

/** The clip phases the dialog reacts to. `ready`, `revealed` and `closed` are the clip's own and change nothing here. */
export type ClipPhase = 'loading' | 'playing' | 'retry';

export type RevealEvent =
  | { type: 'show' }
  | { type: 'flew' }
  | { type: 'held' }
  | { type: 'phase'; phase: ClipPhase }
  | { type: 'landed' }
  | { type: 'opened' }
  | { type: 'close' }
  | { type: 'dispose' };

/** What the view writes to `dialog.dataset`; null removes the attribute. */
export type DialogAttributes = { cinema: string | null; handoff: string | null; framed: string | null };

export const INITIAL: RevealState = { kind: 'idle' };
const IDLE = INITIAL;
const DISPOSED: RevealState = { kind: 'disposed' };

const fresh = (): RevealState => ({ kind: 'cinema', flight: false, handoff: 'off', framed: false, audioHeld: false });

function onPhase(state: Extract<RevealState, { kind: 'cinema' }>, phase: ClipPhase): RevealState {
  if (phase === 'loading') return state.handoff === 'pending' ? state : { ...state, handoff: 'pending' };
  // The clip took over (playing) or failed (retry): the flight is over either way.
  return state.handoff === 'on' && !state.flight ? state : { ...state, handoff: 'on', flight: false };
}

/** Returns the next state, or the same object when the event is refused. */
export function next(state: RevealState, event: RevealEvent): RevealState {
  const cinema = state.kind === 'cinema' ? state : null;
  switch (event.type) {
    // A new reveal replaces whatever showed before, so it is accepted in every live state.
    case 'show': return state.kind === 'disposed' ? state : fresh();
    case 'flew': return cinema && !cinema.flight && cinema.handoff === 'off' ? { ...cinema, flight: true } : state;
    case 'held': return cinema && !cinema.audioHeld ? { ...cinema, audioHeld: true } : state;
    case 'phase': return cinema ? onPhase(cinema, event.phase) : state;
    // A landing counts only while its flight is the live one: after a close, a retry or the clip, it is stale.
    case 'landed': return cinema && cinema.flight && !cinema.framed ? { ...cinema, framed: true } : state;
    case 'opened': return cinema ? { kind: 'naming', framed: cinema.framed } : state;
    case 'close': return state.kind === 'cinema' || state.kind === 'naming' ? IDLE : state;
    case 'dispose': return state.kind === 'disposed' ? state : DISPOSED;
    default: return state;
  }
}

/** True when this step ends a hold on room audio: the view must resume it, once. */
export function releasesAudio(prev: RevealState, after: RevealState): boolean {
  return prev.kind === 'cinema' && prev.audioHeld && !(after.kind === 'cinema' && after.audioHeld);
}

/** True when this step ends the flight layer: the view must dispose it. */
export function releasesFlight(prev: RevealState, after: RevealState): boolean {
  return prev.kind === 'cinema' && prev.flight && !(after.kind === 'cinema' && after.flight);
}

/** The clip may be muted (audio switched off, tab hidden) only while the box video shows. */
export const clipLive = (state: RevealState): boolean => state.kind === 'cinema';

export function attributesOf(state: RevealState): DialogAttributes {
  if (state.kind === 'cinema') {
    const handoff = state.handoff === 'off' ? 'false' : state.handoff === 'pending' ? 'pending' : 'true';
    return { cinema: 'true', handoff, framed: state.framed ? 'true' : null };
  }
  if (state.kind === 'naming') return { cinema: 'false', handoff: null, framed: state.framed ? 'true' : null };
  return { cinema: null, handoff: null, framed: null };
}
