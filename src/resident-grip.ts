/** The hand's grip on a resident as one state and one pure transition function (docs/architecture/STATE-MACHINES.md,
 *  G1). No DOM: `ResidentControls` keeps one `Grip`, sends it events and acts on the result. The room has one grip,
 *  so a second resident cannot be taken while one is pressed or carried.
 *
 *  `item` is whatever the view carries along (the resident, its button, where it stood); the model never reads it. */

export type Grip<T> =
  | { readonly kind: "none" }
  /** A pointer is down on the resident and has not yet moved far enough to lift it. */
  | { readonly kind: "pressed"; readonly pointer: number; readonly item: T }
  /** Lifted. `pointer` is null when the keyboard carries it. `caught`: taken out of play or out of a fall. */
  | { readonly kind: "carried"; readonly pointer: number | null; readonly caught: boolean; readonly item: T };

export type GripEvent<T> =
  | { type: "press"; pointer: number; caught: boolean; item: T }
  | { type: "drag"; pointer: number }
  | { type: "key"; caught: boolean; item: T }
  /** A release, a drop, a hand-over to play or a cancel: the grip is over either way. */
  | { type: "end" };

export const NONE: { readonly kind: "none" } = Object.freeze({ kind: "none" });

/** The next grip, or the very same object when the event is refused from this state. */
export function next<T>(grip: Grip<T>, event: GripEvent<T>): Grip<T> {
  switch (event.type) {
    case "press":
      if (grip.kind !== "none") return grip;
      return event.caught
        ? { kind: "carried", pointer: event.pointer, caught: true, item: event.item }
        : { kind: "pressed", pointer: event.pointer, item: event.item };
    case "drag":
      if (grip.kind !== "pressed" || grip.pointer !== event.pointer) return grip;
      return { kind: "carried", pointer: grip.pointer, caught: false, item: grip.item };
    case "key":
      if (grip.kind !== "none") return grip;
      return { kind: "carried", pointer: null, caught: event.caught, item: event.item };
    case "end":
      return grip.kind === "none" ? grip : NONE;
  }
}
