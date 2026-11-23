import type { Element, Trait } from '../loadout/loadout-model.ts';
import { ALT_ID, ALT_MAX_SIDE, EXPRESSION_ID, EXPRESSION_MAX_SIDE } from './constants.ts';
import type { AltKind } from './alt-kind.ts';
import { ALT_PROMPT_VERSION, renderAltPrompt } from './alt-prompt.ts';
import { EXPRESSION_PROMPT_VERSION, renderExpressionPrompt } from './expression-prompt.ts';
import type { ResolvedSelections } from './selections.ts';

/** What a prompt may be built from: the build's picks and the resident's loadout. Every field is a fixed catalog value, never user text. */
export type FollowUpContext = { resolved: ResolvedSelections; residentId: string; kind: AltKind; trait: Trait; element: Element };

/** One image drawn after the idle. Worker and browser read this list, so a new follow-up is an entry here, not new wiring. */
export type FollowUpDef = {
  id: string;
  renderPrompt: (ctx: FollowUpContext) => string;
  promptVersion: string; // recorded on a ready slot, so a stored image says which prompt drew it
  references: readonly ('idle' | 'expression')[]; // which earlier images are sent as references, in order; one named for a slot that is not ready is left out
  alphaRequired: boolean; // a result with no transparency is failed('corrupt')
  maxSide: number;
};

export const FOLLOW_UPS: readonly FollowUpDef[] = [
  { id: EXPRESSION_ID, renderPrompt: ctx => renderExpressionPrompt(ctx.resolved), promptVersion: EXPRESSION_PROMPT_VERSION, references: ['idle'], alphaRequired: true, maxSide: EXPRESSION_MAX_SIDE },
  { id: ALT_ID, renderPrompt: renderAltPrompt, promptVersion: ALT_PROMPT_VERSION, references: ['idle', 'expression'], alphaRequired: false, maxSide: ALT_MAX_SIDE },
];

/** The artifact file names the list allows, png then webp per entry, in list order. */
export function followUpArtifactNames(list: readonly FollowUpDef[] = FOLLOW_UPS): string[] {
  return list.flatMap(entry => [`${entry.id}.png`, `${entry.id}.webp`]);
}
