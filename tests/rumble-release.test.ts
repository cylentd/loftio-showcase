import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publishRumble } from '../build/rumble-release.mjs';

const gameRoot = fileURLToPath(new URL('../', import.meta.url));

test('release packages a directly playable Rumble route without experiment artifacts', async () => {
  const output = await mkdtemp(join(tmpdir(), 'rumble-release-'));
  try {
    await publishRumble(gameRoot, output);
    assert.equal(await access(join(output, 'play/rumble/index.html')).then(() => true, () => false), true);
    const html = await readFile(join(output, 'play/rumble/index.html'), 'utf8');
    assert.match(html, /data-published-rumble/);
    assert.match(html, /rumble-demo.js/);
    assert.doesNotMatch(html, /loft-rumble.html/);
    await assert.rejects(access(join(output, 'play/rumble/check_rumble_demo.py')));
    await assert.rejects(access(join(output, 'play/rumble/art/contact-sheet.png')));
  } finally { await rm(output, { recursive: true, force: true }); }
});

test('published styles resolve their shared tokens and fonts inside the route', async () => {
  const output = await mkdtemp(join(tmpdir(), 'rumble-style-'));
  try {
    await publishRumble(gameRoot, output);
    const theme = await readFile(join(output, 'play/rumble/art-theme.css'), 'utf8');
    const tokens = await readFile(join(output, 'play/rumble/tokens.css'), 'utf8');
    assert.ok(theme.includes('"./tokens.css"'));
    assert.ok(theme.includes("'./nunito-latin.woff2'"));
    assert.ok(tokens.includes('"./shared-tokens.css"'));
    await access(join(output, 'play/rumble/nunito-latin.woff2'));
    await access(join(output, 'play/rumble/shared-tokens.css'));
  } finally { await rm(output, { recursive: true, force: true }); }
});
