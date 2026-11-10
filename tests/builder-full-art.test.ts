import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { test } from 'node:test';
import { catalogOptions, iconFor } from '../src/builder/curated.ts';
import { pickTile } from '../src/residents/pick-tile.ts';

const publicDir = new URL('../public/', import.meta.url);
const ICON_BUDGET = 40 * 1024;

for (const field of ['creature', 'personality', 'signatureDetail'] as const) {
  test(field + ': every catalog choice has a usable felt image', () => {
    for (const option of catalogOptions(field)) {
      const icon = iconFor(field, option.id);
      assert.ok(icon, field + ':' + option.id);
      assert.deepEqual(pickTile(field, option.id), { kind: 'image', src: icon, label: option.label });
      const file = new URL(icon, publicDir);
      assert.ok(existsSync(file), icon + ' exists');
      assert.ok(statSync(file).size <= ICON_BUDGET, icon + ' stays under 40 KiB');
    }
  });
}

test('unknown catalog ids stay text-only rather than requesting missing artwork', () => {
  for (const field of ['creature', 'personality', 'signatureDetail', 'palette'] as const) {
    assert.deepEqual(pickTile(field, 'retired-id'), { kind: 'text', label: 'retired-id' });
  }
});
