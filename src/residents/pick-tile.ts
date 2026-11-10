import { CATALOG, SURPRISE } from '../builder/catalog-data.ts';
import { iconFor } from '../builder/curated.ts';
import type { SelectionField } from '../builder/selections.ts';
import { WIZARD_COPY } from './copy.ts';

const ALL_OPTIONS: Record<SelectionField, readonly { id: string; label: string }[]> = {
  creature: CATALOG.creatures, personality: CATALOG.personalities, signatureDetail: CATALOG.signatureDetails, palette: CATALOG.palettes,
};

export type PickTile =
  | { kind: 'image'; src: string; label: string }
  | { kind: 'swatch'; palette: string; label: string }
  | { kind: 'die'; label: string }
  | { kind: 'text'; label: string };

/** Catalog picks draw their felt art; retired saved ids stay readable without requesting missing images. */
export function pickTile(field: SelectionField, id: string | null): PickTile {
  if (id === SURPRISE) return { kind: 'die', label: WIZARD_COPY.surprisePick };
  if (id === null) return { kind: 'swatch', palette: 'any', label: WIZARD_COPY.anyPalette };
  const option = ALL_OPTIONS[field].find(option => option.id === id);
  if (!option) return { kind: 'text', label: id };
  const label = option.label;
  if (field === 'palette') return { kind: 'swatch', palette: id, label };
  return { kind: 'image', src: iconFor(field, id)!, label };
}
