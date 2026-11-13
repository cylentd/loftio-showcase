import assert from 'node:assert/strict';
import { test } from 'node:test';
import { arrivalPreview } from '../../src/residents/arrival-preview-mode.ts';

const table: Array<[string, string, 'local' | 'online' | 'mock', boolean]> = [
  ['parameter with mock mode is on', '?mode=mock&still&arrival', 'mock', true],
  ['parameter with a value in mock mode is on', '?arrival=1', 'mock', true],
  ['parameter with local mode is off', '?mode=local&arrival', 'local', false],
  ['parameter with online mode is off', '?arrival', 'online', false],
  ['no parameter in mock mode is off', '?mode=mock&still', 'mock', false],
  ['empty search is off', '', 'mock', false],
];

for (const [name, search, mode, expected] of table) {
  test(`arrivalPreview: ${name}`, () => {
    assert.equal(arrivalPreview(search, mode), expected);
  });
}
