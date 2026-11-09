import type { SavedCharacter } from './records.ts';
import { readPngInfo } from './png.ts';
import { IMAGE_MAX_BYTES, IMAGE_MAX_SIDE } from './constants.ts';

const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string');
const textFields = (value: Record<string, unknown>, fields: string[]) => fields.every(field => typeof value[field] === 'string');

function validSelections(value: unknown) {
  return object(value) && textFields(value, ['creature', 'personality', 'signatureDetail'])
    && (value.palette === null || typeof value.palette === 'string');
}

function validResolved(value: unknown) {
  if (!object(value)) return false;
  for (const field of ['creature', 'personality', 'signatureDetail', 'palette']) {
    const option = value[field];
    if (!object(option) || !textFields(option, ['id', 'label', 'prompt'])) return false;
  }
  return object(value.palette) && strings(value.palette.colors);
}

export function validImage(value: unknown) {
  if (object(value) && value.mime === 'image/webp') {
    const match = typeof value.url === 'string' && /^\/loftio-builder-api\/artifacts\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\/preview\.webp$/.exec(value.url);
    return !!match && value.schemaVersion === 2 && value.originalUrl === `/loftio-builder-api/artifacts/${match[1]}/original.png`
      && value.hasAlphaChannel === true && Number.isInteger(value.bytes) && Number(value.bytes) > 0 && Number(value.bytes) <= IMAGE_MAX_BYTES
      && [value.width, value.height].every(side => Number.isInteger(side) && Number(side) > 0 && Number(side) <= IMAGE_MAX_SIDE);
  }
  if (!object(value) || value.mime !== 'image/png' || typeof value.base64 !== 'string'
    || value.base64.length > IMAGE_MAX_BYTES * 2 || typeof value.hasAlphaChannel !== 'boolean') return false;
  try {
    const bytes = Uint8Array.from(atob(value.base64), character => character.charCodeAt(0));
    const info = readPngInfo(bytes);
    return !!info && bytes.length <= IMAGE_MAX_BYTES && info.width === value.width && info.height === value.height
      && info.width <= IMAGE_MAX_SIDE && info.height <= IMAGE_MAX_SIDE;
  } catch { return false; }
}

export function validGeneration(value: unknown) {
  return object(value) && textFields(value, ['id', 'requestId', 'promptVersion', 'prompt', 'providerId', 'modelId', 'createdAt'])
    && validSelections(value.userSelections) && validResolved(value.resolvedSelections)
    && strings(value.referenceIds) && Number.isInteger(value.attempts) && Number(value.attempts) > 0;
}

function validCharacter(value: unknown) {
  return object(value) && textFields(value, ['id', 'generationId', 'promptVersion', 'providerModelId', 'keptAt'])
    && (value.schemaVersion === undefined || value.schemaVersion === 2)
    && (value.state === 'kept' || value.state === 'draft') && validSelections(value.userSelections) && validResolved(value.resolvedSelections)
    && strings(value.referenceIds) && validImage(value.image) && validGeneration(value.generation)
    && (value.parentId === null || typeof value.parentId === 'string')
    && (value.identityNotes === null || typeof value.identityNotes === 'string');
}

export function readSavedCharacters(input: unknown): SavedCharacter[] {
  if (!Array.isArray(input) || !input.every(validCharacter)) throw new Error('Invalid saved residents');
  return input as SavedCharacter[];
}
