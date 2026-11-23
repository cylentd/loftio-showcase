import { activeRoom } from "./room-layout";

/** Carrying a resident toward the window edge scrolls the portrait room, so a spot off screen can be reached with one finger.
 *  `edge` css px: the 44 px minimum touch target (Apple HIG) plus 20 px, so a finger resting on the glass edge is well inside it.
 *  `speed` px per ms at the very edge: the 285 px the portrait room hides (1080 world px x 0.625 - 390) pass in 0.57 s,
 *  quick enough to cross the room and slow enough to stop on a 70 px loft catch zone (`LOFT_CATCH`). Ramps up linearly from the zone's inner edge. */
export const CARRY_SCROLL = { edge: 64, speed: 0.5 };

/** Pixels to scroll this frame (negative: left) for a finger at `finger` css px in a window `width` wide, kept inside the scroll range. */
export function scrollStep(finger: number, width: number, scrollLeft: number, maxScroll: number, dtMs: number): number {
  if (!(dtMs > 0) || !Number.isFinite(dtMs)) return 0; // a backwards, NaN or endless frame time must not scroll or reverse
  const depth = (distance: number) => Math.min(1, Math.max(0, (CARRY_SCROLL.edge - distance) / CARRY_SCROLL.edge));
  const wanted = (depth(width - finger) - depth(finger)) * CARRY_SCROLL.speed * dtMs;
  return Math.max(-scrollLeft, Math.min(maxScroll - scrollLeft, wanted)) + 0; // + 0 turns -0 into 0
}

type Finger = { id: number; x: number; y: number; type: string };
const held = () => document.querySelector<HTMLElement>('[data-held="true"]');

/** Wires the scroll: while one pressed pointer carries a resident (the resident button is `data-held`), a finger near the left or
 *  right window edge scrolls `scroller` (as far as the `world` is wide), and the carried resident is told the pointer moved so it stays under the finger.
 *  One finger is followed at a time. A second finger's moves are ignored while the first still carries; when a second finger lands,
 *  resident-controls puts the first hold back and may give the second finger its own resident, so the first finger is dropped and the
 *  second is followed from its next move. */
export function installCarryScroll(scroller: HTMLElement, world: HTMLElement): void {
  let finger: Finger | null = null, frame = 0, last = 0;
  const tick = (now: number) => {
    frame = 0;
    const button = held();
    if (!finger || !button || activeRoom !== "portrait") { finger = null; last = 0; return; }
    // The room's own width, not scrollWidth: the carried resident's hit box sticks out past the world and would keep stretching it.
    const delta = scrollStep(finger.x, innerWidth, scroller.scrollLeft, world.offsetWidth - scroller.clientWidth, last ? now - last : 0);
    last = now;
    if (delta) {
      scroller.scrollLeft += delta;
      button.dispatchEvent(new PointerEvent("pointermove", { pointerId: finger.id, pointerType: finger.type, isPrimary: true,
        clientX: finger.x, clientY: finger.y, buttons: 1, bubbles: true, cancelable: true }));
    }
    frame = requestAnimationFrame(tick);
  };
  document.addEventListener("pointermove", (event) => {
    // Our own re-sent moves are untrusted; a hovering mouse (no button) is not a carry.
    if (!event.isTrusted || !event.buttons || (finger && finger.id !== event.pointerId) || !held()) return;
    finger = { id: event.pointerId, x: event.clientX, y: event.clientY, type: event.pointerType };
    if (!frame) frame = requestAnimationFrame(tick);
  }, true);
  // A second finger landing always ends the first finger's hold (resident-controls puts it back), and it may lift another resident,
  // so the button stays `data-held` for a different pointer. We cannot tell whose hold it is, so stop following the first finger;
  // the new holder's next pointermove starts the follow again.
  document.addEventListener("pointerdown", (event) => {
    if (finger && finger.id !== event.pointerId) { finger = null; last = 0; }
  }, true);
  const lift = (event: PointerEvent) => { if (finger?.id === event.pointerId) finger = null; };
  document.addEventListener("pointerup", lift, true);
  document.addEventListener("pointercancel", lift, true);
}
