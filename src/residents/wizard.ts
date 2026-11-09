import { SURPRISE } from '../builder/catalog-data.ts';
import { CURATED } from '../builder/curated.ts';
import type { SelectionField } from '../builder/selections.ts';

/** One question per step, in this order; the step after the last field is the summary. */
export const WIZARD_FIELDS = ['creature', 'personality', 'signatureDetail', 'palette'] as const satisfies readonly SelectionField[];
export const SUMMARY_STEP = WIZARD_FIELDS.length;

type Picker = { select(field: SelectionField, value: string | null): void; create(): unknown };

/** The Create panel's step flow. Picks go straight to the builder; the wizard only owns which step is showing. */
export function createWizard(builder: Picker, rng: () => number) {
  let step = 0;
  // The builder always holds a selection; a card shows as picked only once the user has picked on that step.
  const picked = new Set<SelectionField>();
  const goTo = (next: number) => { step = Math.max(0, Math.min(SUMMARY_STEP, next)); };
  const field = (): SelectionField | null => WIZARD_FIELDS[step] ?? null;
  const choose = (value: string | null) => {
    const current = field(); if (!current) return;
    builder.select(current, value); picked.add(current); goTo(step + 1);
  };
  return {
    get step() { return step; },
    get field() { return field(); },
    chosen: (target: SelectionField) => picked.has(target),
    choose,
    /** The dice: surprise for friend, feeling and extra; colours have no surprise value, so it draws a real palette. */
    surprise() {
      const palettes = CURATED.palette;
      choose(field() === 'palette' ? palettes[Math.min(palettes.length - 1, Math.floor(rng() * palettes.length))]! : SURPRISE);
    },
    back() { goTo(step - 1); },
    /** After a resident is made: a fresh design from the first question. The builder keeps its last picks as defaults. */
    restart() { picked.clear(); goTo(0); },
    goTo,
    make() { return step === SUMMARY_STEP ? builder.create() : undefined; },
  };
}
