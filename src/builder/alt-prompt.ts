import { ALT_PROMPT_BLOCKS, ALT_PROMPT_ORDER, ALT_PROMPT_VERSION } from './alt-prompt-data.ts';
import type { FollowUpContext } from './follow-ups.ts';

export { ALT_PROMPT_VERSION };

/**
 * The alt prompt: identity comes from the reference images alone. The kind, trait and element each pick one fixed block, so no
 * free text reaches the prompt. The kind arrives in the context; this never derives it.
 */
export function renderAltPrompt(ctx: FollowUpContext): string {
  const picked = { ...ALT_PROMPT_BLOCKS, kind: ALT_PROMPT_BLOCKS.kind[ctx.kind], trait: ALT_PROMPT_BLOCKS.trait[ctx.trait], element: ALT_PROMPT_BLOCKS.element[ctx.element] };
  return ALT_PROMPT_ORDER.map(key => picked[key]).join('\n\n');
}
