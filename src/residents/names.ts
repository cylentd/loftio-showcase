import { RESIDENT_NAME_LIMIT } from './name-constants.ts';
import { SUGGESTED_NAMES } from './names-data.ts';
import { RESIDENT_COPY as COPY } from './copy.ts';

export function residentName(value: unknown): string {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f-\u009f\ud800-\udfff]/u.test(value)) throw Error(COPY.nameInvalid);
  const name = value.trim();
  if (!name || Array.from(name).length > RESIDENT_NAME_LIMIT) throw Error(COPY.nameInvalid);
  return name;
}

export function suggestedName(id: string): string {
  const index = Array.from(id).reduce((total, character) => total + character.codePointAt(0)!, 0);
  return SUGGESTED_NAMES[index % SUGGESTED_NAMES.length]!;
}
