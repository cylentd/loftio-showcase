// The picture-card subset the Residents Create panel shows, in card order. The full catalog stays valid for saved
// residents and the worker prompt; this only chooses which ids a child sees. Card labels are the catalog labels.
// Icons are sliced from the art sheets by scripts/slice_builder_icons.py into public/builder.
import { CATALOG, type CatalogOption } from './catalog-data.ts';
import type { SelectionField } from './selections.ts';
import { POPULAR_CREATURES } from './picker-order.ts';

export const CURATED = {
  creature: ['bunny', 'cat', 'puppy', 'fox', 'frog', 'penguin', 'tiny-dragon', 'little-ghost'],
  personality: ['sleepy', 'playful', 'bashful', 'curious', 'serious', 'mischievous'],
  signatureDetail: ['round-glasses', 'tiny-bow', 'scarf', 'beret', 'flower-tuft', 'none'],
  palette: ['blackberry', 'apricot', 'dusty-blue', 'cocoa', 'frost', 'meadow'],
} as const satisfies Record<SelectionField, readonly string[]>;

const GROUPS: Record<SelectionField, readonly CatalogOption[]> = {
  creature: CATALOG.creatures, personality: CATALOG.personalities, signatureDetail: CATALOG.signatureDetails, palette: CATALOG.palettes,
};
const ICON_PREFIX: Partial<Record<SelectionField, string>> = { creature: 'creature', personality: 'personality', signatureDetail: 'detail' };

export function catalogOptions(field: SelectionField): CatalogOption[] {
  return [...GROUPS[field]];
}

export function hasMoreOptions(field: SelectionField): boolean {
  return GROUPS[field].length > CURATED[field].length;
}

export function orderedPickerOptions(field: SelectionField, options: readonly CatalogOption[]): CatalogOption[] {
  const preferred = field === 'creature' ? POPULAR_CREATURES : CURATED[field];
  const ranks = new Map<string, number>(preferred.map((id, index) => [id, index]));
  return [...options].sort((left, right) => (ranks.get(left.id) ?? preferred.length) - (ranks.get(right.id) ?? preferred.length));
}

/** The curated catalog entries for one step, in card order. */
export function curatedOptions(field: SelectionField): CatalogOption[] {
  return CURATED[field].map(id => GROUPS[field].find(option => option.id === id)!);
}

/** The card picture, relative to the page; palettes draw swatches instead and have none. */
export function iconFor(field: SelectionField, id: string): string | null {
  const prefix = ICON_PREFIX[field];
  return prefix ? `builder/${prefix}-${id}.webp` : null;
}
