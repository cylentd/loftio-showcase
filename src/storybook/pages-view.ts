// One storybook page (#565 S4): a 3x3 grid of small cards in list order, the resident's name small under its first
// card, empty slots left for the margin sketches, and the folio. Faces come from the caller (the real holo card in
// the game, a plain button in tests) and are built once per page.
import { BINDER_COPY } from '../binder/binder-copy';
import type { CardFace } from '../binder/binder-pocket';
import { el } from '../holo-card/holo-card-faces';
import { zoomSubjects } from '../holo-card/feature';
import { originalSubject, type CardSubject } from '../holo-card/holo-card-subject';
import type { PageCardData } from './pages';

export type PageCard = { id: string; side: string; face: CardFace };
export type PageView = { root: HTMLElement; cards: PageCard[]; dispose(): void };

export function pageView(list: PageCardData[], index: number, slots: number, face: (subject: CardSubject) => CardFace,
  onTap: (card: PageCardData, button: HTMLButtonElement) => void): PageView {
  const root = el('section', 'storybook-page');
  root.dataset.page = String(index);
  const grid = el('div', 'storybook-grid');
  const cards = list.map(card => {
    const subject = 'made' in card ? zoomSubjects(card.made).normal : originalSubject(card.id, '', card.variant);
    const made = face(subject);
    made.button.dataset.side = card.side;
    made.button.dataset.resident = card.id;
    made.button.setAttribute('aria-label', `${made.button.getAttribute('aria-label') ?? subject.name} ${BINDER_COPY[card.side as keyof typeof BINDER_COPY]}`);
    made.button.addEventListener('click', event => { if (made.isTap(event as MouseEvent)) onTap(card, made.button); });
    const slot = el('div', `storybook-card storybook-card-${card.side}`);
    slot.append(made.button);
    if (card.named) slot.append(el('p', 'storybook-name', subject.name));
    grid.append(slot);
    return { id: card.id, side: card.side, face: made };
  });
  for (let empty = list.length; empty < slots; empty++) grid.append(el('div', 'storybook-card storybook-slot-empty'));
  // The margin sketches (S4): a band over the cards, a tailpiece under them, two corners. Decoration only.
  const sketch = (name: string) => { const node = el('div', `storybook-sketch ${name}`); node.setAttribute('aria-hidden', 'true'); return node; };
  // S5: two faint vignettes behind the grid, seen in the gutters between cards and round the grid, never over a card.
  root.append(sketch('storybook-sketch-behind'), sketch('storybook-corner-tl'), sketch('storybook-corner-br'), sketch('storybook-sketch-head'), grid,
    sketch('storybook-sketch-tail'), el('p', 'storybook-folio', String(index + 1)));
  return { root, cards, dispose: () => { for (const card of cards) card.face.dispose(); } };
}
