import { parseLoadout } from '../loadout/loadout-model.ts';
import { parseFollowUp } from './follow-up-model.ts';
import { ALT_REFERENCES, validImage } from './records.ts';
import type { AltReference, SavedAlt, SavedCharacter } from './records.ts';

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

// validImage lives in records.ts (a model file) so parseFollowUp can use it without a model importing a contract.
export { validImage };

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

// A bad loadout is dropped and nothing else about the record: the controller's load() backfills a missing one, and one
// resident's loadout must never fail the whole list. Validity is the loadout model's call, not this file's.
function readLoadout(record: SavedCharacter): SavedCharacter {
  if (!('rumble' in record)) return record;
  const { rumble, ...rest } = record;
  const loadout = parseLoadout(rumble);
  return loadout ? { ...rest, rumble: loadout } : rest;
}

// A bad expression slot is dropped alone, like a bad loadout: the resident then shows its idle only.
function readExpression(record: SavedCharacter): SavedCharacter {
  if (!('expression' in record)) return record;
  const { expression, ...rest } = record;
  const slot = parseFollowUp(expression);
  return slot ? { ...rest, expression: slot } : rest;
}

/** A stored alt, or null when malformed (a bad kind, slot or references list). Never throws. */
function parseAlt(value: unknown): SavedAlt | null {
  try {
    if (!object(value) || value.schemaVersion !== 1 || (value.kind !== 'A' && value.kind !== 'B')) return null;
    const slot = parseFollowUp(value.slot);
    if (!slot) return null;
    const alt: SavedAlt = { schemaVersion: 1, kind: value.kind, slot };
    if (value.references === undefined) return alt;
    const refs = value.references;
    if (!Array.isArray(refs) || !refs.every(ref => (ALT_REFERENCES as readonly unknown[]).includes(ref))) return null;
    return { ...alt, references: refs as AltReference[] };
  } catch { return null; }
}

// A bad alt is dropped alone, like a bad expression: the resident then shows no alt, and nothing else about it changes.
function readAlt(record: SavedCharacter): SavedCharacter {
  if (!('alt' in record)) return record;
  const { alt, ...rest } = record;
  const parsed = parseAlt(alt);
  return parsed ? { ...rest, alt: parsed } : rest;
}

export function readSavedCharacters(input: unknown): SavedCharacter[] {
  if (!Array.isArray(input) || !input.every(validCharacter)) throw new Error('Invalid saved residents');
  return (input as SavedCharacter[]).map(record => readAlt(readExpression(readLoadout(record))));
}
