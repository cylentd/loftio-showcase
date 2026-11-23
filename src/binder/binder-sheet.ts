// The options sheet a pocket's loft mark opens (#477). It lists the resident's actions, the loft move first, and a
// feature's block (abilities) under the name. A blocked action stays visible, disabled, with the reason under it. A
// failed action keeps the sheet open with an alert. Escape, the backdrop and the close button close it, except while an
// action runs (G14 refuses close when busy), and focus goes back to the
// button that opened it, or to the page when the resident has left.
import { NAMES } from '../copy';
import { el } from '../holo-card/holo-card-faces';
import { dismissOnBackdrop } from '../world-ui';
import { BINDER_COPY } from './binder-copy';

const SVG = 'http://www.w3.org/2000/svg';

function closeIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg') as SVGSVGElement;
  for (const [key, value] of [['viewBox', '0 0 24 24'], ['aria-hidden', 'true'], ['class', 'binder-close-icon']]) svg.setAttribute(key!, value!);
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', 'M6 6l12 12M18 6 6 18');
  svg.append(path);
  return svg;
}

/** The first element under `root` that matches, walking `children` (no selector engine needed). */
function find(root: Element, match: (node: HTMLElement) => boolean): HTMLElement | null {
  for (const child of Array.from(root.children) as HTMLElement[]) {
    if (match(child)) return child;
    const inner = find(child, match);
    if (inner) return inner;
  }
  return null;
}

/** One button in the sheet. `blocked` is the reason it cannot run now (shown under it); null or absent, it runs. */
export type SheetEntry = { id: string; label: string; run: () => void | Promise<void>; blocked?: string | null };
/** What the sheet shows for one resident. */
export type SheetContent = { id: string; name?: string; inLoft: boolean; detail: HTMLElement | null; entries: SheetEntry[] };

function sheetButton(entry: SheetEntry, primary: boolean, onRun: (entry: SheetEntry) => void): HTMLElement[] {
  const node = el('button', primary ? 'world-button world-primary binder-action' : 'world-button binder-action', entry.label);
  node.type = 'button';
  node.dataset.action = entry.id;
  node.addEventListener('click', () => onRun(entry));
  if (!entry.blocked) return [node];
  node.disabled = true;
  node.setAttribute('aria-describedby', `binder-blocked-${entry.id}`);
  const why = el('p', 'binder-sheet-blocked', entry.blocked);
  why.id = `binder-blocked-${entry.id}`;
  return [node, why];
}

/** The dialog and its parts: close, title and status, the feature block, the alert and the action list. */
function sheetChrome() {
  const dialog = el('dialog', 'binder-sheet') as HTMLDialogElement;
  const title = el('h2', 'binder-sheet-title');
  title.id = 'binder-sheet-title';
  dialog.setAttribute('aria-labelledby', title.id);
  const status = el('p', 'binder-sheet-status');
  const close = el('button', 'binder-sheet-close');
  close.type = 'button';
  close.setAttribute('aria-label', BINDER_COPY.close);
  close.addEventListener('click', () => dialog.close());
  close.append(closeIcon());
  // G14 refuses `close` while an action runs: Escape (cancel), the backdrop and the close button all end here.
  const forceClose = dialog.close.bind(dialog);
  dialog.addEventListener('cancel', event => { if (dialog.dataset.busy === 'true') event.preventDefault(); });
  dialog.close = () => { if (dialog.dataset.busy !== 'true') forceClose(); };
  const detail = el('div', 'binder-sheet-detail');
  const alert = el('p', 'binder-sheet-alert');
  alert.setAttribute('role', 'alert');
  const list = el('div', 'binder-sheet-actions');
  const head = el('div', 'binder-sheet-head');
  head.append(title, status);
  dialog.append(close, head, detail, alert, list);
  dismissOnBackdrop(dialog);
  return { dialog, title, status, detail, alert, list, forceClose };
}

export function optionsSheet(onRun: (entry: SheetEntry) => void) {
  const ui = sheetChrome(), dialog = ui.dialog;
  let trigger: HTMLElement | null = null, fallback: HTMLElement | null = null, shownId: string | null = null;
  dialog.addEventListener('close', () => {
    const back = trigger?.isConnected === false ? fallback : trigger;
    back?.focus(); trigger = null; shownId = null;
  });

  /** Draws `content`; a redraw for the same resident keeps focus on the same action, or the same button in the block. */
  const draw = (content: SheetContent) => {
    const same = shownId === content.id, active = document.activeElement as HTMLElement | null;
    const focused = same ? active?.dataset?.action : undefined;
    const inBlock = same && active !== null && find(ui.detail, node => node === active) ? active.className : null;
    shownId = content.id;
    ui.title.textContent = content.name ?? NAMES[content.id] ?? content.id;
    ui.status.textContent = BINDER_COPY.status(content.inLoft);
    dialog.dataset.loft = content.inLoft ? 'in' : 'away';
    ui.detail.replaceChildren(...(content.detail ? [content.detail] : []));
    ui.detail.hidden = content.detail === null;
    const nodes = content.entries.flatMap((entry, index) => sheetButton(entry, index === 0, onRun));
    ui.list.replaceChildren(...nodes);
    if (focused !== undefined) nodes.find(node => node.dataset.action === focused)?.focus();
    if (inBlock !== null) find(ui.detail, node => node.className === inBlock)?.focus();
  };

  const open = (content: SheetContent, from: HTMLElement, back: HTMLElement) => {
    trigger = from; fallback = back; shownId = null;
    ui.alert.textContent = '';
    draw(content);
    dialog.showModal();
    (ui.list.children[0] as HTMLButtonElement | undefined)?.focus();
  };
  return {
    dialog, open,
    refresh: (content: SheetContent) => { if (dialog.open && shownId === content.id) draw(content); },
    fail: (message: string) => { ui.alert.textContent = message; },
    busy: (on: boolean) => { dialog.dataset.busy = String(on); },
    shown: () => (dialog.open ? shownId : null),
    close: () => dialog.close(),
    /** The resident left: close, and focus the page rather than a mark that is gone. */
    leave: () => { trigger = fallback; ui.forceClose(); },
  };
}
