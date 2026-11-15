import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publishRumble } from '../../build/rumble-release.mjs';

const gameRoot = fileURLToPath(new URL('../../', import.meta.url));
const tracks = ['plushie-bumper-rush', 'plush-arena-rumble', 'meadow-joyride'];

test('release packages every soundtrack byte for byte and lists each in its music config', async () => {
  const output = await mkdtemp(join(tmpdir(), 'rumble-tracks-'));
  try {
    await publishRumble(gameRoot, output);
    const config = await readFile(join(output, 'play/rumble/rumble-music-data.js'), 'utf8');
    for (const name of tracks) {
      const source = await readFile(join(gameRoot, `prototypes/loft-rumble/audio/${name}.mp3`));
      const packaged = await readFile(join(output, `play/rumble/audio/${name}.mp3`));
      assert.deepEqual(packaged, source, name);
      assert.ok(config.includes(`audio/${name}.mp3`), name);
    }
  } finally { await rm(output, { recursive: true, force: true }); }
});
