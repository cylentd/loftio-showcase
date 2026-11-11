import puff from '../art/crew/puff.webp';
import { CATALOG } from '../builder/catalog-data.ts';
import { memoryStore } from '../builder/store.ts';
import { resolveSelections, type UserSelections } from '../builder/selections.ts';
import type { GenerationRecord, SavedCharacter } from '../builder/records.ts';

const PREVIEW_ID = 'arrival-preview';
const PREVIEW_TIME = '2026-01-01T00:00:00.000Z'; // fixed, so captures do not differ by clock
// Not read on this path: only image inspection checks them, and the preview skips it.
const UNMEASURED = 0;

// One waiting resident drawn with a canonical painted crew image, held in memory only.
function previewCharacter(): SavedCharacter {
  const userSelections: UserSelections = { creature: CATALOG.creatures[0]!.id, personality: CATALOG.personalities[0]!.id, signatureDetail: CATALOG.signatureDetails[0]!.id, palette: null };
  const resolvedSelections = resolveSelections(userSelections, () => 0);
  const generation: GenerationRecord = {
    id: PREVIEW_ID, requestId: PREVIEW_ID, userSelections, resolvedSelections, promptVersion: 'arrival-preview', prompt: '',
    referenceIds: [], providerId: 'preview', modelId: 'crew-art', attempts: 1, createdAt: PREVIEW_TIME,
  };
  return {
    schemaVersion: 2, id: PREVIEW_ID, state: 'draft', generationId: PREVIEW_ID, userSelections, resolvedSelections,
    promptVersion: generation.promptVersion, providerModelId: 'preview/crew-art', referenceIds: [],
    image: { schemaVersion: 2, mime: 'image/webp', url: puff, originalUrl: puff, bytes: UNMEASURED, width: UNMEASURED, height: UNMEASURED, hasAlphaChannel: true },
    generation, keptAt: PREVIEW_TIME, parentId: null, identityNotes: null,
  };
}

// Every store the session reads is in memory, so a preview leaves nothing in localStorage or IndexedDB.
export function previewBackend() {
  const store = memoryStore();
  void store.put(previewCharacter());
  const items = new Map<string, string>();
  const storage = { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => { items.set(key, value); } };
  return { store, storage };
}
