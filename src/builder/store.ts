import type { SavedCharacter } from './records.ts';

export type CharacterStore = {
  list(): Promise<SavedCharacter[]>;
  put(character: SavedCharacter): Promise<void>;
};

export function memoryStore(): CharacterStore {
  const records = new Map<string, SavedCharacter>();
  return {
    async list() { return structuredClone([...records.values()]); },
    async put(character) { records.set(character.id, structuredClone(character)); },
  };
}
