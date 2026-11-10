import type { CatalogOption } from "./catalog-data.ts";

export const CREATIVE_SURPRISE = {
  creature: {
    id: "invented-creature", label: "Original creature",
    prompt: "Invent an original creature or whimsical object-inspired companion beyond the preset catalog. Respect all explicit selections; make one coherent, lovable Loftio resident, not an existing named character.",
  },
  personality: {
    id: "invented-personality", label: "Original personality",
    prompt: "Invent a distinctive personality beyond the preset moods. Respect all explicit selections, including a deliberately absent accessory; convey personality through expression, pose and form.",
  },
  signatureDetail: {
    id: "invented-detail", label: "Original detail",
    prompt: "Invent an unexpected signature detail beyond the preset accessories. Respect all explicit selections and integrate the detail into the character; no held objects or scenery.",
  },
} as const satisfies Record<string, CatalogOption>;
