import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publishRumble, resolveRumbleRequest, rumbleDevMiddleware, rumbleRelease } from '../../build/rumble-release.mjs';

const gameRoot = fileURLToPath(new URL('../../', import.meta.url));
const manifest: string[] = JSON.parse(await readFile(join(gameRoot, 'build/rumble-files.json'), 'utf8'));
const ICON = '/play/rumble/art/rumble-app-icon.webp';

interface Reply { status: number; type: string | undefined; body: Buffer | string | undefined; nexted: boolean; error: unknown; ended: boolean }

async function request(url: string, method = 'GET', manifestFile?: string): Promise<Reply> {
  const reply: Reply = { status: 0, type: undefined, body: undefined, nexted: false, error: undefined, ended: false };
  const headers: Record<string, string> = {};
  const res = {
    statusCode: 200,
    setHeader(name: string, value: string) { headers[name.toLowerCase()] = value; },
    end(body?: Buffer | string) { reply.ended = true; reply.status = res.statusCode; reply.type = headers['content-type']; reply.body = body; },
  };
  await rumbleDevMiddleware(gameRoot, manifestFile)({ url, method }, res, (error?: unknown) => { reply.nexted = true; reply.error = error; });
  return reply;
}

test('dev server maps the Dock Play icon route to the file the build copies', async () => {
  const hit = resolveRumbleRequest(gameRoot, ICON);
  assert.ok(hit);
  assert.deepEqual(await readFile(hit.source), await readFile(join(gameRoot, 'prototypes/loft-rumble/art/rumble-app-icon.webp')));
});

test('dev server serves the icon as a webp image', async () => {
  const reply = await request(ICON + '?v=1');
  assert.equal(reply.status, 200);
  assert.equal(reply.type, 'image/webp');
  assert.deepEqual(reply.body, await readFile(join(gameRoot, 'prototypes/loft-rumble/art/rumble-app-icon.webp')));
});

test('dev server serves every manifest file and nothing the build would not copy', () => {
  for (const name of manifest) {
    const route = '/play/rumble/' + (name === 'loft-rumble-realtime.html' ? 'index.html' : name);
    assert.ok(resolveRumbleRequest(gameRoot, route), route);
  }
  assert.equal(resolveRumbleRequest(gameRoot, '/play/rumble/loft-rumble-realtime.html'), null);
});

test('dev server answers the bare Rumble route with its index page', async () => {
  const reply = await request('/play/rumble/');
  assert.equal(reply.status, 200);
  assert.equal(reply.type, 'text/html; charset=utf-8');
  assert.match(String(reply.body), /data-published-rumble/);
});

for (const [label, url] of [
  ['an unlisted file in the Rumble folder', '/play/rumble/check_rumble_demo.py'],
  ['an unlisted image beside listed ones', '/play/rumble/art/contact-sheet.png'],
  ['a dot-dot traversal', '/play/rumble/../../package.json'],
  ['an encoded dot-dot traversal', '/play/rumble/%2e%2e/%2e%2e/package.json'],
  ['an encoded slash traversal', '/play/rumble/art%2f..%2f..%2fpackage.json'],
  ['a backslash traversal', '/play/rumble/art\\..\\..\\package.json'],
  ['a null byte', '/play/rumble/art/rumble-app-icon.webp%00.png'],
  ['a malformed escape', '/play/rumble/%E0%A4%A'],
  ['a route outside the Rumble folder', '/play/other/art/rumble-app-icon.webp'],
  ['a prefix lookalike', '/play/rumble-extra/index.html'],
] as const) {
  test(`dev server refuses ${label}`, async () => {
    assert.equal(resolveRumbleRequest(gameRoot, url), null);
    const reply = await request(url);
    assert.equal(reply.nexted, true);
    assert.equal(reply.status, 0);
  });
}

test('dev server only answers GET and HEAD', async () => {
  const reply = await request(ICON, 'POST');
  assert.equal(reply.nexted, true);
  assert.equal(reply.status, 0);
});

test('dev server answers HEAD with the served status and headers and no body', async () => {
  const reply = await request(ICON, 'HEAD');
  assert.equal(reply.nexted, false);
  assert.equal(reply.ended, true);
  assert.equal(reply.status, 200);
  assert.equal(reply.type, 'image/webp');
  assert.equal(reply.body, undefined);
});

test('dev server passes a bad manifest to next(error) instead of rejecting', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'rumble-manifest-'));
  try {
    const bad = join(folder, 'rumble-files.json');
    await writeFile(bad, JSON.stringify(['../outside.html']));
    const reply = await request(ICON, 'GET', bad);
    assert.equal(reply.nexted, true);
    assert.equal(reply.ended, false);
    assert.ok(reply.error instanceof Error);
    assert.match((reply.error as Error).message, /^Unsafe Rumble runtime path: \.\.\/outside\.html$/);
  } finally { await rm(folder, { recursive: true, force: true }); }
});

test('dev server bytes equal the published bytes, rewrites included', async () => {
  const output = await mkdtemp(join(tmpdir(), 'rumble-dev-'));
  try {
    await publishRumble(gameRoot, output);
    for (const route of ['index.html', 'art-theme.css', 'tokens.css', 'shared-tokens.css', 'nunito-latin.woff2', 'art/rumble-logo.webp']) {
      const reply = await request('/play/rumble/' + route);
      assert.equal(reply.status, 200, route);
      assert.deepEqual(Buffer.from(reply.body ?? ''), await readFile(join(output, 'play/rumble', route)), route);
    }
  } finally { await rm(output, { recursive: true, force: true }); }
});

test('the plugin registers the dev middleware on the dev server', () => {
  const used: unknown[] = [];
  const plugin = rumbleRelease() as unknown as { configureServer(server: { middlewares: { use(fn: unknown): void } }): void };
  plugin.configureServer({ middlewares: { use: (fn) => used.push(fn) } });
  assert.equal(used.length, 1);
  assert.equal(typeof used[0], 'function');
});
