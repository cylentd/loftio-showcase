import { CATALOG, SURPRISE, type CatalogOption, type PaletteOption } from "./catalog-data.ts";
import { CREATIVE_SURPRISE } from "./surprise-data.ts";

/** What the user picked: catalog ids, `surprise`, or a null palette ("Loftio chooses"). */
export type UserSelections = { creature: string; personality: string; signatureDetail: string; palette: string | null };
/** Prompt inputs: catalog choices or model-invention directives, not invented metadata. */
export type ResolvedSelections = {
  creature: CatalogOption;
  personality: CatalogOption;
  signatureDetail: CatalogOption;
  palette: PaletteOption;
};
export type SelectionField = keyof UserSelections;
export type Rng = () => number;
export type Validation = { ok: true; value: UserSelections } | { ok: false; errors: SelectionField[] };

const GROUPS = {
  creature: CATALOG.creatures,
  personality: CATALOG.personalities,
  signatureDetail: CATALOG.signatureDetails,
} as const;

const known = (group: readonly CatalogOption[], id: unknown) =>
  typeof id === "string" && (id === SURPRISE || group.some(option => option.id === id));

export function validateSelections(input: unknown): Validation {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, errors: ["creature", "personality", "signatureDetail", "palette"] };
  }
  const body = input as Record<string, unknown>;
  const errors: SelectionField[] = [];
  for (const field of Object.keys(GROUPS) as (keyof typeof GROUPS)[]) {
    if (!known(GROUPS[field], body[field])) errors.push(field);
  }
  const paletteOk = body.palette === null || (typeof body.palette === "string" && CATALOG.palettes.some(p => p.id === body.palette));
  if (!paletteOk) errors.push("palette");
  if (errors.length) return { ok: false, errors };
  const { creature, personality, signatureDetail, palette } = body as UserSelections;
  return { ok: true, value: { creature, personality, signatureDetail, palette } };
}

function pick<T extends CatalogOption>(group: readonly T[], id: string | null, rng: Rng): T {
  const chosen = id === null || id === SURPRISE ? group[Math.min(group.length - 1, Math.floor(rng() * group.length))] : group.find(o => o.id === id);
  if (!chosen) throw new Error(`unknown catalog id: ${id}`);
  return chosen;
}

/** Call only on validated selections. Palette omission retains its automatic catalog choice. */
export function resolveSelections(selections: UserSelections, rng: Rng): ResolvedSelections {
  return {
    creature: selections.creature === SURPRISE ? CREATIVE_SURPRISE.creature : pick(CATALOG.creatures, selections.creature, rng),
    personality: selections.personality === SURPRISE ? CREATIVE_SURPRISE.personality : pick(CATALOG.personalities, selections.personality, rng),
    signatureDetail: selections.signatureDetail === SURPRISE ? CREATIVE_SURPRISE.signatureDetail : pick(CATALOG.signatureDetails, selections.signatureDetail, rng),
    palette: pick(CATALOG.palettes, selections.palette, rng),
  };
}
