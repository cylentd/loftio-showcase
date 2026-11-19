// Touch wiring for the floating walk stick. Runs in the capture phase, before the look and fling handlers:
// when a finger belongs to the stick it stops there, so the stick never turns the camera.
// The reading goes out through onChange; main.js folds it into the same walk inputs the keyboard uses.
import { STICK } from './stick-constants.mjs';
import { stickReading, inStickRegion } from './stick-model.mjs';
import { routeTouch } from './touch-routing.mjs';

const IDLE = { x: 0, z: 0, mag: 0, sprint: false, active: false };

export function wireTouchStick({ canvas, play, size, view, onChange }) {
  let held = null; // {id, x, y, sprint}: the finger that owns the stick
  const stop = () => {
    if (!held) return;
    if (canvas.hasPointerCapture(held.id)) canvas.releasePointerCapture(held.id);
    held = null; view.hide(); onChange(IDLE);
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || !play.active) return;
    const { width, height } = size();
    const job = routeTouch({
      onButton: !!e.target?.closest?.('button'),
      nearLead: play.nearLead(e.clientX, e.clientY, width, height),
      flingFree: !play.state.aim,
      inRegion: inStickRegion(e.clientX, e.clientY, width, height, STICK),
      stickFree: held === null,
    });
    if (job !== 'stick') return;
    e.stopImmediatePropagation(); e.preventDefault();
    held = { id: e.pointerId, x: e.clientX, y: e.clientY, sprint: false };
    canvas.setPointerCapture(e.pointerId);
    view.show(e.clientX, e.clientY);
    onChange({ ...IDLE, active: true });
  }, true);
  canvas.addEventListener('pointermove', (e) => {
    if (!held || e.pointerId !== held.id) return;
    e.stopImmediatePropagation();
    const s = stickReading(e.clientX - held.x, e.clientY - held.y, held.sprint, STICK);
    held.sprint = s.sprint;
    view.move(s.knobX, s.knobY, s.sprint);
    onChange({ ...s, active: true });
  }, true);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(type, (e) => { if (held && e.pointerId === held.id) { e.stopImmediatePropagation(); stop(); } }, true);
  }
  return { stop, get held() { return held !== null; } };
}
