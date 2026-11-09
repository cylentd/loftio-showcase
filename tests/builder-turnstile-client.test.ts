import assert from 'node:assert/strict';
import { test } from 'node:test';
import { turnstileTokens } from '../src/builder/turnstile-client.ts';
import { TURNSTILE_TIMEOUT_MS } from '../src/builder/constants.ts';

type Fake = { tag: string; listeners: Record<string, Array<() => void>>; children: unknown[]; src?: string;
  addEventListener(type: string, listener: () => void): void; append(child: unknown): void };

function element(tag: string): Fake {
  return { tag, listeners: {}, children: [],
    addEventListener(type, listener) { (this.listeners[type] ??= []).push(listener); },
    append(child) { this.children.push(child); } };
}

// A fake document and Turnstile widget: the test fires the script's load and the widget's callbacks itself.
function fakePage() {
  const win: { turnstile?: unknown } = {};
  const head = element('head');
  const body = element('body');
  const widget = {
    containers: [] as unknown[], options: {} as Record<string, any>, executes: 0, resets: 0,
    render(container: unknown, options: Record<string, unknown>) { this.containers.push(container); this.options = options; return 'widget-1'; },
    execute() { this.executes++; },
    reset() { this.resets++; },
  };
  const doc = { defaultView: win, head, body, createElement: element } as unknown as Document;
  const script = (index = head.children.length - 1) => head.children[index] as Fake;
  const load = (withWidget = true) => { if (withWidget) win.turnstile = widget; script().listeners.load!.forEach(fire => fire()); };
  const fail = () => script().listeners.error!.forEach(fire => fire());
  return { doc, head, body, widget, load, fail };
}

const tick = () => new Promise(resolve => setImmediate(resolve));

test('renders the widget once into the host it is given, runs it, and resolves the token', async () => {
  const page = fakePage();
  const host = element('div');
  const pending = turnstileTokens({ siteKey: 'site-1', doc: page.doc, host: () => host as unknown as HTMLElement })();
  page.load();
  await tick();
  assert.equal(page.widget.containers.length, 1);
  assert.deepEqual(host.children, page.widget.containers);
  assert.deepEqual(page.body.children, []);
  assert.equal(page.widget.options.sitekey, 'site-1');
  assert.equal(page.widget.executes, 1);
  page.widget.options.callback('token-1');
  assert.equal(await pending, 'token-1');
  assert.equal(page.widget.resets, 1);
});

test('without a host the widget goes on the page body', async () => {
  const page = fakePage();
  const pending = turnstileTokens({ siteKey: 'site-1', doc: page.doc })();
  page.load();
  await tick();
  assert.deepEqual(page.body.children, page.widget.containers);
  page.widget.options.callback('token-1');
  await pending;
});

test('the script loads once; every later token runs the same widget again', async () => {
  const page = fakePage();
  const get = turnstileTokens({ siteKey: 'site-1', doc: page.doc });
  const first = get();
  page.load();
  await tick();
  page.widget.options.callback('token-1');
  assert.equal(await first, 'token-1');
  const second = get();
  await tick();
  page.widget.options.callback('token-2');
  assert.equal(await second, 'token-2');
  assert.equal(page.head.children.length, 1);
  assert.equal(page.widget.containers.length, 1);
  assert.equal(page.widget.executes, 2);
  assert.equal(page.widget.resets, 2);
});

test('a widget error rejects, resets, and the next token still works', async () => {
  const page = fakePage();
  const get = turnstileTokens({ siteKey: 'site-1', doc: page.doc });
  const first = get();
  page.load();
  await tick();
  page.widget.options['error-callback']();
  await assert.rejects(first, /Turnstile failed/);
  assert.equal(page.widget.resets, 1);
  const second = get();
  await tick();
  page.widget.options.callback('token-2');
  assert.equal(await second, 'token-2');
});

test('a script that fails to load rejects, and the next call loads it again', async () => {
  const page = fakePage();
  const get = turnstileTokens({ siteKey: 'site-1', doc: page.doc });
  const first = get();
  page.fail();
  await assert.rejects(first, /script failed/);
  const second = get();
  assert.equal(page.head.children.length, 2);
  page.load();
  await tick();
  page.widget.options.callback('token-2');
  assert.equal(await second, 'token-2');
});

test('a script that loads without the Turnstile global rejects', async () => {
  const page = fakePage();
  const pending = turnstileTokens({ siteKey: 'site-1', doc: page.doc })();
  page.load(false);
  await assert.rejects(pending, /did not load/);
});

test('no answer within the timeout rejects and resets the widget', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const page = fakePage();
  const pending = turnstileTokens({ siteKey: 'site-1', doc: page.doc })();
  page.load();
  await tick();
  t.mock.timers.tick(TURNSTILE_TIMEOUT_MS - 1);
  await tick();
  assert.equal(page.widget.resets, 0);
  t.mock.timers.tick(1);
  await assert.rejects(pending, /timed out/);
  assert.equal(page.widget.resets, 1);
});
