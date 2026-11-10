import { catalogOptions, orderedPickerOptions } from '../builder/curated';
import type { CatalogOption } from '../builder/catalog-data';
import type { SelectionField } from '../builder/selections';
import { worldButton } from '../world-ui';
import { icon } from '../icons';
import { WIZARD_COPY as COPY } from './copy';

export function questionPicker(field: SelectionField, uid: string, actions: {
  card(field: SelectionField, id: string | null): HTMLButtonElement;
  pick(field: SelectionField, id: string | null, button: HTMLButtonElement): void;
  pickForMe(button: HTMLButtonElement): void;
}) {
  const root = document.createElement('div'); root.className = 'wizard-options';
  const grid = document.createElement('div'); grid.className = 'wizard-cards'; grid.dataset.field = field;
  grid.id = uid + '-' + field + '-choices'; grid.setAttribute('role', 'group');
  const pickForMe = worldButton(COPY.pickForMe, () => actions.pickForMe(pickForMe));
  pickForMe.className = 'wizard-card wizard-random';
  const randomArt = document.createElement('span'); randomArt.className = 'wizard-art wizard-die'; randomArt.setAttribute('aria-hidden', 'true');
  randomArt.append(icon('dice')); pickForMe.prepend(randomArt);
  const ids: (string | null)[] = catalogOptions(field).map(option => option.id);
  if (field === 'palette') ids.push(null);
  const cards = ids.map(value => {
    const button = actions.card(field, value);
    button.addEventListener('click', () => actions.pick(field, value, button));
    return { button, field, value };
  });
  const buttons = new Map(cards.map(item => [item.value, item.button]));
  root.append(grid);
  return { root, grid, pickForMe, cards, update(options: readonly CatalogOption[], busy: boolean) {
    const shown = orderedPickerOptions(field, options).map(option => buttons.get(option.id)!);
    if (field === 'palette') shown.push(buttons.get(null)!);
    shown.push(pickForMe);
    if (grid.children.length !== shown.length || shown.some((button, index) => grid.children[index] !== button)) grid.replaceChildren(...shown);
    pickForMe.disabled = busy;
  } };
}
