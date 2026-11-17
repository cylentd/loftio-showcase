import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publishWorld } from '../../build/world-release.mjs';

const gameRoot = fileURLToPath(new URL('../../', import.meta.url));

test('release packages a local world without experiment artifacts', async () => {
  const output = await mkdtemp(join(tmpdir(), 'world-release-'));
  try {
    await publishWorld(gameRoot, output);
    const html = await readFile(join(output, 'play/valley/index.html'), 'utf8');
    assert.match(html, /data-published-world/);
    assert.match(html, /data-world-loading/);
    assert.doesNotMatch(html, /importmap|node_modules|localhost|loft-outside/);
    await access(join(output, 'play/valley/assets/residents/sprout-idle.png'));
    await access(join(output, 'play/valley/assets/residents/chomper-idle.png'));
    for (const track of ['music.mp3', 'path-through-the-glowing-grove.mp3', 'battle.mp3']) {
      assert.deepEqual(await readFile(join(output, 'play/valley', track)),
        await readFile(join(gameRoot, 'prototypes/loft-world', track)));
    }
    await assert.rejects(access(join(output, 'play/valley/captures')));
    await assert.rejects(access(join(output, 'play/valley/derive-residents.py')));
    await assert.rejects(access(join(output, 'play/valley/assets/residents/provenance.json')));
  } finally { await rm(output, { recursive: true, force: true }); }
});
