import { CATALOG, SURPRISE } from '../builder/catalog-data.ts';
import { CURATED, iconFor } from '../builder/curated.ts';
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

/** What a card or summary pick draws for one selection. A saved pick outside the curated cards has no figure,
 *  so it shows its name instead of an empty picture. */
export function pickTile(field: SelectionField, id: string | null): PickTile {
  if (id === SURPRISE) return { kind: 'die', label: WIZARD_COPY.surprisePick };
  if (id === null) return { kind: 'swatch', palette: 'any', label: WIZARD_COPY.anyPalette };
  const label = ALL_OPTIONS[field].find(option => option.id === id)?.label ?? id;
  if (!(CURATED[field] as readonly string[]).includes(id)) return { kind: 'text', label };
  if (field === 'palette') return { kind: 'swatch', palette: id, label };
  return { kind: 'image', src: iconFor(field, id)!, label };
}
