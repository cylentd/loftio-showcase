/** A resident's lifecycle as one state and one pure transition function (docs/architecture/STATE-MACHINES.md, G1).
 *  No Pixi and no DOM: `Resident` holds a `Lifecycle`, sends it events and draws the result. */

export type Motion = "still" | "walking" | "paused";
export type Pt = { readonly x: number; readonly y: number };
/** Who holds a held resident: the player's hand (pointer or keyboard), play (a toss or a pile) or a parcel drag. */
export type Holder = "hand" | "play" | "parcel";

/** `motion` is what a free resident's own walk is doing. A held resident does not walk: it stashes `resume`, the
 *  motion it had when the hold began, and `origin`, where the hold began. */
export type Lifecycle =
  | { readonly kind: "free"; readonly motion: Motion }
  | { readonly kind: "held"; readonly holder: Holder; readonly resume: Motion; readonly origin: Pt };

export type LifeEvent =
  /** From free, a hold begins. From held, another holder re-picks it: the first resume and origin stay. */
  | { type: "pickUp"; at: Pt; by: Holder }
  /** The hold passes to another holder; resume and origin stay. */
  | { type: "handOver"; to: Holder }
  | { type: "putDown"; placed: boolean }
  | { type: "walk" }
  | { type: "arrive" }
  | { type: "stop" }
  | { type: "resume" }
  | { type: "reset" }
  | { type: "halt" };

export const INITIAL: Lifecycle = Object.freeze({ kind: "free", motion: "still" });

type WalkEvent = Exclude<LifeEvent["type"], "pickUp" | "handOver" | "putDown" | "reset">;

/** What each walk event does to a free resident's `motion`; a missing entry is a refused pair, and every walk event
 *  is refused while held. `stop` on a paused walk gives still, as the two flags it replaces did. */
const MOTION: Readonly<Record<WalkEvent, Partial<Record<Motion, Motion>>>> = {
  walk: { still: "walking", paused: "walking" },
  arrive: { walking: "still" },
  stop: { walking: "paused", paused: "still" },
  resume: { paused: "walking" },
  halt: { walking: "still" },
};

const free = (motion: Motion): Lifecycle => ({ kind: "free", motion });

/** The motion a resident has now: a held one is still. */
export const motionOf = (state: Lifecycle): Motion => state.kind === "free" ? state.motion : "still";

/** The next state, or the very same object when the event is refused from this state. */
export function next(state: Lifecycle, event: LifeEvent): Lifecycle {
  switch (event.type) {
    case "pickUp":
    case "handOver": {
      const to = event.type === "pickUp" ? event.by : event.to;
      if (state.kind === "held") return state.holder === to ? state : { ...state, holder: to };
      return event.type === "pickUp" ? { kind: "held", holder: to, resume: state.motion, origin: { x: event.at.x, y: event.at.y } } : state;
    }
    case "putDown":
      if (state.kind === "free") return state;
      return free(event.placed ? "still" : state.resume);
    case "reset":
      return state.kind === "free" && state.motion === "still" ? state : free("still");
    default: {
      if (state.kind === "held") return state;
      const motion = MOTION[event.type][state.motion];
      return motion === undefined ? state : free(motion);
    }
  }
}
