import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBuilder } from '../src/builder/controller.ts';
import { mockApi } from '../src/builder/mock-api.ts';
import { memoryStore } from '../src/builder/store.ts';
import { readSavedCharacters } from '../src/builder/storage-contract.ts';

async function saved() {
  const store = memoryStore();
  const builder = createBuilder({
    api: mockApi({ rng: () => 0, now: () => new Date('2026-11-05T12:00:00Z'), newId: () => 'stored-generation' }),
    store, newId: () => 'storage-contract',
    now: () => new Date('2026-11-05T12:30:00Z'), inspect: async () => ({ verdict: 'transparent' }),
  }, { creature: 'moth', personality: 'bookworm', signatureDetail: 'reading-glasses', palette: null });
  await builder.create();
  await builder.keep();
  return store.list();
}

test('persisted mock residents retain complete generation metadata', async () => {
  const records = await saved();
  assert.equal(records.length, 1);
  assert.deepEqual(readSavedCharacters(records), records);
  assert.equal(records[0]?.generation.promptVersion, 'v4.2');
  assert.equal(records[0]?.parentId, null);
});

test('malformed persisted records fail at the storage boundary', async () => {
  const records = await saved();
  assert.throws(() => readSavedCharacters([{}]));
  assert.throws(() => readSavedCharacters([{ ...records[0], image: { mime: 'text/html', base64: 'AAAA' } }]));
  assert.throws(() => readSavedCharacters([{ ...records[0], resolvedSelections: null }]));
  assert.throws(() => readSavedCharacters([{ ...records[0], generation: null }]));
});

test('versioned residents retain legacy PNG compatibility and reject unknown schemas', async () => {
  const records = await saved();
  assert.equal(records[0]?.schemaVersion, 2);
  const legacy = { ...records[0] }; delete legacy.schemaVersion;
  assert.equal(readSavedCharacters([legacy])[0]?.image.mime, 'image/png');
  assert.throws(() => readSavedCharacters([{ ...records[0], schemaVersion: 99 }]));
});
