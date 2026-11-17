// Mouse lock for desktop play. One click on the game captures the mouse: the cursor disappears and cannot
// leave the window, so a stray click never lands outside it. Esc gives the mouse back.
//
// While it is captured:
//   move the mouse            look around
//   hold the left button      start a fling: a ring appears on your resident
//   drag                      move the ring to where you want to go; the view holds still so you can place it
//   release                   fling at the ring
//   right button while aiming look around without moving the ring
// The aim is yours: nothing snaps the ring to a target. (A centre reticle that aimed for you was tried and
// removed, 2026-11-17: "it does the fling for you".)
// Touch, and a mouse that is not captured, drag from the resident directly.
import { AIM } from './control-constants.mjs';

export const LOCK = {
  look: 0.55, // share of normal drag-to-look speed; a captured mouse moves further per swipe than a drag does
  aim: 1, // ring pixels per mouse pixel while aiming
  edge: 10, // the ring stays this many pixels inside the window
};

export function wireMouseLock({ canvas, doc, play, size, ring, onChange = () => {}, enabled = () => true }) {
  const locked = () => doc.pointerLockElement === canvas;
  let aiming = null; // {x, y, startX, startY} in window pixels while the left button is held

  function showRing() {
    ring.hidden = !aiming;
    if (aiming) ring.style.transform = `translate(${aiming.x}px, ${aiming.y}px)`;
  }
  function stop(fire) {
    if (!aiming) return;
    aiming = null; showRing();
    if (fire) play.aimEnd(); else play.aimCancel();
  }
  function release() { stop(false); if (locked()) doc.exitPointerLock(); }
  function place() {
    const { width, height } = size(), pixels = Math.hypot(aiming.x - aiming.startX, aiming.y - aiming.startY);
    play.aimMove(aiming.x, aiming.y, width, height, Math.min(pixels / (Math.min(width, height) * AIM.swipeShare), 1), pixels);
  }

  // These run before the ordinary pointer handlers and, while the mouse is captured, replace them.
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || !play.active) return;
    if (!locked() && !enabled()) return; // switched off: the mouse is not captured and you drag from the resident
    if (!locked()) {
      // the first click only captures the mouse; it is not a fling
      e.stopImmediatePropagation(); e.preventDefault();
      canvas.requestPointerLock?.();
      return;
    }
    e.stopImmediatePropagation();
    if (e.button !== 0 || aiming) return;
    const { width, height } = size(), at = play.screenPoint(play.lead.pos, width, height);
    aiming = { x: at.x, y: at.y, startX: at.x, startY: at.y };
    play.state.aim = { target: null, power: 0, pixels: 0 };
    showRing();
  }, true);

  canvas.addEventListener('pointermove', (e) => {
    if (!locked()) return;
    e.stopImmediatePropagation();
    if (aiming && !(e.buttons & 2)) {
      const { width, height } = size();
      aiming.x = Math.min(Math.max(aiming.x + e.movementX * LOCK.aim, LOCK.edge), width - LOCK.edge);
      aiming.y = Math.min(Math.max(aiming.y + e.movementY * LOCK.aim, LOCK.edge), height - LOCK.edge);
      place(); showRing();
    } else play.orbit(e.movementX * LOCK.look, e.movementY * LOCK.look);
  }, true);

  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(type, (e) => { if (locked()) e.stopImmediatePropagation(); }, true);
  }
  // mouseup, not pointerup: with two buttons held, pointerup waits for the last one
  canvas.addEventListener('mouseup', (e) => {
    if (!locked()) return;
    e.stopImmediatePropagation();
    if (e.button === 0) stop(true);
  }, true);

  doc.addEventListener('pointerlockchange', () => { if (!locked()) stop(false); onChange(locked()); });
  doc.addEventListener('pointerlockerror', () => onChange(false));
  return {
    release,
    get locked() { return locked(); },
    /** Call once a frame: while aiming, the world keeps moving under the ring, so the aim is re-read from it. */
    update() { if (aiming && locked() && play.active) place(); },
  };
}
