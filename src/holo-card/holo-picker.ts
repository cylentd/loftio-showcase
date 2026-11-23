// The holo picker (2026-11-21): a tab per holo type plus Mix, and one animation toggle. One copy, shared by the compare
// board (`?holocard&holocompare`) and the storybook binder (#477 U7). State is holo-compare-model.ts; this file only
// draws it and reports presses.
import { HOLO_COPY } from './holo-card-copy';
import { el } from './holo-card-faces';
import type { BoardAction, BoardState } from './holo-compare-model';
import { HOLO_TABS, tabLabel } from './holo-type-data';
import './holo-picker.css';

export type HoloPicker = { bar: HTMLElement; buttons: HTMLButtonElement[]; toggle: HTMLButtonElement | null };

/** The bar: the tab group, then the toggle. `className` places it (the board's strip, the binder's row). */
export function holoPicker(dispatch: (action: BoardAction) => void, className: string, withToggle = true): HoloPicker {
  const bar = el('div', `holo-picker ${className}`);
  const tabs = el('div', 'holo-tabs');
  tabs.setAttribute('role', 'group');
  tabs.setAttribute('aria-label', HOLO_COPY.board.holos);
  const buttons = HOLO_TABS.map(tab => {
    const button = el('button', 'holo-tab', tabLabel(tab));
    button.type = 'button';
    button.dataset.tab = tab;
    button.addEventListener('click', () => dispatch({ kind: 'tab', tab }));
    return button;
  });
  tabs.append(...buttons);
  bar.append(tabs);
  if (!withToggle) return { bar, buttons, toggle: null };
  const toggle = el('button', 'holo-anim');
  toggle.type = 'button';
  toggle.append(el('span', 'holo-anim-label', HOLO_COPY.board.animation), el('span', 'holo-anim-state'));
  toggle.addEventListener('click', () => dispatch({ kind: 'toggle' }));
  bar.append(toggle);
  return { bar, buttons, toggle };
}

/** Marks the picked tab and the toggle's state. */
export function paintPicker(state: BoardState, ui: HoloPicker): void {
  for (const button of ui.buttons) button.setAttribute('aria-pressed', String(button.dataset.tab === state.tab));
  if (!ui.toggle) return;
  ui.toggle.setAttribute('aria-pressed', String(state.animate));
  const label = ui.toggle.children[1] as HTMLElement;
  label.textContent = state.animate ? HOLO_COPY.board.on : HOLO_COPY.board.off;
}
