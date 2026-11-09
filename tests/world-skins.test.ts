import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

// Every skin dresses the same components through its own tokens. A theme block sets tokens only.
const SKINS = ['treehouse', 'coffee', 'beach'] as const;
const SKIN_TOKENS = ['--world-carved', '--skin-tag', '--capsule-disc', '--tray-base', '--tray-tuft'] as const;
const source = new URL('../src/', import.meta.url);
const css = readdirSync(source).filter(file => file.endsWith('.css')).map(file => readFileSync(new URL(file, source), 'utf8')).join('\n');

/** Every rule whose selector names the skin, as [selector, body]. Comments are dropped first. */
function rulesFor(skin: string): [string, string][] {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: [string, string][] = [];
  for (const match of plain.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (match[1]!.includes(`data-world-theme="${skin}"`)) rules.push([match[1]!.trim(), match[2]!]);
  }
  return rules;
}

/** The skin's token values, from blocks whose whole selector is the theme root. */
function tokensFor(skin: string): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const [selector, body] of rulesFor(skin)) {
    if (selector !== `:root[data-world-theme="${skin}"]`) continue;
    for (const match of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);?/g)) tokens.set(match[1]!, match[2]!.trim());
  }
  return tokens;
}

for (const skin of SKINS) {
  test(`${skin} sets its own frame, name tag, disc, tray base and tray motif tokens`, () => {
    const tokens = tokensFor(skin);
    for (const token of SKIN_TOKENS) assert.ok(tokens.has(token), `${skin} is missing ${token}`);
  });
}

/** A token's value with var() references to the same skin's own tokens filled in, so two skins pointing at their own --art-skin-corner differ. */
function resolved(skin: string, token: string): string | undefined {
  const tokens = tokensFor(skin);
  return tokens.get(token)?.replace(/var\((--[\w-]+)\)/g, (whole, name: string) => tokens.get(name) ?? whole);
}

test('no two skins share a tray base, tray motif or name tag colour', () => {
  for (const token of ['--tray-base', '--tray-tuft', '--skin-tag'] as const) {
    const values = SKINS.map(skin => resolved(skin, token));
    assert.equal(new Set(values).size, SKINS.length, `${token}: ${values.join(' | ')}`);
  }
});

// world-theme.test.ts checks the label ink against --world-tray and --world-tray-deep; that only holds if the tray is drawn from them.
const TRAY_PAINT = new Set(['--world-tray', '--world-tray-deep', '--world-grain', '--world-grain-angle']);
for (const skin of SKINS) {
  test(`${skin} draws its tray only from the contrast-checked tray tones, with the checked ink`, () => {
    const base = resolved(skin, '--tray-base')!;
    for (const [, name] of base.matchAll(/var\((--[\w-]+)\)/g)) assert.ok(TRAY_PAINT.has(name!), `${skin} --tray-base uses ${name}`);
    assert.doesNotMatch(base, /#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|oklch|lab)\(/i, `${skin} --tray-base has a literal colour`);
    assert.equal(tokensFor(skin).get('--tray-label-ink'), 'var(--world-tray-ink)');
  });
}

for (const skin of ['coffee', 'beach'] as const) {
  test(`${skin} never draws the Treehouse leaf art`, () => {
    for (const [selector, body] of rulesFor(skin)) assert.doesNotMatch(body, /--art-leaf|--world-leaf|--postcard-leaf/, selector);
  });
}
