// Draws the floating stick. The root holds a resting hint (where the stick region is, until the first use)
// and a base with a knob that appears under the thumb. Sizes come from STICK so the maths and the drawing agree.
import { STICK } from './stick-constants.mjs';

export function createStickView(root) {
  const base = root.querySelector('.stick-base'), knob = root.querySelector('.stick-knob');
  root.style.setProperty('--stick-base', `${STICK.baseSize}px`);
  root.style.setProperty('--stick-knob', `${STICK.knobSize}px`);
  return {
    show(x, y) {
      base.style.transform = `translate(${x}px, ${y}px)`;
      knob.style.transform = 'translate(0px, 0px)';
      root.classList.add('live', 'used'); // 'used' keeps the resting hint away for the rest of the visit
      root.classList.remove('rim');
    },
    move(x, y, rim) {
      knob.style.transform = `translate(${x}px, ${y}px)`;
      root.classList.toggle('rim', !!rim);
    },
    hide() { root.classList.remove('live', 'rim'); },
  };
}
