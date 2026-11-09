import { PROMPT_TEMPLATE } from "./prompt-template.ts";
import type { ResolvedSelections } from "./selections.ts";

export const PROMPT_VERSION = "v4.1";

/**
 * Positive references sent with every render, per the v4 reference policy. The approved-assets roster sheet is for
 * post-render collision review only, and the diagnostics are failure examples: neither is ever attached.
 */
export const REFERENCES = [
  { id: "loftio-original-six", role: "style", file: "loftio-original-six.png" },
  { id: "loftio-exploratory-concepts", role: "range", file: "loftio-exploratory-concepts.png" },
] as const;

export const REFERENCE_IDS: readonly string[] = REFERENCES.map(reference => reference.id);

/** Fills the template. Values come from the catalog, never from user text, so no escaping is needed yet. */
export function renderPrompt(resolved: ResolvedSelections): string {
  const slots: Record<string, string> = {
    creature: resolved.creature.prompt,
    personality: resolved.personality.prompt,
    signature_detail: resolved.signatureDetail.prompt,
    resolved_palette: resolved.palette.prompt,
  };
  return PROMPT_TEMPLATE.replace(/\{\{(\w+)\}\}/g, (match, name: string) => slots[name] ?? match);
}
