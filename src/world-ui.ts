import { icon } from './icons';
import type { ICON_PATHS } from './icon-data';

export function worldButton(label: string, action: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'world-button'; button.textContent = label;
  button.addEventListener('click', action);
  return button;
}

export function worldDrawer(title: string, closeLabel: string) {
  const dialog = document.createElement('dialog'); dialog.className = 'world-drawer world-frame';
  const header = document.createElement('header'); header.className = 'world-header';
  const heading = document.createElement('h2'); heading.textContent = title;
  dialog.setAttribute('aria-label', title);
  // A round close set on the frame, like the settings close: icon only, named for screen readers.
  const close = worldButton('', () => dialog.close()); close.classList.add('world-close');
  close.setAttribute('aria-label', closeLabel); close.title = closeLabel; close.append(icon('close'));
  header.append(heading, close);
  const content = document.createElement('div'); content.className = 'world-content';
  dialog.append(header, content); document.body.append(dialog);
  let trigger: HTMLElement | null = null;
  dialog.addEventListener('close', () => trigger?.focus());
  return { dialog, content, open(from: HTMLElement) { trigger = from; if (!dialog.open) dialog.showModal(); } };
}

export function worldTabs(labels: string[], onSelect: (index: number) => void, icons: readonly (keyof typeof ICON_PATHS)[] = []) {
  const root = document.createElement('div'); root.className = 'world-tabs'; root.setAttribute('role', 'tablist');
  const buttons = labels.map((label, index) => worldButton(label, () => select(index)));
  buttons.forEach((button, index) => { const name = icons[index]; if (name) button.prepend(icon(name)); });
  const select = (selected: number) => {
    buttons.forEach((button, index) => { button.setAttribute('aria-selected', String(index === selected)); button.tabIndex = index === selected ? 0 : -1; });
    onSelect(selected);
  };
  buttons.forEach((button, index) => {
    button.setAttribute('role', 'tab');
    button.addEventListener('keydown', event => {
      const next = event.key === 'ArrowRight' ? (index + 1) % buttons.length : event.key === 'ArrowLeft'
        ? (index - 1 + buttons.length) % buttons.length : event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : null;
      if (next === null) return;
      event.preventDefault(); select(next); buttons[next]!.focus();
    });
  });
  root.append(...buttons);
  return { root, select };
}

export function containFocus(container: HTMLElement, close: () => void) {
  container.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); close(); return; }
    if (event.key !== 'Tab') return;
    const items = [...container.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select, summary, [tabindex="0"]')]
      .filter(item => item.getClientRects().length > 0);
    const first = items[0], last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
}
