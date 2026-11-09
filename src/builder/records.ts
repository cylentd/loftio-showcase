import type { UserSelections, ResolvedSelections } from './selections.ts';

export type GenerationRecord = {
  id: string;
  requestId: string;
  userSelections: UserSelections;
  resolvedSelections: ResolvedSelections;
  promptVersion: string;
  prompt: string;
  referenceIds: readonly string[];
  providerId: string;
  modelId: string;
  attempts: number;
  createdAt: string;
};

export type GeneratedImage = {
  base64: string;
  mime: 'image/png';
  width: number;
  height: number;
  hasAlphaChannel: boolean;
} | {
  schemaVersion: 2;
  mime: 'image/webp';
  url: string;
  originalUrl: string;
  bytes: number;
  width: number;
  height: number;
  hasAlphaChannel: boolean;
};

export type SavedCharacter = {
  schemaVersion?: 2;
  id: string;
  state: 'kept' | 'draft';
  generationId: string;
  userSelections: UserSelections;
  resolvedSelections: ResolvedSelections;
  promptVersion: string;
  providerModelId: string;
  referenceIds: readonly string[];
  image: GeneratedImage;
  generation: GenerationRecord;
  keptAt: string;
  parentId: string | null;
  identityNotes: string | null;
};
