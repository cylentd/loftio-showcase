import { binderCards, cardSourceFor } from '../binder/binder-cards-model';
import '../binder/binder.css';
import { cardArtFor } from '../holo-card/card-art';
import { holoZoom } from '../holo-card/feature';
import '../holo-card/holo-card.css';
import '../holo-card/holo-types.css';
import type { SavedCharacter } from '../builder/records';
import { containFocus, worldButton } from '../world-ui';
import { RESIDENT_COPY } from './copy';

function firstResidentInspector(dialog: HTMLDialogElement, trigger: HTMLButtonElement) {
  const body = trigger.closest<HTMLElement>('.reveal-body');
  const scroll = body?.scrollTop;
  dialog.classList.add('first-resident-inspector');
  const close = worldButton(RESIDENT_COPY.close, () => dialog.close());
  close.classList.add('first-resident-inspector-close');
  for (const control of dialog.querySelectorAll('[autofocus]')) control.removeAttribute('autofocus');
  close.autofocus = true;
  dialog.prepend(close);
  containFocus(dialog, () => dialog.close());
  dialog.addEventListener('close', () => {
    trigger.focus({ preventScroll: true });
    if (body && scroll !== undefined) body.scrollTop = scroll;
  });
}

export function openArrivalCard(saved: SavedCharacter, name: string, trigger: HTMLButtonElement, reduced: boolean, first = false) {
  const source = cardSourceFor(saved, cardArtFor(saved), name);
  const [card] = binderCards({ originals: [], kept: [source], loft: new Set() }, () => null);
  const decorate = first ? (dialog: HTMLDialogElement) => firstResidentInspector(dialog, trigger) : undefined;
  if (card) holoZoom(reduced || matchMedia('(prefers-reduced-motion: reduce)').matches, undefined, decorate).open(card, trigger, () => {});
}
