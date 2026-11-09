import assert from 'node:assert/strict';
import { test } from 'node:test';
import { builderMode, usesLocalWorker } from '../src/builder/local-mode.ts';

const HOST = 'worker.example.net';
const OTHER = 'loftio.example.com';

type Env = { workerHost?: string; mode?: string };
const table: Array<[string, string, string, Env, 'local' | 'online' | 'mock']> = [
  ['?mode=local beats everything', '?mode=local', OTHER, { workerHost: HOST, mode: 'online' }, 'local'],
  ['?mode=mock beats the worker host', '?mode=mock', HOST, { workerHost: HOST }, 'mock'],
  ['?mode=mock beats a build-time online mode', '?mode=mock', OTHER, { mode: 'online' }, 'mock'],
  ['the worker host is local', '', HOST, { workerHost: HOST }, 'local'],
  ['the worker host beats a build-time online mode', '', HOST, { workerHost: HOST, mode: 'online' }, 'local'],
  ['a build-time online mode on another host is online', '', OTHER, { workerHost: HOST, mode: 'online' }, 'online'],
  ['a build-time online mode with no worker host is online', '', OTHER, { mode: 'online' }, 'online'],
  ['no signal is mock', '', OTHER, { workerHost: HOST }, 'mock'],
  ['empty env is mock', '', '', {}, 'mock'],
  ['an empty worker host never matches an empty hostname', '', '', { workerHost: '' }, 'mock'],
  ['a build-time mode other than online is mock', '', OTHER, { mode: 'local' }, 'mock'],
  ['?mode=online is not a toggle', '?mode=online', OTHER, { workerHost: HOST }, 'mock'],
  ['?mode=online does not override the worker host', '?mode=online', HOST, { workerHost: HOST }, 'local'],
];

for (const [name, search, hostname, env, expected] of table) {
  test(`builderMode: ${name}`, () => {
    assert.equal(builderMode(search, hostname, env), expected);
  });
}

test('?mode=online with a build-time online mode is still decided by the build, so it is online', () => {
  assert.equal(builderMode('?mode=online', OTHER, { mode: 'online' }), 'online');
});

test('usesLocalWorker keeps its behaviour', () => {
  assert.equal(usesLocalWorker('', HOST, HOST), true);
  assert.equal(usesLocalWorker('?mode=mock', HOST, HOST), false);
  assert.equal(usesLocalWorker('', OTHER, HOST), false);
});
