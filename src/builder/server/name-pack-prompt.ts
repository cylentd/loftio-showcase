// The text request for a resident's themed-name pack (#442 P2). Inputs are the three preset labels only: never the
// image prompt text, the palette, or anything the player typed (the builder has no free-text field).
import { NAME_MAX_LENGTH, SPECIALS, SYNERGIES } from '../../loadout/loadout-data.ts';
import type { ResolvedSelections } from '../selections.ts';

const IDS = [...SYNERGIES, ...SPECIALS].map((entry) => entry.id);

/** The prompt for one resident. Every id appears quoted, so the reply's keys are the ids the parser reads. */
export function renderNamePrompt(resolved: ResolvedSelections): string {
  const { creature, personality, signatureDetail } = resolved;
  return [
    'You name the moves of a small cozy game character.',
    `The character is a ${creature.label}. Personality: ${personality.label}. Signature detail: ${signatureDetail.label}.`,
    'Give each move id below one short, playful name in that character\'s voice.',
    `Rules: at most ${NAME_MAX_LENGTH} characters, letters, digits, spaces, apostrophes and hyphens only, no emoji, no brand or franchise names, nothing rude, family friendly.`,
    `Reply with one JSON object whose keys are exactly these ids and whose values are the names: ${IDS.map((id) => `"${id}"`).join(', ')}.`,
  ].join('\n');
}
