import type { BuilderMode } from '../builder/local-mode.ts';

// ?arrival opens the arrival reveal for a seeded resident, for captures and QA.
// Honoured only in mock mode, so no real visitor can reach it.
export const arrivalPreview = (search: string, mode: BuilderMode) =>
  mode === 'mock' && new URLSearchParams(search).has('arrival');
