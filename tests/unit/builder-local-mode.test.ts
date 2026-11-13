import assert from 'node:assert/strict';
import { test } from 'node:test';
import { usesLocalWorker } from '../../src/builder/local-mode.ts';

const HOST = 'worker.example.net';

test('the configured worker host defaults to the local worker', () => {
  assert.equal(usesLocalWorker('', HOST, HOST), true);
});

test('an explicit mode overrides the host', () => {
  assert.equal(usesLocalWorker('?mode=mock', HOST, HOST), false);
  assert.equal(usesLocalWorker('?mode=local', 'loftio.example.com', HOST), true);
});

test('any other host, or no configured host, uses mock mode', () => {
  assert.equal(usesLocalWorker('', 'loftio.example.com', HOST), false);
  assert.equal(usesLocalWorker('', HOST, undefined), false);
  assert.equal(usesLocalWorker('', '', ''), false);
});
