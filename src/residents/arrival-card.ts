import { binderCards, cardSourceFor } from '../binder/binder-cards-model';
import '../binder/binder.css';
import { cardArtFor } from '../holo-card/card-art';
import { holoZoom } from '../holo-card/feature';
import '../holo-card/holo-card.css';
import '../holo-card/holo-types.css';
import type { SavedCharacter } from '../builder/records';

export function openArrivalCard(saved: SavedCharacter, name: string, trigger: HTMLButtonElement, reduced: boolean) {
  const source = cardSourceFor(saved, cardArtFor(saved), name);
  const [card] = binderCards({ originals: [], kept: [source], loft: new Set() }, () => null);
  if (card) holoZoom(reduced || matchMedia('(prefers-reduced-motion: reduce)').matches).open(card, trigger, () => {});
}
