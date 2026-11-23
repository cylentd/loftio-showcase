// Generic motion on the opened card's painting (look test #565, owner 2026-11-21: "I wanted the art to feel alive not
// the card"): slow drift, mood motes, depth on tilt. None of it knows where anything is in a painting. Runs only on the
// big card, after its open flight lands (`is-alive` on the dialog), and never under reduced motion. Motion is
// transform and opacity only; the CSS is holo-alive.css, the numbers HOLO_ALIVE.
import { HOLO_ALIVE } from './constants';
import { ALIVE_PARTS, aliveInitial, driftFrames, motePlan, moteKind, overscanScale, type AliveState } from './holo-alive-model';
import { el } from './holo-card-faces';
import './holo-alive.css';

const MS = 'ms';
const PERCENT = '%';
const SECONDS = 's';
const HUNDRED = 100;

/** The timing and geometry as custom properties on the board, so the CSS reads HOLO_ALIVE. */
export function aliveTiming(board: HTMLElement): void {
  const t = HOLO_ALIVE;
  const { to } = driftFrames(t);
  const set = (name: string, value: string) => board.style.setProperty(name, value);
  set('--hx-alive-fade-ms', `${t.fadeInMs}${MS}`);
  set('--hx-drift-ms', `${t.driftMs}${MS}`);
  set('--hx-drift-x', `${to.x * HUNDRED}${PERCENT}`);
  set('--hx-drift-y', `${to.y * HUNDRED}${PERCENT}`);
  set('--hx-drift-scale', String(to.scale));
  set('--hx-overscan', overscanScale(t.driftPan, t.depth, t.margin).toFixed(4));
  set('--hx-mote-depth', String(t.moteDepth));
  set('--hx-mote-ms', `${t.moteMs}${MS}`);
}

/** The board's switcher state as data attributes the CSS keys on. */
export function writeAlive(board: HTMLElement, state: AliveState): void {
  for (const part of ALIVE_PARTS) board.dataset[`alive${part[0]!.toUpperCase()}${part.slice(1)}`] = state[part] ? 'on' : 'off';
}

/** Adds the motes layer over one card's painting; returns it and the painting, the two layers that take depth. */
export function addMotes(front: Element, mood: string, seed: number): HTMLElement[] {
  const backdrop = front.querySelector<HTMLElement>('.holo-backdrop');
  if (!backdrop) return [];
  const motes = el('span', 'hx-motes');
  motes.setAttribute('aria-hidden', 'true');
  motes.dataset.kind = moteKind(mood);
  for (const at of motePlan(seed, HOLO_ALIVE)) {
    const mote = el('span', 'hx-mote');
    mote.style.left = `${at.x}${PERCENT}`;
    mote.style.top = `${at.y}${PERCENT}`;
    mote.style.animationDelay = `${at.delayS}${SECONDS}`;
    motes.append(mote);
  }
  backdrop.after(motes);
  return [backdrop, motes];
}

/** The painting comes alive once the open flight has landed; the dialog's close takes it back. */
export function aliveOnLand(card: HTMLElement, dialog: HTMLDialogElement, reduced: boolean): void {
  if (reduced) return;
  const flights = card.getAnimations().map(animation => animation.finished.catch(() => undefined));
  void Promise.all(flights).then(() => { if (dialog.open) dialog.classList.add('is-alive'); });
}

/** A dialog that carries its own motion (the storybook's big card, #565): timing and every part on, except under reduced
 *  motion, where all stay off; its close stills the painting again. */
export function aliveDialog(dialog: HTMLDialogElement, reduced: boolean): void {
  aliveTiming(dialog);
  writeAlive(dialog, aliveInitial(reduced));
  dialog.addEventListener('close', () => dialog.classList.remove('is-alive'));
}
