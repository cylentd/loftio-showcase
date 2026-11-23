import { EXPRESSION_PROMPT_BLOCKS, EXPRESSION_PROMPT_ORDER, EXPRESSION_PROMPT_VERSION } from './expression-prompt-data.ts';
import type { ResolvedSelections } from './selections.ts';

export { EXPRESSION_PROMPT_VERSION };

/** The expression prompt: identity comes from the idle image alone; only the personality text is filled in (catalog text, never user text). */
export function renderExpressionPrompt(resolved: ResolvedSelections): string {
  const slots: Record<string, string> = { personality: resolved.personality.prompt };
  return EXPRESSION_PROMPT_ORDER.map(key => EXPRESSION_PROMPT_BLOCKS[key]).join('\n\n')
    .replace(/\{\{(\w+)\}\}/g, (match, name: string) => slots[name] ?? match);
}
